export const ROOM_SIZE = 8;
export const ROOM_SHELL_WIDTH = 496;
export const ROOM_SHELL_HEIGHT = 352;
export const ROOM_SHELL_Y = 4;
export const ROOM_ORIGIN_X = 248;
export const ROOM_ORIGIN_Y = 104;
export const ROOM_TILE_HALF_WIDTH = 30;
export const ROOM_TILE_HALF_HEIGHT = 15;
export const ROOM_LIGHT_DEPTH = 100;

export const ROOM_LIGHTS = [
  { key: 'roomLightPc', alpha: 1 },
  { key: 'roomLightTank', alpha: 1 },
  { key: 'roomLightLamp', alpha: 1 },
] as const;

export const HERO_START = { gx: 4.5, gy: 4.5 } as const;
export const HERO_SPEED = 2.6;
export const HERO_RADIUS = 0.25;
export const ROOM_MIN = HERO_RADIUS;
export const ROOM_MAX = ROOM_SIZE - HERO_RADIUS;

export type RoomFacing = 'SE' | 'SW' | 'NE' | 'NW';
export type RoomPropKey =
  | 'roomWindow'
  | 'roomDoor'
  | 'roomBookcase'
  | 'roomDesk'
  | 'roomTank'
  | 'roomNightstand'
  | 'roomBed'
  | 'roomPlant';

export interface RoomPosition {
  readonly gx: number;
  readonly gy: number;
}

export interface ScreenDirection {
  readonly x: number;
  readonly y: number;
}

export interface RoomFootprint {
  readonly gx0: number;
  readonly gy0: number;
  readonly gx1: number;
  readonly gy1: number;
}

export interface RoomProp {
  readonly key: RoomPropKey;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly footprint?: RoomFootprint;
}

export const ROOM_PROPS: readonly RoomProp[] = [
  { key: 'roomWindow', x: 116, y: 42, width: 84, height: 94, depth: 1 },
  { key: 'roomDoor', x: 449, y: 128, width: 30, height: 92, depth: 2 },
  {
    key: 'roomBookcase',
    x: 209,
    y: 25,
    width: 51,
    height: 106,
    footprint: { gx0: 0.02, gy0: 0.1, gx1: 0.48, gy1: 1.3 },
    depth: 4,
  },
  {
    key: 'roomDesk',
    x: 200,
    y: 14,
    width: 140,
    height: 172,
    footprint: { gx0: 0.5, gy0: 0, gx1: 3, gy1: 2 },
    depth: 10,
  },
  {
    key: 'roomTank',
    x: 320,
    y: 82,
    width: 114,
    height: 132,
    footprint: { gx0: 3.5, gy0: 0, gx1: 6.2, gy1: 1.1 },
    depth: 16,
  },
  {
    key: 'roomNightstand',
    x: 99,
    y: 128,
    width: 43,
    height: 61,
    footprint: { gx0: 0, gy0: 4.25, gx1: 0.7, gy1: 4.95 },
    depth: 22,
  },
  {
    key: 'roomBed',
    x: 32,
    y: 135,
    width: 162,
    height: 125,
    footprint: { gx0: 0, gy0: 5, gx1: 3.2, gy1: 7.2 },
    depth: 30,
  },
  {
    key: 'roomPlant',
    x: 8,
    y: 150,
    width: 44,
    height: 84,
    footprint: { gx0: 0.15, gy0: 7.45, gx1: 0.55, gy1: 7.85 },
    depth: 36,
  },
];

export function projectRoom(
  gx: number,
  gy: number,
  shellX: number,
  shellY: number,
): { sx: number; sy: number } {
  return {
    sx: shellX + ROOM_ORIGIN_X + (gx - gy) * ROOM_TILE_HALF_WIDTH,
    sy: shellY + ROOM_ORIGIN_Y + (gx + gy) * ROOM_TILE_HALF_HEIGHT,
  };
}

const FACING_ORDER: readonly RoomFacing[] = ['SE', 'SW', 'NE', 'NW'];

function matchesDirection(
  facing: RoomFacing,
  allowPositiveX: boolean,
  allowPositiveY: boolean,
): boolean {
  const positiveX = facing === 'SE' || facing === 'NE';
  const positiveY = facing === 'SE' || facing === 'SW';
  return positiveX === allowPositiveX && positiveY === allowPositiveY;
}

export function facingFromDirection(dir: ScreenDirection, current: RoomFacing): RoomFacing | null {
  if (Math.hypot(dir.x, dir.y) < 0.2) return null;

  const xSigns = Math.abs(dir.x) < 0.2 ? [true, false] : [dir.x >= 0];
  const ySigns = Math.abs(dir.y) < 0.2 ? [true, false] : [dir.y >= 0];
  const candidates = FACING_ORDER.filter((facing) =>
    xSigns.some((positiveX) =>
      ySigns.some((positiveY) => matchesDirection(facing, positiveX, positiveY)),
    ),
  );
  return candidates.includes(current) ? current : (candidates[0] ?? null);
}

function blocksHorizontal(footprint: RoomFootprint, gy: number): boolean {
  return gy > footprint.gy0 - HERO_RADIUS && gy < footprint.gy1 + HERO_RADIUS;
}

function blocksVertical(footprint: RoomFootprint, gx: number): boolean {
  return gx > footprint.gx0 - HERO_RADIUS && gx < footprint.gx1 + HERO_RADIUS;
}

function moveGx(pos: RoomPosition, amount: number): RoomPosition {
  let gx = Math.min(ROOM_MAX, Math.max(ROOM_MIN, pos.gx + amount));
  for (const prop of ROOM_PROPS) {
    if (!prop.footprint || !blocksHorizontal(prop.footprint, pos.gy)) continue;
    const edge = amount > 0 ? prop.footprint.gx0 - HERO_RADIUS : prop.footprint.gx1 + HERO_RADIUS;
    if (amount > 0 && pos.gx <= edge && gx >= edge) gx = Math.min(gx, edge);
    if (amount < 0 && pos.gx >= edge && gx <= edge) gx = Math.max(gx, edge);
  }
  return { gx, gy: pos.gy };
}

function moveGy(pos: RoomPosition, amount: number): RoomPosition {
  let gy = Math.min(ROOM_MAX, Math.max(ROOM_MIN, pos.gy + amount));
  for (const prop of ROOM_PROPS) {
    if (!prop.footprint || !blocksVertical(prop.footprint, pos.gx)) continue;
    const edge = amount > 0 ? prop.footprint.gy0 - HERO_RADIUS : prop.footprint.gy1 + HERO_RADIUS;
    if (amount > 0 && pos.gy <= edge && gy >= edge) gy = Math.min(gy, edge);
    if (amount < 0 && pos.gy >= edge && gy <= edge) gy = Math.max(gy, edge);
  }
  return { gx: pos.gx, gy };
}

export function moveInRoom(pos: RoomPosition, facing: RoomFacing, distance: number): RoomPosition {
  const step = Math.max(0, distance);
  switch (facing) {
    case 'SE':
      return moveGx(pos, step);
    case 'SW':
      return moveGy(pos, step);
    case 'NE':
      return moveGy(pos, -step);
    case 'NW':
      return moveGx(pos, -step);
  }
}

const D = Math.SQRT1_2;
/** Bước trên lưới cho 8 hướng màn hình, xếp theo góc 45° từ hướng phải, chiều kim đồng hồ. */
const GRID_STEPS: readonly (readonly [number, number])[] = [
  [D, -D],
  [1, 0],
  [D, D],
  [0, 1],
  [-D, D],
  [-1, 0],
  [-D, -D],
  [0, -1],
];

/** Đi theo hướng cần điều khiển (làm tròn về 8 hướng); gặp vật cản thì trượt theo trục còn lại. */
export function moveInRoomByDirection(
  pos: RoomPosition,
  dir: ScreenDirection,
  distance: number,
): RoomPosition {
  const step = Math.max(0, distance);
  const octant = Math.round(Math.atan2(dir.y, dir.x) / (Math.PI / 4));
  const [stepGx, stepGy] = GRID_STEPS[(octant + 8) % 8] as readonly [number, number];
  return moveGy(moveGx(pos, stepGx * step), stepGy * step);
}

export function heroDepth(pos: RoomPosition, props: readonly RoomProp[]): number {
  let depth = 5;
  for (const prop of props) {
    const footprint = prop.footprint;
    if (!footprint) continue;
    const outsideRightEdge = pos.gx > footprint.gx1 && pos.gy < footprint.gy0;
    const outsideLeftEdge = pos.gx < footprint.gx0 && pos.gy > footprint.gy1;
    if (
      (pos.gx >= footprint.gx1 || pos.gy >= footprint.gy1) &&
      !outsideRightEdge &&
      !outsideLeftEdge
    ) {
      depth = Math.max(depth, prop.depth + 5);
    }
  }
  return depth;
}
