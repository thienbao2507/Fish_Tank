import { describe, expect, it } from 'vitest';
import type { TrashCatalog, TrashTypeDef, ZoneDef } from '../content/schemas';
import { createRng } from '../rng';
import { floorAt } from './terrain';
import { testHillyZone } from './testFixtures';
import { TrashField, type TrashCollector } from './trash';

const types: TrashTypeDef[] = [
  { id: 'bottle', texture: 't', layer: 'float', value: 3, slots: 1, radius: 4, pollution: 2 },
  { id: 'bag', texture: 't', layer: 'mid', value: 2, slots: 1, radius: 5, pollution: 2 },
  { id: 'can', texture: 't', layer: 'sink', value: 4, slots: 1, radius: 5, pollution: 2 },
];
const [bottle, bag, can] = types as [TrashTypeDef, TrashTypeDef, TrashTypeDef];
const catalog: TrashCatalog = { sinkSpeed: 20, driftSpeed: 6, types };

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
    const field = new TrashField(z, catalog, createRng(1));
    field.fillInitial();
    expect(field.items).toHaveLength(30);
    for (const item of field.items) {
      const r = item.type.radius;
      expect(item.x).toBeGreaterThan(z.wallWidth);
      expect(item.x).toBeLessThan(z.width - z.wallWidth);
      expect(item.lane).toBeGreaterThanOrEqual(0);
      expect(item.lane).toBeLessThanOrEqual(2);
      if (item.type.layer === 'float') expect(item.y).toBe(z.surfaceY + r);
      if (item.type.layer === 'sink') expect(item.y).toBe(z.floorY - r);
      if (item.type.layer === 'mid') {
        expect(item.y).toBeGreaterThan(z.surfaceY + r);
        expect(item.y).toBeLessThan(z.floorY - r);
      }
    }
  });

  it('sinh thêm rác theo chu kỳ nhưng không vượt trần', () => {
    const field = new TrashField(zone({ initialCount: 0, maxCount: 3 }), catalog, createRng(2));
    field.update(1.9);
    expect(field.items).toHaveLength(0);
    field.update(0.2);
    expect(field.items).toHaveLength(1);
    field.update(100);
    expect(field.items).toHaveLength(3);
  });

  it('dọn hết thì rác sinh lại', () => {
    const z = zone({ initialCount: 5, maxCount: 5 });
    const field = new TrashField(z, catalog, createRng(3));
    field.fillInitial();
    for (const item of [...field.items]) {
      field.pull(
        item.x,
        item.y,
        { radius: 1, pullSpeed: 1, collectRadius: 1 },
        0.016,
        acceptAll,
        item.lane,
      );
    }
    expect(field.items).toHaveLength(0);
    field.update(2);
    expect(field.items.length).toBeGreaterThan(0);
  });

  it('rác chìm mới sinh rơi dần xuống đáy rồi nằm yên', () => {
    const z = zone({ initialCount: 0 });
    const field = new TrashField(z, catalog, createRng(4));
    const item = field.add(can, 100, z.surfaceY + can.radius, 0);
    field.update(1);
    expect(item.y).toBeCloseTo(z.surfaceY + can.radius + 20);
    for (let i = 0; i < 100; i++) field.update(0.5);
    expect(item.y).toBe(z.floorY - can.radius);
  });

  it('rác nổi bị kéo xuống thì nổi lên lại', () => {
    const z = zone({ initialCount: 0 });
    const field = new TrashField(z, catalog, createRng(5));
    const item = field.add(bottle, 100, 200, 0);
    for (let i = 0; i < 100; i++) field.update(0.5);
    expect(item.y).toBe(z.surfaceY + bottle.radius);
  });

  it('rác trôi không vượt qua thành bể', () => {
    const z = zone({ initialCount: 0, maxCount: 1, spawnIntervalSeconds: 1e9 });
    const field = new TrashField(z, catalog, createRng(6));
    const item = field.add(bag, 400, 200, 0);
    for (let i = 0; i < 2_000; i++) field.update(0.5);
    expect(item.x).toBeGreaterThan(z.wallWidth);
    expect(item.x).toBeLessThan(z.width - z.wallWidth);
  });

  it('rác chìm và rác lơ lửng dừng theo mặt gò tại x của món rác', () => {
    const z: ZoneDef = {
      ...testHillyZone,
      trash: { ...testHillyZone.trash, initialCount: 1, weights: { can: 1 } },
    };
    const field = new TrashField(z, catalog, createRng(12));
    field.fillInitial();
    const initial = field.items[0] as (typeof field.items)[number];
    expect(initial.y).toBeCloseTo(floorAt(z, initial.x) - can.radius);

    const sinking = field.add(can, 300, z.surfaceY + can.radius, 0);
    const middle = field.add(bag, 300, z.floorY, 0);
    field.update(100);
    expect(sinking.y).toBe(floorAt(z, 300) - can.radius);
    expect(middle.y).toBe(floorAt(z, middle.x) - bag.radius - 24);
  });

  describe('pull', () => {
    const params = { radius: 30, pullSpeed: 100, collectRadius: 5 };

    it('rác ngoài bán kính không bị ảnh hưởng', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(7));
      const item = field.add(bag, 200, 200, 0);
      field.pull(100, 200, params, 0.1, acceptAll);
      expect(item.x).toBe(200);
    });

    it('rác trong bán kính bị kéo lại gần', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(8));
      const item = field.add(bag, 120, 200, 0);
      field.pull(100, 200, params, 0.1, acceptAll);
      expect(item.x).toBeCloseTo(110);
    });

    it('rác đủ gần thì được thu và biến khỏi bãi', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(9));
      const item = field.add(bag, 103, 200, 0);
      const result = field.pull(100, 200, params, 0.1, acceptAll);
      expect(result.collected).toEqual([item]);
      expect(field.items).toHaveLength(0);
    });

    it('khoang không đủ chỗ → không hút và báo blocked', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(10));
      const item = field.add(bag, 120, 200, 0);
      const result = field.pull(100, 200, params, 0.1, {
        canFit: () => false,
        collect: () => true,
      });
      expect(result.blocked).toBe(true);
      expect(item.x).toBe(120);
    });

    it('collect từ chối → rác ở lại và báo blocked', () => {
      const field = new TrashField(zone({ initialCount: 0 }), catalog, createRng(11));
      field.add(bag, 101, 200, 0);
      const result = field.pull(100, 200, params, 0.1, {
        canFit: () => true,
        collect: () => false,
      });
      expect(result.blocked).toBe(true);
      expect(field.items).toHaveLength(1);
    });
  });
});
