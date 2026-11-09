import { describe, expect, it } from 'vitest';
import { LANE_COUNT, nearestLane, stepLane } from './lanes';

describe('lanes', () => {
  it('có đúng 3 làn', () => {
    expect(LANE_COUNT).toBe(3);
  });

  it('làm tròn z về làn gần nhất và kẹp trong 0..2', () => {
    expect(nearestLane(-10)).toBe(0);
    expect(nearestLane(0.49)).toBe(0);
    expect(nearestLane(0.5)).toBe(1);
    expect(nearestLane(1.6)).toBe(2);
    expect(nearestLane(10)).toBe(2);
  });

  it('trượt về làn đích theo cả hai hướng mà không vượt quá đích', () => {
    expect(stepLane(0, 2, 0.25)).toBe(0.25);
    expect(stepLane(2, 0, 0.25)).toBe(1.75);
    expect(stepLane(0.9, 1, 0.5)).toBe(1);
    expect(stepLane(1.1, 1, 0.5)).toBe(1);
  });
});
