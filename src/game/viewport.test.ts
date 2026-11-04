import { describe, expect, it } from 'vitest';
import { viewWidthFor } from './viewport';

describe('viewWidthFor', () => {
  it.each([
    ['16:9 (1920×1080)', 1920, 1080, 640],
    ['19.5:9 (2340×1080)', 2340, 1080, 780],
    ['20:9 (2400×1080)', 2400, 1080, 800],
    ['20:9 (1600×720)', 1600, 720, 800],
    ['21:9 (2520×1080)', 2520, 1080, 840],
  ])('màn hình %s', (_name, width, height, expected) => {
    expect(viewWidthFor(width, height)).toBe(expected);
  });

  it('màn hình dài hơn 21:9 bị chặn ở 840', () => {
    expect(viewWidthFor(3840, 1080)).toBe(840);
  });

  it('màn hình vuông hơn 16:9 (tablet, dọc) giữ 640', () => {
    expect(viewWidthFor(2048, 1536)).toBe(640);
    expect(viewWidthFor(1080, 2400)).toBe(640);
  });

  it('kích thước không hợp lệ trả về 640', () => {
    expect(viewWidthFor(0, 0)).toBe(640);
    expect(viewWidthFor(Number.NaN, 100)).toBe(640);
  });
});
