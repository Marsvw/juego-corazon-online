import { useCallback, useEffect, useState } from 'react';
import { FIGHTER_LIST } from '../game/fighters.js';
import Portrait from './Portrait.js';
import Controls from './Controls.js';
import MuteButton from './MuteButton.js';
import { sfx, unlockAudio } from '../game/audio.js';

export default function Title({ onStart: next }) {
  const [showControls, setShowControls] = useState(false);
  const [touchOnly, setTouchOnly] = useState(false);
  const onStart = useCallback(() => {
    unlockAudio();
    sfx.click();
    next();
  }, [next]);

  useEffect(() => {
    setTouchOnly(window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches);
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="screen title-screen">
      <MuteButton className="corner" />
      <div className="title-cast">
        {FIGHTER_LIST.map((f, i) => (
          <div key={f.id} className="title-cast-member" style={{ animationDelay: `${i * 0.18}s` }}>
            <Portrait fighter={f} size={130} animate flip={i % 2 === 1} />
          </div>
        ))}
      </div>
      <h1 className="logo">
        <span className="logo-top">BRAINROT</span>
        <span className="logo-bottom">BRAWL!</span>
      </h1>
      <button className="big-button pulse" onClick={onStart}>
        Press Start
      </button>
      <button className="link-button" onClick={() => setShowControls((v) => !v)}>
        {showControls ? 'Hide controls' : 'How to play'}
      </button>
      {showControls && <Controls />}
      {touchOnly && <p className="notice">Brainrot Brawl plays best with a keyboard or a game controller.</p>}
    </div>
  );
}
