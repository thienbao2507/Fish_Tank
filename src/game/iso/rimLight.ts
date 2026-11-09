/** Hướng trỏ về nguồn sáng trên màn hình (y hướng xuống), độ dài 1. */
export interface LightDirection {
  readonly x: number;
  readonly y: number;
}

/** Nguồn sáng từ trên trái, cùng hướng với chùm tia nắng và bóng đổ. */
export const RIM_LIGHT: LightDirection = { x: -0.38, y: -0.92 };
/** Dùng cho ảnh sẽ bị lật ngang lúc vẽ: sau khi lật, viền lại đúng phía nguồn sáng. */
export const RIM_LIGHT_MIRRORED: LightDirection = { x: 0.38, y: -0.92 };

const ALPHA_SOLID = 128;
/** Cạnh phải quay về nguồn sáng ít nhất mức này mới có viền, nên không thành viền 360°. */
const MIN_FACING = 0.35;
const RIM_COLOR = [255, 242, 204] as const;
const RIM_STRENGTH = 0.85;
/** Ảnh từ chiều rộng này trở lên có viền dày 2px. */
const THICK_RIM_WIDTH = 100;
const INNER_RIM_FACTOR = 0.55;

/** Độ sáng viền của một ô ảnh (0–1 từng pixel), xét riêng trong khung bắt đầu ở cột `frameX`. */
export function computeRim(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  frameX: number,
  frameWidth: number,
  light: LightDirection,
): Float32Array {
  const rim = new Float32Array(width * height);
  const solid = (x: number, y: number): number =>
    x >= frameX &&
    x < frameX + frameWidth &&
    y >= 0 &&
    y < height &&
    (pixels[(y * width + x) * 4 + 3] as number) > ALPHA_SOLID
      ? 1
      : 0;

  for (let y = 0; y < height; y++) {
    for (let x = frameX; x < frameX + frameWidth; x++) {
      if (!solid(x, y)) continue;
      // Gradient của độ đặc trỏ vào trong vật, nên pháp tuyến ngoài là chiều ngược lại.
      const gx =
        solid(x + 1, y - 1) +
        2 * solid(x + 1, y) +
        solid(x + 1, y + 1) -
        solid(x - 1, y - 1) -
        2 * solid(x - 1, y) -
        solid(x - 1, y + 1);
      const gy =
        solid(x - 1, y + 1) +
        2 * solid(x, y + 1) +
        solid(x + 1, y + 1) -
        solid(x - 1, y - 1) -
        2 * solid(x, y - 1) -
        solid(x + 1, y - 1);
      const length = Math.hypot(gx, gy);
      if (length === 0) continue;

      const normalX = -gx / length;
      const normalY = -gy / length;
      const facing = normalX * light.x + normalY * light.y;
      if (facing <= MIN_FACING) continue;

      const intensity = (facing - MIN_FACING) / (1 - MIN_FACING);
      const index = y * width + x;
      rim[index] = Math.max(rim[index] as number, intensity);
      if (frameWidth >= THICK_RIM_WIDTH) {
        const innerX = x - Math.round(normalX);
        const innerY = y - Math.round(normalY);
        if (solid(innerX, innerY)) {
          const inner = innerY * width + innerX;
          rim[inner] = Math.max(rim[inner] as number, intensity * INNER_RIM_FACTOR);
        }
      }
    }
  }
  return rim;
}

/** Vẽ viền bắt sáng trực tiếp vào mảng RGBA; `frameWidth` để xử lý từng khung của sprite sheet. */
export function applyRim(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  light: LightDirection,
  frameWidth: number = width,
  strength: number = RIM_STRENGTH,
): void {
  for (let frameX = 0; frameX < width; frameX += frameWidth) {
    const rim = computeRim(pixels, width, height, frameX, frameWidth, light);
    for (let i = 0; i < rim.length; i++) {
      const amount = (rim[i] as number) * strength;
      if (amount <= 0) continue;
      for (let channel = 0; channel < 3; channel++) {
        const p = i * 4 + channel;
        const value = pixels[p] as number;
        pixels[p] = value + ((RIM_COLOR[channel] as number) - value) * amount;
      }
    }
  }
}
