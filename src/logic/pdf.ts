import { jsPDF } from 'jspdf';
import type { PlacedItem, Room } from '../types';
import { drawOrder, itemShapes, wallShapes, type Fill, type Shape, type Stroke } from './planSymbols';
import type { CapacityReport } from './capacity';
import { money, type CostReport, TIERS } from './cost';
import type { EgressResult } from './egress';
import { hexToRgb, mix } from './color';
import { planPlacement, SHEET, sheetDate } from './sheet';
import { TEMPLATES } from '../data/templates';
import type { TemplateId } from '../types';

export interface SheetData {
  projectName: string;
  templateId: TemplateId;
  room: Room;
  items: PlacedItem[];
  brand: string;
  capacity: CapacityReport;
  cost: CostReport;
  egress: EgressResult;
  render: string | null;
  sprinklered: boolean;
}

const INK = '#22211F';
const SOFT = '#8A8377';
const LINE = '#CFC3AE';
const EXIT = '#0E8C52';

export const buildPdf = (d: SheetData): jsPDF => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });
  doc.setProperties({ title: `${d.projectName} — Layout sheet A-101`, creator: 'Fitout space planner' });

  const fills: Record<Fill, string | null> = {
    none: null,
    paper: '#FFFDF9',
    oat: '#E8DFCF',
    wood: '#E6D3B3',
    brand: d.brand,
    brandSoft: mix(d.brand, '#FFFFFF', 0.55),
    ink: INK,
    glass: '#DCE8EA',
    steel: '#CBCED0',
    leaf: '#93A97E',
  };
  const strokes: Record<Stroke, string | null> = { ink: INK, soft: SOFT, brand: d.brand, exit: EXIT, none: null };

  const fill = (hex: string) => doc.setFillColor(...hexToRgb(hex));
  const draw = (hex: string) => doc.setDrawColor(...hexToRgb(hex));
  const text = (hex: string) => doc.setTextColor(...hexToRgb(hex));

  const { scale, k, cx, cy } = planPlacement(d.room);
  const P = (x: number, z: number): [number, number] => [cx + x * k, cy + z * k];

  const poly = (pts: [number, number][], f: string | null, s: string | null, lw: number, dash = false, closed = true) => {
    if (pts.length < 2) return;
    const mapped = pts.map(([x, z]) => P(x, z));
    const deltas = mapped.slice(1).map((p, i) => [p[0] - mapped[i][0], p[1] - mapped[i][1]]);
    if (f) fill(f);
    if (s) {
      draw(s);
      doc.setLineWidth(lw);
    }
    doc.setLineDashPattern(dash ? [1.2, 0.8] : [], 0);
    const style = f && s ? 'FD' : f ? 'F' : 'S';
    if (!f && !s) return;
    doc.lines(deltas, mapped[0][0], mapped[0][1], [1, 1], style, closed);
    doc.setLineDashPattern([], 0);
  };

  const shape = (s: Shape) => {
    const lw = (s.sw * 0.02 * k) / 1;
    if (s.k === 'circle') {
      const [x, y] = P(s.cx, s.cy);
      const f = fills[s.fill];
      const st = strokes[s.stroke];
      if (f) fill(f);
      if (st) {
        draw(st);
        doc.setLineWidth(lw);
      }
      if (f || st) doc.circle(x, y, s.r * k, f && st ? 'FD' : f ? 'F' : 'S');
      return;
    }
    poly(s.pts, s.k === 'poly' ? fills[s.fill] : null, strokes[s.stroke], lw, s.dash, s.k === 'poly');
  };

  // ── frame ──
  draw(INK);
  doc.setLineWidth(0.5);
  doc.rect(SHEET.frame.x, SHEET.frame.y, SHEET.frame.w, SHEET.frame.h);
  doc.setLineWidth(0.25);
  doc.line(SHEET.col.x, SHEET.frame.y, SHEET.col.x, SHEET.frame.y + SHEET.frame.h);
  for (const y of [SHEET.capacity.y, SHEET.cost.y, SHEET.title.y]) doc.line(SHEET.col.x, y, SHEET.col.x + SHEET.col.w, y);

  // ── drawing header ──
  text(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GROUND FLOOR PLAN', SHEET.draw.x + 8, SHEET.draw.y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  text(SOFT);
  doc.text(
    `Furniture layout · Scale 1:${scale} at A3 · ${d.room.width.toFixed(2)} × ${d.room.depth.toFixed(2)} m · ${(d.room.width * d.room.depth).toFixed(1)} m²`,
    SHEET.draw.x + 8,
    SHEET.draw.y + 18,
  );

  // ── plan ──
  const hw = d.room.width / 2;
  const hd = d.room.depth / 2;
  poly(
    [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ],
    '#FBF8F2',
    null,
    0,
  );
  draw('#C9D3DF');
  doc.setLineWidth(0.1);
  for (let x = Math.ceil(-hw); x < hw; x++) if (x > -hw) doc.line(...P(x, -hd), ...P(x, hd));
  for (let z = Math.ceil(-hd); z < hd; z++) if (z > -hd) doc.line(...P(-hw, z), ...P(hw, z));
  for (const it of drawOrder(d.items)) itemShapes(it).forEach(shape);
  const walls = wallShapes(d.room);
  walls.poche.forEach((p) => poly(p, INK, null, 0));
  walls.glazing.forEach((p) => poly(p, '#DCE8EA', INK, 0.15));
  for (const door of walls.doors) {
    poly([door.hinge, door.leaf], null, INK, 0.3, false, false);
    poly(door.arc, null, INK, 0.15, true, false);
  }
  // egress
  for (const r of d.egress.routes) {
    const pts = r.points.map((p) => [p.x, p.z] as [number, number]);
    poly(pts, null, EXIT, 0.45, true, false);
    const a = r.points[r.points.length - 2];
    const b = r.points[r.points.length - 1];
    if (a && b) {
      const ang = Math.atan2(b.z - a.z, b.x - a.x);
      const [bx, by] = P(b.x, b.z);
      const s = 1.8;
      const p1: [number, number] = [bx - Math.cos(ang) * s + Math.sin(ang) * s * 0.55, by - Math.sin(ang) * s - Math.cos(ang) * s * 0.55];
      const p2: [number, number] = [bx - Math.cos(ang) * s - Math.sin(ang) * s * 0.55, by - Math.sin(ang) * s + Math.cos(ang) * s * 0.55];
      fill(EXIT);
      doc.triangle(bx, by, p1[0], p1[1], p2[0], p2[1], 'F');
    }
  }
  const seen = new Set<string>();
  for (const door of walls.doors) {
    const key = door.center.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const [x, y] = P(door.center[0] + door.normal[0] * 0.75, door.center[1] + door.normal[1] * 0.75);
    fill(EXIT);
    doc.roundedRect(x - 5, y - 2.1, 10, 4.2, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    text('#FFFFFF');
    doc.text('EXIT', x, y + 1, { align: 'center' });
  }
  // dimensions
  draw(INK);
  doc.setLineWidth(0.15);
  text(INK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const dz = hd + 0.75;
  doc.line(...P(-hw, dz), ...P(hw, dz));
  for (const x of [-hw, hw]) {
    doc.line(...P(x, dz - 0.2), ...P(x, dz + 0.2));
    doc.line(...P(x - 0.1, dz + 0.1), ...P(x + 0.1, dz - 0.1));
  }
  const wl = P(0, dz);
  doc.text(`${d.room.width.toFixed(2)} m`, wl[0], wl[1] - 1.2, { align: 'center' });
  const dx = hw + 0.75;
  doc.line(...P(dx, -hd), ...P(dx, hd));
  for (const z of [-hd, hd]) {
    doc.line(...P(dx - 0.2, z), ...P(dx + 0.2, z));
    doc.line(...P(dx - 0.1, z + 0.1), ...P(dx + 0.1, z - 0.1));
  }
  const dl = P(dx, 0);
  doc.text(`${d.room.depth.toFixed(2)} m`, dl[0] - 1.2, dl[1], { align: 'center', angle: 90 });

  // north arrow and scale bar
  const nx = SHEET.draw.x + SHEET.draw.w - 18;
  const ny = SHEET.draw.y + 14;
  draw(INK);
  doc.setLineWidth(0.3);
  doc.circle(nx, ny, 5, 'S');
  fill(INK);
  doc.triangle(nx, ny - 4.5, nx - 2, ny + 2, nx + 2, ny + 2, 'F');
  doc.setFontSize(7);
  text(INK);
  doc.text('N', nx, ny + 9.5, { align: 'center' });
  const sbY = SHEET.draw.y + SHEET.draw.h - 14;
  const sbX = SHEET.draw.x + 8;
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) fill(INK);
    else fill('#FFFFFF');
    draw(INK);
    doc.setLineWidth(0.2);
    doc.rect(sbX + i * k, sbY, k, 1.6, 'FD');
  }
  doc.setFontSize(6.5);
  doc.text('0', sbX, sbY + 5, { align: 'center' });
  doc.text('5 m', sbX + 5 * k, sbY + 5, { align: 'center' });
  // legend
  const lgX = sbX + 5 * k + 16;
  draw(EXIT);
  doc.setLineWidth(0.6);
  doc.setLineDashPattern([1.2, 0.8], 0);
  doc.line(lgX, sbY + 0.8, lgX + 10, sbY + 0.8);
  doc.setLineDashPattern([], 0);
  text(INK);
  doc.text('Escape route', lgX + 12, sbY + 1.8);
  fill(d.brand);
  doc.rect(lgX + 36, sbY - 0.6, 5, 3, 'F');
  doc.text('Brand finish', lgX + 43, sbY + 1.8);
  draw(INK);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.2, 0.8], 0);
  doc.rect(lgX + 66, sbY - 0.6, 5, 3, 'S');
  doc.setLineDashPattern([], 0);
  doc.text('Wall-mounted', lgX + 73, sbY + 1.8);

  // ── right column ──
  const cx0 = SHEET.col.x + 6;
  const cw = SHEET.col.w - 12;
  if (d.render) {
    const fmt = d.render.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    fill('#F3EEE5');
    doc.rect(SHEET.col.x, SHEET.render.y, SHEET.col.w, SHEET.render.h, 'F');
    doc.addImage(d.render, fmt, SHEET.col.x + 2, SHEET.render.y + 2, SHEET.col.w - 4, SHEET.render.h - 10, undefined, 'FAST');
  }
  doc.setFontSize(6.5);
  text(SOFT);
  doc.text('PERSPECTIVE · NOT TO SCALE', cx0, SHEET.render.y + SHEET.render.h - 2.6);

  // capacity
  let y = SHEET.capacity.y + 7;
  text(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CAPACITY & EGRESS', cx0, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  text(SOFT);
  doc.text(`${d.capacity.occupancyLabel} · ${d.sprinklered ? 'sprinklered' : 'unsprinklered'}`, cx0, y + 4.2);
  y += 11;
  const big = (label: string, value: string, x: number) => {
    text(INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(value, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    text(SOFT);
    doc.text(label, x, y + 3.6);
  };
  big('seats', String(d.capacity.seats), cx0);
  big('max occupants', String(d.capacity.maxOccupants), cx0 + 24);
  big('m² per seat', d.capacity.seats ? d.capacity.m2PerSeat.toFixed(1) : '–', cx0 + 54);
  big('max travel', `${d.capacity.travel.toFixed(1)} m`, cx0 + 78);
  y += 9;
  doc.setFontSize(7);
  for (const c of d.capacity.checks) {
    const col = c.status === 'pass' ? '#2F7D55' : c.status === 'warn' ? '#B7791F' : '#C2412D';
    fill(col);
    doc.circle(cx0 + 1.2, y - 0.9, 1.1, 'F');
    text(INK);
    doc.text(c.label, cx0 + 4, y);
    doc.text(c.value, cx0 + cw - 26, y, { align: 'right' });
    text(SOFT);
    doc.text(c.limit, cx0 + cw, y, { align: 'right' });
    y += 4.6;
  }

  // cost
  y = SHEET.cost.y + 7;
  text(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FURNITURE & FIXTURES ESTIMATE', cx0, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  text(SOFT);
  doc.text(`${TIERS.find((t) => t.id === d.cost.tier)!.label} specification · USD before tax`, cx0, y + 4.2);
  y += 10;
  const rows: [string, string][] = [
    ...d.cost.groups.map((g) => [`${g.label} (${g.lines.reduce((n, l) => n + l.qty, 0)})`, money(g.total)] as [string, string]),
    ['Delivery & install', money(d.cost.install)],
    ['Contingency', money(d.cost.contingency)],
  ];
  for (const [a, b] of rows.slice(0, 8)) {
    text(INK);
    doc.text(a, cx0, y);
    doc.text(b, cx0 + cw, y, { align: 'right' });
    draw(LINE);
    doc.setLineWidth(0.1);
    doc.line(cx0, y + 1.4, cx0 + cw, y + 1.4);
    y += 4.4;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Total', cx0, y + 2.5);
  doc.text(money(d.cost.total), cx0 + cw, y + 2.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  text(SOFT);
  doc.text(`${money(d.cost.perSeat)} per seat · ${money(d.cost.perM2)} per m²`, cx0, y + 6.5);

  // title block
  y = SHEET.title.y;
  fill(d.brand);
  doc.rect(SHEET.col.x, y, 6, SHEET.title.h, 'F');
  text(SOFT);
  doc.setFontSize(6.5);
  doc.text('PROJECT', cx0 + 4, y + 7);
  text(INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(d.projectName || 'Untitled layout', cx0 + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  text(SOFT);
  doc.text(`${TEMPLATES[d.templateId].label} fit-out · ${TEMPLATES[d.templateId].tagline}`, cx0 + 4, y + 19, { maxWidth: cw - 6 });
  const cells: [string, string][] = [
    ['SHEET', 'A-101'],
    ['SCALE', `1:${scale} @ A3`],
    ['DATE', sheetDate()],
    ['BRAND', d.brand.toUpperCase()],
  ];
  cells.forEach(([lab, val], i) => {
    const x = cx0 + 4 + (i % 2) * 50;
    const yy = y + 31 + Math.floor(i / 2) * 12;
    text(SOFT);
    doc.setFontSize(6.5);
    doc.text(lab, x, yy);
    text(INK);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(val, x, yy + 4.6);
    doc.setFont('helvetica', 'normal');
  });
  doc.setFontSize(5.8);
  text(SOFT);
  doc.text('Planning estimate. Confirm occupant load and egress with the local building official.', cx0 + 4, y + SHEET.title.h - 4, { maxWidth: cw - 6 });

  return doc;
};
