import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ref, onValue, set, update } from 'firebase/database';
import { db } from '../../lib/firebase';

export default function Room() {
  const router = useRouter();
  const { id } = router.query;
  const user = router.query.user || 'guest';

  const rows = 5;
  const cols = 5;
  const totalTiles = rows * cols;

  const [players, setPlayers] = useState({});
  const [flipped, setFlipped] = useState(Array(totalTiles).fill(false));
  const [heartIndex, setHeartIndex] = useState(null);
  const [found, setFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Listen for players joining
    const playersRef = ref(db, `rooms/${id}/players`);
    onValue(playersRef, snapshot => {
      setPlayers(snapshot.val() || {});
    });

    // Set heart index once (if not set)
    const heartRef = ref(db, `rooms/${id}/heartIndex`);
    onValue(heartRef, snapshot => {
      if (snapshot.exists()) {
        setHeartIndex(snapshot.val());
      } else {
        const index = Math.floor(Math.random() * totalTiles);
        setHeartIndex(index);
        set(heartRef, index);
      }
    });

    // Listen for flipped tiles
    const flippedRef = ref(db, `rooms/${id}/flipped`);
    onValue(flippedRef, snapshot => {
      setFlipped(snapshot.val() || Array(totalTiles).fill(false));
    });

    // Listen for found state
    const foundRef = ref(db, `rooms/${id}/found`);
    onValue(foundRef, snapshot => {
      setFound(snapshot.val() || false);
    });

  }, [id]);

  const handleClick = (i) => {
    if (found || flipped[i]) return;
    const newFlipped = [...flipped];
    newFlipped[i] = true;
    set(ref(db, `rooms/${id}/flipped`), newFlipped);
    if (i === heartIndex) {
      set(ref(db, `rooms/${id}/found`), true);
    }
  };

  return id ? (
    <div>
      <h1>Room: {id}</h1>
      <h3>Players:</h3>
      <ul>
        {Object.keys(players).map(name => (
          <li key={name}>{name}</li>
        ))}
      </ul>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 60px)`, gap: '8px' }}>
        {Array.from({ length: totalTiles }).map((_, i) => (
          <div
            key={i}
            onClick={() => handleClick(i)}
            style={{
              width: 60,
              height: 60,
              backgroundColor: flipped[i] ? (i === heartIndex ? 'red' : 'gray') : 'pink',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: flipped[i] ? 'default' : 'pointer',
              borderRadius: '10px'
            }}
          >
            {flipped[i] ? (i === heartIndex ? '❤️' : '❌') : '❓'}
          </div>
        ))}
      </div>

      {found && <h2>¡La encontraste!</h2>}
    </div>
  ) : <p>Loading...</p>;
}
