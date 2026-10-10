import { useStore, store } from '../state/store';
import { TEMPLATES, TEMPLATE_ORDER } from '../data/templates';
import { useCost } from '../logic/analysis';
import { money } from '../logic/cost';
import { IconDownload, IconReceipt, TEMPLATE_ICON } from './Icons';
import { toast } from '../state/toast';
import type { TemplateId } from '../types';
import { useTween } from './Odometer';

export const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
    <path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="var(--paper-2)" stroke="var(--charcoal)" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M4 9.5 16 16l12-6.5M16 16v13" fill="none" stroke="var(--charcoal)" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M16 16 28 9.5v13L16 29z" fill="var(--brand)" />
    <path d="M16 16 28 9.5v13L16 29z" fill="none" stroke="var(--charcoal)" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export const switchTemplate = (id: TemplateId) => {
  const s = store.getState();
  if (s.templateId === id && s.past.length === 0) return;
  s.loadTemplate(id);
  toast(`Loaded ${TEMPLATES[id].label.toLowerCase()} template: ${TEMPLATES[id].project}`, { label: 'Undo', run: () => store.getState().undo() });
};

export function TopBar() {
  const projectName = useStore((s) => s.projectName);
  const templateId = useStore((s) => s.templateId);
  const room = useStore((s) => s.room);
  const costOpen = useStore((s) => s.costOpen);
  const cost = useCost();
  const total = useTween(cost.total);

  return (
    <header className="topbar">
      <a className="brandmark" href="#top" aria-label="Fitout home">
        <Logo />
        <span className="wordmark">Fitout</span>
      </a>
      <div className="project">
        <label htmlFor="project-name" className="sr-only">
          Project name
        </label>
        <input
          id="project-name"
          className="project-name"
          value={projectName}
          maxLength={40}
          spellCheck={false}
          onChange={(e) => store.getState().setProjectName(e.target.value)}
        />
        <span className="project-meta">
          {TEMPLATES[templateId].label} · {room.width.toFixed(1)} × {room.depth.toFixed(1)} m · {(room.width * room.depth).toFixed(0)} m²
        </span>
      </div>
      <div className="seg templates" role="radiogroup" aria-label="Template">
        {TEMPLATE_ORDER.map((id) => {
          const Icon = TEMPLATE_ICON[id];
          return (
            <button
              key={id}
              role="radio"
              aria-checked={templateId === id}
              className={templateId === id ? 'on' : ''}
              onClick={() => switchTemplate(id)}
              title={`${TEMPLATES[id].label}: ${TEMPLATES[id].tagline}`}
            >
              <Icon size={16} />
              <span>{TEMPLATES[id].label}</span>
            </button>
          );
        })}
      </div>
      <select
        className="templates-select"
        aria-label="Template"
        value={templateId}
        onChange={(e) => switchTemplate(e.target.value as TemplateId)}
      >
        {TEMPLATE_ORDER.map((id) => (
          <option key={id} value={id}>
            {TEMPLATES[id].label}
          </option>
        ))}
      </select>
      <div className="topbar-actions">
        <button
          className={`btn btn-ghost btn-estimate ${costOpen ? 'on' : ''}`}
          aria-pressed={costOpen}
          onClick={() => store.getState().setCostOpen(!costOpen)}
        >
          <IconReceipt size={17} />
          <span className="lbl">Estimate</span>
          <b className="num">{money(total, true)}</b>
        </button>
        <button className="btn btn-primary" onClick={() => store.getState().setExportOpen(true)}>
          <IconDownload size={17} />
          <span>Export PDF</span>
        </button>
      </div>
    </header>
  );
}
