import { useEffect, useRef } from 'react';
import { drawPortrait } from '../game/art.js';

// A fighter drawn on a small canvas. With animate it idles (blinks, bobs).
export default function Portrait({ fighter, size = 96, animate = false, flip = false, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let t = 0;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPortrait(ctx, fighter, size, size, t, flip);
      if (animate) {
        t++;
        raf = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [fighter, size, animate, flip]);

  return <canvas ref={ref} className={`portrait ${className}`} style={{ width: size, height: size }} aria-label={fighter.name} role="img" />;
}
