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
const FALL_SECONDS = 0.8;

describe('DropField', () => {
  it('rơi từ tầng cá về tầng 0 mà y không đổi', () => {
    const drops = new DropField(zone, rules, FALL_SECONDS);
    const coin = drops.spawn('coin', 4, 100, 100, 2);
    drops.update(FALL_SECONDS);
    expect(coin.z).toBeCloseTo(1);
    expect(coin.lane).toBe(1);
    expect(coin.y).toBe(100);
    drops.update(FALL_SECONDS);
    expect(coin.z).toBe(0);
    expect(coin.lane).toBe(0);
    expect(coin.y).toBe(100);
  });

  it('chỉ nhặt được món nằm trong hộp quanh robot', () => {
    const drops = new DropField(zone, rules, FALL_SECONDS);
    drops.spawn('coin', 4, 100, 100);
    drops.spawn('pearl', 1, 140, 100);
    const picked = drops.pickup(100, 100, 10, 10, 0, 1);
    expect(picked.map((drop) => drop.kind)).toEqual(['coin']);
    expect(drops.items).toHaveLength(1);
  });

  it('chỉ nhặt được món trong tầm độ sâu của robot', () => {
    const drops = new DropField(zone, rules, FALL_SECONDS);
    drops.spawn('coin', 4, 100, 100, 0);
    drops.spawn('pearl', 1, 100, 100, 1);
    const picked = drops.pickup(100, 100, 10, 10, 0, 1);
    expect(picked.map((drop) => drop.kind)).toEqual(['coin']);
    expect(drops.items).toHaveLength(1);
  });

  it('quá hạn thì bị lấy ra để tự cộng', () => {
    const drops = new DropField(zone, rules, FALL_SECONDS);
    drops.spawn('coin', 4, 100, 100);
    expect(drops.update(9.9)).toHaveLength(0);
    const expired = drops.update(0.2);
    expect(expired).toHaveLength(1);
    expect(drops.items).toHaveLength(0);
  });

  it('xu và ngọc giữ nguyên vị trí trên mặt phẳng khi rơi tầng', () => {
    const drops = new DropField(zone, { ...rules, autoCollectSeconds: 1e9 }, FALL_SECONDS);
    const coin = drops.spawn('coin', 4, 300, 100, 2);
    const pearl = drops.spawn('pearl', 1, 300, 120, 1);
    drops.update(100);
    expect(coin.y).toBe(100);
    expect(pearl.y).toBe(120);
    expect(coin.z).toBe(0);
    expect(pearl.z).toBe(0);
  });
});
