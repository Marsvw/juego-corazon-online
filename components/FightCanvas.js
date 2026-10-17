import { useEffect, useRef, useState } from 'react';
import { createMatch, step, placements } from '../game/engine.js';
import { createInput } from '../game/input.js';
import { createRenderer } from '../game/render.js';
import { drawPortrait } from '../game/art.js';
import { FIGHTER_LIST } from '../game/fighters.js';
import Controls from './Controls.js';

const STEP_MS = 1000 / 60;
const COUNTDOWN = 150;

function makePortraits() {
  const out = {};
  for (const f of FIGHTER_LIST) {
    const c = document.createElement('canvas');
    c.width = c.height = 140;
    drawPortrait(c.getContext('2d'), f, 140, 140);
    out[f.id] = c;
  }
  return out;
}

function summarize(state, players) {
  return {
    winner: state.winner,
    placements: placements(state),
    fighters: state.fighters.map((f) => ({
      slot: f.slot,
      charId: f.charId,
      label: players[f.slot].label,
      score: { ...f.score },
      stocks: f.stocks,
    })),
  };
}

export default function FightCanvas({ config, onEnd, onQuit }) {
  const canvasRef = useRef(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const setPause = (v) => {
    pausedRef.current = v;
    setPaused(v);
  };

  useEffect(() => {
    const state = createMatch({
      stageId: config.stageId,
      stocks: config.stocks,
      players: config.players,
      seed: (Math.random() * 1e9) | 0,
      countdown: COUNTDOWN,
    });
    // Exposed for automated browser tests.
    window.__brawlState = state;
    const input = createInput(window);
    const renderer = createRenderer(canvasRef.current, { portraits: makePortraits() });

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let ended = false;
    let endTimeout = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(100, now - last);
      last = now;
      const events = [];
      if (!pausedRef.current) {
        // Slow motion while "GAME!" shows.
        acc += dt * (state.endTimer > 0 ? 0.35 : 1);
        while (acc >= STEP_MS) {
          acc -= STEP_MS;
          const inputs = config.players.map((p) => (p.type === 'human' ? input.player(p.controller) : null));
          step(state, inputs);
          input.endFrame();
          events.push(...state.events);
        }
        if (state.over && !ended) {
          ended = true;
          endTimeout = setTimeout(() => onEnd(summarize(state, config.players)), 300);
        }
      }
      renderer.render(state, events);
    };
    raf = requestAnimationFrame(frame);

    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') setPause(!pausedRef.current);
      if (e.code === 'Backquote') renderer.toggleDebug();
    };
    const onBlur = () => setPause(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(endTimeout);
      input.dispose();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
    // The match is created once per mount; Game remounts this for a rematch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fight">
      <canvas ref={canvasRef} className="fight-canvas" />
      <button className="pause-button" onClick={() => setPause(true)} aria-label="Pause">
        ❚❚
      </button>
      {paused && (
        <div className="pause-overlay">
          <div className="pause-panel">
            <h2>Paused</h2>
            <div className="button-row">
              <button className="big-button" onClick={() => setPause(false)}>
                Resume
              </button>
              <button className="big-button secondary" onClick={onQuit}>
                Quit match
              </button>
            </div>
            <Controls />
          </div>
        </div>
      )}
    </div>
  );
}
