import { describe, expect, it } from 'vitest';
import {
  facingFromDirection,
  heroDepth,
  moveInRoom,
  projectRoom,
  ROOM_PROPS,
  type RoomFacing,
} from './layout';

describe('projectRoom', () => {
  it.each([
    [0, 0, 258, 124],
    [8, 0, 498, 244],
    [0, 8, 18, 244],
    [8, 8, 258, 364],
  ])('chiếu góc sàn (%s, %s) đúng vị trí', (gx, gy, sx, sy) => {
    expect(projectRoom(gx, gy, 10, 20)).toEqual({ sx, sy });
  });
});

describe('moveInRoom', () => {
  it.each([
    ['bàn', { gx: 2, gy: 3 }, 'NE' as const, 'gy' as const, 1.75],
    ['hồ', { gx: 4, gy: 3 }, 'NE' as const, 'gy' as const, 1.35],
    ['giường', { gx: 2, gy: 3 }, 'SW' as const, 'gy' as const, 4.75],
  ])('dừng đúng mép chân đế mở rộng của %s', (_label, start, facing, axis, edge) => {
    expect(moveInRoom(start, facing, 5)[axis]).toBeCloseTo(edge);
  });

  it('dừng đúng mép chân đế khi đi vào tủ đầu giường', () => {
    expect(moveInRoom({ gx: 1.5, gy: 4.6 }, 'NW', 5).gx).toBeCloseTo(0.95);
  });

  it.each([
    [{ gx: 4, gy: 4 }, 'SE' as const, 'gx' as const, 7.75],
    [{ gx: 4, gy: 4 }, 'NW' as const, 'gx' as const, 0.25],
    [{ gx: 7, gy: 4 }, 'SW' as const, 'gy' as const, 7.75],
    [{ gx: 7, gy: 4 }, 'NE' as const, 'gy' as const, 0.25],
  ])('không đi ra khỏi biên sàn', (start, facing, axis, edge) => {
    expect(moveInRoom(start, facing, 20)[axis]).toBe(edge);
  });
});

describe('heroDepth', () => {
  it('nhỏ hơn depth giường khi đứng sau giường', () => {
    expect(heroDepth({ gx: 2, gy: 4 }, ROOM_PROPS)).toBeLessThan(30);
  });

  it.each([
    { gx: 2, gy: 7.2 },
    { gx: 3.2, gy: 4 },
  ])('lớn hơn depth giường khi đứng trước giường tại $gx, $gy', (pos) => {
    expect(heroDepth(pos, ROOM_PROPS)).toBeGreaterThan(30);
  });

  it('nhỏ hơn depth tủ đầu giường khi đứng sau tủ', () => {
    expect(heroDepth({ gx: 0.4, gy: 3.8 }, ROOM_PROPS)).toBeLessThan(22);
  });

  it('nằm giữa depth tủ đầu giường và giường khi đứng trước tủ nhưng sau giường', () => {
    const depth = heroDepth({ gx: 1.5, gy: 4.6 }, ROOM_PROPS);

    expect(depth).toBeGreaterThan(22);
    expect(depth).toBeLessThan(30);
  });

  it('nhỏ hơn depth hồ khi đứng giữa bàn và hồ', () => {
    expect(heroDepth({ gx: 3.25, gy: 0.5 }, ROOM_PROPS)).toBeLessThan(16);
  });
});

describe('facingFromDirection', () => {
  it.each<[number, number, RoomFacing]>([
    [1, 1, 'SE'],
    [-1, 1, 'SW'],
    [1, -1, 'NE'],
    [-1, -1, 'NW'],
  ])('chọn đúng góc phần tư cho vector (%s, %s)', (x, y, expected) => {
    expect(facingFromDirection({ x, y }, 'SE')).toBe(expected);
  });

  it('giữ hướng hiện tại khi thành phần gần 0 cho hai hướng ứng viên', () => {
    expect(facingFromDirection({ x: 0.1, y: 1 }, 'SW')).toBe('SW');
  });

  it('lấy ứng viên đầu khi hướng hiện tại không phải ứng viên', () => {
    expect(facingFromDirection({ x: 0.1, y: 1 }, 'NE')).toBe('SE');
  });

  it('trả null khi vector quá nhỏ', () => {
    expect(facingFromDirection({ x: 0.1, y: 0.1 }, 'SE')).toBeNull();
  });
});
