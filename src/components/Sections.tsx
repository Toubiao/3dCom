import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { store, useStore } from '../state/store';
import { TEMPLATES, TEMPLATE_ORDER, OCCUPANCY } from '../data/templates';
import { useCapacity, useCost, getEgress } from '../logic/analysis';
import { costReport, money, TIERS } from '../logic/cost';
import { countSeats } from '../logic/capacity';
import { getPlanner } from '../engine/Planner';
import { PlanSVG } from './PlanSVG';
import { BrandSwatches } from './BrandPicker';
import { CheckList } from './Inspector';
import { TierSwitch } from './CostDrawer';
import { switchTemplate } from './TopBar';
import { getDef } from '../data/catalog';
import { IconArrowDown, IconExit, TEMPLATE_ICON } from './Icons';
import type { TemplateId } from '../types';

const scrollToPlanner = () => document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });

/**
 * True once the 3D engine exists and the element is near the viewport, so stills are only
 * rendered for sections someone is about to see.
 */
function useCaptureReady(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  useEffect(() => {
    if (!near) return;
    let id = 0;
    const check = () => {
      if (getPlanner()) setReady(true);
      else id = window.setTimeout(check, 200);
    };
    check();
    return () => clearTimeout(id);
  }, [near]);
  return ready;
}

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 });
  else window.setTimeout(fn, 300);
};

export function SectionNav() {
  return (
    <nav className="section-nav" aria-label="Sections">
      <a href="#templates">Templates</a>
      <a href="#capacity">Capacity planner</a>
      <a href="#brand">Brand colour</a>
      <a href="#cost">Cost estimator</a>
      <span className="scroll-cue" aria-hidden="true">
        <IconArrowDown size={14} />
      </span>
    </nav>
  );
}

function TemplatesSection() {
  const ref = useRef<HTMLElement>(null);
  const ready = useCaptureReady(ref);
  const current = useStore((s) => s.templateId);
  const [photos, setPhotos] = useState<Partial<Record<TemplateId, string>>>({});
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const queue = [...TEMPLATE_ORDER];
    const next = () => {
      const id = queue.shift();
      if (!id || cancelled) return;
      idle(() => {
        if (cancelled) return;
        try {
          const url = getPlanner()?.capture({ width: 880, height: 620, shot: 'photo', templateId: id, jpeg: true });
          if (url) setPhotos((p) => ({ ...p, [id]: url }));
        } catch {
          /* leave the plan fallback in place */
        }
        next();
      });
    };
    next();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const stats = useMemo(
    () =>
      Object.fromEntries(
        TEMPLATE_ORDER.map((id) => {
          const t = TEMPLATES[id];
          const seats = countSeats(t.items);
          const area = t.room.width * t.room.depth;
          return [id, { seats, area, cost: costReport(t.items, 'standard', seats, area).total }];
        }),
      ),
    [],
  );

  return (
    <section className="section" id="templates" aria-labelledby="templates-h" ref={ref}>
      <div className="section-head">
        <span className="eyebrow">Templates</span>
        <h2 id="templates-h">Start from a room that already trades.</h2>
        <p>
          Four layouts drawn to real clearances: queue space at the counter, 1.1 m exit landings, aisles a wheelchair can turn in. Load one,
          then make it yours.
        </p>
      </div>
      <div className="template-grid">
        {TEMPLATE_ORDER.map((id) => {
          const t = TEMPLATES[id];
          const st = stats[id];
          const Icon = TEMPLATE_ICON[id];
          return (
            <article key={id} className={`template-card ${current === id ? 'current' : ''}`}>
              <figure className="photo">
                {photos[id] ? (
                  <img src={photos[id]} alt={`${t.project}, eye-level view: ${t.photo.caption.toLowerCase()}`} />
                ) : (
                  <div className="photo-fallback">
                    <PlanSVG room={t.room} items={t.items} showDims={false} title={`${t.project} plan`} />
                  </div>
                )}
                <figcaption>
                  <span className="ts">{t.photo.time}</span>
                  {t.photo.caption}
                </figcaption>
              </figure>
              <div className="tc-body">
                <div className="tc-title">
                  <Icon size={18} />
                  <h3>{t.label}</h3>
                  <span className="tc-proj">{t.project}</span>
                </div>
                <p>{t.tagline}.</p>
                <dl className="tc-stats">
                  <div>
                    <dt>Area</dt>
                    <dd>{st.area.toFixed(0)} m²</dd>
                  </div>
                  <div>
                    <dt>Seats</dt>
                    <dd>{st.seats}</dd>
                  </div>
                  <div>
                    <dt>FF&amp;E</dt>
                    <dd>{money(st.cost, true)}</dd>
                  </div>
                </dl>
                <button
                  className={`btn ${current === id ? 'btn-ghost' : 'btn-primary'} sm`}
                  onClick={() => {
                    switchTemplate(id);
                    scrollToPlanner();
                  }}
                >
                  {current === id ? 'Open in planner' : `Load ${t.label.toLowerCase()}`}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CapacitySection() {
  const cap = useCapacity();
  const room = useStore((s) => s.room);
  const items = useStore((s) => s.items);
  const egress = getEgress(room, items);
  const occ = OCCUPANCY[cap.occupancy];
  const steps: { label: string; value: string; note: string; strong?: boolean }[] = [
    { label: 'Floor area', value: `${cap.area.toFixed(1)} m²`, note: `${room.width.toFixed(1)} × ${room.depth.toFixed(1)} m shell` },
    ...(occ.basis === 'net' ? [{ label: 'Net seating area', value: `${cap.netArea.toFixed(1)} m²`, note: '80% after counters, walls and back-of-house' }] : []),
    { label: 'Load factor', value: `÷ ${cap.factor} m²`, note: `${cap.occupancy}: ${occ.note}` },
    { label: 'Area allows', value: `${cap.areaLoad} people`, note: 'Before exits and doors are counted' },
    { label: 'Exits allow', value: cap.exitLimit > 9000 ? 'no limit' : `${cap.exitLimit} people`, note: `${cap.exitsProvided} exit${cap.exitsProvided > 1 ? 's' : ''}: one exit tops out at 49` },
    { label: 'Door width allows', value: `${cap.widthLimit} people`, note: `${cap.widthProvided.toFixed(2)} m clear at ${cap.mmPerOccupant} mm per person` },
    { label: 'Posted capacity', value: `${cap.maxOccupants} people`, note: `Smallest of the three, limited by ${cap.limitedBy}`, strong: true },
    { label: 'Seats you can sell', value: `${cap.maxSeats} seats`, note: `After ${cap.staff} staff on shift`, strong: true },
  ];
  return (
    <section className="section section-split" id="capacity" aria-labelledby="capacity-h">
      <div className="section-head">
        <span className="eyebrow">Capacity planner</span>
        <h2 id="capacity-h">How many people can this room legally hold?</h2>
        <p>
          The planner works it out the way a code consultant would, live, from your layout. Seat density tells you if the room will feel
          busy or empty. Occupant load and egress tell you if you can open the doors.
        </p>
      </div>
      <div className="cap-grid">
        <div className="calc card">
          <h3>The calculation</h3>
          <ol className="calc-steps">
            {steps.map((s) => (
              <li key={s.label} className={s.strong ? 'strong' : ''}>
                <span className="cs-label">
                  {s.label}
                  <small>{s.note}</small>
                </span>
                <b>{s.value}</b>
              </li>
            ))}
          </ol>
          <div className="density">
            <div className="density-head">
              <span>Seat density</span>
              <b>
                {cap.seatsPerM2.toFixed(2)} seats/m² · {cap.seats ? cap.m2PerSeat.toFixed(1) : '–'} m² per seat
              </b>
            </div>
            <DensityBar />
          </div>
        </div>
        <div className="egress card">
          <div className="egress-head">
            <h3>Fire egress</h3>
            <button className="btn btn-ghost sm" onClick={() => { store.getState().toggleEgress(true); scrollToPlanner(); }}>
              <IconExit size={15} /> Show in planner
            </button>
          </div>
          <PlanSVG room={room} items={items} egress={egress} className="egress-plan" title="Plan with escape routes" />
          <CheckList checks={cap.checks} />
          <p className="fine">
            Factors follow the International Building Code (Table 1004.5, Sections 1005–1017). Local codes differ, so treat these as planning
            figures and confirm them with your building official.
          </p>
        </div>
      </div>
    </section>
  );
}

function DensityBar() {
  const cap = useCapacity();
  const templateId = useStore((s) => s.templateId);
  const t = TEMPLATES[templateId];
  if (!t.m2PerSeat || !cap.band) {
    return <p className="muted small">Retail is sized by shoppers, not seats. The posted capacity above is the number that matters.</p>;
  }
  const lo = 1 / t.m2PerSeat[1];
  const hi = 1 / t.m2PerSeat[0];
  const max = hi * 1.6;
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="dbar">
      <div className="dbar-track">
        <span className="dbar-band" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
        <span className="dbar-mark" style={{ left: pos(cap.seatsPerM2) }} />
      </div>
      <div className="dbar-scale">
        <span>Sparse</span>
        <span style={{ left: pos(lo) }} className="abs">
          {lo.toFixed(2)}
        </span>
        <span style={{ left: pos(hi) }} className="abs">
          {hi.toFixed(2)}
        </span>
        <span>Packed</span>
      </div>
      <p className="muted small">
        Comfortable {t.label.toLowerCase()} layouts run {t.m2PerSeat[0]}–{t.m2PerSeat[1]} m² per seat: {cap.band.min} to {cap.band.max} seats here.
      </p>
    </div>
  );
}

function BrandSection() {
  const ref = useRef<HTMLElement>(null);
  const ready = useCaptureReady(ref);
  const brand = useStore((s) => s.brand);
  const items = useStore((s) => s.items);
  const room = useStore((s) => s.room);
  const name = useStore((s) => s.projectName);
  const [shot, setShot] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => {
      try {
        setShot(getPlanner()?.capture({ width: 1100, height: 640, shot: 'storefront', jpeg: true }) ?? null);
      } catch {
        setShot(null);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [ready, brand, room, name, items]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const d = getDef(it.type);
      if (d.branded) m.set(d.name, (m.get(d.name) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const total = counts.reduce((s, [, n]) => s + n, 0) + 3;

  return (
    <section className="section section-split brand-section" id="brand" aria-labelledby="brand-h" ref={ref}>
      <div className="section-head">
        <span className="eyebrow">Brand colour</span>
        <h2 id="brand-h">One colour, applied across the room.</h2>
        <p>
          Pick your signature colour and every branded surface follows: counter fronts, upholstery, the fascia sign, awnings, rugs and
          screens. {total} elements in this layout.
        </p>
      </div>
      <div className="brand-grid">
        <figure className="storefront card">
          {shot ? <img src={shot} alt={`Street view of ${name || 'the shop'} with the fascia and awning in the brand colour`} /> : <div className="storefront-fallback" />}
          <figcaption>
            Street view, {name || 'your shop'} · {brand.toUpperCase()}
          </figcaption>
        </figure>
        <div className="brand-controls card">
          <h3>Signature colour</h3>
          <BrandSwatches size="lg" idPrefix="section" />
          <h4>What changes</h4>
          <ul className="brand-list">
            <li>
              <span className="bl-dot" /> Fascia sign and awning <b>3</b>
            </li>
            {counts.slice(0, 7).map(([n, c]) => (
              <li key={n}>
                <span className="bl-dot" /> {n} <b>{c}</b>
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost sm" onClick={scrollToPlanner}>
            See it in the planner
          </button>
        </div>
      </div>
    </section>
  );
}

function CostSection() {
  const cost = useCost();
  const items = useStore((s) => s.items);
  const room = useStore((s) => s.room);
  const cap = useCapacity();
  const tiers = useMemo(() => TIERS.map((t) => ({ ...t, report: costReport(items, t.id, cap.seats, room.width * room.depth) })), [items, cap.seats, room]);
  const tier = useStore((s) => s.costTier);
  const colors = ['var(--charcoal)', 'var(--brand)', 'var(--oat-3)', 'var(--ink-2)', 'var(--brand-soft)', 'var(--oat-2)'];
  return (
    <section className="section" id="cost" aria-labelledby="cost-h">
      <div className="section-head">
        <span className="eyebrow">Cost estimator</span>
        <h2 id="cost-h">Know the furniture budget before you get quotes.</h2>
        <p>
          Every piece you place is priced at three specification levels, with delivery, install and contingency on top. Use it to sanity-check
          supplier quotes and to see what each seat costs you.
        </p>
      </div>
      <div className="cost-grid">
        <div className="tier-cards">
          {tiers.map((t) => (
            <button key={t.id} className={`tier-card ${tier === t.id ? 'on' : ''}`} onClick={() => store.getState().setCostTier(t.id)} aria-pressed={tier === t.id}>
              <span className="eyebrow">{t.label}</span>
              <b>{money(t.report.total)}</b>
              <span>{t.note}</span>
              <span className="tier-meta">
                {money(t.report.perSeat)} / seat · {money(t.report.perM2)} / m²
              </span>
            </button>
          ))}
        </div>
        <div className="breakdown card">
          <div className="bd-head">
            <h3>Where the money goes</h3>
            <TierSwitch id="tier-section" />
          </div>
          <div className="stack" role="img" aria-label="Cost by category">
            {cost.groups.map((g, i) => (
              <span key={g.id} style={{ width: `${(g.total / Math.max(1, cost.subtotal)) * 100}%`, background: colors[i % colors.length] }} title={`${g.label}: ${money(g.total)}`} />
            ))}
          </div>
          <ul className="bd-legend">
            {cost.groups.map((g, i) => (
              <li key={g.id}>
                <span className="sw" style={{ background: colors[i % colors.length] }} />
                <span>{g.label}</span>
                <b>{money(g.total)}</b>
                <small>{Math.round((g.total / Math.max(1, cost.subtotal)) * 100)}%</small>
              </li>
            ))}
          </ul>
          <div className="bd-top">
            <h4>Biggest lines</h4>
            <ol>
              {cost.lines.slice(0, 4).map((l) => (
                <li key={l.type}>
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <b>{money(l.total)}</b>
                </li>
              ))}
            </ol>
          </div>
          <button className="btn btn-primary sm" onClick={() => { store.getState().setCostOpen(true); scrollToPlanner(); }}>
            Open the estimate panel
          </button>
        </div>
      </div>
    </section>
  );
}

export function Sections() {
  return (
    <main className="sections">
      <TemplatesSection />
      <CapacitySection />
      <BrandSection />
      <CostSection />
    </main>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <strong>Fitout</strong> plans cafés, studios, shops and dining rooms in the browser. Layouts save to this device.
      </div>
      <div className="muted">Capacity and egress figures are planning estimates based on IBC factors. Prices are indicative US trade rates.</div>
    </footer>
  );
}
