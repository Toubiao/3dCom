import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { store, useStore } from '../state/store';
import { currentReports } from '../logic/analysis';
import { getPlanner } from '../engine/Planner';
import { PlanDrawing } from './PlanSVG';
import { fileName, planPlacement, SHEET, sheetDate } from '../logic/sheet';
import { buildPdf } from '../logic/pdf';
import { money, TIERS } from '../logic/cost';
import { TEMPLATES } from '../data/templates';
import { IconCheck, IconClose, IconDownload } from './Icons';

const STEPS = [
  'Setting up the A3 sheet',
  'Drawing walls and openings',
  'Placing furniture',
  'Tracing escape routes',
  'Rendering the perspective',
  'Writing capacity and cost schedules',
  'Saving the PDF',
];

/** ms at which the first build phases start; later phases follow the furniture pop-in. */
const T_FRAME = 150;
const T_WALLS = 650;
const T_ITEMS = 1050;

export function ExportModal() {
  const open = useStore((s) => s.exportOpen);
  if (!open) return null;
  return <ExportSheet />;
}

function ExportSheet() {
  const s = useStore((x) => x);
  const reports = useMemo(() => currentReports(), []); // freeze the layout being exported
  const snapshot = useMemo(() => ({ room: s.room, items: s.items, name: s.projectName, brand: s.brand, templateId: s.templateId, sprinklered: s.sprinklered }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState(0);
  const [render, setRender] = useState<string | null>(null);
  const [done, setDone] = useState<{ ok: boolean; name: string } | null>(null);
  const pdfRef = useRef<ReturnType<typeof buildPdf> | null>(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const n = snapshot.items.length;
  const itemSpan = Math.min(1500, Math.max(700, n * 28));
  const stagger = itemSpan / Math.max(1, n);

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, reduced ? 0 : ms));
    const t4 = T_ITEMS + itemSpan + 250;
    const schedule = [T_FRAME, T_WALLS, T_ITEMS, t4, t4 + 450, t4 + 1000, t4 + 1700];
    schedule.forEach((ms, i) => at(ms, () => setPhase(i + 1)));
    // capture the 3D render as the perspective phase begins
    at(t4 + 380, () => {
      try {
        setRender(getPlanner()?.capture({ width: 1248, height: 744, shot: 'aerial' }) ?? null);
      } catch {
        setRender(null);
      }
    });
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 7) return;
    const id = window.setTimeout(() => {
      try {
        const doc = buildPdf({
          projectName: snapshot.name,
          templateId: snapshot.templateId,
          room: snapshot.room,
          items: snapshot.items,
          brand: snapshot.brand,
          capacity: reports.capacity,
          cost: reports.cost,
          egress: reports.egress,
          render,
          sprinklered: snapshot.sprinklered,
        });
        pdfRef.current = doc;
        const name = fileName(snapshot.name);
        doc.save(name);
        setDone({ ok: true, name });
      } catch (err) {
        console.error(err);
        setDone({ ok: false, name: '' });
      }
    }, reduced ? 0 : 500);
    return () => clearTimeout(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && store.getState().setExportOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => store.getState().setExportOpen(false);
  const classes = Array.from({ length: phase }, (_, i) => `p${i + 1}`).join(' ');
  const { scale, k, cx, cy } = planPlacement(snapshot.room);
  const cap = reports.capacity;
  const cost = reports.cost;
  const tpl = TEMPLATES[snapshot.templateId];
  const col = SHEET.col;
  const x0 = col.x + 6;
  const cw = col.w - 12;

  return (
    <div className="export-modal" role="dialog" aria-modal="true" aria-label="Export layout sheet">
      <div className="export-backdrop" onClick={close} />
      <div className="export-shell">
        <div className="export-side">
          <span className="eyebrow">Export</span>
          <h2>Layout sheet A-101</h2>
          <p className="muted">A3 landscape, 1:{scale}. Plan, perspective, capacity checks and the estimate on one page.</p>
          <ol className="export-steps">
            {STEPS.map((label, i) => {
              const state = done && i === 6 ? 'done' : phase > i + 1 ? 'done' : phase === i + 1 ? 'active' : '';
              return (
                <li key={label} className={state}>
                  <span className="step-dot">{state === 'done' ? <IconCheck size={12} /> : null}</span>
                  {i === 2 ? `Placing ${n} pieces` : label}
                </li>
              );
            })}
          </ol>
          <div className="export-actions">
            {done?.ok && (
              <p className="saved">
                <IconCheck size={15} /> Saved <code>{done.name}</code>
              </p>
            )}
            {done && !done.ok && <p className="saved bad">The PDF could not be written in this browser. Try again, or use the CSV from the estimate panel.</p>}
            <button className="btn btn-primary" disabled={!done} onClick={() => pdfRef.current?.save(fileName(snapshot.name))}>
              <IconDownload size={16} /> {done ? 'Download again' : 'Building…'}
            </button>
            <button className="btn btn-ghost" onClick={close}>
              Close
            </button>
          </div>
        </div>
        <div className="export-stage">
          <button className="icon-btn export-close" onClick={close} aria-label="Close export">
            <IconClose />
          </button>
          <svg
            className={`sheet ${classes} ${reduced ? 'reduced' : ''}`}
            viewBox={`0 0 ${SHEET.w} ${SHEET.h}`}
            style={{ '--stagger': `${stagger}ms`, '--brand': snapshot.brand } as CSSProperties}
            role="img"
            aria-label={`Layout sheet for ${snapshot.name}`}
          >
            <rect className="s-paper" x="0" y="0" width={SHEET.w} height={SHEET.h} />
            <g className="s-frame" fill="none" stroke="var(--charcoal)">
              <rect x={SHEET.frame.x} y={SHEET.frame.y} width={SHEET.frame.w} height={SHEET.frame.h} strokeWidth="0.5" pathLength={100} />
              <line x1={col.x} y1={SHEET.frame.y} x2={col.x} y2={SHEET.frame.y + SHEET.frame.h} strokeWidth="0.25" pathLength={100} />
              {[SHEET.capacity.y, SHEET.cost.y, SHEET.title.y].map((y) => (
                <line key={y} x1={col.x} y1={y} x2={col.x + col.w} y2={y} strokeWidth="0.25" pathLength={100} />
              ))}
            </g>
            <g className="s-head">
              <text x={SHEET.draw.x + 8} y={SHEET.draw.y + 12} className="t-h">
                GROUND FLOOR PLAN
              </text>
              <text x={SHEET.draw.x + 8} y={SHEET.draw.y + 18} className="t-s">
                Furniture layout · Scale 1:{scale} at A3 · {snapshot.room.width.toFixed(2)} × {snapshot.room.depth.toFixed(2)} m · {(snapshot.room.width * snapshot.room.depth).toFixed(1)} m²
              </text>
              <g transform={`translate(${SHEET.draw.x + SHEET.draw.w - 18} ${SHEET.draw.y + 14})`}>
                <circle r="5" fill="none" stroke="var(--charcoal)" strokeWidth="0.3" />
                <path d="M0 -4.5 L-2 2 L2 2Z" fill="var(--charcoal)" />
                <text y="9.5" textAnchor="middle" className="t-xs">
                  N
                </text>
              </g>
            </g>
            <g className="s-plan" transform={`translate(${cx} ${cy}) scale(${k})`}>
              <PlanDrawing room={snapshot.room} items={snapshot.items} egress={reports.egress} staged />
            </g>
            <g className="s-legend" transform={`translate(${SHEET.draw.x + 8} ${SHEET.draw.y + SHEET.draw.h - 14})`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <rect key={i} x={i * k} y={0} width={k} height={1.6} fill={i % 2 ? '#fff' : 'var(--charcoal)'} stroke="var(--charcoal)" strokeWidth="0.2" />
              ))}
              <text x={0} y={5} textAnchor="middle" className="t-xs">
                0
              </text>
              <text x={5 * k} y={5} textAnchor="middle" className="t-xs">
                5 m
              </text>
              <g transform={`translate(${5 * k + 16} 0)`}>
                <line x1={0} y1={0.8} x2={10} y2={0.8} stroke="var(--exit)" strokeWidth="0.6" strokeDasharray="1.2 0.8" />
                <text x={12} y={1.8} className="t-xs">
                  Escape route
                </text>
                <rect x={36} y={-0.6} width={5} height={3} fill="var(--brand)" />
                <text x={43} y={1.8} className="t-xs">
                  Brand finish
                </text>
                <rect x={66} y={-0.6} width={5} height={3} fill="none" stroke="var(--charcoal)" strokeWidth="0.2" strokeDasharray="1.2 0.8" />
                <text x={73} y={1.8} className="t-xs">
                  Wall-mounted
                </text>
              </g>
            </g>

            <g className="s-render">
              <rect x={col.x} y={SHEET.render.y} width={col.w} height={SHEET.render.h} fill="var(--sheet-render)" />
              {render && (
                <image href={render} x={col.x + 2} y={SHEET.render.y + 2} width={col.w - 4} height={SHEET.render.h - 10} preserveAspectRatio="xMidYMid slice" />
              )}
              <rect className={`wipe ${render ? 'ready' : ''}`} x={col.x + 1.5} y={SHEET.render.y + 1.5} width={col.w - 3} height={SHEET.render.h - 9} />
              <text x={x0} y={SHEET.render.y + SHEET.render.h - 2.6} className="t-xs soft">
                PERSPECTIVE · NOT TO SCALE
              </text>
            </g>

            <g className="s-cap">
              <text x={x0} y={SHEET.capacity.y + 7} className="t-b">
                CAPACITY &amp; EGRESS
              </text>
              <text x={x0} y={SHEET.capacity.y + 11.2} className="t-xs soft">
                {cap.occupancyLabel} · {snapshot.sprinklered ? 'sprinklered' : 'unsprinklered'}
              </text>
              {[
                ['seats', String(cap.seats), 0],
                ['max occupants', String(cap.maxOccupants), 24],
                ['m² per seat', cap.seats ? cap.m2PerSeat.toFixed(1) : '–', 54],
                ['max travel', `${cap.travel.toFixed(1)} m`, 78],
              ].map(([l, v, dx]) => (
                <g key={l as string} transform={`translate(${x0 + (dx as number)} ${SHEET.capacity.y + 18})`}>
                  <text className="t-big">{v}</text>
                  <text y={3.6} className="t-xs soft">
                    {l}
                  </text>
                </g>
              ))}
              {cap.checks.map((c, i) => (
                <g key={c.id} className="s-row" style={{ '--r': i } as CSSProperties} transform={`translate(0 ${SHEET.capacity.y + 27 + i * 4.6})`}>
                  <circle cx={x0 + 1.2} cy={-0.9} r={1.1} fill={c.status === 'pass' ? 'var(--ok)' : c.status === 'warn' ? 'var(--warn)' : 'var(--bad)'} />
                  <text x={x0 + 4} className="t-r">
                    {c.label}
                  </text>
                  <text x={x0 + cw - 26} textAnchor="end" className="t-r">
                    {c.value}
                  </text>
                  <text x={x0 + cw} textAnchor="end" className="t-r soft">
                    {c.limit}
                  </text>
                </g>
              ))}
            </g>

            <g className="s-cost">
              <text x={x0} y={SHEET.cost.y + 7} className="t-b">
                FURNITURE &amp; FIXTURES ESTIMATE
              </text>
              <text x={x0} y={SHEET.cost.y + 11.2} className="t-xs soft">
                {TIERS.find((t) => t.id === cost.tier)!.label} specification · USD before tax
              </text>
              {[
                ...cost.groups.map((g) => [`${g.label} (${g.lines.reduce((a, l) => a + l.qty, 0)})`, money(g.total)]),
                ['Delivery & install', money(cost.install)],
                ['Contingency', money(cost.contingency)],
              ]
                .slice(0, 8)
                .map(([a, b], i) => (
                  <g key={a} className="s-row" style={{ '--r': i } as CSSProperties} transform={`translate(0 ${SHEET.cost.y + 17 + i * 4.4})`}>
                    <text x={x0} className="t-r">
                      {a}
                    </text>
                    <text x={x0 + cw} textAnchor="end" className="t-r">
                      {b}
                    </text>
                    <line x1={x0} y1={1.4} x2={x0 + cw} y2={1.4} stroke="var(--sheet-line)" strokeWidth="0.1" />
                  </g>
                ))}
              <g className="s-row" style={{ '--r': 9 } as CSSProperties} transform={`translate(0 ${SHEET.cost.y + 17 + Math.min(8, cost.groups.length + 2) * 4.4 + 2.5})`}>
                <text x={x0} className="t-tot">
                  Total
                </text>
                <text x={x0 + cw} textAnchor="end" className="t-tot">
                  {money(cost.total)}
                </text>
              </g>
            </g>

            <g className="s-title">
              <rect x={col.x} y={SHEET.title.y} width={6} height={SHEET.title.h} fill="var(--brand)" />
              <text x={x0 + 4} y={SHEET.title.y + 7} className="t-xs soft">
                PROJECT
              </text>
              <text x={x0 + 4} y={SHEET.title.y + 14} className="t-proj">
                {snapshot.name || 'Untitled layout'}
              </text>
              <text x={x0 + 4} y={SHEET.title.y + 19} className="t-xs soft">
                {tpl.label} fit-out · {tpl.tagline}
              </text>
              {[
                ['SHEET', 'A-101'],
                ['SCALE', `1:${scale} @ A3`],
                ['DATE', sheetDate()],
                ['BRAND', snapshot.brand.toUpperCase()],
              ].map(([l, v], i) => (
                <g key={l} transform={`translate(${x0 + 4 + (i % 2) * 50} ${SHEET.title.y + 31 + Math.floor(i / 2) * 12})`}>
                  <text className="t-xs soft">{l}</text>
                  <text y={4.6} className="t-cell">
                    {v}
                  </text>
                </g>
              ))}
              <text x={x0 + 4} y={SHEET.title.y + SHEET.title.h - 4} className="t-xxs soft">
                Planning estimate. Confirm occupant load and egress with the local building official.
              </text>
            </g>
            <g className="s-stamp" transform={`translate(${col.x - 34} ${SHEET.draw.y + SHEET.draw.h - 16}) rotate(-6)`}>
              <g className="stamp-inner">
                <rect x={-22} y={-7} width={44} height={14} rx={2} fill="none" stroke="var(--brand)" strokeWidth="0.8" />
                <text textAnchor="middle" y={2.2} className="t-stamp">
                  ISSUED {sheetDate().toUpperCase()}
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
