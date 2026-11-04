import { describe, expect, it } from 'vitest';
import { Cargo } from './cargo';

describe('Cargo', () => {
  it('thêm rác thì tăng số ô đã dùng và đếm theo loại', () => {
    const cargo = new Cargo(10);
    expect(cargo.add('can', 1)).toBe(true);
    expect(cargo.add('can', 1)).toBe(true);
    expect(cargo.add('tire', 3)).toBe(true);
    expect(cargo.used).toBe(5);
    expect(cargo.free).toBe(5);
    expect(cargo.contents.get('can')).toBe(2);
    expect(cargo.contents.get('tire')).toBe(1);
  });

  it('không đủ chỗ thì từ chối và không thay đổi gì', () => {
    const cargo = new Cargo(4);
    cargo.add('tire', 3);
    expect(cargo.canFit(3)).toBe(false);
    expect(cargo.add('tire', 3)).toBe(false);
    expect(cargo.used).toBe(3);
    expect(cargo.canFit(1)).toBe(true);
  });

  it('unload trả về toàn bộ rác và làm rỗng khoang', () => {
    const cargo = new Cargo(10);
    cargo.add('bottle', 1);
    cargo.add('bottle', 1);
    const unloaded = cargo.unload();
    expect(unloaded.get('bottle')).toBe(2);
    expect(cargo.isEmpty).toBe(true);
    expect(cargo.contents.size).toBe(0);
  });

  it('từ chối sức chứa hoặc số ô không hợp lệ', () => {
    expect(() => new Cargo(0)).toThrow(RangeError);
    expect(() => new Cargo(2.5)).toThrow(RangeError);
    expect(() => new Cargo(5).add('x', 0)).toThrow(RangeError);
  });
});
