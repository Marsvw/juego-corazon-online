import { useState } from 'react';
import { useRouter } from 'next/router';
import { ref, set } from 'firebase/database';
import { db } from '../lib/firebase';

export default function Home() {
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  const createRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    const randomId = Math.random().toString(36).substring(2, 8);
    // Save user to room in Firebase
    set(ref(db, `rooms/${randomId}/players/${username}`), { username });
    router.push(`/room/${randomId}?user=${username}`);
  };

  const joinRoom = () => {
    if (!username.trim() || !room.trim()) {
      alert('Please enter username and room ID');
      return;
    }
    // Save user to room in Firebase
    set(ref(db, `rooms/${room.trim()}/players/${username}`), { username });
    router.push(`/room/${room.trim()}?user=${username}`);
  };

  return (
    <div className="container">
      <h1>Encuentra el Corazón Online 💖</h1>
      <input
        placeholder="Your username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />
      <button onClick={createRoom}>Crear Nueva Sala</button>
      <div>
        <input
          placeholder="ID de Sala"
          value={room}
          onChange={e => setRoom(e.target.value)}
        />
        <button onClick={joinRoom}>Unirse a Sala</button>
      </div>
    </div>
  );
}
