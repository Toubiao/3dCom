import { useEffect, type CSSProperties } from 'react';
import { useStore } from './state/store';
import { TopBar } from './components/TopBar';
import { Library } from './components/Library';
import { Viewport } from './components/Viewport';
import { Inspector } from './components/Inspector';
import { CostDrawer } from './components/CostDrawer';
import { ExportModal } from './components/ExportModal';
import { Footer, SectionNav, Sections } from './components/Sections';
import { useKeyboard } from './hooks/useKeyboard';
import { useToasts, dismissToast } from './state/toast';
import { contrast, inkFor, mix } from './logic/color';
import { IconClose } from './components/Icons';

/** Brand tokens derived from the user's colour, applied to the whole page. */
const brandVars = (brand: string): CSSProperties =>
  ({
    '--brand': brand,
    '--brand-ink': inkFor(brand),
    '--brand-soft': mix(brand, '#F4EDE2', 0.55),
    '--brand-wash': mix(brand, '#FAF7F1', 0.88),
    '--brand-text': contrast(brand, '#FAF7F1') >= 3.2 ? brand : mix(brand, '#1F1E1C', 0.55),
  }) as CSSProperties;

function Toasts() {
  const list = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.action && (
            <button
              className="toast-act"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="toast-x" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const brand = useStore((s) => s.brand);
  const costOpen = useStore((s) => s.costOpen);
  useKeyboard();

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(brandVars(brand)).forEach(([k, v]) => root.style.setProperty(k, String(v)));
  }, [brand]);

  return (
    <>
      <div className="workspace" id="top">
        <TopBar />
        <div className={`ws-body ${costOpen ? 'cost-open' : ''}`}>
          <Library />
          <Viewport />
          <Inspector />
          <CostDrawer />
        </div>
        <SectionNav />
      </div>
      <Sections />
      <Footer />
      <ExportModal />
      <Toasts />
    </>
  );
}
