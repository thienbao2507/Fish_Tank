import { describe, expect, it } from 'vitest';
import type { FoodRules, ZoneDef } from '../content/schemas';
import { createRng } from '../rng';
import { FoodField } from './food';

const zone = {
  id: 'z',
  width: 400,
  height: 300,
  surfaceY: 20,
  floorY: 280,
  wallWidth: 6,
} as ZoneDef;

const rules: FoodRules = {
  price: 5,
  pellets: 3,
  nutrition: 30,
  sinkSpeed: 20,
  dissolveSeconds: 10,
  pollution: 2,
  spread: 8,
};

describe('FoodField', () => {
  it('thả đúng số viên, toả quanh vị trí thả và trong bể', () => {
    const food = new FoodField(zone, rules, createRng(1));
    food.drop(100, 50);
    expect(food.pellets).toHaveLength(3);
    for (const pellet of food.pellets) {
      expect(Math.abs(pellet.x - 100)).toBeLessThanOrEqual(8);
      expect(pellet.y).toBe(50);
    }
    food.drop(1, 50);
    for (const pellet of food.pellets) expect(pellet.x).toBeGreaterThanOrEqual(zone.wallWidth);
  });

  it('chìm dần rồi nằm dưới đáy; chỉ thức ăn dưới đáy mới gây ô nhiễm', () => {
    const food = new FoodField(zone, rules, createRng(2));
    food.drop(100, 50);
    food.update(1);
    expect(food.pellets[0]?.y).toBeCloseTo(70);
    expect(food.pollution).toBe(0);
    for (let i = 0; i < 20; i++) food.update(1);
    expect(food.pellets.every((pellet) => pellet.settled)).toBe(true);
    expect(food.pollution).toBe(3 * rules.pollution);
  });

  it('thức ăn thừa tan sau một thời gian', () => {
    const food = new FoodField(zone, rules, createRng(3));
    food.drop(100, 270);
    food.update(1); // chạm đáy
    food.update(rules.dissolveSeconds);
    expect(food.pellets).toHaveLength(0);
  });

  it('tìm viên gần nhất trong bán kính và xoá được', () => {
    const food = new FoodField(zone, rules, createRng(4));
    food.drop(100, 100);
    expect(food.nearest(300, 100, 50)).toBeUndefined();
    const nearest = food.nearest(100, 100, 50);
    expect(nearest).toBeDefined();
    if (nearest) food.remove(nearest);
    expect(food.pellets).toHaveLength(2);
  });
});
