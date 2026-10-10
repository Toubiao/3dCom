import type { Room } from '../types';

/** A3 landscape layout sheet, in millimetres. Shared by the on-screen preview and the PDF writer. */
export const SHEET = {
  w: 420,
  h: 297,
  frame: { x: 10, y: 10, w: 400, h: 277 },
  draw: { x: 10, y: 10, w: 292, h: 277 },
  col: { x: 302, w: 108 },
  render: { y: 10, h: 72 },
  capacity: { y: 82, h: 76 },
  cost: { y: 158, h: 64 },
  title: { y: 222, h: 65 },
};

export const SCALES = [50, 75, 100, 125, 150, 200];

/** Pick the largest standard scale at which the room plus annotation margin fits the drawing area. */
export const chooseScale = (room: Room) => {
  const availW = SHEET.draw.w - 20;
  const availH = SHEET.draw.h - 56;
  for (const s of SCALES) {
    const mmPerM = 1000 / s;
    if ((room.width + 1.8) * mmPerM <= availW && (room.depth + 1.8) * mmPerM <= availH) return s;
  }
  return SCALES[SCALES.length - 1];
};

/** Where the plan's origin (room centre) lands on the sheet, and the mm-per-metre factor. */
export const planPlacement = (room: Room) => {
  const scale = chooseScale(room);
  const k = 1000 / scale;
  return {
    scale,
    k,
    cx: SHEET.draw.x + SHEET.draw.w / 2 - 4,
    cy: SHEET.draw.y + 30 + (SHEET.draw.h - 62) / 2,
  };
};

export const sheetDate = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const fileName = (project: string) => `${slug(project) || 'layout'}-A101.pdf`;
