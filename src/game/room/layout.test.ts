import { describe, expect, it } from 'vitest';
import {
  facingFromDirection,
  heroDepth,
  moveInRoom,
  moveInRoomByDirection,
  projectRoom,
  ROOM_PROPS,
  type RoomFacing,
} from './layout';
import { nearestInteraction, ROOM_INTERACTIONS } from './layout';

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
    ['bàn', { gx: 2, gy: 3 }, 'NE' as const, 'gy' as const, 2.25],
    ['hồ', { gx: 4, gy: 3 }, 'NE' as const, 'gy' as const, 1.35],
    ['giường', { gx: 2, gy: 3 }, 'SW' as const, 'gy' as const, 4.75],
  ])('dừng đúng mép chân đế mở rộng của %s', (_label, start, facing, axis, edge) => {
    expect(moveInRoom(start, facing, 5)[axis]).toBeCloseTo(edge);
  });

  it('dừng đúng mép chân đế khi đi vào tủ đầu giường', () => {
    expect(moveInRoom({ gx: 1.5, gy: 4.6 }, 'NW', 5).gx).toBeCloseTo(0.95);
  });

  it('không đi vào chân đế kệ sách khi đi NW', () => {
    expect(moveInRoom({ gx: 2, gy: 1 }, 'NW', 5).gx).toBeCloseTo(0.73);
  });

  it('không đi vào chân đế chậu cây khi đi NW', () => {
    expect(moveInRoom({ gx: 1.5, gy: 7.7 }, 'NW', 5).gx).toBeCloseTo(0.8);
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
  it('nhỏ hơn depth giường khi đứng sát mép sau giường', () => {
    expect(heroDepth({ gx: 3, gy: 4.75 }, ROOM_PROPS)).toBeLessThan(30);
  });

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

  it('nhỏ hơn depth chậu cây khi đứng ngay trước giường và sau chậu cây', () => {
    expect(heroDepth({ gx: 3.5, gy: 7.3 }, ROOM_PROPS)).toBeLessThan(36);
  });

  it('lớn hơn depth chậu cây khi đứng trước chậu cây', () => {
    expect(heroDepth({ gx: 0.8, gy: 7.9 }, ROOM_PROPS)).toBeGreaterThan(36);
  });

  it('nhỏ hơn depth bàn khi đứng trước kệ sách', () => {
    expect(heroDepth({ gx: 0.3, gy: 1.7 }, ROOM_PROPS)).toBeLessThan(10);
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

describe('moveInRoomByDirection', () => {
  const start = { gx: 4.5, gy: 5.5 };
  const screenStep = (x: number, y: number): { dx: number; dy: number } => {
    const end = moveInRoomByDirection(start, { x, y }, 0.5);
    const from = projectRoom(start.gx, start.gy, 0, 0);
    const to = projectRoom(end.gx, end.gy, 0, 0);
    return { dx: to.sx - from.sx, dy: to.sy - from.sy };
  };

  it.each([
    [1, 0, 1, 0],
    [-1, 0, -1, 0],
    [0, 1, 0, 1],
    [0, -1, 0, -1],
    [1, 1, 1, 1],
    [1, -1, 1, -1],
    [-1, 1, -1, 1],
    [-1, -1, -1, -1],
  ])('cần (%s, %s) đi đúng chiều trên màn hình', (x, y, signX, signY) => {
    const { dx, dy } = screenStep(x, y);
    expect(Math.sign(Math.round(dx * 1000))).toBe(signX);
    expect(Math.sign(Math.round(dy * 1000))).toBe(signY);
  });

  it('làm tròn cần lệch nhẹ về hướng gần nhất', () => {
    expect(screenStep(1, 0.3).dy).toBeCloseTo(0);
  });

  it.each([
    [1, 0],
    [1, 1],
    [0, -1],
  ])('cùng tốc độ trên lưới ở hướng (%s, %s)', (x, y) => {
    const end = moveInRoomByDirection(start, { x, y }, 0.5);
    expect(Math.hypot(end.gx - start.gx, end.gy - start.gy)).toBeCloseTo(0.5);
  });

  it('chạm tường thì trượt dọc tường', () => {
    const end = moveInRoomByDirection({ gx: 7.75, gy: 5 }, { x: 1, y: 0 }, 0.5);
    expect(end.gx).toBe(7.75);
    expect(end.gy).toBeLessThan(5);
  });
});

describe('nearestInteraction', () => {
  it('đứng cạnh bàn PC trả tương tác pc', () => {
    expect(nearestInteraction({ gx: 2, gy: 2.5 }, ROOM_INTERACTIONS)?.id).toBe('pc');
  });

  it('đứng cạnh hồ trả tương tác tank', () => {
    expect(nearestInteraction({ gx: 4.5, gy: 1.5 }, ROOM_INTERACTIONS)?.id).toBe('tank');
  });

  it('đứng trước cửa trả tương tác door', () => {
    expect(nearestInteraction({ gx: 7, gy: 0.5 }, ROOM_INTERACTIONS)?.id).toBe('door');
  });

  it('đứng giữa phòng trả null', () => {
    expect(nearestInteraction({ gx: 4.5, gy: 4.5 }, ROOM_INTERACTIONS)).toBeNull();
  });
});

describe('tương tác giường', () => {
  it('đứng cạnh giường trả tương tác bed', () => {
    expect(nearestInteraction({ gx: 3.5, gy: 6 }, ROOM_INTERACTIONS)?.id).toBe('bed');
  });

  it('giường nằm trong danh sách tương tác', () => {
    expect(ROOM_INTERACTIONS.some(({ id }) => id === 'bed')).toBe(true);
  });
});
