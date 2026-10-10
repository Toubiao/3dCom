export type Category = 'seating' | 'tables' | 'counters' | 'office' | 'retail' | 'decor';
export type TemplateId = 'cafe' | 'cowork' | 'boutique' | 'restaurant';
export type WallSide = 'front' | 'back' | 'left' | 'right';
export type FloorFinish = 'oak' | 'herringbone' | 'concrete' | 'terrazzo';
export type ViewMode = 'plan' | 'split' | '3d';
export type CostTier = 'budget' | 'standard' | 'premium';
export type OccupancyCode = 'A-2' | 'B' | 'M';

/** A piece of furniture or a fixture placed in the room. Units are metres, rot is radians about +Y. */
export interface PlacedItem {
  id: string;
  type: string;
  x: number;
  z: number;
  rot: number;
}

/** A door in one of the four walls. `offset` runs along the wall from its midpoint. */
export interface Exit {
  id: string;
  wall: WallSide;
  offset: number;
  width: number;
  label: string;
}

export interface Room {
  width: number; // along x
  depth: number; // along z, storefront at +z
  floor: FloorFinish;
  featureWall: boolean;
  exits: Exit[];
}

export interface ItemDef {
  type: string;
  name: string;
  category: Category;
  w: number;
  d: number;
  h: number;
  seats: number;
  price: number; // standard tier, USD, per unit
  branded: boolean;
  round?: boolean;
  /** Blocks walking routes when calculating egress. Chairs and rugs do not. */
  solid: boolean;
  /** Mounted on a wall above the floor, e.g. menu boards. Never blocks egress. */
  wallMounted?: boolean;
  blurb: string;
}

export interface LayoutSnapshot {
  room: Room;
  items: PlacedItem[];
}
