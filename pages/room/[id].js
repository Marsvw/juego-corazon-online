import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../lib/firebase';

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

  useEffect(() => {
    if (!id) return;

    // Listen for room data updates
    const roomRef = ref(db, `rooms/${id}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.heartIndex !== undefined) setHeartIndex(data.heartIndex);
      if (data.flipped) setFlipped(data.flipped);
      if (data.found !== undefined) setFound(data.found);
      if (data.players) setPlayers(data.players);
      if (data.startTime) setStartTime(data.startTime);
      if (data.elapsed) setElapsed(data.elapsed);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (found) return; // stop timer if found

    if (!startTime) {
      const now = Date.now();
      update(ref(db, `rooms/${id}`), { startTime: now });
      setStartTime(now);
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedTime = now - startTime;
      setElapsed(elapsedTime);
      update(ref(db, `rooms/${id}`), { elapsed: elapsedTime });
    }, 500);

    return () => clearInterval(interval);
  }, [id, startTime, found]);

  const handleClick = (index) => {
    if (found || flipped[index]) return;

    const newFlipped = [...flipped];
    newFlipped[index] = true;

    update(ref(db, `rooms/${id}`), {
      flipped: newFlipped,
    });

    if (index === heartIndex) {
      update(ref(db, `rooms/${id}`), {
        found: true,
        elapsed,
        winner: user,
      });
      setFound(true);
    }
  };

  const resetGame = () => {
    const newFlipped = Array(totalTiles).fill(false);
    const now = Date.now();
    update(ref(db, `rooms/${id}`), {
      flipped: newFlipped,
      found: false,
      elapsed: 0,
      startTime: now,
      winner: null,
    });
    setFound(false);
    setElapsed(0);
    setStartTime(now);
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
      <h1>Room: {id}</h1>
      <p>Player: {user}</p>
      <div className="players-list">
        <h3>Players in room:</h3>
        <ul>
          {players && Object.values(players).map((p) => (
            <li key={p.username}>{p.username}</li>
          ))}
        </ul>
      </div>
      <div className="status">
        <div>Time: {formatTime(elapsed)}</div>
        <div className="message">
          {found ? `❤️ Found by ${players?.winner || 'someone'} in ${formatTime(elapsed)}!` : ''}
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
            <div className="front">❓</div>
            <div className="back">{i === heartIndex ? '❤️' : '❌'}</div>
          </div>
        ))}
      </div>
      <button onClick={resetGame}>Reset</button>
      <style jsx>{`
        .container {
          display: flex; flex-direction: column; align-items: center; padding: 20px;
        }
        h1 { color: #d6336c; }
        .players-list { margin-bottom: 10px; }
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
      `}</style>
    </div>
  );
}
