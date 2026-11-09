import { createRng } from '../../core/rng';
import type { Clearing, PaletteEntry, PaletteName, ReefCluster } from './scenePlan';

export const SPAWN = { x: 512, z: 512 } as const;

export interface PropKeys {
  readonly plants: readonly string[];
  readonly solids: readonly string[];
}

export interface GroundProp {
  readonly key: string;
  readonly x: number;
  readonly z: number;
  /** Cây mềm lắc theo dòng nước; đá và san hô cứng luôn đứng yên. */
  readonly sway: boolean;
}

export interface ReefProp extends GroundProp {
  readonly scale: number;
}

/** Mật độ rạn; bỏ trống thì dùng mặc định. */
export interface LayoutDensity {
  readonly reefCount: number;
  readonly minItems: number;
  readonly maxItems: number;
  /** Tỉ lệ cây mềm trong mỗi rạn (phần còn lại là san hô, đá). */
  readonly plantChance: number;
}

const DEFAULT_DENSITY: LayoutDensity = {
  reefCount: 40,
  minItems: 5,
  maxItems: 12,
  plantChance: 0.68,
};
const MIN_RADIUS = 30;
const MAX_RADIUS = 70;
const WORLD_MIN = 24;
const WORLD_MAX = 1000;
const SPAWN_CLEARANCE = 90;

/** Sinh các cụm rạn tất định, giữ một khoảng trống an toàn quanh điểm xuất phát. */
export function layoutProps(
  seed: number,
  keys: PropKeys,
  density: LayoutDensity = DEFAULT_DENSITY,
): GroundProp[] {
  if (keys.plants.length === 0 && keys.solids.length === 0) {
    throw new RangeError('Cần ít nhất một texture cây hoặc vật rắn');
  }

  const rng = createRng(seed);
  const props: GroundProp[] = [];

  for (let reef = 0; reef < density.reefCount; reef++) {
    const radius = rng.int(MIN_RADIUS, MAX_RADIUS);
    let centerX: number;
    let centerZ: number;

    // Tâm cụm cách biên ít nhất một bán kính và cách vùng spawn đủ để cả cụm an toàn.
    do {
      centerX = WORLD_MIN + radius + rng.next() * (WORLD_MAX - WORLD_MIN - radius * 2);
      centerZ = WORLD_MIN + radius + rng.next() * (WORLD_MAX - WORLD_MIN - radius * 2);
    } while (Math.hypot(centerX - SPAWN.x, centerZ - SPAWN.z) < SPAWN_CLEARANCE + radius);

    const count = rng.int(density.minItems, density.maxItems);
    for (let item = 0; item < count; item++) {
      const angle = rng.next() * Math.PI * 2;
      const distance = Math.sqrt(rng.next()) * radius;
      const plant =
        keys.plants.length > 0 && (keys.solids.length === 0 || rng.chance(density.plantChance));
      const pool = plant ? keys.plants : keys.solids;
      props.push({
        key: rng.pick(pool),
        x: centerX + Math.cos(angle) * distance,
        z: centerZ + Math.sin(angle) * distance,
        sway: plant,
      });
    }
  }

  return props;
}

function insideClearing(clearings: readonly Clearing[], x: number, z: number): boolean {
  return clearings.some(
    (clearing) =>
      Math.abs(x - clearing.x) <= clearing.halfW &&
      Math.abs(z - clearing.z) <= clearing.halfD,
  );
}

/** Rải các cụm rạn đặt tay, bỏ hẳn vật rơi vào vùng trống hoặc ra ngoài thế giới. */
export function composeReefs(
  seed: number,
  reefs: readonly ReefCluster[],
  clearings: readonly Clearing[],
  palettes: Readonly<Record<PaletteName, readonly PaletteEntry[]>>,
): ReefProp[] {
  const rng = createRng(seed);
  const props: ReefProp[] = [];

  for (const reef of reefs) {
    for (let item = 0; item < reef.count; item++) {
      const angle = rng.next() * Math.PI * 2;
      const distance = Math.sqrt(rng.next()) * reef.radius;
      const entry = rng.pick(palettes[reef.palette]);
      const scale = entry.minScale + rng.next() * (entry.maxScale - entry.minScale);
      const x = reef.x + Math.cos(angle) * distance;
      const z = reef.z + Math.sin(angle) * distance;

      if (
        x < WORLD_MIN ||
        x > WORLD_MAX ||
        z < WORLD_MIN ||
        z > WORLD_MAX ||
        insideClearing(clearings, x, z)
      ) {
        continue;
      }

      props.push({ key: entry.key, x, z, sway: entry.sway, scale });
    }
  }

  return props;
}
