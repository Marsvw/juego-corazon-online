import { useCallback, useState } from 'react';
import Title from './Title.js';
import Select, { slotLabel } from './Select.js';
import StageSelect from './StageSelect.js';
import FightCanvas from './FightCanvas.js';
import Results from './Results.js';

const DEFAULT_SLOTS = [
  { type: 'human', charId: 'tralalero', level: 2 },
  { type: 'cpu', charId: 'tungtung', level: 2 },
  { type: 'off', charId: 'bombardiro', level: 2 },
  { type: 'off', charId: 'ballerina', level: 2 },
];

function buildPlayers(slots) {
  let human = 0;
  return slots
    .map((s, i) => ({ ...s, port: i, label: slotLabel(slots, i) }))
    .filter((s) => s.type !== 'off')
    .map((s) => ({
      name: s.type === 'cpu' ? 'CPU' : `P${human + 1}`,
      charId: s.charId,
      type: s.type,
      level: s.level,
      label: s.label,
      port: s.port,
      controller: s.type === 'human' ? human++ : null,
    }));
}

export default function Game() {
  const [screen, setScreen] = useState('title');
  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [rules, setRules] = useState({ stocks: 3, items: true });
  const [stageId, setStageId] = useState('sahur');
  const [config, setConfig] = useState(null);
  const [result, setResult] = useState(null);
  const [matchId, setMatchId] = useState(0);

  const toTitle = useCallback(() => setScreen('title'), []);
  const toSelect = useCallback(() => setScreen('select'), []);
  const toStage = useCallback(() => setScreen('stage'), []);

  const startFight = useCallback(
    (id) => {
      setStageId(id);
      setConfig({ stageId: id, stocks: rules.stocks, items: rules.items, players: buildPlayers(slots) });
      setMatchId((n) => n + 1);
      setScreen('fight');
    },
    [rules, slots],
  );

  const onEnd = useCallback((r) => {
    setResult(r);
    setScreen('results');
  }, []);

  const rematch = useCallback(() => {
    setMatchId((n) => n + 1);
    setScreen('fight');
  }, []);

  switch (screen) {
    case 'select':
      return <Select slots={slots} setSlots={setSlots} rules={rules} setRules={setRules} onNext={toStage} onBack={toTitle} />;
    case 'stage':
      return <StageSelect stageId={stageId} onPick={startFight} onBack={toSelect} />;
    case 'fight':
      return <FightCanvas key={matchId} config={config} onEnd={onEnd} onQuit={toSelect} />;
    case 'results':
      return <Results result={result} onRematch={rematch} onSelect={toSelect} onTitle={toTitle} />;
    default:
      return <Title onStart={toSelect} />;
  }
}
