import { describe, expect, it } from 'vitest';
import { applyRim, computeRim, RIM_LIGHT, RIM_LIGHT_MIRRORED } from './rimLight';

const SIZE = 7;
const LIGHT_FROM_TOP = { x: 0, y: -1 };

/** Ảnh SIZE×SIZE, khối đặc màu xám nằm ở các ô từ 1 đến SIZE−2. */
function block(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      data.set([50, 50, 50, 255], (y * SIZE + x) * 4);
    }
  }
  return data;
}

const at = (rim: Float32Array, x: number, y: number): number => rim[y * SIZE + x] as number;

describe('computeRim', () => {
  it('chỉ cạnh quay về nguồn sáng mới có viền, không thành viền 360°', () => {
    const rim = computeRim(block(), SIZE, SIZE, 0, SIZE, LIGHT_FROM_TOP);
    expect(at(rim, 3, 1)).toBeCloseTo(1);
    expect(at(rim, 3, 5)).toBe(0); // cạnh dưới
    expect(at(rim, 1, 3)).toBe(0); // cạnh trái
    expect(at(rim, 5, 3)).toBe(0); // cạnh phải
    expect(at(rim, 3, 3)).toBe(0); // lòng vật
  });

  it('bỏ qua pixel trong suốt', () => {
    const rim = computeRim(block(), SIZE, SIZE, 0, SIZE, LIGHT_FROM_TOP);
    expect(at(rim, 3, 0)).toBe(0);
  });

  it('hai hướng gương nhau cho viền đối xứng', () => {
    const left = computeRim(block(), SIZE, SIZE, 0, SIZE, RIM_LIGHT);
    const right = computeRim(block(), SIZE, SIZE, 0, SIZE, RIM_LIGHT_MIRRORED);
    expect(at(left, 1, 1)).toBeGreaterThan(at(left, 5, 1));
    expect(at(right, 5, 1)).toBeCloseTo(at(left, 1, 1));
  });

  it('khung kế bên không che cạnh của khung đang xét', () => {
    // Hai khung rộng SIZE nằm sát nhau, cả hai đều đặc kín.
    const width = SIZE * 2;
    const data = new Uint8ClampedArray(width * SIZE * 4).fill(255);
    const rim = computeRim(data, width, SIZE, 0, SIZE, { x: 1, y: 0 });
    expect(rim[3 * width + (SIZE - 1)]).toBeCloseTo(1);
  });
});

describe('applyRim', () => {
  it('làm sáng cạnh đón sáng, giữ nguyên lòng vật và độ trong suốt', () => {
    const data = block();
    applyRim(data, SIZE, SIZE, LIGHT_FROM_TOP);
    const top = (1 * SIZE + 3) * 4;
    const centre = (3 * SIZE + 3) * 4;
    expect(data[top] as number).toBeGreaterThan(200);
    expect(data[top + 3]).toBe(255);
    expect(data[centre]).toBe(50);
    expect(data[3]).toBe(0);
  });
});
