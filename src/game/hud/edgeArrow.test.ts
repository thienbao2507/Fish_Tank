import { describe, expect, it } from 'vitest';
import { edgePoint } from './edgeArrow';

const rect = { x: 0, y: 0, width: 200, height: 100 }; // tâm (100, 50)

describe('edgePoint', () => {
  it('mục tiêu bên phải → mép phải, chỉ sang phải', () => {
    const point = edgePoint(rect, 500, 50);
    expect(point.x).toBe(200);
    expect(point.y).toBe(50);
    expect(point.angle).toBeCloseTo(0);
  });

  it('mục tiêu phía trên → mép trên, chỉ lên', () => {
    const point = edgePoint(rect, 100, -300);
    expect(point.x).toBe(100);
    expect(point.y).toBe(0);
    expect(point.angle).toBeCloseTo(-Math.PI / 2);
  });

  it('mục tiêu chéo trái-dưới → nằm trên mép, đúng hướng', () => {
    const point = edgePoint(rect, -400, 300);
    expect(point.x === 0 || point.y === 100).toBe(true);
    expect(point.x).toBeLessThan(100);
    expect(point.y).toBeGreaterThan(50);
  });

  it('mục tiêu ở trong rect → giữ nguyên vị trí', () => {
    const point = edgePoint(rect, 120, 60);
    expect(point.x).toBe(120);
    expect(point.y).toBe(60);
  });
});
