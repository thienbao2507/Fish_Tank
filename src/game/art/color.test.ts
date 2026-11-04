import { describe, expect, it } from 'vitest';
import { hexToNumber, mixHex } from './color';

describe('hexToNumber', () => {
  it('đổi "#rrggbb" sang số', () => {
    expect(hexToNumber('#ff8000')).toBe(0xff8000);
    expect(hexToNumber('#000000')).toBe(0);
  });
});

describe('mixHex', () => {
  it('t = 0 và t = 1 trả về hai đầu', () => {
    expect(mixHex('#102030', '#f0e0d0', 0)).toBe('#102030');
    expect(mixHex('#102030', '#f0e0d0', 1)).toBe('#f0e0d0');
  });

  it('t = 0.5 trộn từng kênh màu', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#ff0000', '#0000ff', 0.5)).toBe('#800080');
  });
});
