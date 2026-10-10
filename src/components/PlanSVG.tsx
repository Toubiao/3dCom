import { memo, type CSSProperties } from 'react';
import type { PlacedItem, Room } from '../types';
import { drawOrder, flattenPrims, itemShapes, symbolPrims, wallShapes, type Fill, type Shape, type Stroke } from '../logic/planSymbols';
import { getDef } from '../data/catalog';
import type { EgressResult } from '../logic/egress';

export const FILL_VAR: Record<Fill, string> = {
  none: 'none',
  paper: 'var(--sym-paper)',
  oat: 'var(--oat)',
  wood: 'var(--sym-wood)',
  brand: 'var(--brand)',
  brandSoft: 'var(--brand-soft)',
  ink: 'var(--charcoal)',
  glass: 'var(--sym-glass)',
  steel: 'var(--sym-steel)',
  leaf: 'var(--sym-leaf)',
};

export const STROKE_VAR: Record<Stroke, string> = {
  ink: 'var(--charcoal)',
  soft: 'var(--ink-3)',
  brand: 'var(--brand)',
  exit: 'var(--exit)',
  none: 'none',
};

/** Render flattened shapes. `unit` converts stroke widths (pt-ish) into drawing units. */
export const ShapeList = ({ shapes, unit }: { shapes: Shape[]; unit: number }) => (
  <>
    {shapes.map((s, i) => {
      if (s.k === 'circle') {
        return (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={FILL_VAR[s.fill]}
            stroke={STROKE_VAR[s.stroke]}
            strokeWidth={s.sw * unit}
          />
        );
      }
      const d = s.pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join('') + (s.k === 'poly' ? 'Z' : '');
      return (
        <path
          key={i}
          d={d}
          fill={s.k === 'poly' ? FILL_VAR[s.fill] : 'none'}
          stroke={STROKE_VAR[s.stroke]}
          strokeWidth={s.sw * unit}
          strokeDasharray={s.dash ? `${4 * unit} ${3 * unit}` : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    })}
  </>
);

/** Library thumbnail of a single item in plan. */
export const ItemSymbol = memo(function ItemSymbol({ type, size = 64 }: { type: string; size?: number }) {
  const def = getDef(type);
  const span = Math.max(def.w, def.d, 0.5) * 1.18;
  const shapes = flattenPrims(symbolPrims(type), 0, 0, 0);
  return (
    <svg width={size} height={size} viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`} aria-hidden="true" className="item-symbol">
      <ShapeList shapes={shapes} unit={span / 90} />
    </svg>
  );
});

/** Symbol for a multi-item set, laid out as it will be placed. */
export const SetSymbol = memo(function SetSymbol({ items, size = 64 }: { items: { type: string; x: number; z: number; rot: number }[]; size?: number }) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const it of items) {
    const d = getDef(it.type);
    const r = Math.max(d.w, d.d) / 2;
    x0 = Math.min(x0, it.x - r);
    x1 = Math.max(x1, it.x + r);
    z0 = Math.min(z0, it.z - r);
    z1 = Math.max(z1, it.z + r);
  }
  const span = Math.max(x1 - x0, z1 - z0) * 1.12;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const ordered = drawOrder(items.map((it, i) => ({ ...it, id: String(i) })));
  return (
    <svg width={size} height={size} viewBox={`${cx - span / 2} ${cz - span / 2} ${span} ${span}`} aria-hidden="true" className="item-symbol">
      {ordered.map((it) => (
        <ShapeList key={it.id} shapes={itemShapes(it)} unit={span / 90} />
      ))}
    </svg>
  );
});

interface PlanProps {
  room: Room;
  items: PlacedItem[];
  egress?: EgressResult | null;
  showDims?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Wrap each item in a <g> with an index, for staged build-up animations. */
  staged?: boolean;
  title?: string;
}

/** Whole-room architectural plan: poché walls, glazing, door swings, furniture, egress. */
export const PlanDrawing = ({ room, items, egress, showDims = true, staged = false }: Omit<PlanProps, 'className' | 'style' | 'title'>) => {
  const walls = wallShapes(room);
  const hw = room.width / 2;
  const hd = room.depth / 2;
  const unit = 0.02;
  const ordered = drawOrder(items);
  const path = (pts: [number, number][], close = true) => pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join('') + (close ? 'Z' : '');
  return (
    <g className="plan-drawing">
      <rect x={-hw} y={-hd} width={room.width} height={room.depth} fill="var(--sym-floor)" className="pd-floor" />
      <g className="pd-grid" stroke="var(--grid-line)" strokeWidth={unit * 0.6}>
        {Array.from({ length: Math.floor(room.width) + 1 }, (_, i) => -Math.floor(hw) + i)
          .filter((x) => x > -hw && x < hw)
          .map((x) => (
            <line key={`x${x}`} x1={x} y1={-hd} x2={x} y2={hd} />
          ))}
        {Array.from({ length: Math.floor(room.depth) + 1 }, (_, i) => -Math.floor(hd) + i)
          .filter((z) => z > -hd && z < hd)
          .map((z) => (
            <line key={`z${z}`} x1={-hw} y1={z} x2={hw} y2={z} />
          ))}
      </g>
      <g className="pd-items">
        {ordered.map((it, i) => (
          <g key={it.id} className={staged ? 'stage-item' : undefined} style={staged ? ({ '--i': i } as CSSProperties) : undefined}>
            <ShapeList shapes={itemShapes(it)} unit={unit} />
          </g>
        ))}
      </g>
      <g className="pd-walls">
        {walls.poche.map((p, i) => (
          <path key={i} d={path(p)} fill="var(--charcoal)" className="stage-wall" />
        ))}
        {walls.glazing.map((p, i) => (
          <path key={`g${i}`} d={path(p)} fill="var(--sym-glass)" stroke="var(--charcoal)" strokeWidth={unit * 0.7} />
        ))}
        {walls.doors.map((d, i) => (
          <g key={`d${i}`} stroke="var(--charcoal)" fill="none" strokeWidth={unit * 0.7}>
            <path d={path([d.hinge, d.leaf], false)} strokeWidth={unit * 1.3} />
            <path d={path(d.arc, false)} strokeDasharray={`${unit * 3} ${unit * 2}`} />
          </g>
        ))}
      </g>
      {egress && (
        <g className="pd-egress">
          {egress.routes.map((r, i) => (
            <g key={i}>
              <path
                d={path(r.points.map((p) => [p.x, p.z] as [number, number]), false)}
                fill="none"
                stroke="var(--exit)"
                strokeWidth={unit * 2.4}
                strokeDasharray={`${unit * 7} ${unit * 4}`}
                strokeLinecap="round"
                className="egress-flow"
              />
              <Arrowhead pts={r.points} unit={unit} />
            </g>
          ))}
          {walls.doors
            .filter((_, i, arr) => arr.findIndex((d) => d.center[0] === arr[i].center[0] && d.center[1] === arr[i].center[1]) === i)
            .map((d, i) => (
              <g key={`x${i}`} transform={`translate(${d.center[0] + d.normal[0] * 0.75} ${d.center[1] + d.normal[1] * 0.75})`}>
                <rect x={-0.42} y={-0.17} width={0.84} height={0.34} rx={0.05} fill="var(--exit)" />
                <text x={0} y={0.075} textAnchor="middle" fontSize={0.21} fontWeight={600} fill="#fff" fontFamily="var(--font-display)" letterSpacing="0.02">
                  EXIT
                </text>
              </g>
            ))}
        </g>
      )}
      {showDims && (
        <g className="pd-dims" stroke="var(--charcoal)" strokeWidth={unit * 0.6} fill="var(--charcoal)">
          <line x1={-hw} y1={hd + 0.75} x2={hw} y2={hd + 0.75} />
          {[-hw, hw].map((x) => (
            <g key={x}>
              <line x1={x} y1={hd + 0.55} x2={x} y2={hd + 0.95} />
              <line x1={x - 0.1} y1={hd + 0.85} x2={x + 0.1} y2={hd + 0.65} />
            </g>
          ))}
          <text x={0} y={hd + 0.65} textAnchor="middle" fontSize={0.3} stroke="none" fontFamily="var(--font-mono)">
            {room.width.toFixed(2)} m
          </text>
          <line x1={hw + 0.75} y1={-hd} x2={hw + 0.75} y2={hd} />
          {[-hd, hd].map((z) => (
            <g key={z}>
              <line x1={hw + 0.55} y1={z} x2={hw + 0.95} y2={z} />
              <line x1={hw + 0.65} y1={z + 0.1} x2={hw + 0.85} y2={z - 0.1} />
            </g>
          ))}
          <text x={hw + 0.65} y={0} textAnchor="middle" fontSize={0.3} stroke="none" fontFamily="var(--font-mono)" transform={`rotate(-90 ${hw + 0.65} 0)`}>
            {room.depth.toFixed(2)} m
          </text>
        </g>
      )}
    </g>
  );
};

const Arrowhead = ({ pts, unit }: { pts: { x: number; z: number }[]; unit: number }) => {
  if (pts.length < 2) return null;
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const ang = (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
  const s = unit * 9;
  return <path d={`M0 0L${-s} ${-s * 0.6}L${-s} ${s * 0.6}Z`} fill="var(--exit)" transform={`translate(${b.x} ${b.z}) rotate(${ang})`} />;
};

/** Standalone plan SVG sized to the room with margins for dimensions. */
export const PlanSVG = ({ room, items, egress, showDims = true, className, style, title }: PlanProps) => {
  const m = showDims ? 1.4 : 0.6;
  const vb = `${-room.width / 2 - 0.6} ${-room.depth / 2 - 0.6} ${room.width + 0.6 + m} ${room.depth + 0.6 + m}`;
  return (
    <svg viewBox={vb} className={className} style={style} role="img" aria-label={title ?? 'Floor plan'}>
      <PlanDrawing room={room} items={items} egress={egress} showDims={showDims} />
    </svg>
  );
};
