import { useEffect, useRef, useState } from 'react';
import { store, useStore } from '../state/store';
import { useCost } from '../logic/analysis';
import { CONTINGENCY_RATE, INSTALL_RATE, money, TIERS, type CostReport } from '../logic/cost';
import { IconClose, IconDownload } from './Icons';
import { useTween } from './Odometer';
import { ItemSymbol } from './PlanSVG';
import type { CostTier } from '../types';
import { slug } from '../logic/sheet';

/** Remember previous quantities so changed rows can flash. */
function useChanged(cost: CostReport) {
  const prev = useRef<Map<string, number>>(new Map());
  const [changed, setChanged] = useState<Record<string, number>>({});
  useEffect(() => {
    const next = new Map(cost.lines.map((l) => [l.type, l.qty]));
    const diff: Record<string, number> = {};
    for (const [t, q] of next) if (prev.current.size && prev.current.get(t) !== q) diff[t] = Date.now();
    prev.current = next;
    if (Object.keys(diff).length) setChanged((c) => ({ ...c, ...diff }));
  }, [cost.lines]);
  return changed;
}

export const downloadCsv = (cost: CostReport, name: string) => {
  const rows = [['Item', 'Category', 'Qty', 'Unit (USD)', 'Total (USD)']];
  cost.lines.forEach((l) => rows.push([l.name, l.category, String(l.qty), String(l.unit), String(l.total)]));
  rows.push([], ['FF&E subtotal', '', '', '', String(cost.subtotal)]);
  rows.push([`Delivery and install (${INSTALL_RATE * 100}%)`, '', '', '', String(cost.install)]);
  rows.push([`Contingency (${CONTINGENCY_RATE * 100}%)`, '', '', '', String(cost.contingency)]);
  rows.push(['Total', '', '', '', String(cost.total)]);
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(name) || 'layout'}-estimate.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

export function TierSwitch({ id = 'tier' }: { id?: string }) {
  const tier = useStore((s) => s.costTier);
  return (
    <div className="seg seg-tier" role="radiogroup" aria-label="Specification tier" id={id}>
      {TIERS.map((t) => (
        <button key={t.id} role="radio" aria-checked={tier === t.id} className={tier === t.id ? 'on' : ''} onClick={() => store.getState().setCostTier(t.id as CostTier)} title={t.note}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function CostDrawer() {
  const open = useStore((s) => s.costOpen);
  const name = useStore((s) => s.projectName);
  const tier = useStore((s) => s.costTier);
  const cost = useCost();
  const changed = useChanged(cost);
  const total = useTween(cost.total);
  const subtotal = useTween(cost.subtotal);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && store.getState().setCostOpen(false);
    window.addEventListener('keydown', onKey);
    ref.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <aside className={`cost-drawer ${open ? 'open' : ''}`} aria-label="Cost estimate" aria-hidden={!open} inert={!open || undefined} ref={ref} tabIndex={-1}>
      <div className="cd-head">
        <div>
          <span className="eyebrow">Cost estimate</span>
          <h2>Furniture &amp; fixtures</h2>
        </div>
        <button className="icon-btn" onClick={() => store.getState().setCostOpen(false)} aria-label="Close estimate">
          <IconClose />
        </button>
      </div>
      <TierSwitch id="tier-drawer" />
      <p className="muted small tier-note">{TIERS.find((t) => t.id === tier)!.note}. Prices in USD, before tax.</p>
      <div className="cd-total">
        <span className="cd-total-num">{money(total)}</span>
        <span className="cd-total-sub">
          {money(cost.perSeat)} per seat · {money(cost.perM2)} per m²
        </span>
      </div>
      <div className="cd-lines">
        {cost.groups.map((g) => (
          <section key={g.id} className="cd-group">
            <h3>
              <span>{g.label}</span>
              <span>{money(g.total)}</span>
            </h3>
            <ul>
              {g.lines.map((l) => (
                <li key={`${l.type}-${changed[l.type] ?? 0}`} className={changed[l.type] ? 'flash' : ''}>
                  <span className="cd-ico">
                    <ItemSymbol type={l.type} size={26} />
                  </span>
                  <span className="cd-name">
                    {l.name}
                    <small>
                      {l.qty} × {money(l.unit)}
                    </small>
                  </span>
                  <span className="cd-amt">{money(l.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!cost.lines.length && <p className="empty">Place furniture to start the estimate.</p>}
      </div>
      <div className="cd-foot">
        <dl>
          <div>
            <dt>FF&amp;E subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div>
            <dt>Delivery &amp; install · {INSTALL_RATE * 100}%</dt>
            <dd>{money(cost.install)}</dd>
          </div>
          <div>
            <dt>Contingency · {CONTINGENCY_RATE * 100}%</dt>
            <dd>{money(cost.contingency)}</dd>
          </div>
          <div className="grand">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
        <div className="btn-row">
          <button className="btn btn-ghost sm" onClick={() => downloadCsv(cost, name)}>
            <IconDownload size={15} /> CSV
          </button>
          <button className="btn btn-primary sm" onClick={() => store.getState().setExportOpen(true)}>
            <IconDownload size={15} /> Layout sheet PDF
          </button>
        </div>
      </div>
    </aside>
  );
}
