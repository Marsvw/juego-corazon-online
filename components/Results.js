import { useEffect } from 'react';
import { announce } from '../game/audio.js';
import { FIGHTERS } from '../game/fighters.js';
import { PLAYER_COLORS } from '../game/render.js';
import Portrait from './Portrait.js';

const PLACES = ['1st', '2nd', '3rd', '4th'];

export default function Results({ result, onRematch, onSelect, onTitle }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Enter') onRematch();
      if (e.code === 'Escape') onSelect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRematch, onSelect]);

  const winner = result.fighters.find((f) => f.slot === result.winner);

  const winnerId = winner ? winner.charId : null;
  useEffect(() => {
    if (winnerId) announce(FIGHTERS[winnerId].name);
  }, [winnerId]);

  const ordered = result.placements.map((slot) => result.fighters.find((f) => f.slot === slot));

  return (
    <div className="screen results-screen">
      {winner ? (
        <div className="winner" style={{ '--player': PLAYER_COLORS[winner.port] }}>
          <div className="winner-glow" />
          <Portrait fighter={FIGHTERS[winner.charId]} size={260} animate />
          <h2>
            {FIGHTERS[winner.charId].name}
            <span>wins!</span>
          </h2>
          <p className="winner-player">{winner.label}</p>
        </div>
      ) : (
        <h2>It&apos;s a draw!</h2>
      )}

      <table className="standings">
        <thead>
          <tr>
            <th />
            <th>Fighter</th>
            <th>KOs</th>
            <th>Falls</th>
            <th>Damage dealt</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((f, i) => (
            <tr key={f.slot} style={{ '--player': PLAYER_COLORS[f.port] }}>
              <td className="place">{PLACES[i]}</td>
              <td>
                <span className="dot" />
                {FIGHTERS[f.charId].name} <small>({f.label})</small>
              </td>
              <td>{f.score.kos}</td>
              <td>{f.score.falls}</td>
              <td>{f.score.damageDealt}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="button-row">
        <button className="big-button" onClick={onRematch}>
          Rematch
        </button>
        <button className="big-button secondary" onClick={onSelect}>
          Change fighters
        </button>
        <button className="link-button" onClick={onTitle}>
          Main menu
        </button>
      </div>
    </div>
  );
}
