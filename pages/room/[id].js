import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Room() {
  const router = useRouter();
  const { id, username } = router.query;
  const rows = 5;
  const cols = 5;
  const totalTiles = rows * cols;

  const [roomData, setRoomData] = useState(null);
  const [heartIndex, setHeartIndex] = useState(null);
  const [found, setFound] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    if (!id || !username) return;
    const roomRef = doc(db, "rooms", id);

    // Listen for live updates in room data
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (!docSnap.exists()) {
        alert("Room was deleted");
        router.push('/');
        return;
      }
      const data = docSnap.data();
      setRoomData(data);

      // Initialize gameState if not set
      if (!data.gameState) {
        // randomly assign heart index
        const randomIndex = Math.floor(Math.random() * totalTiles);
        updateDoc(roomRef, {
          gameState: {
            flipped: Array(totalTiles).fill(false),
            heartIndex: randomIndex,
            found: false,
            startTime: Date.now(),
          }
        });
        setHeartIndex(randomIndex);
        setFound(false);
        setElapsed(0);
        setStartTime(Date.now());
      } else {
        setHeartIndex(data.gameState.heartIndex);
        setFound(data.gameState.found);
        setElapsed(Date.now() - data.gameState.startTime);
        setStartTime(data.gameState.startTime);
      }
    });

    return () => unsubscribe();
  }, [id, username]);

  useEffect(() => {
    if (!startTime || found) return;
    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 500);
    return () => clearInterval(timer);
  }, [startTime, found]);

  const handleClick = async (i) => {
    if (found || roomData?.gameState?.flipped[i]) return;

    const roomRef = doc(db, "rooms", id);
    const newFlipped = [...roomData.gameState.flipped];
    newFlipped[i] = true;

    const foundHeart = i === heartIndex;

    await updateDoc(roomRef, {
      "gameState.flipped": newFlipped,
      "gameState.found": foundHeart ? true : roomData.gameState.found,
      "gameState.foundBy": foundHeart ? username : roomData.gameState.foundBy,
      "gameState.elapsed": foundHeart ? Date.now() - startTime : roomData.gameState.elapsed,
    });
  };

  const formatTime = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const resetGame = async () => {
    const roomRef = doc(db, "rooms", id);
    const randomIndex = Math.floor(Math.random() * totalTiles);
    await updateDoc(roomRef, {
      gameState: {
        flipped: Array(totalTiles).fill(false),
        heartIndex: randomIndex,
        found: false,
        startTime: Date.now(),
        foundBy: null,
        elapsed: 0,
      }
    });
  };

  if (!roomData) return <p>Cargando...</p>;

  return (
    <div className="container">
      <h1>Sala: {id}</h1>
      <h2>Jugadores:</h2>
      <ul>
        {roomData.players?.map(p => <li key={p.id}>{p.id}</li>)}
      </ul>
      <div className="status">
        <div>Tiempo: {formatTime(elapsed)}</div>
        <div className="message">
          {found ? `¡La encontró ${roomData.gameState.foundBy} en ${formatTime(elapsed)}!` : ''}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: totalTiles }).map((_, i) => (
          <div
            key={i}
            className={`tile ${roomData.gameState.flipped[i] ? 'flipped' : ''}`}
            onClick={() => handleClick(i)}
          >
            <div className="front">❓</div>
            <div className="back">{i === heartIndex ? '❤️' : '❌'}</div>
          </div>
        ))}
      </div>
      <button onClick={resetGame}>Reiniciar</button>

      <style jsx>{`
        .container { display: flex; flex-direction: column; align-items: center; padding: 20px; }
        h1 { color: #d6336c; }
        ul { list-style: none; padding: 0; }
        li { font-weight: bold; color: #b30059; }
        .status { margin: 10px; font-size: 1.2rem; }
        .message { margin-top: 5px; color: #b30059; }
        .grid { display: grid; gap: 8px; width: 100%; max-width: 400px; }
        .tile { position: relative; width: 60px; height: 60px; background: #ffe6f2; border-radius: 10px; cursor: pointer; transform-style: preserve-3d; transition: transform 0.4s; display: flex; align-items: center; justify-content: center; margin: auto; }
        .tile.flipped { transform: rotateY(180deg); cursor: default; }
        .front, .back { position: absolute; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; backface-visibility: hidden; border-radius: 10px; font-size: 1.5rem;}
        .front { background: #fff; color: #4a0a35; }
        .back { background: #d6336c; color: #fff; transform: rotateY(180deg); }
        button { margin-top: 15px; padding: 8px 18px; background: #d6336c; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
      `}</style>
    </div>
  );
}
