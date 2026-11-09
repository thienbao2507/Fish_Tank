import { describe, expect, it } from 'vitest';
import { blockedBy, resolveMove, type Obstacle } from './obstacles';

const wall: Obstacle = { x: 100, y: 100, width: 20, height: 120 };

describe('blockedBy', () => {
  it('phân biệt giao vật cản với chỉ chạm mép', () => {
    expect(blockedBy([wall], 80, 100, 11, 10)).toBe(true);
    expect(blockedBy([wall], 80, 100, 10, 10)).toBe(false);
  });
});

describe('resolveMove', () => {
  it('không xuyên qua vật cản dù bước di chuyển rất lớn', () => {
    expect(resolveMove([wall], 0, 100, 300, 100, 5, 5)).toEqual({
      x: 85,
      y: 100,
      hitX: true,
      hitY: false,
    });
  });

  it('chặn một trục và cho trượt dọc tường trên trục còn lại', () => {
    expect(resolveMove([wall], 80, 100, 120, 140, 10, 10)).toEqual({
      x: 80,
      y: 140,
      hitX: true,
      hitY: false,
    });
  });

  it('đứng sát tường vẫn rời ra và đi dọc tường được, không bị kẹt', () => {
    expect(resolveMove([wall], 80, 100, 70, 130, 10, 10)).toEqual({
      x: 70,
      y: 130,
      hitX: false,
      hitY: false,
    });
    expect(resolveMove([wall], 80, 100, 80, 130, 10, 10).y).toBe(130);
  });
});
