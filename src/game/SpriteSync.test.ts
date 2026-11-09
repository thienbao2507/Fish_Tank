import { describe, expect, it, vi } from 'vitest';
import { SpriteSync } from './SpriteSync';

function setup() {
  const destroyed: number[] = [];
  const create = vi.fn((item: { id: number }) => ({
    id: item.id,
    destroy: () => destroyed.push(item.id),
  }));
  const update = vi.fn();
  return { sync: new SpriteSync(create, update), create, update, destroyed };
}

describe('SpriteSync', () => {
  it('tạo view cho phần tử mới và cập nhật mọi phần tử', () => {
    const { sync, create, update } = setup();
    sync.sync([{ id: 1 }, { id: 2 }]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
    sync.sync([{ id: 1 }, { id: 2 }]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(4);
  });

  it('huỷ view của phần tử đã biến mất', () => {
    const { sync, destroyed } = setup();
    sync.sync([{ id: 1 }, { id: 2 }]);
    sync.sync([{ id: 2 }]);
    expect(destroyed).toEqual([1]);
    expect(sync.size).toBe(1);
  });
});
