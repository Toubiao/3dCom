import type { Category, CostTier, PlacedItem } from '../types';
import { CATEGORIES, getDef } from '../data/catalog';

export const TIERS: { id: CostTier; label: string; mult: number; note: string }[] = [
  { id: 'budget', label: 'Budget', mult: 0.62, note: 'Contract-grade stock lines' },
  { id: 'standard', label: 'Standard', mult: 1, note: 'Mid-market hospitality spec' },
  { id: 'premium', label: 'Premium', mult: 1.8, note: 'Designer pieces, custom joinery' },
];

export const INSTALL_RATE = 0.12;
export const CONTINGENCY_RATE = 0.08;

export interface CostLine {
  type: string;
  name: string;
  category: Category;
  qty: number;
  unit: number;
  total: number;
}

export interface CostReport {
  tier: CostTier;
  lines: CostLine[];
  groups: { id: Category; label: string; total: number; lines: CostLine[] }[];
  subtotal: number;
  install: number;
  contingency: number;
  total: number;
  perSeat: number;
  perM2: number;
  itemCount: number;
}

export const costReport = (items: PlacedItem[], tier: CostTier, seats: number, area: number): CostReport => {
  const mult = TIERS.find((t) => t.id === tier)!.mult;
  const byType = new Map<string, number>();
  for (const it of items) byType.set(it.type, (byType.get(it.type) ?? 0) + 1);
  const lines: CostLine[] = [...byType.entries()].map(([type, qty]) => {
    const def = getDef(type);
    const unit = Math.round((def.price * mult) / 5) * 5;
    return { type, name: def.name, category: def.category, qty, unit, total: unit * qty };
  });
  lines.sort((a, b) => b.total - a.total);
  const groups = CATEGORIES.map((c) => {
    const ls = lines.filter((l) => l.category === c.id);
    return { id: c.id, label: c.label, total: ls.reduce((s, l) => s + l.total, 0), lines: ls };
  }).filter((g) => g.lines.length);
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const install = Math.round(subtotal * INSTALL_RATE);
  const contingency = Math.round((subtotal + install) * CONTINGENCY_RATE);
  const total = subtotal + install + contingency;
  return {
    tier,
    lines,
    groups,
    subtotal,
    install,
    contingency,
    total,
    perSeat: seats ? total / seats : 0,
    perM2: area ? total / area : 0,
    itemCount: items.length,
  };
};

export const money = (v: number, compact = false) => {
  if (compact && Math.abs(v) >= 1000) {
    const k = v / 1000;
    return `$${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `$${Math.round(v).toLocaleString('en-US')}`;
};
