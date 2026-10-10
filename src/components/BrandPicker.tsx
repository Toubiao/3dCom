import { useEffect, useRef, useState } from 'react';
import { store, useStore } from '../state/store';
import { BRAND_PRESETS } from '../data/templates';
import { isHex, normalizeHex, inkFor, contrast } from '../logic/color';
import { IconCheck, IconPalette } from './Icons';

export function BrandSwatches({ size = 'md', idPrefix = 'brand' }: { size?: 'md' | 'lg'; idPrefix?: string }) {
  const brand = useStore((s) => s.brand);
  const [hex, setHex] = useState(brand);
  useEffect(() => setHex(brand), [brand]);
  const set = (h: string) => store.getState().setBrand(normalizeHex(h));
  const readable = contrast(brand, '#FAF7F1') >= 3;
  return (
    <div className={`brand-swatches size-${size}`}>
      <div className="swatch-row" role="radiogroup" aria-label="Brand colour presets">
        {BRAND_PRESETS.map((p) => {
          const on = p.hex.toUpperCase() === brand.toUpperCase();
          return (
            <button
              key={p.hex}
              role="radio"
              aria-checked={on}
              className={`swatch ${on ? 'on' : ''}`}
              style={{ background: p.hex, color: inkFor(p.hex) }}
              onClick={() => set(p.hex)}
              title={p.name}
              aria-label={p.name}
            >
              {on && <IconCheck size={size === 'lg' ? 18 : 14} />}
            </button>
          );
        })}
      </div>
      <div className="custom-row">
        <label className="color-well" style={{ background: brand }} title="Pick any colour">
          <input
            id={`${idPrefix}-color`}
            type="color"
            value={brand.length === 7 ? brand.toLowerCase() : '#c4572f'}
            onChange={(e) => set(e.target.value)}
            aria-label="Custom brand colour"
          />
        </label>
        <label className="hex-field">
          <span>HEX</span>
          <input
            id={`${idPrefix}-hex`}
            value={hex}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              setHex(e.target.value);
              if (isHex(e.target.value)) set(e.target.value);
            }}
            onBlur={() => setHex(brand)}
            aria-label="Brand colour hex code"
          />
        </label>
      </div>
      {!readable && <p className="swatch-note">Light colours recolour the room but are hard to read as text, so the interface keeps charcoal labels on them.</p>}
    </div>
  );
}

export function BrandButton() {
  const brand = useStore((s) => s.brand);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="brand-btn-wrap" ref={ref}>
      <button className={`brand-btn ${open ? 'on' : ''}`} aria-expanded={open} aria-haspopup="dialog" aria-label="Brand colour" title="Brand colour" onClick={() => setOpen((o) => !o)}>
        <IconPalette size={16} />
        <span>Brand</span>
        <span className="brand-dot" style={{ background: brand }} />
      </button>
      {open && (
        <div className="popover brand-pop" role="dialog" aria-label="Brand colour">
          <div className="pop-head">
            <strong>Brand colour</strong>
            <span>Counter fronts, upholstery, signage, awning and rugs recolour live.</span>
          </div>
          <BrandSwatches idPrefix="pop" />
        </div>
      )}
    </div>
  );
}
