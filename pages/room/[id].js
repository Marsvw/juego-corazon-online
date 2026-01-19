import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { ref, onValue, update, onDisconnect, serverTimestamp } from 'firebase/database';
import { db, onConnectionChange, withRetry, isFirebaseReady } from '../../lib/firebase';

export default function Room() {
  const router = useRouter();
  const { id, user } = router.query;
  const rows = 5;
  const cols = 5;
  const totalTiles = rows * cols;

  const [heartIndex, setHeartIndex] = useState(null);
  const [flipped, setFlipped] = useState(Array(totalTiles).fill(false));
  const [found, setFound] = useState(false);
  const [players, setPlayers] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Refs for timer management
  const localStartTimeRef = useRef(null);
  const lastSyncedElapsedRef = useRef(0);
  const syncTimeoutRef = useRef(null);

  // Safe update function with error handling and retry
  const safeUpdate = useCallback(async (path, data, options = {}) => {
    const { retries = 3, showSyncIndicator = true } = options;

    if (!isFirebaseReady()) {
      setConnectionError('Firebase not initialized. Please refresh the page.');
      return false;
    }

    if (showSyncIndicator) {
      setIsSyncing(true);
    }

    try {
      await withRetry(async () => {
        await update(ref(db, path), data);
      }, retries);

      setConnectionError(null);
      return true;
    } catch (error) {
      console.error('Failed to sync data:', error);
      setConnectionError(`Sync failed: ${error.message}. Check your connection.`);
      return false;
    } finally {
      if (showSyncIndicator) {
        setIsSyncing(false);
      }
    }
  }, []);

  // Debounced elapsed time sync - reduces network traffic significantly
  const syncElapsedTime = useCallback((elapsedTime) => {
    // Clear any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Only sync if significant time has passed (5 seconds) or game just started
    const timeSinceLastSync = elapsedTime - lastSyncedElapsedRef.current;
    if (timeSinceLastSync >= 5000 || lastSyncedElapsedRef.current === 0) {
      lastSyncedElapsedRef.current = elapsedTime;
      safeUpdate(`rooms/${id}`, { elapsed: elapsedTime }, { showSyncIndicator: false, retries: 1 });
    }
  }, [id, safeUpdate]);

  // Connection state monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unsubscribe = onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setConnectionError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Set up disconnect handlers for player cleanup
  useEffect(() => {
    if (!id || !user || !isFirebaseReady()) return;

    const playerRef = ref(db, `rooms/${id}/players/${user}`);
    const presenceRef = ref(db, `rooms/${id}/players/${user}/online`);

    // Set up onDisconnect handler to clean up when player leaves
    const disconnectRef = onDisconnect(presenceRef);
    disconnectRef.set(false).catch((error) => {
      console.warn('Failed to set up disconnect handler:', error);
    });

    // Mark player as online
    update(playerRef, { online: true, lastSeen: Date.now() }).catch((error) => {
      console.warn('Failed to update player presence:', error);
    });

    return () => {
      // Cancel disconnect handler if component unmounts normally
      disconnectRef.cancel().catch(() => {});
    };
  }, [id, user]);

  // Listen for room data updates with error handling
  useEffect(() => {
    if (!id) return;

    if (!isFirebaseReady()) {
      setConnectionError('Firebase not initialized. Please refresh the page.');
      return;
    }

    const roomRef = ref(db, `rooms/${id}`);

    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.heartIndex !== undefined) setHeartIndex(data.heartIndex);
        if (data.flipped) setFlipped(data.flipped);
        if (data.found !== undefined) setFound(data.found);
        if (data.players) setPlayers(data.players);
        if (data.startTime) {
          setStartTime(data.startTime);
          localStartTimeRef.current = data.startTime;
        }
        // Only update elapsed from server if local is behind
        if (data.elapsed && data.elapsed > elapsed) {
          setElapsed(data.elapsed);
          lastSyncedElapsedRef.current = data.elapsed;
        }

        setConnectionError(null);
      },
      (error) => {
        console.error('Room listener error:', error);
        setConnectionError(`Connection lost: ${error.message}. Retrying...`);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Local timer - updates locally frequently but syncs to server less often
  useEffect(() => {
    if (!id) return;
    if (found) return;

    // Initialize start time if not set
    if (!startTime && !localStartTimeRef.current) {
      const now = Date.now();
      localStartTimeRef.current = now;
      setStartTime(now);
      safeUpdate(`rooms/${id}`, { startTime: now });
    }

    // Update local elapsed time every 100ms for smooth UI
    const interval = setInterval(() => {
      if (localStartTimeRef.current) {
        const now = Date.now();
        const elapsedTime = now - localStartTimeRef.current;
        setElapsed(elapsedTime);

        // Sync to server less frequently (handled by syncElapsedTime)
        syncElapsedTime(elapsedTime);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [id, startTime, found, safeUpdate, syncElapsedTime]);

  const handleClick = async (index) => {
    if (found || flipped[index]) return;

    // Optimistic update for smooth UX
    const newFlipped = [...flipped];
    newFlipped[index] = true;
    setFlipped(newFlipped);

    const success = await safeUpdate(`rooms/${id}`, {
      flipped: newFlipped,
    });

    if (!success) {
      // Revert optimistic update on failure
      setFlipped(flipped);
      return;
    }

    if (index === heartIndex) {
      setFound(true);
      await safeUpdate(`rooms/${id}`, {
        found: true,
        elapsed,
        winner: user,
      });
    }
  };

  const resetGame = async () => {
    const newFlipped = Array(totalTiles).fill(false);
    const now = Date.now();

    // Reset local state
    setFlipped(newFlipped);
    setFound(false);
    setElapsed(0);
    setStartTime(now);
    localStartTimeRef.current = now;
    lastSyncedElapsedRef.current = 0;

    await safeUpdate(`rooms/${id}`, {
      flipped: newFlipped,
      found: false,
      elapsed: 0,
      startTime: now,
      winner: null,
    });
  };

  const formatTime = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  if (!id || !user) return <p>Loading...</p>;

  return (
    <div className="container">
      {/* Connection status indicator */}
      {(!isConnected || connectionError) && (
        <div className="connection-warning">
          {connectionError || 'Connection lost. Reconnecting...'}
        </div>
      )}
      {isSyncing && <div className="sync-indicator">Syncing...</div>}

      <h1>Room: {id}</h1>
      <p>Player: {user}</p>
      <div className="players-list">
        <h3>Players in room:</h3>
        <ul>
          {players && Object.values(players).map((p) => (
            <li key={p.username} className={p.online === false ? 'offline' : ''}>
              {p.username} {p.online === false && '(offline)'}
            </li>
          ))}
        </ul>
      </div>
      <div className="status">
        <div>Time: {formatTime(elapsed)}</div>
        <div className="message">
          {found ? `Found by ${players?.winner || user || 'someone'} in ${formatTime(elapsed)}!` : ''}
        </div>
      </div>
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: totalTiles }).map((_, i) => (
          <div
            key={i}
            className={`tile ${flipped[i] ? 'flipped' : ''}`}
            onClick={() => handleClick(i)}
          >
            <div className="front">?</div>
            <div className="back">{i === heartIndex ? '<3' : 'X'}</div>
          </div>
        ))}
      </div>
      <button onClick={resetGame} disabled={isSyncing}>Reset</button>
      <style jsx>{`
        .container {
          display: flex; flex-direction: column; align-items: center; padding: 20px;
        }
        .connection-warning {
          background: #ff6b6b;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          margin-bottom: 10px;
          font-weight: bold;
          animation: pulse 2s infinite;
        }
        .sync-indicator {
          background: #4dabf7;
          color: white;
          padding: 5px 15px;
          border-radius: 4px;
          font-size: 0.8rem;
          margin-bottom: 5px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        h1 { color: #d6336c; }
        .players-list { margin-bottom: 10px; }
        .players-list .offline { color: #888; font-style: italic; }
        .status { margin: 10px; font-size: 1.2rem; }
        .message { margin-top: 5px; color: #b30059; }
        .grid {
          display: grid; gap: 8px; width: 100%; max-width: 400px;
        }
        .tile {
          position: relative;
          width: 60px; height: 60px;
          background: #ffe6f2;
          border-radius: 10px;
          cursor: pointer;
          transform-style: preserve-3d;
          transition: transform 0.4s;
          display: flex; align-items: center; justify-content: center;
          margin: auto;
        }
        .tile.flipped {
          transform: rotateY(180deg);
          cursor: default;
        }
        .front, .back {
          position: absolute;
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          backface-visibility: hidden;
          border-radius: 10px;
          font-size: 1.5rem;
        }
        .front {
          background: #fff;
          color: #4a0a35;
        }
        .back {
          background: #d6336c;
          color: #fff;
          transform: rotateY(180deg);
        }
        button {
          margin-top: 15px;
          padding: 8px 18px;
          background: #d6336c;
          color: #fff;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
