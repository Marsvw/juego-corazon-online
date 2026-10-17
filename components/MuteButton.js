import { useState } from 'react';
import { isMuted, setMuted, unlockAudio } from '../game/audio.js';

export default function MuteButton({ className = '' }) {
  const [muted, setState] = useState(isMuted());
  const toggle = () => {
    unlockAudio();
    setMuted(!muted);
    setState(!muted);
  };
  return (
    <button className={`mute-button ${className}`} onClick={toggle} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
