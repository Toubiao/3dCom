import { useEffect, useRef, useState } from 'react';

/** Rolling-digit counter. Each digit is a vertical strip that slides to its value. */
export function Odometer({ value, minDigits = 1, className }: { value: number; minDigits?: number; className?: string }) {
  const str = Math.max(0, Math.round(value)).toString().padStart(minDigits, '0');
  return (
    <span className={`odometer ${className ?? ''}`} aria-label={String(value)} role="text">
      {str.split('').map((ch, i) => (
        <span className="odo-digit" key={str.length - i} aria-hidden="true">
          <span className="odo-strip" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
            {'0123456789'.split('').map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Briefly shows "+n" / "−n" when a value changes. */
export function DeltaBadge({ value }: { value: number }) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ d: number; k: number } | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (d !== 0) setDelta((x) => ({ d, k: (x?.k ?? 0) + 1 }));
  }, [value]);
  if (!delta) return null;
  return (
    <span key={delta.k} className={`delta-badge ${delta.d > 0 ? 'up' : 'down'}`} aria-hidden="true">
      {delta.d > 0 ? `+${delta.d}` : `−${Math.abs(delta.d)}`}
    </span>
  );
}

/** Number that eases to its target, for money totals. */
export function useTween(target: number, ms = 450) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = a + (target - a) * e;
      from.current = cur;
      setV(cur);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v;
}
