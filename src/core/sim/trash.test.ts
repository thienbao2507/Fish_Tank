import { describe, expect, it } from 'vitest';
import type { TrashCatalog, TrashTypeDef, ZoneDef } from '../content/schemas';
import { createRng } from '../rng';
import { blockedBy } from './obstacles';
import { TrashField, type TrashCollector } from './trash';

const types: TrashTypeDef[] = [
  { id: 'bottle', texture: 't', layer: 'float', value: 3, slots: 1, radius: 4, pollution: 2 },
  { id: 'bag', texture: 't', layer: 'mid', value: 2, slots: 1, radius: 5, pollution: 2 },
  { id: 'can', texture: 't', layer: 'sink', value: 4, slots: 1, radius: 5, pollution: 2 },
];
const [bottle, bag] = types as [TrashTypeDef, TrashTypeDef, TrashTypeDef];
const catalog: TrashCatalog = { sinkSpeed: 20, driftSpeed: 6, types };
const FALL_SECONDS = 2.5;

function zone(trash: Partial<ZoneDef['trash']> = {}): ZoneDef {
  return {
    id: 'z',
    width: 800,
    height: 400,
    surfaceY: 20,
    floorY: 380,
    wallWidth: 6,
    station: { x: 10, y: 340, width: 40, height: 40 },
    robotSpawn: { x: 30, y: 350 },
    trash: {
      initialCount: 30,
      maxCount: 40,
      spawnIntervalSeconds: 2,
      weights: { bottle: 1, bag: 1, can: 1 },
      ...trash,
    },
  };
}

const acceptAll: TrashCollector = { canFit: () => true, collect: () => true };

describe('TrashField', () => {
  it('rải đúng số rác ban đầu, mỗi loại ở đúng tầng nước', () => {
    const z = zone();
    const field = new TrashField(z, catalog, createRng(1), FALL_SECONDS);
    field.fillInitial();
    expect(field.items).toHaveLength(30);
    for (const item of field.items) {
      expect(item.x).toBeGreaterThan(z.wallWidth);
      expect(item.x).toBeLessThan(z.width - z.wallWidth);
      expect(item.y).toBeGreaterThan(z.surfaceY);
      expect(item.y).toBeLessThan(z.floorY);
      const expectedLane = item.type.layer === 'float' ? 2 : item.type.layer === 'mid' ? 1 : 0;
      expect(item.lane).toBe(expectedLane);
      expect(item.z).toBe(expectedLane);
    }
  });

  it('sinh thêm rác theo chu kỳ nhưng không vượt trần', () => {
    const field = new TrashField(
      zone({ initialCount: 0, maxCount: 3 }),
      catalog,
      createRng(2),
      FALL_SECONDS,
    );
    field.update(1.9);
    expect(field.items).toHaveLength(0);
    field.update(0.2);
    expect(field.items).toHaveLength(1);
    field.update(100);
    expect(field.items).toHaveLength(3);
  });

  it('dọn hết thì rác sinh lại', () => {
    const z = zone({ initialCount: 5, maxCount: 5 });
    const field = new TrashField(z, catalog, createRng(3), FALL_SECONDS);
    field.fillInitial();
    for (const item of [...field.items]) {
      field.pull(
        item.x,
        item.y,
        { radius: 1, pullSpeed: 1, collectRadius: 1 },
        0.016,
        acceptAll,
        item.z,
        1,
      );
    }
    expect(field.items).toHaveLength(0);
    field.update(2);
    expect(field.items.length).toBeGreaterThan(0);
  });

  it('rác chìm mới sinh rơi từ tầng 2 về 0 mà y không đổi', () => {
    const z = zone({ initialCount: 0, maxCount: 1, spawnIntervalSeconds: 1 });
    z.trash.weights = { can: 1 };
    const field = new TrashField(z, catalog, createRng(4), FALL_SECONDS);
    field.update(1);
    const item = field.items[0] as (typeof field.items)[number];
    const y = item.y;
    expect(item.lane).toBe(0);
    expect(item.z).toBe(2);
    field.update(FALL_SECONDS);
    expect(item.z).toBeCloseTo(1);
    expect(item.y).toBe(y);
    field.update(FALL_SECONDS);
    expect(item.z).toBe(0);
    expect(item.y).toBe(y);
  });

  it('rác nổi và lơ lửng trôi ngang nhưng giữ nguyên y', () => {
    const z = zone({ initialCount: 0 });
    const field = new TrashField(z, catalog, createRng(5), FALL_SECONDS);
    const floating = field.add(bottle, 100, 120);
    const middle = field.add(bag, 200, 240);
    field.update(1);
    expect(floating.y).toBe(120);
    expect(middle.y).toBe(240);
    expect(floating.x).not.toBe(100);
    expect(middle.x).not.toBe(200);
  });

  it('rác trôi không vượt qua thành bể', () => {
    const z = zone({ initialCount: 0, maxCount: 1, spawnIntervalSeconds: 1e9 });
    const field = new TrashField(z, catalog, createRng(6), FALL_SECONDS);
    const item = field.add(bag, 400, 200, 0);
    for (let i = 0; i < 2_000; i++) field.update(0.5);
    expect(item.x).toBeGreaterThan(z.wallWidth);
    expect(item.x).toBeLessThan(z.width - z.wallWidth);
  });

  it('rác không sinh trong vật cản', () => {
    const z = zone({ initialCount: 30, maxCount: 30 });
    z.obstacles = [{ x: 400, y: 200, width: 500, height: 200 }];
    const field = new TrashField(z, catalog, createRng(12), FALL_SECONDS);
    field.fillInitial();
    expect(field.items).toHaveLength(30);
    expect(
      field.items.every(
        (item) => !blockedBy(z.obstacles ?? [], item.x, item.y, item.type.radius, item.type.radius),
      ),
    ).toBe(true);
  });

  describe('pull', () => {
    const params = { radius: 30, pullSpeed: 100, collectRadius: 5 };

    it('rác ngoài bán kính không bị ảnh hưởng', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(7), FALL_SECONDS);
      const item = field.add(bag, 200, 200, 0);
      field.pull(100, 200, params, 0.1, acceptAll, 0, 1);
      expect(item.x).toBe(200);
    });

    it('rác trong bán kính bị kéo lại gần', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(8), FALL_SECONDS);
      const item = field.add(bag, 120, 200, 0);
      field.pull(100, 200, params, 0.1, acceptAll, 0, 1);
      expect(item.x).toBeCloseTo(110);
    });

    it('rác đủ gần thì được thu và biến khỏi bãi', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(9), FALL_SECONDS);
      const item = field.add(bag, 103, 200, 0);
      const result = field.pull(100, 200, params, 0.1, acceptAll, 0, 1);
      expect(result.collected).toEqual([item]);
      expect(field.items).toHaveLength(0);
    });

    it('khoang không đủ chỗ → không hút và báo blocked', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(10), FALL_SECONDS);
      const item = field.add(bag, 120, 200, 0);
      const result = field.pull(
        100,
        200,
        params,
        0.1,
        {
          canFit: () => false,
          collect: () => true,
        },
        0,
        1,
      );
      expect(result.blocked).toBe(true);
      expect(item.x).toBe(120);
    });

    it('collect từ chối → rác ở lại và báo blocked', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(11), FALL_SECONDS);
      field.add(bag, 101, 200, 0);
      const result = field.pull(
        100,
        200,
        params,
        0.1,
        {
          canFit: () => true,
          collect: () => false,
        },
        0,
        1,
      );
      expect(result.blocked).toBe(true);
      expect(field.items).toHaveLength(1);
    });
  });
});
