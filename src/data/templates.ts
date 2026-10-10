import type { FloorFinish, OccupancyCode, PlacedItem, Room, TemplateId } from '../types';
import { chairsAround } from './catalog';

const PI = Math.PI;
const H = PI / 2;

type Spec = [type: string, x: number, z: number, rot?: number];

export interface TemplateDef {
  id: TemplateId;
  label: string;
  project: string;
  tagline: string;
  occupancy: OccupancyCode;
  staff: number;
  /** Comfortable gross floor area per seat, in m². null when seats are not the sizing metric. */
  m2PerSeat: [number, number] | null;
  brand: string;
  floor: FloorFinish;
  room: Room;
  items: PlacedItem[];
  photo: { caption: string; time: string; cam: [number, number, number]; look: [number, number, number] };
}

let n = 0;
const build = (specs: Spec[]): PlacedItem[] =>
  specs.map(([type, x, z, rot = 0]) => ({ id: `t${++n}`, type, x: +x.toFixed(3), z: +z.toFixed(3), rot }));

/** Expand a table and its chairs, positioned and rotated as a group. */
const tableSet = (
  table: string,
  tw: number,
  td: number,
  chair: string,
  perSide: number,
  x: number,
  z: number,
  rot = 0,
  ends = 0,
  gap = 0.32,
): Spec[] => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const local = [{ type: table, x: 0, z: 0, rot: 0 }, ...chairsAround(tw, td, chair, perSide, ends, gap)];
  return local.map((it) => [it.type, x + it.x * c + it.z * s, z - it.x * s + it.z * c, it.rot + rot] as Spec);
};

const cafe: TemplateDef = {
  id: 'cafe',
  label: 'Café',
  project: 'Corner Café',
  tagline: 'Espresso bar, banquette run and a window ledge',
  occupancy: 'A-2',
  staff: 3,
  m2PerSeat: [2.2, 3.2],
  brand: '#C4572F',
  floor: 'herringbone',
  room: {
    width: 12,
    depth: 9,
    floor: 'herringbone',
    featureWall: true,
    exits: [
      { id: 'e1', wall: 'front', offset: -3.4, width: 1.8, label: 'Main entrance' },
      { id: 'e2', wall: 'back', offset: 5.1, width: 0.95, label: 'Rear exit' },
    ],
  },
  items: build([
    ['back_counter', 1.4, -4.15],
    ['menu_board', 1.4, -4.38],
    ['espresso_bar', 1.6, -2.35],
    ['pastry_case', -0.95, -2.33],
    ['condiment', 5.68, -0.9, -H],
    // banquette run on the left wall
    ['banquette', -5.62, -2.55, H],
    ['banquette', -5.62, 0.05, H],
    ['table_2', -4.88, -3.15],
    ['table_2', -4.88, -1.95],
    ['table_2', -4.88, -0.55],
    ['table_2', -4.88, 0.65],
    ['cafe_chair', -4.18, -3.15, -H],
    ['cafe_chair', -4.18, -1.95, -H],
    ['cafe_chair', -4.18, -0.55, -H],
    ['cafe_chair', -4.18, 0.65, -H],
    // communal table
    ...tableSet('communal_table', 3.0, 1.0, 'cafe_chair', 3, -1.15, 1.15),
    // window ledge with stools
    ['window_counter', 2.25, 4.2, PI],
    ['bar_stool', 1.2, 3.62],
    ['bar_stool', 1.9, 3.62],
    ['bar_stool', 2.6, 3.62],
    ['bar_stool', 3.3, 3.62],
    // bistro pair by the door
    ['bistro_table', -0.6, 3.45],
    ['cafe_chair', -1.15, 3.45, H],
    ['cafe_chair', -0.05, 3.45, -H],
    // high-top
    ['high_top', 4.35, 0.55],
    ['bar_stool', 3.72, 0.55, H],
    ['bar_stool', 4.98, 0.55, -H],
    // lounge corner
    ['rug', 4.75, 2.9, H],
    ['lounge_chair', 4.75, 3.75, PI],
    ['lounge_chair', 4.75, 2.05],
    ['coffee_table', 4.75, 2.9],
    ['planter', 5.55, 4.0],
    ['planter', -5.55, 4.0],
    ['planter', -5.55, 1.75],
  ]),
  photo: { caption: 'Morning queue at the espresso bar', time: '07:42', cam: [-4.6, 1.55, 3.6], look: [1.6, 1.0, -2.6] },
};

const cowork: TemplateDef = {
  id: 'cowork',
  label: 'Co-working',
  project: 'Studio Commons',
  tagline: 'Desk pods, a glazed meeting room and phone booths',
  occupancy: 'B',
  staff: 2,
  m2PerSeat: [5, 8],
  brand: '#2F55C8',
  floor: 'concrete',
  room: {
    width: 16,
    depth: 11,
    floor: 'concrete',
    featureWall: false,
    exits: [
      { id: 'e1', wall: 'front', offset: -3.0, width: 1.8, label: 'Main entrance' },
      { id: 'e2', wall: 'right', offset: 2.2, width: 0.95, label: 'Fire exit' },
    ],
  },
  items: build([
    ['reception', -6.35, 2.9, H],
    ['task_chair', -7.35, 2.9, H],
    ['planter', -7.45, 4.95],
    // desk pods
    ...tableSet('desk_pod', 2.8, 1.4, 'task_chair', 2, -3.6, -0.6, 0, 0, 0.36),
    ...tableSet('desk_pod', 2.8, 1.4, 'task_chair', 2, 0.6, -0.6, 0, 0, 0.36),
    ...tableSet('desk_pod', 2.8, 1.4, 'task_chair', 2, 0.6, 2.6, 0, 0, 0.36),
    // meeting room
    ['partition', 4.0, -4.5, H],
    ['partition', 4.0, -2.5, H],
    ['partition', 5.0, -1.5],
    ...tableSet('meeting_table', 2.4, 1.1, 'task_chair', 3, 6.15, -3.5, H, 0, 0.36),
    ['whiteboard', 7.6, -1.9, -H],
    // back wall
    ['kitchenette', -6.55, -5.15],
    ['high_top', -6.2, -3.3],
    ['bar_stool', -6.85, -3.3, H],
    ['bar_stool', -5.55, -3.3, -H],
    ['lockers', -3.3, -5.22],
    ['phone_booth', -1.1, -4.95],
    ['phone_booth', 0.05, -4.95],
    ['storage', 2.3, -5.25],
    // lounge
    ['rug', 4.6, 3.75],
    ['sofa', 4.6, 4.95, PI],
    ['coffee_table', 4.6, 3.8],
    ['lounge_chair', 3.3, 3.75, H],
    ['lounge_chair', 5.9, 3.75, -H],
    ['planter', 7.4, 4.95],
    ['planter', 7.4, 1.2],
  ]),
  photo: { caption: 'Heads down at the desk pods', time: '10:15', cam: [-4.6, 1.6, 4.9], look: [2.4, 0.85, -2.6] },
};

const boutique: TemplateDef = {
  id: 'boutique',
  label: 'Boutique',
  project: 'Atelier No. 9',
  tagline: 'Window plinths, wall shelving and fitting rooms',
  occupancy: 'M',
  staff: 3,
  m2PerSeat: null,
  brand: '#8E3B5E',
  floor: 'terrazzo',
  room: {
    width: 9,
    depth: 13,
    floor: 'terrazzo',
    featureWall: true,
    exits: [
      { id: 'e1', wall: 'front', offset: 0, width: 1.8, label: 'Main entrance' },
      { id: 'e2', wall: 'back', offset: 3.3, width: 0.95, label: 'Rear exit' },
    ],
  },
  items: build([
    // window display
    ['mannequin', -2.95, 5.6],
    ['plinth', -1.95, 5.35],
    ['plinth', 1.85, 5.45],
    ['mannequin', 2.85, 5.6],
    ['planter', 3.85, 5.85],
    ['planter', -3.85, 5.85],
    // walls
    ['wall_shelf', -4.27, 2.3, H],
    ['wall_shelf', -4.27, -0.3, H],
    ['wall_shelf', 4.27, 2.3, -H],
    ['wall_shelf', 4.27, -0.3, -H],
    // floor
    ['display_table', 0, 3.1],
    ['display_table', 0, 0.2, H],
    ['clothing_rail', -2.05, 1.0, H],
    ['clothing_rail', 2.05, 1.0, H],
    ['clothing_rail', -1.6, -2.2],
    ['clothing_rail', 1.6, -2.2],
    // back of shop
    ['cash_wrap', 1.9, -4.35],
    ['back_counter', 1.2, -6.15],
    ['fitting_room', -3.85, -5.85],
    ['fitting_room', -2.55, -5.85],
    ['rug', -2.9, -3.85],
    ['sofa', -3.95, -3.85, H],
    ['plinth', -1.5, -3.85],
  ]),
  photo: { caption: 'Afternoon light on the window plinths', time: '15:30', cam: [3.2, 1.6, -5.4], look: [-1.5, 0.9, 4.0] },
};

const restaurant: TemplateDef = {
  id: 'restaurant',
  label: 'Restaurant',
  project: 'Bistro Marlowe',
  tagline: 'Front bar, booths, a dining floor and an open pass',
  occupancy: 'A-2',
  staff: 8,
  m2PerSeat: [2.6, 3.6],
  brand: '#7A2E2A',
  floor: 'oak',
  room: {
    width: 15,
    depth: 12,
    floor: 'oak',
    featureWall: false,
    exits: [
      { id: 'e1', wall: 'front', offset: -4.6, width: 1.8, label: 'Main entrance' },
      { id: 'e2', wall: 'back', offset: 6.75, width: 0.95, label: 'Kitchen exit' },
    ],
  },
  items: build([
    ['host_stand', -2.9, 5.15],
    // bar
    ['back_counter', -3.6, -5.65],
    ['bar_counter', -3.6, -3.75],
    ['bar_stool', -5.1, -3.05, PI],
    ['bar_stool', -4.1, -3.05, PI],
    ['bar_stool', -3.1, -3.05, PI],
    ['bar_stool', -2.1, -3.05, PI],
    // kitchen
    ['partition', 1.4, -5.0, H],
    ['partition', 1.4, -3.0, H],
    ['kitchen_line', 4.3, -5.5],
    ['kitchen_line', 4.3, -2.85, PI],
    // booths on the left wall
    ['booth', -6.83, -0.55],
    ['booth', -6.83, 1.75],
    // dining floor
    ...tableSet('table_4', 1.2, 0.8, 'cafe_chair', 2, -3.9, -0.45),
    ...tableSet('table_4', 1.2, 0.8, 'cafe_chair', 2, -1.2, -0.45),
    ...tableSet('table_4', 1.2, 0.8, 'cafe_chair', 2, 1.5, -0.45),
    ...tableSet('table_4', 1.2, 0.8, 'cafe_chair', 2, -3.9, 2.05),
    ...tableSet('table_4', 1.2, 0.8, 'cafe_chair', 2, -1.2, 2.05),
    ...tableSet('table_4', 1.2, 0.8, 'cafe_chair', 2, 1.5, 2.05),
    ...tableSet('table_6', 1.8, 0.9, 'cafe_chair', 3, 5.1, 0.6, H),
    // window two-tops
    ...tableSet('table_2', 0.7, 0.7, 'cafe_chair', 1, 0.3, 4.75),
    ...tableSet('table_2', 0.7, 0.7, 'cafe_chair', 1, 2.3, 4.75),
    ...tableSet('table_2', 0.7, 0.7, 'cafe_chair', 1, 4.3, 4.75),
    ['planter', 7.0, 5.5],
    ['planter', -7.0, 5.5],
    ['planter', 7.0, 3.2],
  ]),
  photo: { caption: 'Service at the pass, Friday night', time: '20:05', cam: [-6.4, 1.6, 4.6], look: [2.5, 0.9, -2.0] },
};

export const TEMPLATES: Record<TemplateId, TemplateDef> = { cafe, cowork, boutique, restaurant };
export const TEMPLATE_ORDER: TemplateId[] = ['cafe', 'cowork', 'boutique', 'restaurant'];

export const BRAND_PRESETS: { name: string; hex: string }[] = [
  { name: 'Terracotta', hex: '#C4572F' },
  { name: 'Espresso green', hex: '#1F5E49' },
  { name: 'Cobalt', hex: '#2F55C8' },
  { name: 'Saffron', hex: '#D99A1E' },
  { name: 'Mulberry', hex: '#8E3B5E' },
  { name: 'Oxblood', hex: '#7A2E2A' },
  { name: 'Sea glass', hex: '#4E9A8F' },
  { name: 'Blush', hex: '#E29A8C' },
];

export const OCCUPANCY: Record<OccupancyCode, { label: string; factor: number; basis: 'net' | 'gross'; note: string }> = {
  'A-2': { label: 'Assembly A-2, tables and chairs', factor: 1.4, basis: 'net', note: '15 ft² net per occupant' },
  B: { label: 'Business B, office', factor: 13.9, basis: 'gross', note: '150 ft² gross per occupant' },
  M: { label: 'Mercantile M, sales floor', factor: 5.6, basis: 'gross', note: '60 ft² gross per occupant' },
};
