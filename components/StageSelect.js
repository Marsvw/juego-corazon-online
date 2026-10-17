import { useEffect, useRef } from 'react';
import { STAGE_LIST } from '../game/stages.js';
import { drawStagePreview } from '../game/scenery.js';

function StagePreview({ stage }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = 320 * dpr;
    canvas.height = 180 * dpr;
    drawStagePreview(canvas, stage);
  }, [stage]);
  return <canvas ref={ref} className="stage-preview" style={{ width: 320, height: 180 }} />;
}

export default function StageSelect({ stageId, onPick, onBack }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') onBack();
      if (e.code === 'Enter') onPick(stageId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stageId, onPick, onBack]);

  return (
    <div className="screen stage-screen">
      <header className="screen-header">
        <button className="back-button" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Pick a stage</h2>
        <div />
      </header>
      <div className="stage-grid">
        {STAGE_LIST.map((s) => (
          <button key={s.id} className={`stage-card ${s.id === stageId ? 'stage-last' : ''}`} onClick={() => onPick(s.id)}>
            <StagePreview stage={s} />
            <strong>{s.name}</strong>
            <span>{s.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
