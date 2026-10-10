import { useMemo } from 'react';
import { useStore, store, type Store } from '../state/store';
import { analyzeEgress, type EgressResult } from './egress';
import { capacityReport, type CapacityReport } from './capacity';
import { costReport, type CostReport } from './cost';
import type { PlacedItem, Room } from '../types';

let egressCache: { room: Room; items: PlacedItem[]; result: EgressResult } | null = null;

/** Egress analysis is the expensive part; cache it on layout identity so every consumer shares one run. */
export const getEgress = (room: Room, items: PlacedItem[]): EgressResult => {
  if (egressCache && egressCache.room === room && egressCache.items === items) return egressCache.result;
  const result = analyzeEgress(room, items);
  egressCache = { room, items, result };
  return result;
};

export const computeCapacity = (s: Pick<Store, 'templateId' | 'room' | 'items' | 'staff' | 'sprinklered'>): CapacityReport =>
  capacityReport(s.templateId, s.room, s.items, s.staff, s.sprinklered, getEgress(s.room, s.items));

export const computeCost = (s: Pick<Store, 'items' | 'costTier' | 'room'>, seats: number): CostReport =>
  costReport(s.items, s.costTier, seats, s.room.width * s.room.depth);

export function useCapacity(): CapacityReport {
  const templateId = useStore((s) => s.templateId);
  const room = useStore((s) => s.room);
  const items = useStore((s) => s.items);
  const staff = useStore((s) => s.staff);
  const sprinklered = useStore((s) => s.sprinklered);
  return useMemo(
    () => computeCapacity({ templateId, room, items, staff, sprinklered }),
    [templateId, room, items, staff, sprinklered],
  );
}

export function useCost(tierOverride?: Store['costTier']): CostReport {
  const items = useStore((s) => s.items);
  const tier = useStore((s) => s.costTier);
  const room = useStore((s) => s.room);
  const cap = useCapacity();
  return useMemo(
    () => computeCost({ items, costTier: tierOverride ?? tier, room }, cap.seats),
    [items, tier, tierOverride, room, cap.seats],
  );
}

export const currentReports = () => {
  const s = store.getState();
  const capacity = computeCapacity(s);
  const cost = computeCost(s, capacity.seats);
  return { capacity, cost, egress: getEgress(s.room, s.items) };
};
