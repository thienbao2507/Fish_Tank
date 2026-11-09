import { describe, expect, it } from 'vitest';
import { createTimer } from '../time/timers';
import { FishOrders } from './orders';

describe('FishOrders', () => {
  it('thêm đơn đúng loài và cấp id tăng dần', () => {
    const orders = new FishOrders();
    const guppyTimer = createTimer(1_000, 60);
    const neonTimer = createTimer(2_000, 180);

    expect(orders.add('guppy', guppyTimer)).toEqual({
      id: 1,
      speciesId: 'guppy',
      timer: guppyTimer,
      notified: false,
    });
    expect(orders.add('neon', neonTimer)).toEqual({
      id: 2,
      speciesId: 'neon',
      timer: neonTimer,
      notified: false,
    });
    expect(orders.orders).toEqual([
      { id: 1, speciesId: 'guppy', timer: guppyTimer, notified: false },
      { id: 2, speciesId: 'neon', timer: neonTimer, notified: false },
    ]);
  });

  it('xoá đúng đơn theo id', () => {
    const orders = new FishOrders();
    orders.add('guppy', createTimer(1_000, 60));
    orders.add('neon', createTimer(1_000, 180));

    expect(orders.remove(1)).toBe(true);
    expect(orders.remove(99)).toBe(false);
    expect(orders.orders.map((order) => order.speciesId)).toEqual(['neon']);
  });
});
