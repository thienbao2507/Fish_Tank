import { describe, expect, it } from 'vitest';
import { layoutProps, SPAWN } from './layout';
import { composeReefs } from './layout';
import type { Clearing, PaletteName, ReefCluster } from './scenePlan';

const KEYS = {
  plants: ['plant.a', 'plant.b'],
  solids: ['rock.a', 'coral.a'],
} as const;

describe('layoutProps', () => {
  it('tất định theo seed', () => {
    expect(layoutProps(2026, KEYS)).toEqual(layoutProps(2026, KEYS));
    expect(layoutProps(2026, KEYS)).not.toEqual(layoutProps(2027, KEYS));
  });

  it('giữ mọi vật trong thế giới và ngoài vùng trống quanh spawn', () => {
    const props = layoutProps(73, KEYS);
    expect(props.length).toBeGreaterThanOrEqual(40 * 5);
    expect(props.length).toBeLessThanOrEqual(40 * 12);

    for (const prop of props) {
      expect(prop.x).toBeGreaterThanOrEqual(24);
      expect(prop.x).toBeLessThanOrEqual(1000);
      expect(prop.z).toBeGreaterThanOrEqual(24);
      expect(prop.z).toBeLessThanOrEqual(1000);
      expect(Math.hypot(prop.x - SPAWN.x, prop.z - SPAWN.z)).toBeGreaterThanOrEqual(90);
    }
  });

  it('chỉ cây có sway', () => {
    for (const prop of layoutProps(19, KEYS)) {
      expect(prop.sway).toBe(KEYS.plants.includes(prop.key as (typeof KEYS.plants)[number]));
    }
  });
});

const COMPOSE_PALETTES = {
  reef: [
    { key: 'reef.a', sway: false, minScale: 0.8, maxScale: 1.2 },
    { key: 'reef.b', sway: true, minScale: 1.3, maxScale: 1.8 },
  ],
  grass: [{ key: 'grass.a', sway: true, minScale: 0.5, maxScale: 0.7 }],
  gold: [{ key: 'gold.a', sway: true, minScale: 0.9, maxScale: 1.1 }],
  rocks: [{ key: 'rock.a', sway: false, minScale: 1, maxScale: 1.4 }],
} as const satisfies Readonly<
  Record<PaletteName, readonly { key: string; sway: boolean; minScale: number; maxScale: number }[]>
>;

const COMPOSE_REEFS: readonly ReefCluster[] = [
  { x: 32, z: 32, radius: 40, count: 40, palette: 'rocks' },
  { x: 500, z: 500, radius: 90, count: 80, palette: 'reef' },
  { x: 980, z: 980, radius: 50, count: 40, palette: 'grass' },
];
const COMPOSE_CLEARINGS: readonly Clearing[] = [
  { x: 500, z: 500, halfW: 24, halfD: 30 },
];

describe('composeReefs', () => {
  it('tất định theo seed', () => {
    expect(composeReefs(2026, COMPOSE_REEFS, COMPOSE_CLEARINGS, COMPOSE_PALETTES)).toEqual(
      composeReefs(2026, COMPOSE_REEFS, COMPOSE_CLEARINGS, COMPOSE_PALETTES),
    );
    expect(composeReefs(2026, COMPOSE_REEFS, COMPOSE_CLEARINGS, COMPOSE_PALETTES)).not.toEqual(
      composeReefs(2027, COMPOSE_REEFS, COMPOSE_CLEARINGS, COMPOSE_PALETTES),
    );
  });

  it('bỏ vật trong clearing và ngoài biên thay vì dời vị trí', () => {
    const props = composeReefs(73, COMPOSE_REEFS, COMPOSE_CLEARINGS, COMPOSE_PALETTES);
    expect(props.length).toBeLessThan(COMPOSE_REEFS.reduce((sum, reef) => sum + reef.count, 0));

    for (const prop of props) {
      expect(prop.x).toBeGreaterThanOrEqual(24);
      expect(prop.x).toBeLessThanOrEqual(1000);
      expect(prop.z).toBeGreaterThanOrEqual(24);
      expect(prop.z).toBeLessThanOrEqual(1000);
      expect(
        COMPOSE_CLEARINGS.some(
          (clearing) =>
            Math.abs(prop.x - clearing.x) <= clearing.halfW &&
            Math.abs(prop.z - clearing.z) <= clearing.halfD,
        ),
      ).toBe(false);
    }
  });

  it('giữ scale trong khoảng của đúng phần tử palette', () => {
    for (const prop of composeReefs(19, COMPOSE_REEFS, COMPOSE_CLEARINGS, COMPOSE_PALETTES)) {
      const entry = Object.values(COMPOSE_PALETTES)
        .flat()
        .find((candidate) => candidate.key === prop.key);
      expect(entry).toBeDefined();
      expect(prop.scale).toBeGreaterThanOrEqual(entry?.minScale ?? Infinity);
      expect(prop.scale).toBeLessThanOrEqual(entry?.maxScale ?? -Infinity);
    }
  });
});
