import { useEffect, useState } from 'react';
import { FIGHTERS, FIGHTER_LIST } from '../game/fighters.js';
import { PLAYER_COLORS } from '../game/render.js';
import Portrait from './Portrait.js';
import { announce, sfx } from '../game/audio.js';

export const SLOT_TYPES = ['human', 'cpu', 'off'];

export function slotLabel(slots, i) {
  const s = slots[i];
  if (s.type === 'off') return 'Empty';
  if (s.type === 'cpu') return `CPU · Level ${s.level}`;
  const humanNumber = slots.slice(0, i + 1).filter((x) => x.type === 'human').length;
  return `Player ${humanNumber}`;
}

export default function Select({ slots, setSlots, rules, setRules, onNext, onBack }) {
  const [active, setActive] = useState(0);
  const playing = slots.filter((s) => s.type !== 'off').length;
  const ready = playing >= 2;

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Enter' && ready) onNext();
      if (e.code === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, onNext, onBack]);

  const update = (i, patch) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const pick = (charId) => {
    sfx.click();
    announce(FIGHTERS[charId].name);
    const i = slots[active].type === 'off' ? slots.findIndex((s) => s.type === 'off') : active;
    const next = slots.map((s, j) => (j === i ? { ...s, charId, type: s.type === 'off' ? 'human' : s.type } : s));
    setSlots(next);
    // Move on to the next player who is in the match.
    for (let k = 1; k <= slots.length; k++) {
      const j = (i + k) % slots.length;
      if (next[j].type !== 'off') {
        setActive(j);
        break;
      }
    }
  };

  const toggleRule = (key) => {
    sfx.click();
    setRules({ ...rules, [key]: !rules[key] });
  };

  const cycleType = (i) => {
    const t = SLOT_TYPES[(SLOT_TYPES.indexOf(slots[i].type) + 1) % SLOT_TYPES.length];
    update(i, { type: t });
    setActive(i);
  };

  return (
    <div className="screen select-screen">
      <header className="screen-header">
        <button className="back-button" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Choose your fighter</h2>
        <div className="rules">
          <span>Stocks</span>
          <button onClick={() => setRules({ ...rules, stocks: Math.max(1, rules.stocks - 1) })} aria-label="Fewer stocks">
            −
          </button>
          <strong>{rules.stocks}</strong>
          <button onClick={() => setRules({ ...rules, stocks: Math.min(5, rules.stocks + 1) })} aria-label="More stocks">
            +
          </button>
          <span className="rules-sep" />
          <span>Items</span>
          <button className={`toggle ${rules.items ? 'on' : ''}`} onClick={() => setRules({ ...rules, items: !rules.items })} aria-pressed={rules.items}>
            {rules.items ? 'On' : 'Off'}
          </button>
        </div>
      </header>

      <div className="roster">
        {FIGHTER_LIST.map((f) => {
          const takenBy = slots.map((s, i) => (s.type !== 'off' && s.charId === f.id ? i : -1)).filter((i) => i >= 0);
          return (
            <button key={f.id} className="roster-card" onClick={() => pick(f.id)} style={{ '--card': f.colors.main }}>
              <Portrait fighter={f} size={104} />
              <span className="roster-name">{f.name}</span>
              <span className="roster-tags">
                {takenBy.map((i) => (
                  <i key={i} style={{ background: PLAYER_COLORS[i] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="slots">
        {slots.map((s, i) => {
          const f = FIGHTERS[s.charId];
          return (
            <div
              key={i}
              className={`slot ${s.type === 'off' ? 'slot-off' : ''} ${active === i ? 'slot-active' : ''}`}
              style={{ '--player': PLAYER_COLORS[i] }}
              onClick={() => (s.type === 'off' ? cycleType(i) : setActive(i))}
            >
              <button
                className="slot-type"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleType(i);
                }}
              >
                {slotLabel(slots, i)}
              </button>
              {s.type !== 'off' ? (
                <>
                  <Portrait fighter={f} size={120} animate={active === i} flip={i % 2 === 1} />
                  <div className="slot-name">{f.name}</div>
                  {s.type === 'cpu' && (
                    <div className="levels">
                      {[1, 2, 3].map((lv) => (
                        <button
                          key={lv}
                          className={s.level === lv ? 'on' : ''}
                          onClick={(e) => {
                            e.stopPropagation();
                            update(i, { level: lv });
                          }}
                        >
                          {lv}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="slot-empty">Click to add a player</div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="screen-footer">
        <div className="party-rules">
          <span>Party rules</span>
          <button className={`chip ${rules.bigHead ? 'on' : ''}`} onClick={() => toggleRule('bigHead')} aria-pressed={!!rules.bigHead}>
            Big heads
          </button>
          <button className={`chip ${rules.lowGravity ? 'on' : ''}`} onClick={() => toggleRule('lowGravity')} aria-pressed={!!rules.lowGravity}>
            Low gravity
          </button>
        </div>
        <p className="hint">{ready ? (FIGHTERS[slots[active]?.charId]?.tagline ?? '') : 'Add at least two fighters.'}</p>
        <button className="big-button" disabled={!ready} onClick={onNext}>
          Ready to fight!
        </button>
      </footer>
    </div>
  );
}
