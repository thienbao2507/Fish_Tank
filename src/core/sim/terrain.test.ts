import { describe, expect, it } from 'vitest';
import type { ZoneDef } from '../content/schemas';
import { floorAt, floorUnder } from './terrain';

const flatZone = { floorY: 200 } as ZoneDef;
const hillyZone = {
  floorY: 200,
  terrain: [
    [0, 0],
    [10, 20],
    [20, 5],
  ],
} as ZoneDef;

describe('terrain', () => {
  it('không có terrain thì floorAt trả về floorY', () => {
    expect(floorAt(flatZone, -50)).toBe(200);
    expect(floorAt(flatZone, 100)).toBe(200);
  });

  it('tại các điểm điều khiển trả về đúng độ nhô đã khai báo', () => {
    expect(floorAt(hillyZone, 0)).toBe(200);
    expect(floorAt(hillyZone, 10)).toBe(180);
    expect(floorAt(hillyZone, 20)).toBe(195);
  });

  it('giữa hai điểm luôn nằm trong khoảng giá trị của hai đầu', () => {
    expect(floorAt(hillyZone, 5)).toBeGreaterThanOrEqual(180);
    expect(floorAt(hillyZone, 5)).toBeLessThanOrEqual(200);
    expect(floorAt(hillyZone, 15)).toBeGreaterThanOrEqual(180);
    expect(floorAt(hillyZone, 15)).toBeLessThanOrEqual(195);
  });

  it('floorUnder lấy mặt đáy cao nhất trong toàn bộ khoảng rộng', () => {
    expect(floorUnder(hillyZone, 10, 10)).toBe(180);
    expect(floorUnder(hillyZone, 2, 2)).toBeLessThan(floorAt(hillyZone, 0));
  });
});
