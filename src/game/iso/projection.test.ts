import { describe, expect, it } from 'vitest';
import { groundRow, project } from './projection';

const VIEW_W = 720;
const VIEW_H = 360;
const FOCUS = { x: 512, z: 512 };

describe('project', () => {
  it('chiếu điểm nhìn trên đáy vào đúng tâm với tỉ lệ 1', () => {
    const point = project(FOCUS.x, 0, FOCUS.z, FOCUS, VIEW_W, VIEW_H);
    expect(point.sx).toBeCloseTo(VIEW_W / 2);
    expect(point.sy).toBeCloseTo(VIEW_H / 2);
    expect(point.scale).toBeCloseTo(1);
  });

  it('điểm xa hơn nằm cao hơn và nhỏ hơn', () => {
    const near = project(FOCUS.x, 0, FOCUS.z, FOCUS, VIEW_W, VIEW_H);
    const far = project(FOCUS.x, 0, FOCUS.z + 180, FOCUS, VIEW_W, VIEW_H);
    expect(far.scale).toBeLessThan(near.scale);
    expect(far.sy).toBeLessThan(near.sy);
  });
});

describe('groundRow', () => {
  it.each([24, VIEW_H / 2, VIEW_H - 24])('là nghịch đảo của project tại hàng %s', (sy) => {
    const row = groundRow(sy, FOCUS, VIEW_H);
    const point = project(FOCUS.x, 0, row.z, FOCUS, VIEW_W, VIEW_H);
    expect(point.sy).toBeCloseTo(sy, 2);
    expect(point.scale).toBeCloseTo(row.scale, 5);
  });
});
