// TEST LINE - MARS
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [room, setRoom] = useState('');
  const router = useRouter();

  const createRoom = () => {
    const randomId = Math.random().toString(36).substring(2,8);
    router.push(`/room/${randomId}`);
  };

  const joinRoom = () => {
    if(room.trim()) router.push(`/room/${room.trim()}`);
  };

  return (
    <div className="container">
      <h1>Encuentra el Corazón Online 💖</h1>
      <button onClick={createRoom}>Crear Nueva Sala</button>
      <div>
        <input placeholder="ID de Sala" value={room} onChange={e => setRoom(e.target.value)} />
        <button onClick={joinRoom}>Unirse a Sala</button>
      </div>
      <p>Comparte el ID de la sala con tu novia y compitan para ver quién la encuentra más rápido.</p>
      <style jsx>{`
        .container { display:flex; flex-direction:column; align-items:center; margin-top:50px; }
        button { margin:8px; padding:10px 20px; background:#d6336c; color:#fff; border:none; border-radius:6px; cursor:pointer; }
        input { padding:8px; border-radius:4px; border:1px solid #ccc; margin-right:8px;}
      `}</style>
    </div>
  );
}
