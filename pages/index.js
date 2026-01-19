import { useState } from 'react';
import { useRouter } from 'next/router';
import { ref, set } from 'firebase/database';
import { db, withRetry, isFirebaseReady } from '../lib/firebase';

export default function Home() {
  const [room, setRoom] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const createRoom = async () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    if (!isFirebaseReady()) {
      setError('Connection error. Please refresh the page and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const randomId = Math.random().toString(36).substring(2, 8);

      // Save user to room in Firebase with retry logic
      await withRetry(async () => {
        await set(ref(db, `rooms/${randomId}/players/${username}`), {
          username,
          online: true,
          joinedAt: Date.now()
        });
      }, 3);

      router.push(`/room/${randomId}?user=${username}`);
    } catch (err) {
      console.error('Failed to create room:', err);
      setError(`Failed to create room: ${err.message}. Please check your connection and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!username.trim() || !room.trim()) {
      alert('Please enter username and room ID');
      return;
    }

    if (!isFirebaseReady()) {
      setError('Connection error. Please refresh the page and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const roomId = room.trim();

      // Save user to room in Firebase with retry logic
      await withRetry(async () => {
        await set(ref(db, `rooms/${roomId}/players/${username}`), {
          username,
          online: true,
          joinedAt: Date.now()
        });
      }, 3);

      router.push(`/room/${roomId}?user=${username}`);
    } catch (err) {
      console.error('Failed to join room:', err);
      setError(`Failed to join room: ${err.message}. Please check your connection and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Encuentra el Corazon Online</h1>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <input
        placeholder="Your username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        disabled={isLoading}
      />
      <button onClick={createRoom} disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Crear Nueva Sala'}
      </button>
      <div>
        <input
          placeholder="ID de Sala"
          value={room}
          onChange={e => setRoom(e.target.value)}
          disabled={isLoading}
        />
        <button onClick={joinRoom} disabled={isLoading}>
          {isLoading ? 'Joining...' : 'Unirse a Sala'}
        </button>
      </div>

      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          gap: 10px;
        }
        h1 {
          color: #d6336c;
        }
        .error-message {
          background: #ff6b6b;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          margin-bottom: 10px;
          max-width: 300px;
          text-align: center;
        }
        input {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
        }
        input:disabled {
          background: #f5f5f5;
        }
        button {
          padding: 10px 20px;
          background: #d6336c;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        div {
          display: flex;
          gap: 10px;
          align-items: center;
        }
      `}</style>
    </div>
  );
}
