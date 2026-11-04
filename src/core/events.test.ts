import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './events';

interface TestEvents {
  scored: { points: number };
  reset: undefined;
}

describe('EventBus', () => {
  it('gọi handler với đúng dữ liệu', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('scored', handler);
    bus.emit('scored', { points: 3 });
    expect(handler).toHaveBeenCalledWith({ points: 3 });
  });

  it('chỉ gọi handler của đúng sự kiện', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('reset', handler);
    bus.emit('scored', { points: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('huỷ đăng ký bằng hàm trả về từ on()', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on('scored', handler);
    unsubscribe();
    bus.emit('scored', { points: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('handler tự huỷ đăng ký trong lúc emit không ảnh hưởng handler khác', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const unsubscribe = bus.on('scored', () => unsubscribe());
    bus.on('scored', second);
    bus.emit('scored', { points: 1 });
    bus.emit('scored', { points: 2 });
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('emit khi chưa có handler không báo lỗi', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('reset', undefined)).not.toThrow();
  });
});
