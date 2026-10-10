import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Planner, setPlanner, getPlanner } from '../engine/Planner';
import { store, useStore } from '../state/store';
import { getDef, SETS } from '../data/catalog';
import { libraryDrag } from './Library';
import { useCapacity } from '../logic/analysis';
import { DeltaBadge, Odometer } from './Odometer';
import {
  IconCopy,
  IconCube,
  IconExit,
  IconFit,
  IconMagnet,
  IconPlan,
  IconRedo,
  IconRotate,
  IconSplit,
  IconTrash,
  IconUndo,
  IconClose,
  IconCheck,
  IconAlert,
} from './Icons';
import { BrandButton } from './BrandPicker';
import type { ViewMode } from '../types';

export function Viewport() {
  const host = useRef<HTMLDivElement>(null);
  const [glError, setGlError] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    let planner: Planner | null = null;
    try {
      planner = new Planner(host.current);
      setPlanner(planner);
    } catch (err) {
      console.error(err);
      setGlError(true);
    }
    return () => {
      planner?.dispose();
      setPlanner(null);
    };
  }, []);

  const payloadType = () => {
    const p = libraryDrag.current;
    if (!p) return null;
    return p.kind === 'item' ? p.id : SETS.find((s) => s.id === p.id)?.items[0].type ?? null;
  };

  const onDragOver = (e: DragEvent) => {
    if (!libraryDrag.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const at = getPlanner()?.floorPointAt(e.clientX, e.clientY) ?? null;
    getPlanner()?.showGhost(payloadType(), at);
  };
  const onDragLeave = () => getPlanner()?.showGhost(null, null);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const p = libraryDrag.current;
    libraryDrag.current = null;
    getPlanner()?.showGhost(null, null);
    if (!p) return;
    const at = getPlanner()?.floorPointAt(e.clientX, e.clientY) ?? undefined;
    if (p.kind === 'item') store.getState().addItem(p.id, at ?? undefined);
    else store.getState().addSet(p.id, at ?? undefined);
  };

  return (
    <div className="stage">
      <div ref={host} className="viewport" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} />
      {glError && (
        <div className="gl-error">
          <strong>3D view unavailable</strong>
          <p>This browser could not start WebGL. The library, capacity planner and cost estimate still work, and the PDF export draws the plan without the 3D render.</p>
        </div>
      )}
      <CapacityHud />
      <ViewToolbar />
      <EgressLegend />
      <EditToolbar />
      <HeroCard />
    </div>
  );
}

const VIEWS: { id: ViewMode; label: string; Icon: typeof IconPlan; key: string }[] = [
  { id: 'plan', label: 'Plan', Icon: IconPlan, key: '1' },
  { id: 'split', label: 'Split', Icon: IconSplit, key: '2' },
  { id: '3d', label: '3D', Icon: IconCube, key: '3' },
];

function ViewToolbar() {
  const view = useStore((s) => s.view);
  const egress = useStore((s) => s.showEgress);
  return (
    <div className="toolbar toolbar-top" role="toolbar" aria-label="View">
      <div className="seg seg-view" role="radiogroup" aria-label="View mode">
        {VIEWS.map(({ id, label, Icon, key }) => (
          <button
            key={id}
            role="radio"
            aria-checked={view === id}
            className={view === id ? 'on' : ''}
            onClick={() => store.getState().setView(id)}
            title={`${label} view (${key})`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <span className="tb-sep" />
      <button
        className={`switch-btn ${egress ? 'on' : ''}`}
        role="switch"
        aria-checked={egress}
        onClick={() => store.getState().toggleEgress()}
        title="Show fire safety (F)"
      >
        <IconExit size={16} />
        <span>Show fire safety</span>
        <span className="switch" aria-hidden="true">
          <i />
        </span>
      </button>
      <span className="tb-sep" />
      <BrandButton />
    </div>
  );
}

function EditToolbar() {
  const selectedId = useStore((s) => s.selectedId);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const snap = useStore((s) => s.snap);
  const items = useStore((s) => s.items);
  const sel = items.find((i) => i.id === selectedId);
  const st = store.getState;
  return (
    <div className="toolbar toolbar-bottom" role="toolbar" aria-label="Edit">
      <button className="icon-btn" onClick={() => st().undo()} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
        <IconUndo />
      </button>
      <button className="icon-btn" onClick={() => st().redo()} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
        <IconRedo />
      </button>
      <span className="tb-sep" />
      <span className="tb-selection" aria-live="polite">
        {sel ? getDef(sel.type).name : 'Nothing selected'}
      </span>
      <button className="icon-btn" disabled={!sel} onClick={() => sel && st().rotateBy(sel.id, Math.PI / 4)} title="Rotate 45° (R)" aria-label="Rotate">
        <IconRotate />
      </button>
      <button className="icon-btn" disabled={!sel} onClick={() => sel && st().duplicate(sel.id)} title="Duplicate (Ctrl+D)" aria-label="Duplicate">
        <IconCopy />
      </button>
      <button className="icon-btn danger" disabled={!sel} onClick={() => sel && st().removeItem(sel.id)} title="Delete (Del)" aria-label="Delete">
        <IconTrash />
      </button>
      <span className="tb-sep" />
      <button
        className={`icon-btn ${snap ? 'on' : ''}`}
        aria-pressed={snap}
        onClick={() => st().setSnap(!snap)}
        title={snap ? 'Snapping to 10 cm (hold Alt to place freely)' : 'Snapping off'}
        aria-label="Snap to grid"
      >
        <IconMagnet />
      </button>
      <button className="icon-btn" onClick={() => getPlanner()?.resetCamera()} title="Fit room to view" aria-label="Fit view">
        <IconFit />
      </button>
    </div>
  );
}

function CapacityHud() {
  const cap = useCapacity();
  const segs = 28;
  const max = Math.max(1, cap.maxSeats);
  const filled = Math.min(segs, Math.round((cap.seats / max) * segs));
  const over = cap.seats > cap.maxSeats;
  const bandLo = cap.band ? Math.min(segs, Math.round((cap.band.min / max) * segs)) : -1;
  const bandHi = cap.band ? Math.min(segs, Math.round((cap.band.max / max) * segs)) : -1;
  const state = over ? 'bad' : cap.status === 'fail' ? 'bad' : cap.status === 'warn' || cap.bandStatus === 'over' ? 'warn' : 'ok';
  const label = over
    ? `${cap.seats - cap.maxSeats} over code max`
    : cap.status === 'fail'
      ? 'Fire safety issue'
      : cap.bandStatus === 'under'
        ? 'Room for more seats'
        : cap.bandStatus === 'over'
          ? 'Tight for comfort'
          : 'Within code';
  return (
    <section className={`hud capacity-hud state-${state}`} aria-label="Capacity meter">
      <div className="ch-top">
        <span className="eyebrow">Seats</span>
        <span className={`pill pill-${state}`}>
          {state === 'ok' ? <IconCheck size={13} /> : <IconAlert size={13} />}
          {label}
        </span>
      </div>
      <div className="ch-count">
        <Odometer value={cap.seats} className="ch-num" />
        <DeltaBadge value={cap.seats} />
        <span className="ch-max">
          / {cap.maxSeats} <small>max</small>
        </span>
      </div>
      <div className="meter" aria-hidden="true">
        {Array.from({ length: segs }, (_, i) => (
          <i
            key={i}
            className={`${i < filled ? 'fill' : ''} ${i >= bandLo && i < bandHi ? 'band' : ''}`}
            style={{ transitionDelay: `${Math.abs(i - filled) * 12}ms` }}
          />
        ))}
      </div>
      <div className="ch-foot">
        <span>
          <b>{cap.seats ? cap.m2PerSeat.toFixed(1) : '–'}</b> m²/seat
        </span>
        <span>
          {cap.band ? (
            <>
              target <b>{cap.band.min}–{cap.band.max}</b>
            </>
          ) : (
            <>
              <b>{cap.maxOccupants}</b> occupants max
            </>
          )}
        </span>
      </div>
    </section>
  );
}

function EgressLegend() {
  const on = useStore((s) => s.showEgress);
  const cap = useCapacity();
  const travel = cap.checks.find((c) => c.id === 'travel');
  const fails = cap.checks.filter((c) => c.status === 'fail').length;
  return (
    <section className={`hud egress-legend ${on ? 'on' : ''}`} aria-hidden={!on} aria-label="Fire safety legend">
      <div className="el-row">
        <span className="el-key route" />
        Escape route to nearest exit
      </div>
      <div className="el-row">
        <span className="el-key landing" />
        Exit landing, keep clear
      </div>
      <div className="el-stats">
        <div>
          <span className="eyebrow">Max travel</span>
          <b>{cap.travel.toFixed(1)} m</b>
          <small>of {cap.travelLimit} m</small>
        </div>
        <div>
          <span className="eyebrow">Exits</span>
          <b>
            {cap.exitsProvided}/{cap.exitsRequired}
          </b>
          <small>{cap.exitsRequired > 1 ? 'needed' : 'needed'}</small>
        </div>
        <div>
          <span className="eyebrow">Checks</span>
          <b className={fails ? 'bad' : 'ok'}>{fails ? `${fails} failing` : 'All pass'}</b>
          <small>{travel?.status === 'warn' ? 'travel is long' : 'IBC-based'}</small>
        </div>
      </div>
    </section>
  );
}

function HeroCard() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('fitout.hero.dismissed') !== '1';
    } catch {
      return true;
    }
  });
  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem('fitout.hero.dismissed', '1');
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (!open) return;
    // tuck the intro away once someone starts editing
    return store.subscribe((s, p) => {
      if (s.past.length > p.past.length && s.layoutEpoch === p.layoutEpoch) dismiss();
    });
  }, [open]);
  if (!open) return null;
  return (
    <section className="hero-card" aria-label="Introduction">
      <button className="hero-close" onClick={dismiss} aria-label="Dismiss introduction">
        <IconClose size={16} />
      </button>
      <span className="eyebrow">Commercial space planner</span>
      <h1>Lay out the café before you sign the lease.</h1>
      <p>A 108 m² corner unit, ready to arrange. Drag chairs in from the library and watch seats, exits and budget update.</p>
      <ol className="hero-steps">
        <li>
          <b>Drag</b> a bistro pair onto the plan
        </li>
        <li>
          <b>Swing</b> to 3D, or press V
        </li>
        <li>
          <b>Export</b> the sheet for your landlord
        </li>
      </ol>
    </section>
  );
}
