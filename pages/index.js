import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [room, setRoom] = useState("");
  const [username, setUsername] = useState("");
  const router = useRouter();

  const createRoom = () => {
    if (!username.trim()) {
      alert("Please enter your username");
      return;
    }
    const randomId = Math.random().toString(36).substring(2, 8);
    router.push(`/room/${randomId}?username=${encodeURIComponent(username.trim())}`);
  };

  const joinRoom = () => {
    if (!username.trim()) {
      alert("Please enter your username");
      return;
    }
    if (room.trim()) {
      router.push(`/room/${room.trim()}?username=${encodeURIComponent(username.trim())}`);
    }
  };

  return (
    <div className="container">
      <h1>Encuentra el Corazón Online 💖</h1>

      <input
        placeholder="Your username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ marginBottom: "12px", padding: "8px", borderRadius: "4px", width: "200px" }}
      />

      <button onClick={createRoom}>Crear Nueva Sala</button>

      <div style={{ marginTop: "16px" }}>
        <input
          placeholder="ID de Sala"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          style={{ padding: "8px", borderRadius: "4px", marginRight: "8px" }}
        />
        <button onClick={joinRoom}>Unirse a Sala</button>
      </div>

      <p>Comparte el ID de la sala con tu novia y compitan para ver quién la encuentra más rápido.</p>

      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 50px;
        }
        button {
          margin: 8px;
          padding: 10px 20px;
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
