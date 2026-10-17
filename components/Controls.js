import { KEY_LAYOUTS, KEY_NAMES } from '../game/input.js';

const ROWS = [
  ['Move', ['left', 'right'], 'Stick / D-pad'],
  ['Jump', ['up', 'jump'], 'A / Y'],
  ['Attack', ['attack'], 'X'],
  ['Special', ['special'], 'B'],
  ['Shield / dodge', ['shield'], 'Bumpers / triggers'],
  ['Drop through / fast fall', ['down'], 'Down'],
];

function keysFor(layout, actions) {
  return actions
    .flatMap((a) => layout.keys[a])
    .filter((c) => !c.startsWith('Numpad'))
    .map((c) => KEY_NAMES[c] || c)
    .join(' / ');
}

export default function Controls() {
  return (
    <div className="controls">
      <table>
        <thead>
          <tr>
            <th />
            <th className="p1">Player 1</th>
            <th className="p2">Player 2</th>
            <th>Controller</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, actions, pad]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{keysFor(KEY_LAYOUTS[0], actions)}</td>
              <td>{keysFor(KEY_LAYOUTS[1], actions)}</td>
              <td>{pad}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Hold a direction while you attack or use your special for a different move. Up + special is your recovery when you get knocked off. Knock everyone off the stage to win.
      </p>
    </div>
  );
}
