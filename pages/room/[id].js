import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import seedrandom from "seedrandom";
import { database } from "../../lib/firebase";
import {
  ref,
  onValue,
  set,
  update,
  off,
  onChildAdded,
  push,
  remove,
} from "firebase/database";

export default function Room() {
  const router = useRouter();
  const { id, username } = router.query;
  const rows = 5;
  const cols = 5;
  const totalTiles = rows * cols;

  // Firebase paths
  const roomRef = id ? ref(database, `rooms/${id}`) : null;
  const playersRef = id ? ref(database, `rooms/${id}/players`) : null;

  // State
  const [heartIndex, setHeartIndex] = useState(null);
  const [flipped, setFlipped] = useState(Array(totalTiles).fill(false));
  const [found, setFound] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [players, setPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);

  // Setup Firebase listeners
  useEffect(() => {
    if (!id || !username) return;

    // Generate heart index using seeded RNG, only if not set in DB yet
    const rng = seedrandom(id);
    const initialHeartIndex = Math.floor(rng() * totalTiles);

    // Listen for room data
    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHeartIndex(data.heartIndex ?? initialHeartIndex);
        setFlipped(data.flipped ?? Array(totalTiles).fill(false));
        setFound(data.found ?? false);
        setStartTime(data.startTime ?? Date.now());
        setElapsed(data.elapsed ?? 0);
      } else {
        // Initialize room if none exists
        set(roomRef, {
          heartIndex: initialHeartIndex,
          flipped: Array(totalTiles).fill(false),
          found: false,
          startTime: Date.now(),
          elapsed: 0,
        });
      }
    });

    // Listen for players list
    onValue(playersRef, (snapshot) => {
      const playersData = snapshot.val() || {};
      const playersArr = Object.entries(playersData).map(([key, val]) => ({
        id: key,
        username: val.username,
      }));
      setPlayers(playersArr);
    });

    // Add current player to players list
    const newPlayerRef = push(playersRef);
    set(newPlayerRef, { username });
    setMyPlayerId(newPlayerRef.key);

    // Cleanup on unmount - remove player
    return () => {
      if (newPlayerRef && newPlayerRef.key) {
        remove(ref(database, `rooms/${id}/players/${newPlayerRef.key}`));
      }
      off(roomRef);
      off(playersRef);
    };
  }, [id, username]);

  // Timer update - update elapsed every 500ms if game not found yet
  useEffect(() => {
    if (!startTime || found) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
      update(roomRef, { elapsed: Date.now() - startTime });
    }, 500);
    return () => clearInterval(interval);
  }, [startTime, found]);

  const handleClick = (i) => {
    if (found || flipped[i]) return;
    const newFlipped = [...flipped];
    newFlipped[i] = true;

    setFlipped(newFlipped);
    update(roomRef, { flipped: newFlipped });

    if (i === heartIndex) {
      setFound(true);
      const finalTime = Date.now() - startTime;
      setElapsed(finalTime);
      update(roomRef, { found: true, elapsed: finalTime });
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const resetGame = () => {
    setFlipped(Array(totalTiles).fill(false));
    setFound(false);
    const newStart = Date.now();
    setStartTime(newStart);
    setElapsed(0);
    update(roomRef, {
      flipped: Array(totalTiles).fill(false),
      found: false,
      startTime: newStart,
      elapsed: 0,
    });
  };

  if (!id || !username)
    return <p style={{ padding: "20px" }}>Loading... Please enter a username.</p>;

  return (
    <div className="container">
      <h1>Sala: {id}</h1>
      <div>
        <b>Jugadores en la sala:</b>
        <ul>
          {players.map((p) => (
            <li key={p.id}>{p.username}</li>
          ))}
        </ul>
      </div>

      <div className="status">
        <div>Tiempo: {formatTime(elapsed)}</div>
        <div className="message">{found ? `¡La encontraste en ${formatTime(elapsed)}!` : ""}</div>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: totalTiles }).map((_, i) => (
          <div
            key={i}
            className={`tile ${flipped[i] ? "flipped" : ""}`}
            onClick={() => handleClick(i)}
          >
            <div className="front">❓</div>
            <div className="back">{i === heartIndex ? "❤️" : "❌"}</div>
          </div>
        ))}
      </div>

      <button onClick={resetGame}>Reiniciar</button>

      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
        }
        h1 {
          color: #d6336c;
        }
        .status {
          margin: 10px;
          font-size: 1.2rem;
        }
        .message {
          margin-top: 5px;
          color: #b30059;
        }
        .grid {
          display: grid;
          gap: 8px;
          width: 100%;
          max-width: 400px;
        }
        .tile {
          position: relative;
          width: 60px;
          height: 60px;
          background: #ffe6f2;
          border-radius: 10px;
          cursor: pointer;
          transform-style: preserve-3d;
          transition: transform 0.4s;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: auto;
        }
        .tile.flipped {
          transform: rotateY(180deg);
          cursor: default;
        }
        .front,
        .back {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
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
