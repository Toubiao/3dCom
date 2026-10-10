import { useMemo } from 'react';
import { store, useStore } from '../state/store';
import { getDef } from '../data/catalog';
import { useCapacity } from '../logic/analysis';
import { floorSwatch } from '../engine/textures';
import type { FloorFinish, WallSide } from '../types';
import { IconAlert, IconCheck, IconCopy, IconMinus, IconPlus, IconRotate, IconTrash, IconClose } from './Icons';
import { money, TIERS } from '../logic/cost';
import type { Check } from '../logic/capacity';

const FLOORS: { id: FloorFinish; label: string }[] = [
  { id: 'herringbone', label: 'Herringbone oak' },
  { id: 'oak', label: 'Oak plank' },
  { id: 'concrete', label: 'Polished concrete' },
  { id: 'terrazzo', label: 'Terrazzo' },
];

export function Inspector() {
  const selectedId = useStore((s) => s.selectedId);
  return (
    <aside className="inspector panel" aria-label="Inspector">
      <div className="insp-scroll">
        {selectedId && <SelectionCard />}
        <CapacityPanel />
        <RoomPanel />
      </div>
    </aside>
  );
}

function Stepper({ value, onChange, step, min, max, unit, label, id }: { value: number; onChange: (v: number) => void; step: number; min: number; max: number; unit?: string; label: string; id: string }) {
  const fmt = (v: number) => (step < 1 ? v.toFixed(1) : String(v));
  return (
    <div className="stepper">
      <label htmlFor={id}>{label}</label>
      <div className="stepper-ctl">
        <button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} disabled={value <= min}>
          <IconMinus size={14} />
        </button>
        <input
          id={id}
          inputMode="decimal"
          value={fmt(value)}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
        />
        {unit && <span className="unit">{unit}</span>}
        <button aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} disabled={value >= max}>
          <IconPlus size={14} />
        </button>
      </div>
    </div>
  );
}

function SelectionCard() {
  const selectedId = useStore((s) => s.selectedId);
  const item = useStore((s) => s.items.find((i) => i.id === s.selectedId));
  const tier = useStore((s) => s.costTier);
  if (!item || !selectedId) return null;
  const def = getDef(item.type);
  const mult = TIERS.find((t) => t.id === tier)!.mult;
  const deg = Math.round((((item.rot * 180) / Math.PI) % 360 + 360) % 360);
  const st = store.getState;
  return (
    <section className="card selection-card" aria-label="Selected item">
      <div className="card-head">
        <div>
          <span className="eyebrow">Selected</span>
          <h3>{def.name}</h3>
        </div>
        <button className="icon-btn sm" onClick={() => st().select(null)} aria-label="Deselect">
          <IconClose size={15} />
        </button>
      </div>
      <p className="muted">{def.blurb}</p>
      <dl className="kv">
        <div>
          <dt>Size</dt>
          <dd>
            {Math.round(def.w * 100)} × {Math.round(def.d * 100)} cm
          </dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd>{def.seats || '—'}</dd>
        </div>
        <div>
          <dt>Unit cost</dt>
          <dd>{money(Math.round((def.price * mult) / 5) * 5)}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            {item.x.toFixed(2)}, {item.z.toFixed(2)} m
          </dd>
        </div>
      </dl>
      <div className="rot-row">
        <label htmlFor="rot-range">Rotation</label>
        <input
          id="rot-range"
          type="range"
          min={0}
          max={345}
          step={15}
          value={deg}
          onPointerDown={() => st().beginEdit()}
          onPointerUp={() => st().commitEdit()}
          onKeyDown={() => st().beginEdit()}
          onKeyUp={() => st().commitEdit()}
          onChange={(e) => {
            const r = (Number(e.target.value) * Math.PI) / 180;
            st().setRotation(item.id, r > Math.PI ? r - Math.PI * 2 : r);
          }}
        />
        <span className="rot-val">{deg}°</span>
      </div>
      <div className="btn-row">
        <button className="btn btn-ghost sm" onClick={() => st().rotateBy(item.id, Math.PI / 2)}>
          <IconRotate size={15} /> 90°
        </button>
        <button className="btn btn-ghost sm" onClick={() => st().duplicate(item.id)}>
          <IconCopy size={15} /> Duplicate
        </button>
        <button className="btn btn-ghost sm danger" onClick={() => st().removeItem(item.id)}>
          <IconTrash size={15} /> Remove
        </button>
      </div>
    </section>
  );
}

const StatusIcon = ({ s }: { s: Check['status'] }) => (s === 'pass' ? <IconCheck size={14} /> : <IconAlert size={14} />);

export function CheckList({ checks, compact = false }: { checks: Check[]; compact?: boolean }) {
  return (
    <ul className={`checks ${compact ? 'compact' : ''}`}>
      {checks.map((c) => (
        <li key={c.id} className={`check st-${c.status}`}>
          <span className="check-ico">
            <StatusIcon s={c.status} />
          </span>
          <span className="check-label">
            {c.label}
            {!compact && <small>{c.hint}</small>}
          </span>
          <span className="check-val">
            <b>{c.value}</b>
            <small>{c.limit}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CapacityPanel() {
  const cap = useCapacity();
  const staff = useStore((s) => s.staff);
  const sprinklered = useStore((s) => s.sprinklered);
  const egress = useStore((s) => s.showEgress);
  const st = store.getState;
  const fails = cap.checks.filter((c) => c.status === 'fail').length;
  return (
    <section className="card capacity-card" aria-label="Capacity planner">
      <div className="card-head">
        <div>
          <span className="eyebrow">Capacity planner</span>
          <h3>
            {cap.occupants} of {cap.maxOccupants} people
          </h3>
        </div>
        <span className={`pill pill-${cap.status === 'pass' ? 'ok' : cap.status === 'warn' ? 'warn' : 'bad'}`}>
          {cap.status === 'pass' ? 'Compliant' : cap.status === 'warn' ? 'Review' : `${fails} issue${fails > 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="cap-stats">
        <div>
          <b>{cap.seatsPerM2.toFixed(2)}</b>
          <span>seats / m²</span>
        </div>
        <div>
          <b>{cap.seats ? cap.m2PerSeat.toFixed(1) : '–'}</b>
          <span>m² / seat</span>
        </div>
        <div>
          <b>{cap.maxSeats}</b>
          <span>max seats</span>
        </div>
      </div>
      <p className="muted small">
        {cap.occupancyLabel}. Limited by <b>{cap.limitedBy}</b>.
      </p>
      <CheckList checks={cap.checks} compact />
      <div className="cap-controls">
        <Stepper id="staff" label="Staff on shift" value={staff} min={0} max={40} step={1} onChange={(v) => st().setStaff(v)} />
        <label className="toggle-row" htmlFor="sprinklered">
          <span>Sprinklered building</span>
          <input id="sprinklered" type="checkbox" className="toggle" checked={sprinklered} onChange={(e) => st().setSprinklered(e.target.checked)} />
        </label>
        <label className="toggle-row" htmlFor="egress-toggle">
          <span>Show fire safety</span>
          <input id="egress-toggle" type="checkbox" className="toggle exit" checked={egress} onChange={(e) => st().toggleEgress(e.target.checked)} />
        </label>
      </div>
      <a className="link-more" href="#capacity">
        How the numbers work
      </a>
    </section>
  );
}

function RoomPanel() {
  const room = useStore((s) => s.room);
  const st = store.getState;
  const swatches = useMemo(() => Object.fromEntries(FLOORS.map((f) => [f.id, floorSwatch(f.id)])), []);
  return (
    <section className="card room-card" aria-label="Room">
      <div className="card-head">
        <div>
          <span className="eyebrow">Room</span>
          <h3>{(room.width * room.depth).toFixed(0)} m² shell</h3>
        </div>
      </div>
      <div className="two">
        <Stepper id="room-w" label="Frontage" unit="m" value={room.width} min={6} max={24} step={0.5} onChange={(v) => st().setRoomSize(v, room.depth)} />
        <Stepper id="room-d" label="Depth" unit="m" value={room.depth} min={6} max={24} step={0.5} onChange={(v) => st().setRoomSize(room.width, v)} />
      </div>
      <div className="field">
        <span className="field-label">Floor finish</span>
        <div className="floor-row" role="radiogroup" aria-label="Floor finish">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={room.floor === f.id}
              className={`floor-swatch ${room.floor === f.id ? 'on' : ''}`}
              style={{ backgroundImage: `url(${swatches[f.id]})` }}
              onClick={() => st().setFloor(f.id)}
              title={f.label}
              aria-label={f.label}
            />
          ))}
        </div>
      </div>
      <label className="toggle-row" htmlFor="feature-wall">
        <span>Paint back wall in brand tint</span>
        <input id="feature-wall" type="checkbox" className="toggle" checked={room.featureWall} onChange={(e) => st().setFeatureWall(e.target.checked)} />
      </label>
      <div className="field">
        <span className="field-label">
          Exits <small>{room.exits.length}</small>
        </span>
        <ul className="exit-list">
          {room.exits.map((e) => {
            const len = e.wall === 'front' || e.wall === 'back' ? room.width : room.depth;
            const lim = len / 2 - e.width / 2 - 0.2;
            return (
              <li key={e.id} className="exit-item">
                <div className="exit-top">
                  <span className="exit-tag">EXIT</span>
                  <strong>{e.label}</strong>
                  <select
                    aria-label={`${e.label} wall`}
                    value={e.wall}
                    onChange={(ev) => st().updateExit(e.id, { wall: ev.target.value as WallSide, offset: 0 })}
                  >
                    <option value="front">Storefront</option>
                    <option value="back">Back wall</option>
                    <option value="left">Left wall</option>
                    <option value="right">Right wall</option>
                  </select>
                  {room.exits.length > 1 && (
                    <button className="icon-btn sm" onClick={() => st().removeExit(e.id)} aria-label={`Remove ${e.label}`}>
                      <IconClose size={14} />
                    </button>
                  )}
                </div>
                <div className="exit-ctl">
                  <label>
                    <span>Position</span>
                    <input
                      type="range"
                      min={-lim}
                      max={lim}
                      step={0.1}
                      value={e.offset}
                      onChange={(ev) => st().updateExit(e.id, { offset: Number(ev.target.value) })}
                      aria-label={`${e.label} position along the wall`}
                    />
                  </label>
                  <label>
                    <span>Width</span>
                    <select aria-label={`${e.label} width`} value={e.width} onChange={(ev) => st().updateExit(e.id, { width: Number(ev.target.value) })}>
                      <option value={0.85}>0.85 m single</option>
                      <option value={0.95}>0.95 m single</option>
                      <option value={1.2}>1.20 m wide</option>
                      <option value={1.8}>1.80 m double</option>
                      <option value={2.4}>2.40 m double</option>
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
        {room.exits.length < 4 && (
          <button className="btn btn-ghost sm" onClick={() => st().addExit()}>
            <IconPlus size={15} /> Add exit
          </button>
        )}
      </div>
    </section>
  );
}
