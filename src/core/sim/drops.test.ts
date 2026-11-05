import { describe, expect, it } from 'vitest';
import type { DropRules, ZoneDef } from '../content/schemas';
import { DropField } from './drops';

const zone = { floorY: 280 } as ZoneDef;
const rules: DropRules = {
  sinkSpeed: 20,
  pickupMargin: 3,
  autoCollectSeconds: 10,
  autoCollectRatio: 0.5,
};

describe('DropField', () => {
  it('rơi xuống và nằm ở đáy', () => {
    const drops = new DropField(zone, rules);
    const coin = drops.spawn('coin', 4, 100, 100);
    drops.update(1);
    expect(coin.y).toBe(120);
    drops.update(9);
    expect(coin.y).toBe(277);
  });

  it('chỉ nhặt được món nằm trong hộp quanh robot', () => {
    const drops = new DropField(zone, rules);
    drops.spawn('coin', 4, 100, 100);
    drops.spawn('pearl', 1, 140, 100);
    const picked = drops.pickup(100, 100, 10, 10);
    expect(picked.map((drop) => drop.kind)).toEqual(['coin']);
    expect(drops.items).toHaveLength(1);
  });

  it('quá hạn thì bị lấy ra để tự cộng', () => {
    const drops = new DropField(zone, rules);
    drops.spawn('coin', 4, 100, 100);
    expect(drops.update(9.9)).toHaveLength(0);
    const expired = drops.update(0.2);
    expect(expired).toHaveLength(1);
    expect(drops.items).toHaveLength(0);
  });
});
