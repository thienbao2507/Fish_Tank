// Công cụ vẽ pixel art bằng code và ghi PNG. Chỉ dùng thư viện có sẵn của Node (không dependency).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Ngưỡng dither Bayer 4×4 (0–1) tại (x, y). */
export function bayer(x, y) {
  const bx = ((Math.floor(x) % 4) + 4) % 4;
  const by = ((Math.floor(y) % 4) + 4) % 4;
  return (BAYER4[by][bx] + 0.5) / 16;
}

/** mulberry32 — cùng thuật toán với src/core/rng.ts để ảnh sinh ra ổn định giữa các lần chạy. */
export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

export function hexToRgb(color) {
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return (
    '#' +
    ca
      .map((v, i) =>
        Math.round(v + (cb[i] - v) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Chọn màu trong dải `stops` theo t (0–1); ranh giới giữa hai màu được dither. */
export function ramp(stops, t, x, y) {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return scaled - i > bayer(x, y) ? stops[i + 1] : stops[i];
}

export class Pixels {
  constructor(width, height, { wrapX = false } = {}) {
    this.width = width;
    this.height = height;
    this.wrapX = wrapX;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  index(x, y) {
    let px = Math.floor(x);
    const py = Math.floor(y);
    if (this.wrapX) px = ((px % this.width) + this.width) % this.width;
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return -1;
    return (py * this.width + px) * 4;
  }

  alphaAt(x, y) {
    const i = this.index(x, y);
    return i < 0 ? 0 : this.data[i + 3];
  }

  /** Màu #rrggbb tại (x, y), hoặc null nếu trong suốt / ngoài ảnh. */
  colorAt(x, y) {
    const i = this.index(x, y);
    if (i < 0 || this.data[i + 3] === 0) return null;
    return (
      '#' +
      [this.data[i], this.data[i + 1], this.data[i + 2]]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  /** Vẽ một pixel; alpha < 1 thì phủ lên màu cũ (source-over). */
  set(x, y, color, alpha = 1) {
    const i = this.index(x, y);
    if (i < 0 || alpha <= 0) return;
    const [r, g, b] = hexToRgb(color);
    const d = this.data;
    if (alpha >= 1) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
      return;
    }
    const dstA = d[i + 3] / 255;
    const outA = alpha + dstA * (1 - alpha);
    d[i] = (r * alpha + d[i] * dstA * (1 - alpha)) / outA;
    d[i + 1] = (g * alpha + d[i + 1] * dstA * (1 - alpha)) / outA;
    d[i + 2] = (b * alpha + d[i + 2] * dstA * (1 - alpha)) / outA;
    d[i + 3] = outA * 255;
  }

  clear(x, y) {
    const i = this.index(x, y);
    if (i >= 0) this.data.fill(0, i, i + 4);
  }

  rect(x, y, w, h, color, alpha = 1) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color, alpha);
    }
  }

  clearRect(x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.clear(xx, yy);
    }
  }

  /** Elip đặc, xét theo tâm pixel → cạnh sắc, không khử răng cưa. */
  ellipse(cx, cy, rx, ry, color, alpha = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, color, alpha);
      }
    }
  }

  line(x0, y0, x1, y1, color, alpha = 1) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x, y, color, alpha);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Viền 1px quanh mọi pixel đặc (4 hướng), vẽ vào phần trong suốt. */
  outline(color) {
    const solid = (x, y) => this.alphaAt(x, y) >= 128;
    const targets = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          targets.push([x, y]);
        }
      }
    }
    for (const [x, y] of targets) this.set(x, y, color);
  }

  /** Đổi màu từng pixel đặc: fn(x, y, '#rrggbb') trả về màu mới hoặc undefined để giữ. */
  recolor(fn) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const color = this.colorAt(x, y);
        if (!color) continue;
        const next = fn(x, y, color);
        if (next && next !== color) {
          const i = this.index(x, y);
          const a = this.data[i + 3];
          const [r, g, b] = hexToRgb(next);
          this.data.set([r, g, b, a], i);
        }
      }
    }
  }

  /**
   * Làm mờ Gaussian (độ nét theo lớp kiểu HD-2D). Tách hai chiều, alpha nhân trước để mép trong suốt
   * không bị viền đen. Chiều ngang lặp vòng nếu ảnh `wrapX`; chiều dọc kẹp ở mép.
   */
  blur(sigma) {
    if (sigma <= 0) return this;
    const radius = Math.ceil(sigma * 2.5);
    const kernel = [];
    for (let i = -radius; i <= radius; i++) kernel.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
    const total = kernel.reduce((a, b) => a + b, 0);
    for (let i = 0; i < kernel.length; i++) kernel[i] /= total;

    const { width: w, height: h, data } = this;
    const src = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3] / 255;
      src[i * 4] = data[i * 4] * a;
      src[i * 4 + 1] = data[i * 4 + 1] * a;
      src[i * 4 + 2] = data[i * 4 + 2] * a;
      src[i * 4 + 3] = a;
    }
    const pass = (input, horizontal) => {
      const out = new Float32Array(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          for (let k = 0; k < kernel.length; k++) {
            let sx = x;
            let sy = y;
            if (horizontal) {
              sx = x + k - radius;
              if (this.wrapX) sx = ((sx % w) + w) % w;
              else if (sx < 0 || sx >= w) continue;
            } else {
              sy = Math.min(h - 1, Math.max(0, y + k - radius));
            }
            const s = (sy * w + sx) * 4;
            const weight = kernel[k];
            out[o] += input[s] * weight;
            out[o + 1] += input[s + 1] * weight;
            out[o + 2] += input[s + 2] * weight;
            out[o + 3] += input[s + 3] * weight;
          }
        }
      }
      return out;
    };
    const result = pass(pass(src, true), false);
    for (let i = 0; i < w * h; i++) {
      const a = result[i * 4 + 3];
      data[i * 4 + 3] = Math.round(a * 255);
      if (a > 0) {
        data[i * 4] = result[i * 4] / a;
        data[i * 4 + 1] = result[i * 4 + 1] / a;
        data[i * 4 + 2] = result[i * 4 + 2] / a;
      }
    }
    return this;
  }

  /** Dán ảnh khác vào (giữ alpha), phóng to nguyên lần `scale`. */
  draw(src, ox, oy, scale = 1) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = src.index(x, y);
        const a = src.data[i + 3] / 255;
        if (a === 0) continue;
        const color = src.colorAt(x, y);
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++)
            this.set(ox + x * scale + sx, oy + y * scale + sy, color, a);
        }
      }
    }
  }

  toPng() {
    const { width, height } = this;
    const stride = width * 4 + 1;
    const raw = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
      raw[y * stride] = 0;
      Buffer.from(this.data.buffer, y * width * 4, width * 4).copy(raw, y * stride + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', deflateSync(raw, { level: 9 })),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
  }

  save(file) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, this.toPng());
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
