import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import seedrandom from 'seedrandom';

export default function Room() {
  const router = useRouter();
  const { id } = router.query;
  const rows = 5;
  const cols = 5;
  const totalTiles = rows * cols;

  const [heartIndex, setHeartIndex] = useState(null);
  const [flipped, setFlipped] = useState(Array(totalTiles).fill(false));
  const [found, setFound] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!id) return;
    const rng = seedrandom(id);
    const index = Math.floor(rng() * totalTiles);
    setHeartIndex(index);
    const newStart = Date.now();
    setStartTime(newStart);
    const interval = setInterval(() => {
      setElapsed(Date.now() - newStart);
    }, 500);
    return () => clearInterval(interval);
  }, [id]);

  const handleClick = i => {
    if (found || flipped[i]) return;
    const newFlipped = [...flipped];
    newFlipped[i] = true;
    setFlipped(newFlipped);
    if (i === heartIndex) {
      setFound(true);
      setElapsed(Date.now() - startTime);
    }
  };

  const formatTime = ms => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const resetGame = () => {
    setFlipped(Array(totalTiles).fill(false));
    setFound(false);
    const newStart = Date.now();
    setStartTime(newStart);
    setElapsed(0);
  };

  return id ? (
    <div className="container">
      <h1>Sala: {id}</h1>
      <div className="status">
        <div>Tiempo: {formatTime(elapsed)}</div>
        <div className="message">
          {found ? `¡La encontraste en ${formatTime(elapsed)}!` : ''}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
      <button onClick={resetGame}>Reiniciar</button>
      <style jsx>{`
        .container { display: flex; flex-direction: column; align-items: center; padding: 20px; }
        h1 { color: #d6336c; }
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
  ) : (
    <p>Cargando...</p>
  );
}
