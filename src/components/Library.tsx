import { useMemo, useState, type DragEvent } from 'react';
import { CATALOG, CATEGORIES, SETS } from '../data/catalog';
import { store, useStore } from '../state/store';
import { ItemSymbol, SetSymbol } from './PlanSVG';
import { IconSearch } from './Icons';
import { money, TIERS } from '../logic/cost';
import type { Category } from '../types';

/** What is being dragged from the library; dataTransfer can't be read during dragover. */
export const libraryDrag: { current: { kind: 'item' | 'set'; id: string } | null } = { current: null };

type Filter = 'all' | 'sets' | Category;

const SUGGESTED: Record<string, Filter> = { cafe: 'seating', cowork: 'office', boutique: 'retail', restaurant: 'seating' };

export function Library() {
  const templateId = useStore((s) => s.templateId);
  const tier = useStore((s) => s.costTier);
  const mult = TIERS.find((t) => t.id === tier)!.mult;
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG.filter(
      (c) =>
        (filter === 'all' || filter === 'sets' || c.category === filter) &&
        (!needle || c.name.toLowerCase().includes(needle) || c.blurb.toLowerCase().includes(needle)),
    );
  }, [filter, q]);

  const showSets = (filter === 'all' || filter === 'sets') && !q.trim();

  const start = (e: DragEvent, kind: 'item' | 'set', id: string) => {
    libraryDrag.current = { kind, id };
    e.dataTransfer.setData('text/plain', `${kind}:${id}`);
    e.dataTransfer.effectAllowed = 'copy';
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };
  const end = () => {
    libraryDrag.current = null;
  };

  return (
    <aside className="library panel" aria-label="Furniture library">
      <div className="panel-head">
        <h2>Library</h2>
        <span className="panel-sub">{CATALOG.length} pieces</span>
      </div>
      <label className="search">
        <IconSearch size={16} />
        <span className="sr-only">Search the library</span>
        <input id="library-search" type="search" placeholder="Search chairs, counters…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="chips" role="tablist" aria-label="Category">
        {(['all', 'sets', ...CATEGORIES.map((c) => c.id)] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`chip ${filter === f ? 'on' : ''} ${SUGGESTED[templateId] === f && filter !== f ? 'hint' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'sets' ? 'Sets' : CATEGORIES.find((c) => c.id === f)!.label}
          </button>
        ))}
      </div>
      <div className="lib-scroll">
        {showSets && (
          <section className="lib-group">
            <h3>Quick sets</h3>
            <div className="lib-grid">
              {SETS.map((s) => (
                <button
                  key={s.id}
                  className="lib-card set"
                  draggable
                  onDragStart={(e) => start(e, 'set', s.id)}
                  onDragEnd={end}
                  onClick={() => store.getState().addSet(s.id)}
                  title={`Add ${s.name.toLowerCase()}: ${s.blurb}`}
                >
                  <span className="lib-thumb">
                    <SetSymbol items={s.items} size={58} />
                  </span>
                  <span className="lib-name">{s.name}</span>
                  <span className="lib-meta">{s.blurb}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {filter !== 'sets' &&
          CATEGORIES.filter((c) => list.some((i) => i.category === c.id)).map((c) => (
            <section className="lib-group" key={c.id}>
              <h3>{c.label}</h3>
              <div className="lib-grid">
                {list
                  .filter((i) => i.category === c.id)
                  .map((i) => (
                    <button
                      key={i.type}
                      className="lib-card"
                      draggable
                      onDragStart={(e) => start(e, 'item', i.type)}
                      onDragEnd={end}
                      onClick={() => store.getState().addItem(i.type)}
                      title={`${i.name}: ${i.blurb}`}
                    >
                      <span className="lib-thumb">
                        <ItemSymbol type={i.type} size={58} />
                        {i.seats > 0 && <span className="seat-pip">{i.seats}</span>}
                      </span>
                      <span className="lib-name">{i.name}</span>
                      <span className="lib-meta">
                        {Math.round(i.w * 100)}×{Math.round(i.d * 100)} · {money(Math.round((i.price * mult) / 5) * 5)}
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        {list.length === 0 && <p className="empty">Nothing matches “{q}”. Try “table” or “shelf”.</p>}
      </div>
      <p className="lib-foot">Drag onto the plan, or click to drop it in the nearest open spot.</p>
    </aside>
  );
}
