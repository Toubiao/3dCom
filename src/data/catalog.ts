import type { Category, ItemDef } from '../types';

const d = (def: Omit<ItemDef, 'solid'> & { solid?: boolean }): ItemDef => ({ solid: true, ...def });

export const CATALOG: ItemDef[] = [
  // Seating
  d({ type: 'cafe_chair', name: 'Bistro chair', category: 'seating', w: 0.46, d: 0.5, h: 0.82, seats: 1, price: 145, branded: true, solid: false, blurb: 'Bentwood frame, upholstered seat pad.' }),
  d({ type: 'bar_stool', name: 'Counter stool', category: 'seating', w: 0.42, d: 0.42, h: 0.76, seats: 1, price: 165, branded: true, solid: false, blurb: '65 cm seat height for counters and ledges.' }),
  d({ type: 'task_chair', name: 'Task chair', category: 'seating', w: 0.6, d: 0.6, h: 1.0, seats: 1, price: 390, branded: true, solid: false, blurb: 'Swivel base, adjustable height.' }),
  d({ type: 'lounge_chair', name: 'Lounge armchair', category: 'seating', w: 0.78, d: 0.78, h: 0.8, seats: 1, price: 620, branded: true, solid: false, blurb: 'Deep upholstered armchair.' }),
  d({ type: 'sofa', name: 'Two-seat sofa', category: 'seating', w: 1.6, d: 0.86, h: 0.8, seats: 2, price: 1400, branded: true, blurb: 'Low-back sofa for lounges and fitting areas.' }),
  d({ type: 'banquette', name: 'Banquette 2.4 m', category: 'seating', w: 2.4, d: 0.66, h: 1.0, seats: 4, price: 1850, branded: true, blurb: 'Wall-run bench seating, seats four.' }),
  d({ type: 'booth', name: 'Booth for four', category: 'seating', w: 1.3, d: 2.1, h: 1.15, seats: 4, price: 2600, branded: true, blurb: 'Two high-back benches with a fixed table.' }),
  d({ type: 'bench', name: 'Oak bench 1.6 m', category: 'seating', w: 1.6, d: 0.4, h: 0.45, seats: 2, price: 340, branded: false, solid: false, blurb: 'Solid oak, backless.' }),

  // Tables
  d({ type: 'bistro_table', name: 'Bistro table Ø60', category: 'tables', w: 0.6, d: 0.6, h: 0.74, seats: 0, price: 210, branded: false, round: true, blurb: 'Cast base, stone top. Seats two.' }),
  d({ type: 'table_2', name: 'Two-top 70×70', category: 'tables', w: 0.7, d: 0.7, h: 0.74, seats: 0, price: 240, branded: false, blurb: 'Square table for pairs.' }),
  d({ type: 'table_4', name: 'Four-top 120×80', category: 'tables', w: 1.2, d: 0.8, h: 0.74, seats: 0, price: 380, branded: false, blurb: 'Standard dining table for four.' }),
  d({ type: 'table_6', name: 'Six-top 180×90', category: 'tables', w: 1.8, d: 0.9, h: 0.74, seats: 0, price: 560, branded: false, blurb: 'Group dining table for six.' }),
  d({ type: 'communal_table', name: 'Communal table 3 m', category: 'tables', w: 3.0, d: 1.0, h: 0.74, seats: 0, price: 1450, branded: false, blurb: 'Long shared table, seats eight.' }),
  d({ type: 'high_top', name: 'High-top Ø70', category: 'tables', w: 0.7, d: 0.7, h: 1.05, seats: 0, price: 290, branded: false, round: true, blurb: 'Bar-height round table.' }),
  d({ type: 'coffee_table', name: 'Coffee table', category: 'tables', w: 0.9, d: 0.5, h: 0.4, seats: 0, price: 260, branded: false, blurb: 'Low walnut table for lounges.' }),

  // Counters & fixtures
  d({ type: 'espresso_bar', name: 'Espresso bar 3.6 m', category: 'counters', w: 3.6, d: 0.8, h: 1.05, seats: 0, price: 9800, branded: true, blurb: 'Counter with machine, grinders and register.' }),
  d({ type: 'pastry_case', name: 'Pastry case 1.5 m', category: 'counters', w: 1.5, d: 0.75, h: 1.25, seats: 0, price: 4200, branded: true, blurb: 'Refrigerated curved-glass display.' }),
  d({ type: 'back_counter', name: 'Back counter 3 m', category: 'counters', w: 3.0, d: 0.6, h: 0.92, seats: 0, price: 2900, branded: false, blurb: 'Under-counter fridges and storage.' }),
  d({ type: 'window_counter', name: 'Window ledge 3 m', category: 'counters', w: 3.0, d: 0.45, h: 1.05, seats: 0, price: 900, branded: false, blurb: 'Oak ledge for stool seating at the glass.' }),
  d({ type: 'condiment', name: 'Condiment station', category: 'counters', w: 0.9, d: 0.5, h: 0.92, seats: 0, price: 780, branded: false, blurb: 'Milk, lids, napkins and waste.' }),
  d({ type: 'bar_counter', name: 'Bar counter 4 m', category: 'counters', w: 4.0, d: 0.7, h: 1.1, seats: 0, price: 8600, branded: true, blurb: 'Front bar with foot rail and taps.' }),
  d({ type: 'host_stand', name: 'Host stand', category: 'counters', w: 0.6, d: 0.45, h: 1.1, seats: 0, price: 520, branded: true, blurb: 'Reservations and menus at the door.' }),
  d({ type: 'kitchen_line', name: 'Kitchen line 3.6 m', category: 'counters', w: 3.6, d: 0.9, h: 1.0, seats: 0, price: 18500, branded: false, blurb: 'Range, fryer, plancha and hood.' }),
  d({ type: 'menu_board', name: 'Menu board', category: 'counters', w: 1.8, d: 0.08, h: 2.4, seats: 0, price: 650, branded: true, solid: false, wallMounted: true, blurb: 'Wall-hung menu, mounted at 1.5 m.' }),

  // Office
  d({ type: 'desk', name: 'Desk 140×70', category: 'office', w: 1.4, d: 0.7, h: 0.74, seats: 0, price: 480, branded: false, blurb: 'Single workstation with cable tray.' }),
  d({ type: 'desk_pod', name: 'Desk pod ×4', category: 'office', w: 2.8, d: 1.4, h: 1.15, seats: 0, price: 2400, branded: true, blurb: 'Four benching desks with acoustic screens.' }),
  d({ type: 'meeting_table', name: 'Meeting table 240', category: 'office', w: 2.4, d: 1.1, h: 0.74, seats: 0, price: 1650, branded: false, blurb: 'Seats six to eight.' }),
  d({ type: 'phone_booth', name: 'Phone booth', category: 'office', w: 1.0, d: 1.0, h: 2.2, seats: 1, price: 6900, branded: true, blurb: 'Acoustic single-person booth.' }),
  d({ type: 'reception', name: 'Reception desk', category: 'office', w: 2.2, d: 0.8, h: 1.1, seats: 0, price: 3400, branded: true, blurb: 'Front desk with transaction ledge.' }),
  d({ type: 'lockers', name: 'Locker wall 2 m', category: 'office', w: 2.0, d: 0.5, h: 1.9, seats: 0, price: 1900, branded: true, blurb: 'Twenty personal lockers.' }),
  d({ type: 'storage', name: 'Storage credenza', category: 'office', w: 1.6, d: 0.45, h: 0.75, seats: 0, price: 720, branded: false, blurb: 'Low storage with sliding doors.' }),
  d({ type: 'kitchenette', name: 'Kitchenette 2.4 m', category: 'office', w: 2.4, d: 0.65, h: 0.92, seats: 0, price: 3800, branded: false, blurb: 'Sink, fridge, coffee machine.' }),
  d({ type: 'whiteboard', name: 'Mobile whiteboard', category: 'office', w: 1.5, d: 0.5, h: 1.9, seats: 0, price: 420, branded: false, blurb: 'Double-sided, on castors.' }),

  // Retail
  d({ type: 'wall_shelf', name: 'Wall shelving 2.4 m', category: 'retail', w: 2.4, d: 0.45, h: 2.2, seats: 0, price: 1600, branded: true, blurb: 'Five shelves with branded backing.' }),
  d({ type: 'gondola', name: 'Gondola 1.8 m', category: 'retail', w: 1.8, d: 0.9, h: 1.4, seats: 0, price: 1100, branded: false, blurb: 'Double-sided mid-floor shelving.' }),
  d({ type: 'display_table', name: 'Nesting display', category: 'retail', w: 1.6, d: 0.9, h: 0.85, seats: 0, price: 950, branded: false, blurb: 'Two-level table for folded goods.' }),
  d({ type: 'clothing_rail', name: 'Clothing rail 1.5 m', category: 'retail', w: 1.5, d: 0.5, h: 1.6, seats: 0, price: 380, branded: false, blurb: 'Blackened steel hanging rail.' }),
  d({ type: 'cash_wrap', name: 'Cash wrap 2 m', category: 'retail', w: 2.0, d: 0.8, h: 1.0, seats: 0, price: 3200, branded: true, blurb: 'Checkout counter with wrap station.' }),
  d({ type: 'plinth', name: 'Display plinth', category: 'retail', w: 0.6, d: 0.6, h: 0.9, seats: 0, price: 360, branded: true, blurb: 'Painted plinth for hero products.' }),
  d({ type: 'mannequin', name: 'Mannequin', category: 'retail', w: 0.5, d: 0.5, h: 1.85, seats: 0, price: 480, branded: false, blurb: 'Full-height form on a steel base.' }),
  d({ type: 'fitting_room', name: 'Fitting room', category: 'retail', w: 1.2, d: 1.2, h: 2.2, seats: 0, price: 2300, branded: true, blurb: 'Framed cubicle with curtain and mirror.' }),

  // Decor & structure
  d({ type: 'planter', name: 'Planter, large', category: 'decor', w: 0.6, d: 0.6, h: 1.6, seats: 0, price: 340, branded: false, round: true, blurb: 'Olive tree in a fibre-clay pot.' }),
  d({ type: 'rug', name: 'Area rug 3×2', category: 'decor', w: 3.0, d: 2.0, h: 0.02, seats: 0, price: 650, branded: true, solid: false, blurb: 'Flatweave in the brand colour.' }),
  d({ type: 'partition', name: 'Partition 2 m', category: 'decor', w: 2.0, d: 0.12, h: 2.4, seats: 0, price: 900, branded: true, blurb: 'Framed partition with painted panel.' }),
];

export const CATALOG_BY_TYPE: Record<string, ItemDef> = Object.fromEntries(CATALOG.map((c) => [c.type, c]));

export const getDef = (type: string): ItemDef => {
  const def = CATALOG_BY_TYPE[type];
  if (!def) throw new Error(`Unknown item type: ${type}`);
  return def;
};

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'seating', label: 'Seating' },
  { id: 'tables', label: 'Tables' },
  { id: 'counters', label: 'Counters' },
  { id: 'office', label: 'Office' },
  { id: 'retail', label: 'Retail' },
  { id: 'decor', label: 'Decor' },
];

/** Multi-item sets offered at the top of the library. Offsets are relative to the set origin. */
export interface ItemSet {
  id: string;
  name: string;
  blurb: string;
  items: { type: string; x: number; z: number; rot: number }[];
}

const chairsAround = (
  tw: number,
  td: number,
  chair: string,
  perLongSide: number,
  ends = 0,
  gap = 0.3,
): { type: string; x: number; z: number; rot: number }[] => {
  const out: { type: string; x: number; z: number; rot: number }[] = [];
  const step = tw / perLongSide;
  for (let i = 0; i < perLongSide; i++) {
    const x = -tw / 2 + step * (i + 0.5);
    out.push({ type: chair, x, z: -td / 2 - gap, rot: 0 });
    out.push({ type: chair, x, z: td / 2 + gap, rot: Math.PI });
  }
  if (ends >= 1) out.push({ type: chair, x: -tw / 2 - gap, z: 0, rot: Math.PI / 2 });
  if (ends >= 2) out.push({ type: chair, x: tw / 2 + gap, z: 0, rot: -Math.PI / 2 });
  return out;
};

export const SETS: ItemSet[] = [
  {
    id: 'bistro_set',
    name: 'Bistro pair',
    blurb: 'Ø60 table, two chairs',
    items: [
      { type: 'bistro_table', x: 0, z: 0, rot: 0 },
      { type: 'cafe_chair', x: -0.55, z: 0, rot: Math.PI / 2 },
      { type: 'cafe_chair', x: 0.55, z: 0, rot: -Math.PI / 2 },
    ],
  },
  {
    id: 'four_set',
    name: 'Four-top set',
    blurb: '120×80 table, four chairs',
    items: [{ type: 'table_4', x: 0, z: 0, rot: 0 }, ...chairsAround(1.2, 0.8, 'cafe_chair', 2, 0, 0.32)],
  },
  {
    id: 'pod_set',
    name: 'Desk pod',
    blurb: 'Four desks, four task chairs',
    items: [{ type: 'desk_pod', x: 0, z: 0, rot: 0 }, ...chairsAround(2.8, 1.4, 'task_chair', 2, 0, 0.35)],
  },
  {
    id: 'meeting_set',
    name: 'Meeting set',
    blurb: '240 table, six chairs',
    items: [{ type: 'meeting_table', x: 0, z: 0, rot: 0 }, ...chairsAround(2.4, 1.1, 'task_chair', 3, 0, 0.36)],
  },
];

export { chairsAround };
