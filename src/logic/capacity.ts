import type { OccupancyCode, PlacedItem, Room } from '../types';
import { getDef } from '../data/catalog';
import { OCCUPANCY, TEMPLATES } from '../data/templates';
import type { TemplateId } from '../types';
import type { EgressResult } from './egress';

/**
 * Planning-level capacity and egress checks, modelled on IBC occupant-load and egress rules.
 * Results are estimates for early layout decisions and need confirming with the local code official.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  value: string;
  limit: string;
  hint: string;
}

export interface CapacityReport {
  area: number;
  netArea: number;
  seats: number;
  staff: number;
  occupants: number;
  occupancy: OccupancyCode;
  occupancyLabel: string;
  factor: number;
  factorNote: string;
  areaLoad: number;
  exitLimit: number;
  widthLimit: number;
  maxOccupants: number;
  limitedBy: 'area' | 'exits' | 'door width';
  maxSeats: number;
  seatsPerM2: number;
  m2PerSeat: number;
  band: { min: number; max: number } | null;
  bandStatus: 'under' | 'ok' | 'over' | 'n/a';
  exitsRequired: number;
  exitsProvided: number;
  widthRequired: number;
  widthProvided: number;
  mmPerOccupant: number;
  travel: number;
  travelLimit: number;
  separationRequired: number;
  separation: number;
  checks: Check[];
  status: CheckStatus;
}

const exitsFor = (occupants: number) => (occupants <= 49 ? 1 : occupants <= 500 ? 2 : occupants <= 1000 ? 3 : 4);
const maxForExits = (exits: number) => (exits <= 1 ? 49 : exits === 2 ? 500 : exits === 3 ? 1000 : 99999);

export const countSeats = (items: PlacedItem[]) => items.reduce((n, it) => n + getDef(it.type).seats, 0);

export const capacityReport = (
  templateId: TemplateId,
  room: Room,
  items: PlacedItem[],
  staff: number,
  sprinklered: boolean,
  egress: EgressResult,
): CapacityReport => {
  const t = TEMPLATES[templateId];
  const occ = OCCUPANCY[t.occupancy];
  const area = room.width * room.depth;
  // Net area for assembly excludes walls, counters and back-of-house; 80% is a fair early allowance.
  const netArea = occ.basis === 'net' ? area * 0.8 : area;
  const areaLoad = Math.ceil(netArea / occ.factor);
  const seats = countSeats(items);
  const occupants = seats + staff;

  const mmPerOccupant = sprinklered ? 3.8 : 5.1;
  const widthProvided = room.exits.reduce((s, e) => s + e.width, 0);
  const exitsProvided = room.exits.length;
  const exitLimit = maxForExits(exitsProvided);
  const widthLimit = Math.floor((widthProvided * 1000) / mmPerOccupant);
  const maxOccupants = Math.min(areaLoad, exitLimit, widthLimit);
  const limitedBy = maxOccupants === areaLoad ? 'area' : maxOccupants === exitLimit ? 'exits' : 'door width';
  const maxSeats = Math.max(0, maxOccupants - staff);

  const exitsRequired = exitsFor(occupants);
  const widthRequired = Math.max((occupants * mmPerOccupant) / 1000, 0.813);

  const single = exitsProvided <= 1;
  const travelLimit = single
    ? t.occupancy === 'B'
      ? 30
      : 23
    : sprinklered
      ? t.occupancy === 'B'
        ? 91
        : 76
      : 61;
  const diag = Math.hypot(room.width, room.depth);
  const separationRequired = exitsRequired >= 2 || exitsProvided >= 2 ? diag * (sprinklered ? 1 / 3 : 1 / 2) : 0;

  const band = t.m2PerSeat ? { min: Math.floor(area / t.m2PerSeat[1]), max: Math.floor(area / t.m2PerSeat[0]) } : null;
  const bandStatus = !band ? 'n/a' : seats < band.min ? 'under' : seats > band.max ? 'over' : 'ok';

  const m = (v: number) => `${v.toFixed(1)} m`;
  const checks: Check[] = [
    {
      id: 'load',
      label: 'Occupant load',
      status: occupants > maxOccupants ? 'fail' : occupants > maxOccupants * 0.92 ? 'warn' : 'pass',
      value: `${occupants} people`,
      limit: `max ${maxOccupants}`,
      hint:
        occupants > maxOccupants
          ? `Remove ${occupants - maxOccupants} seats, or ${limitedBy === 'exits' ? 'add an exit' : limitedBy === 'door width' ? 'widen a door' : 'enlarge the space'}.`
          : `${seats} seats plus ${staff} staff. Limited by ${limitedBy}.`,
    },
    {
      id: 'exits',
      label: 'Number of exits',
      status: exitsProvided >= exitsRequired ? 'pass' : 'fail',
      value: `${exitsProvided} provided`,
      limit: `${exitsRequired} required`,
      hint: exitsRequired > 1 ? 'Over 49 occupants needs two separate exits.' : 'Up to 49 occupants may use one exit.',
    },
    {
      id: 'width',
      label: 'Exit door width',
      status: widthProvided >= widthRequired && room.exits.every((e) => e.width >= 0.81) ? 'pass' : 'fail',
      value: m(widthProvided),
      limit: `${widthRequired.toFixed(2)} m needed`,
      hint: `${mmPerOccupant} mm per occupant${sprinklered ? ' (sprinklered)' : ''}; each door at least 0.81 m clear.`,
    },
    {
      id: 'travel',
      label: single ? 'Common path of travel' : 'Exit travel distance',
      status: egress.maxTravel > travelLimit ? 'fail' : egress.maxTravel > travelLimit * 0.85 ? 'warn' : 'pass',
      value: m(egress.maxTravel),
      limit: `${travelLimit} m limit`,
      hint: 'Walking route from the most remote point to the nearest exit.',
    },
  ];
  if (exitsRequired >= 2 || exitsProvided >= 2) {
    checks.push({
      id: 'separation',
      label: 'Exit separation',
      status: exitsProvided < 2 ? 'fail' : egress.exitSeparation >= separationRequired ? 'pass' : exitsRequired >= 2 ? 'fail' : 'warn',
      value: exitsProvided < 2 ? '—' : m(egress.exitSeparation),
      limit: `${separationRequired.toFixed(1)} m min`,
      hint: `Exits at least ${sprinklered ? 'one third' : 'half'} of the room diagonal apart.`,
    });
  }
  checks.push({
    id: 'clear',
    label: 'Exit landings clear',
    status: egress.obstructedExits.length ? 'fail' : 'pass',
    value: egress.obstructedExits.length ? `${egress.obstructedExits.length} blocked` : 'All clear',
    limit: '1.1 m landing',
    hint: egress.obstructedExits.length ? 'Move furniture out of the zone inside the door.' : 'Nothing parked inside the doors.',
  });
  checks.push({
    id: 'reach',
    label: 'Seats with a way out',
    status: egress.unreachableSeats.length ? 'fail' : 'pass',
    value: egress.unreachableSeats.length ? `${egress.unreachableSeats.length} boxed in` : `${seats} of ${seats}`,
    limit: '56 cm min gap',
    hint: egress.unreachableSeats.length ? 'Open a gap so every seat can reach an aisle.' : 'Every seat reaches an exit.',
  });

  const status: CheckStatus = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';

  return {
    area,
    netArea,
    seats,
    staff,
    occupants,
    occupancy: t.occupancy,
    occupancyLabel: occ.label,
    factor: occ.factor,
    factorNote: occ.note,
    areaLoad,
    exitLimit,
    widthLimit,
    maxOccupants,
    limitedBy,
    maxSeats,
    seatsPerM2: seats / area,
    m2PerSeat: seats ? area / seats : 0,
    band,
    bandStatus,
    exitsRequired,
    exitsProvided,
    widthRequired,
    widthProvided,
    mmPerOccupant,
    travel: egress.maxTravel,
    travelLimit,
    separationRequired,
    separation: egress.exitSeparation,
    checks,
    status,
  };
};
