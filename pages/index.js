import { useState } from 'react';
import { useRouter } from 'next/router';
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from '../lib/firebase';

export default function Home() {
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  const createRoom = async () => {
    if (!username.trim()) return alert("Please enter your username");
    const randomId = Math.random().toString(36).substring(2,8);
    await setDoc(doc(db, "rooms", randomId), {
      players: [{ id: username.trim() }],
      gameState: null,
    });
    router.push(`/room/${randomId}?username=${username.trim()}`);
  };

  const joinRoom = async () => {
    if (!room.trim() || !username.trim()) return alert("Please enter room and username");
    const roomRef = doc(db, "rooms", room.trim());
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return alert("Room does not exist");
    const roomData = roomSnap.data();

    // Add player if less than 2 players
    if (roomData.players.length >= 2) {
      return alert("Room is full");
    }
    await setDoc(roomRef, {
      ...roomData,
      players: [...roomData.players, { id: username.trim() }]
    });
    router.push(`/room/${room.trim()}?username=${username.trim()}`);
  };

  return (
    <div className="container">
      <h1>Encuentra el Corazón Online 💖</h1>
      <input placeholder="Your username" value={username} onChange={e => setUsername(e.target.value)} />
      <button onClick={createRoom}>Crear Nueva Sala</button>
      <div>
        <input placeholder="ID de Sala" value={room} onChange={e => setRoom(e.target.value)} />
        <button onClick={joinRoom}>Unirse a Sala</button>
      </div>
      <p>Comparte el ID de la sala con tu novia y compitan para ver quién la encuentra más rápido.</p>
      <style jsx>{`
        .container { display:flex; flex-direction:column; align-items:center; margin-top:50px; }
        input { margin: 8px; padding: 8px; border-radius:4px; border:1px solid #ccc; }
        button { margin:8px; padding:10px 20px; background:#d6336c; color:#fff; border:none; border-radius:6px; cursor:pointer; }
      `}</style>
    </div>
  );
}
