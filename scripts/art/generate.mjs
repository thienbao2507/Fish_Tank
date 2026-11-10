// Sinh asset pixel art cho khu 1 theo hướng mỹ thuật spec 12.4 (HD-2D).
// Chạy: npm run art   (ghi PNG vào public/art/gen/; tham số thứ nhất, nếu có, là đường dẫn ảnh xem trước)
// Ảnh được vẽ hoàn toàn bằng code, có seed cố định → chạy lại cho ra đúng các file cũ.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pixels, bayer, createRng, mixHex, ramp } from './lib.mjs';
import { ROOM_ASSETS } from './room.mjs';
import { SHOP_ASSETS } from './shop.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'public/art/gen');
const ZONE = JSON.parse(readFileSync(path.join(ROOT, 'src/data/zones.json'), 'utf8')).zones[0];

/**
 * Vị trí các lớp nền trong thế giới (để tô màu khớp với nước phía sau) — phải khớp với hằng số
 * DISTANT_LIFT, RUINS_LIFT, ROCKS_SINK trong src/game/env/Background.ts.
 */
const LAYOUT = { distantLift: 0, ruinsLift: 0, rocksSink: 0 };

/** Màu nước theo độ sâu: gần mặt nước teal sáng, càng sâu càng ngả xanh dương–tím (spec 12.4). */
const WATER_STOPS = [
  '#9be0d2',
  '#66c4bb',
  '#3fa2a6',
  '#2c8299',
  '#26668c',
  '#234e7d',
  '#213d6c',
  '#1e2f5c',
  '#1a234b',
];
/** Màu tối nhất của cảnh (bóng tiền cảnh, phần khuất của lớp nền). */
const NAVY = '#080b26';

function waterAt(worldY) {
  const t = Math.min(1, Math.max(0, (worldY - ZONE.surfaceY) / (ZONE.floorY - ZONE.surfaceY)));
  const scaled = Math.pow(t, 0.85) * (WATER_STOPS.length - 1);
  const i = Math.min(WATER_STOPS.length - 2, Math.floor(scaled));
  return mixHex(WATER_STOPS[i], WATER_STOPS[i + 1], scaled - i);
}

// Bảng màu (spec 12.4): nước teal, nắng vàng ấm, rêu, đá xám ấm, cát, san hô hồng/tím, đồng gỉ.
const P = {
  w0: '#0a2a36',
  w1: '#0d3542',
  w2: '#114350',
  w3: '#16525e',
  w4: '#1c636c',
  w5: '#25757b',
  w6: '#338888',
  w7: '#469d99',
  w8: '#69b8ac',
  foam: '#b9e8d6',
  l0: '#fff6d2',
  l1: '#ffe39a',
  l2: '#f2c25e',
  f0: '#0f3c47',
  f1: '#0b313b',
  f2: '#1f5f66',
  fWin: '#4fb2ac',
  s0: '#2a2723',
  s1: '#3f3a34',
  s2: '#57514a',
  s3: '#746c62',
  s4: '#958b7e',
  g0: '#22391c',
  g1: '#335a26',
  g2: '#4c7f31',
  g3: '#72a840',
  g4: '#a5cf55',
  d0: '#6f5a3a',
  d1: '#957a4e',
  d2: '#b9996a',
  d3: '#d4b77f',
  d4: '#ead298',
  c0: '#6e2337',
  c1: '#a8394a',
  c2: '#d95c5c',
  c3: '#ff8f7f',
  p0: '#3f2453',
  p1: '#6c3f86',
  p2: '#9b63b4',
  p3: '#c48fd6',
  r0: '#3b2418',
  r1: '#6b3f24',
  r2: '#9c6232',
  r3: '#cc8a48',
  r4: '#f0b870',
  ink: '#15121c',
  white: '#f4f1e8',
};

const STONE = [P.s0, P.s1, P.s2, P.s3, P.s4];
const SAND = [P.d0, P.d1, P.d2, P.d3, P.d4];

/** Sáng / tối thêm `step` bậc trong một dải màu (giữ nguyên nếu màu không thuộc dải). */
function shade(scale, color, step) {
  const i = scale.indexOf(color);
  if (i < 0) return color;
  return scale[Math.max(0, Math.min(scale.length - 1, i + step))];
}

// ---------------------------------------------------------------- nước, mặt nước, không khí, thành bể

function water() {
  // Chuyển màu mượt (HD-2D); 8 rộng để lặp ngang, cao đúng vùng nước của khu.
  const img = new Pixels(8, ZONE.floorY - ZONE.surfaceY);
  for (let y = 0; y < img.height; y++) img.rect(0, y, img.width, 1, waterAt(ZONE.surfaceY + y));
  return img;
}

function surface() {
  const W = 64;
  const H = 7;
  const img = new Pixels(W, H, { wrapX: true });
  for (let x = 0; x < W; x++) {
    const u = (x / W) * Math.PI * 2;
    const crest = Math.round(1.2 + Math.sin(u * 2) * 0.9 + Math.sin(u * 3 + 1) * 0.5);
    img.set(x, crest, P.l0);
    img.set(x, crest + 1, P.foam);
    for (let y = crest + 2; y < H; y++) {
      const a = 1 - (y - crest - 1) / (H - crest - 1);
      if (a > bayer(x, y)) img.set(x, y, P.w8);
    }
    if (x % 11 === 3 && crest > 0) img.set(x, crest - 1, P.l1);
  }
  return img;
}

function air() {
  const img = new Pixels(8, 8);
  img.rect(0, 0, 8, 8, '#08161d');
  return img;
}

function wall() {
  const img = new Pixels(6, 8);
  const cols = ['#0b1a20', '#1d3a40', '#6fb8b0', '#2b5a5c', '#16303a', '#0b1a20'];
  cols.forEach((c, x) => img.rect(x, 0, 1, 8, c));
  img.rect(2, 3, 1, 1, '#c8f0e6');
  return img;
}

/** Phòng tối ngoài bể: kệ, đèn bàn ấm và cửa sổ, làm mờ nặng để không tranh gameplay. */
function room() {
  const W = 256;
  const H = 120;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(201);
  img.rect(0, 0, W, H, P.ink);
  img.rect(0, 74, W, 46, '#0b1021');

  // Cửa sổ đêm và ánh hắt xanh lạnh.
  img.rect(18, 12, 66, 48, '#080b18');
  img.rect(22, 16, 58, 40, '#18334b');
  img.rect(49, 16, 4, 40, P.ink);
  img.rect(22, 34, 58, 3, P.ink);
  for (let i = 0; i < 12; i++) {
    img.set(rng.int(25, 77), rng.int(18, 53), P.foam, rng.range(0.2, 0.55));
  }

  // Kệ và vài khối đồ không sắc nét sau blur.
  img.rect(112, 22, 112, 5, P.r0);
  img.rect(112, 61, 112, 5, P.r0);
  img.rect(116, 27, 5, 69, P.r1);
  img.rect(215, 27, 5, 69, P.r1);
  for (let i = 0; i < 10; i++) {
    const x = rng.int(124, 207);
    const y = rng.chance(0.5) ? 31 : 68;
    img.rect(x, y, rng.int(7, 18), rng.int(12, 25), rng.pick([P.s0, P.r0, P.p0, P.f1]));
  }

  // Đèn bàn vàng ấm, có quầng sáng mờ.
  img.ellipse(99, 74, 28, 26, P.l2, 0.1);
  img.line(99, 52, 99, 84, P.r2);
  img.rect(88, 47, 23, 6, P.l2);
  img.rect(92, 42, 15, 6, P.l1);
  img.rect(92, 84, 16, 4, P.r1);
  return img.blur(3);
}

/** Tile kính sau ám màu nước, có vệt rêu mờ. */
function backGlass() {
  const W = 128;
  const H = 128;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(202);
  img.rect(0, 0, W, H, P.w3, 0.2);
  for (let i = 0; i < 14; i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(4, H - 8);
    const length = rng.int(8, 28);
    img.line(x, y, x + rng.int(-5, 6), y + length, P.g2, rng.range(0.08, 0.2));
  }
  for (let x = 0; x < W; x++) {
    if (bayer(x, H - 4) < 0.38) img.set(x, H - 4 + (x % 3), P.g1, 0.22);
  }
  return img.blur(1.2);
}

/** Vệt phản chiếu chéo trên kính trước. */
function glassStreak() {
  const img = new Pixels(96, 120);
  for (let offset = 0; offset < 3; offset++) {
    img.line(8 + offset, 112, 62 + offset, 4, P.foam, 0.12 - offset * 0.025);
  }
  img.line(38, 118, 91, 14, P.white, 0.07);
  return img.blur(0.7);
}

/** Bọt nhỏ 3–5px bám trên kính. */
function glassBubble() {
  const img = new Pixels(7, 7);
  img.ellipse(3.5, 3.5, 2.5, 2.5, P.foam, 0.24);
  img.ellipse(3.5, 3.5, 1.4, 1.4, P.w2, 0.28);
  img.set(2, 1, P.white, 0.5);
  img.set(1, 2, P.foam, 0.34);
  return img;
}

/** Mảng rêu bán trong suốt dùng ở hai góc kính trước. */
function glassMoss() {
  const W = 48;
  const H = 40;
  const img = new Pixels(W, H);
  const rng = createRng(203);
  for (let y = 8; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = 1 - x / W;
      const bottom = y / H;
      const density = edge * bottom * 0.75;
      if (rng.next() < density && bayer(x, y) < density) {
        img.set(x, y, rng.chance(0.35) ? P.g2 : P.g1, rng.range(0.18, 0.42));
      }
    }
  }
  return img.blur(0.8);
}

/** Viền nhựa tối của khung trên, lặp ngang. */
function frameTop() {
  const img = new Pixels(64, 12, { wrapX: true });
  img.rect(0, 0, 64, 3, '#050713');
  img.rect(0, 3, 64, 5, P.ink);
  img.rect(0, 8, 64, 2, '#26364b');
  img.rect(0, 10, 64, 2, '#0b1021');
  for (let x = 7; x < 64; x += 16) img.rect(x, 4, 5, 1, P.s1, 0.55);
  return img;
}

/** Elip bóng đổ nhỏ, dither ở mép. */
function shadow() {
  const W = 18;
  const H = 7;
  const img = new Pixels(W, H);
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = ((x + 0.5 - cx) / 8.5) ** 2 + ((y + 0.5 - cy) / 3) ** 2;
      if (d <= 0.62) img.set(x, y, P.ink, 0.72);
      else if (d <= 1 && bayer(x, y) > (d - 0.62) / 0.38) img.set(x, y, P.ink, 0.42);
    }
  }
  return img;
}

// ---------------------------------------------------------------- cát đáy

function sand() {
  const W = 64;
  const H = 40;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(11);
  const stops = [P.d2, P.d2, P.d1, P.d1, P.d0, P.d0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = y === 0 ? P.d3 : ramp(stops, (y - 1) / (H - 2), x, y);
      if (y > 1 && rng.chance(0.08)) c = shade(SAND, c, rng.chance(0.5) ? 1 : -1);
      img.set(x, y, c);
    }
  }
  // Gợn cát: vệt sáng phía trên, vệt tối phía dưới.
  for (const row of [9, 19, 30]) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * Math.PI * 2;
      if (Math.sin(u * 3 + row * 2) < -0.35) continue;
      const yy = row + Math.round(Math.sin(u * 2 + row) * 1.3);
      img.set(x, yy, shade(SAND, img.colorAt(x, yy), 1));
      img.set(x, yy + 1, shade(SAND, img.colorAt(x, yy + 1), -1));
    }
  }
  // Sỏi nhỏ.
  for (let i = 0; i < 4; i++) {
    const px = rng.int(0, W - 1);
    const py = rng.int(6, 34);
    const big = rng.chance(0.5);
    img.rect(px + 1, py + (big ? 2 : 1), big ? 3 : 2, 1, P.d0);
    img.rect(px, py, big ? 3 : 2, big ? 2 : 1, P.s2);
    img.set(px, py, P.s4);
    if (big) img.set(px + 2, py + 1, P.s1);
  }
  // Vỏ sò.
  for (let i = 0; i < 2; i++) {
    const px = rng.int(0, W - 1);
    const py = rng.int(10, 32);
    img.rect(px, py, 3, 1, P.c3);
    img.set(px + 1, py - 1, P.white);
    img.rect(px, py + 1, 3, 1, P.d0);
  }
  // Rêu lốm đốm ở mép trên.
  for (let x = 0; x < W; x++) {
    if (rng.chance(0.08)) img.set(x, 0, P.g3);
  }
  // Đáy bể nằm sâu: ánh sáng ngả xanh dương–tím.
  img.recolor((x, y, c) => mixHex(c, '#2b3266', 0.3));
  return img;
}

// ---------------------------------------------------------------- lớp xa: tàn tích

function ruins() {
  const W = 512;
  const H = 190;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(21);
  const base = P.f0;

  // Cầu vòm (aqueduct), gãy một đoạn.
  const deckY = 70;
  img.rect(10, deckY, 232, 10, base);
  for (let x = 10; x < 240; x += 12) img.rect(x, deckY - 3, 8, 3, base);
  for (let i = 0; i < 7; i++) {
    const px = 14 + i * 34;
    img.rect(px, deckY + 10, 10, H - deckY - 10, base);
    img.rect(px + 8, deckY + 10, 2, H - deckY - 10, P.f1);
    for (let y = deckY + 18; y < H; y += 9) img.rect(px, y, 8, 1, P.f1);
  }
  img.rect(10, deckY + 6, 232, 1, P.f1);
  for (let i = 0; i < 6; i++) {
    const ox = 24 + i * 34;
    const cx = ox + 12;
    const cy = deckY + 22;
    for (let y = deckY + 10; y < cy; y++) {
      for (let x = ox; x < ox + 24; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > 144) img.set(x, y, base);
      }
    }
  }
  img.clearRect(146, deckY - 4, 32, 44);
  for (let y = deckY - 4; y < deckY + 44; y++) {
    if (rng.chance(0.6)) img.clear(145, y);
    if (rng.chance(0.6)) img.clear(178, y);
  }

  // Đền mái vòm, cửa sổ phát sáng mờ.
  img.rect(268, 180, 104, 10, base);
  img.rect(272, 174, 96, 6, base);
  img.rect(278, 100, 84, 74, base);
  img.rect(286, 86, 68, 14, base);
  for (let y = 40; y < 86; y++) {
    for (let x = 284; x < 356; x++) {
      const dx = (x + 0.5 - 320) / 34;
      const dy = (y + 0.5 - 86) / 34;
      if (dx * dx + dy * dy <= 1) img.set(x, y, base);
    }
  }
  img.rect(316, 46, 8, 8, base);
  img.rect(319, 38, 2, 8, base);
  // Khối mái vòm: nửa phải tối dần (dither), đai và cửa sổ nhỏ ở cổ vòm.
  for (let y = 40; y < 100; y++) {
    for (let x = 320; x < 362; x++) {
      if (img.colorAt(x, y) === base && (x - 322) / 34 > bayer(x, y)) img.set(x, y, P.f1);
    }
  }
  img.rect(286, 86, 68, 1, P.f2);
  for (let x = 292; x < 350; x += 10) img.rect(x, 90, 3, 6, P.f1);
  // Cửa sổ vòm: lòng tối, ánh sáng mờ dâng từ dưới lên, có song cửa.
  for (const wx of [292, 314, 336]) {
    for (let y = 116; y < 152; y++) {
      for (let x = wx; x < wx + 12; x++) {
        const dx = x + 0.5 - (wx + 6);
        const dy = y + 0.5 - 122;
        if (y < 122 && dx * dx + dy * dy > 36) continue;
        const lit = (y - 116) / 36;
        img.set(x, y, lit * 0.9 > bayer(x, y) ? P.fWin : P.f1);
      }
    }
    img.rect(wx + 5, 117, 2, 35, P.f1);
    img.rect(wx, 134, 12, 1, P.f1);
  }
  for (const cx of [281, 359]) img.rect(cx - 2, 104, 4, 70, P.f1);

  // Cột gãy.
  const column = (cx, top, broken) => {
    img.rect(cx - 4, top, 8, H - top, base);
    if (!broken) img.rect(cx - 6, top - 4, 12, 4, base);
    else
      for (let x = cx - 4; x < cx + 4; x++)
        for (let k = 0; k < rng.int(0, 4); k++) img.clear(x, top + k);
    img.rect(cx - 2, top + 2, 1, H - top - 2, P.f1);
    img.rect(cx + 1, top + 2, 1, H - top - 2, P.f1);
  };
  column(404, 120, false);
  column(430, 88, false);
  column(458, 138, true);
  column(486, 104, true);
  img.rect(440, 176, 20, 6, base); // khối đá đổ

  // Tảo bẹ xa, tối hơn tàn tích.
  for (const kx of [120, 252, 388, 500]) {
    const top = rng.int(20, 70);
    const phase = rng.range(0, 6);
    for (let y = H - 1; y >= top; y--) {
      const off = Math.round(Math.sin((H - y) * 0.07 + phase) * 3);
      img.rect(kx + off, y, 2, 1, P.f1);
      if ((H - y) % 9 === 0) {
        const side = ((H - y) / 9) % 2 === 0 ? 1 : -1;
        img.line(kx + off, y, kx + off + side * 4, y - 2, P.f1);
      }
    }
  }

  // Viền sáng phía trên (ánh sáng từ mặt nước).
  const rim = [];
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (img.colorAt(x, y) !== base) continue;
      if (img.alphaAt(x, y - 1) === 0) rim.push([x, y, P.f2]);
      else if (img.alphaAt(x - 1, y) === 0 && bayer(x, y) < 0.5) rim.push([x, y, P.f2]);
    }
  }
  for (const [x, y, c] of rim) img.set(x, y, c);

  // Chân tan vào nước (dither, sau đó làm mờ thành dải mượt).
  for (let y = H - 44; y < H; y++) {
    const t = (y - (H - 44)) / 44;
    for (let x = 0; x < W; x++) if (t > bayer(x, y)) img.clear(x, y);
  }
  // Phối cảnh không khí: tô theo màu nước phía sau, phần khuất ngả về navy; cửa sổ phát sáng.
  const top = ZONE.floorY - H - LAYOUT.ruinsLift;
  img.recolor((x, y, c) => {
    const behind = waterAt(top + y);
    if (c === P.fWin) return '#8ff5ec';
    if (c === P.f2) return mixHex(behind, '#d8fdff', 0.22);
    if (c === P.f1) return mixHex(behind, NAVY, 0.55);
    return mixHex(behind, NAVY, 0.4);
  });
  return img.blur(1.3);
}

// ---------------------------------------------------------------- lớp giữa: đá rêu

/** Một phiến đá có mặt trên phủ rêu. */
function slab(img, x, y, w, h, rng) {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (yy === 0 && (xx === 0 || xx === w - 1)) continue;
      let c = P.s2;
      if (yy <= 1 || xx <= 1) c = P.s3;
      else if (xx >= w - 2 || yy >= h - 2) c = P.s1;
      if (rng.chance(0.09)) c = shade(STONE, c, rng.chance(0.5) ? 1 : -1);
      img.set(x + xx, y + yy, c);
    }
  }
  // Mạch đá.
  for (let s = rng.int(1, 3); s > 0; s--) {
    const sx = x + rng.int(4, Math.max(5, w - 5));
    img.rect(sx, y + 3, 1, h - 3, P.s1);
    img.rect(sx + 1, y + 3, 1, h - 3, P.s3);
  }
  if (h > 16) {
    const sy = y + Math.floor(h / 2);
    for (let xx = 2; xx < w - 2; xx++) if (rng.chance(0.85)) img.set(x + xx, sy, P.s1);
  }
  // Rêu.
  for (let xx = 0; xx < w; xx++) {
    if (!rng.chance(0.88)) continue;
    img.set(x + xx, y, P.g3);
    img.set(x + xx, y + 1, P.g2);
    if (rng.chance(0.35)) img.set(x + xx, y - 1, rng.chance(0.4) ? P.g4 : P.g3);
    if (rng.chance(0.16)) {
      const len = rng.int(1, 6);
      for (let d = 0; d < len; d++) img.set(x + xx, y + 2 + d, d < len - 1 ? P.g2 : P.g1);
    }
  }
  // Cỏ mọc trên mặt đá.
  for (let n = rng.int(0, 2); n > 0; n--) {
    const gx = x + rng.int(2, w - 3);
    for (let b = -1; b <= 1; b++)
      img.line(gx + b, y - 1, gx + b * 2, y - rng.int(3, 5), b === 0 ? P.g4 : P.g3);
  }
}

/** Tam giác đặc (xét theo tâm pixel). a, b, c là [x, y]. */
function tri(img, a, b, c, color) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const total = cross(a, b, c);
  const xs = [a[0], b[0], c[0]];
  const ys = [a[1], b[1], c[1]];
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const p = [x + 0.5, y + 0.5];
      const w = [cross(b, c, p), cross(c, a, p), cross(a, b, p)];
      if (w.every((v) => (total > 0 ? v >= 0 : v <= 0))) img.set(x, y, color);
    }
  }
}

/** Tảng đá tròn đáy phẳng, sáng từ trên-trái, đỉnh phủ rêu. */
function boulder(img, cx, bottom, rx, ry, rng) {
  const capLine = -0.8 + rng.range(-0.06, 0.06);
  for (let y = Math.floor(bottom - ry); y < bottom; y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - bottom) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const light = -0.55 * nx - 0.85 * ny;
      let c = ramp([P.s1, P.s2, P.s3, P.s4], (light + 0.35) / 1.35, x, y);
      if (ny < capLine) c = ny < capLine - 0.1 ? P.g3 : P.g2;
      else if (rng.chance(0.06)) c = shade(STONE, c, -1);
      img.set(x, y, c);
    }
  }
  for (let x = Math.floor(cx - rx * 0.6); x < cx + rx * 0.6; x++) {
    if (!rng.chance(0.18)) continue;
    const nx = (x + 0.5 - cx) / rx;
    if (-Math.sqrt(Math.max(0, 1 - nx * nx)) >= capLine) continue;
    const top = Math.round(bottom + capLine * ry);
    const len = rng.int(1, 5);
    for (let d = 0; d < len; d++) img.set(x, top + d, d < len - 1 ? P.g2 : P.g1);
  }
}

/** Nhánh san hô đệ quy. cols = [tối, giữa, sáng, đầu nhánh]. a = 0 là thẳng đứng. */
function branch(img, x, y, a, len, wide, depth, rng, cols) {
  let cx = x;
  let cy = y;
  let angle = a;
  const steps = Math.max(2, Math.round(len));
  for (let i = 0; i < steps; i++) {
    cx += Math.sin(angle);
    cy -= Math.cos(angle);
    angle += rng.range(-0.12, 0.12);
    img.set(cx, cy, i > steps - 3 ? cols[2] : cols[1]);
    if (wide) img.set(cx + 1, cy, cols[0]);
  }
  if (depth > 0) {
    const n = rng.int(2, 3);
    for (let k = 0; k < n; k++) {
      const spread = (k - (n - 1) / 2) * rng.range(0.5, 0.8);
      branch(img, cx, cy, angle + spread, len * rng.range(0.55, 0.8), false, depth - 1, rng, cols);
    }
  } else {
    img.set(cx, cy - 1, cols[3]);
  }
}

function kelpStalk(img, x, bottom, top, phase, stem, leaf, tip) {
  for (let y = bottom; y >= top; y--) {
    const k = bottom - y;
    const off = Math.round(Math.sin(k * 0.09 + phase) * 2);
    img.set(x + off, y, stem);
    if (k % 6 === 3 && y > top + 2) {
      const side = Math.floor(k / 6) % 2 === 0 ? 1 : -1;
      img.set(x + off + side, y, leaf);
      img.set(x + off + side * 2, y - 1, leaf);
      img.set(x + off + side * 3, y - 1, leaf);
      img.set(x + off + side * 4, y - 2, tip);
      img.set(x + off + side * 2, y, leaf);
    }
  }
  img.set(x + Math.round(Math.sin((bottom - top) * 0.09 + phase) * 2), top - 1, tip);
}

function rocks() {
  const W = 640;
  const H = 150;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(31);

  for (const kx of [95, 205, 300, 470, 575]) {
    kelpStalk(img, kx, H - 1, rng.int(10, 50), rng.range(0, 6), P.g1, P.g2, P.g3);
  }
  for (const cx of [70, 390, 610]) {
    branch(img, cx, H - 20, 0, rng.int(10, 14), true, 2, rng, [P.c0, P.c1, P.c2, P.c3]);
  }

  const groups = [30, 150, 250, 350, 450, 540];
  for (const [index, gx] of groups.entries()) {
    if (index % 2 === 1) {
      // Cụm đá tròn tự nhiên xen giữa các khối đá xây để bớt lặp.
      for (let b = rng.int(2, 3); b > 0; b--) {
        boulder(img, gx + rng.int(0, 60), H, rng.int(14, 28), rng.int(16, 38), rng);
      }
      continue;
    }
    let w = rng.int(64, 96);
    let x = gx + rng.int(-10, 10);
    let y = H;
    const layers = rng.int(2, 4);
    for (let i = 0; i < layers; i++) {
      const h = i === 0 ? rng.int(20, 30) : rng.int(12, 22);
      y -= h;
      slab(img, x, y, w, h, rng);
      const nw = Math.round(w * rng.range(0.55, 0.8));
      x += rng.int(0, w - nw);
      w = nw;
      if (w < 18) break;
    }
  }
  for (let i = 0; i < 4; i++) {
    branch(img, rng.int(0, W), H - rng.int(2, 10), rng.range(-0.3, 0.3), 6, false, 2, rng, [
      P.p0,
      P.p1,
      P.p2,
      P.p3,
    ]);
  }

  // Phủ sương: lớp giữa dịu và tối hơn lớp chơi (spec 12.4 › Độ đọc gameplay).
  const top = ZONE.floorY - H + LAYOUT.rocksSink;
  img.recolor((x, y, c) => mixHex(mixHex(c, waterAt(top + y), 0.45), NAVY, 0.12));
  return img.blur(0.7);
}

// ---------------------------------------------------------------- lớp rất xa: rừng tảo bẹ, tháp

/** Bóng rất xa: chỉ tối hơn nước phía sau một chút và mờ nhiều nhất. */
function distant() {
  const W = 512;
  const H = 320;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(91);
  const c = '#0b2f3a';
  const tower = (cx, top, w) => {
    img.rect(cx - w / 2, top, w, H - top, c);
    img.rect(cx - w / 2 - 3, top - 6, w + 6, 6, c);
    for (let k = 0; k < w / 2 + 3; k++)
      img.rect(cx - w / 2 - 3 + k, top - 7 - k, w + 6 - 2 * k, 1, c);
    for (let y = top + 10; y < H - 20; y += 22) img.clearRect(cx - 2, y, 4, 7);
  };
  tower(150, 70, 16);
  tower(392, 110, 22);
  img.rect(250, 200, 70, H - 200, c);
  for (let x = 254; x < 316; x += 16) img.clearRect(x, 214, 8, 30);
  for (let i = 0; i < 9; i++) {
    const kx = rng.int(0, W - 1);
    const top = rng.int(8, 130);
    const phase = rng.range(0, 6);
    const thick = rng.chance(0.5) ? 3 : 2;
    for (let y = H - 1; y >= top; y--) {
      const k = H - y;
      const off = Math.round(Math.sin(k * 0.035 + phase) * 6);
      img.rect(kx + off, y, thick, 1, c);
      if (k % 14 === 0) {
        const side = (k / 14) % 2 === 0 ? 1 : -1;
        for (let j = 1; j <= 7; j++) img.rect(kx + off + side * j, y - Math.floor(j / 2), 2, 1, c);
      }
    }
  }
  for (let y = H - 70; y < H; y++) {
    const t = (y - (H - 70)) / 70;
    for (let x = 0; x < W; x++) if (t > bayer(x, y)) img.clear(x, y);
  }
  const top = ZONE.floorY - H - LAYOUT.distantLift;
  img.recolor((x, y) => mixHex(waterAt(top + y), NAVY, 0.24));
  return img.blur(2.2);
}

/** Đàn cá nhỏ ở hậu cảnh (bóng tối, quay phải). */
function school() {
  const img = new Pixels(46, 18);
  const rng = createRng(101);
  const c = '#0b2f3a';
  for (let i = 0; i < 12; i++) {
    const x = rng.int(0, 39);
    const y = rng.int(1, 15);
    img.rect(x + 2, y, 3, 2, c);
    img.set(x + 5, y, c);
    img.rect(x + 1, y, 1, 2, c);
    img.set(x, y - 1, c);
    img.set(x, y + 2, c);
  }
  return img;
}

/** Dải sáng ngay dưới mặt nước. */
function surfaceGlow() {
  const W = 32;
  const H = 40;
  const img = new Pixels(W, H);
  for (let y = 0; y < H; y++) {
    const q = Math.pow(1 - y / H, 1.8) * 4;
    for (let x = 0; x < W; x++) {
      let level = Math.floor(q);
      if (q - level > bayer(x, y)) level++;
      if (level > 0) img.set(x, y, mixHex(P.foam, P.l1, 0.45), (level / 4) * 0.45);
    }
  }
  return img;
}

/** Luồng sáng đèn pha của tàu ngầm: gốc ở mép trái giữa ảnh, loe ra bên phải. */
function headlight() {
  const W = 80;
  const H = 44;
  const img = new Pixels(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = x / W;
      const half = 3 + t * (H / 2 - 3);
      const d = Math.abs(y + 0.5 - H / 2) / half;
      if (d >= 1) continue;
      const q = Math.pow(1 - t, 1.3) * (1 - d * d) * 4;
      let level = Math.floor(q);
      if (q - level > bayer(x, y)) level++;
      if (level > 0) img.set(x, y, level >= 3 ? P.l0 : P.l1, Math.min(1, level / 4) * 0.7);
    }
  }
  return img;
}

/** Tối nhẹ ở viền màn hình (phía dưới đậm hơn phía trên vì nắng chiếu từ trên xuống). */
function vignette() {
  const W = 640;
  const H = 360;
  const img = new Pixels(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - W / 2) / (W / 2);
      const ny = (y + 0.5 - H / 2) / (H / 2);
      const r = Math.hypot(nx, ny * (ny > 0 ? 1.1 : 0.8));
      const s = Math.min(1, Math.max(0, (r - 0.62) / 0.6));
      const q = s * s * 4;
      let level = Math.floor(q);
      if (q - level > bayer(x, y)) level++;
      if (level > 0) img.set(x, y, '#060a26', (level / 4) * 0.6);
    }
  }
  return img;
}

// ---------------------------------------------------------------- ánh sáng, bong bóng, hạt

function sunray() {
  const W = 48;
  const H = 472;
  const img = new Pixels(W, H);
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const cx = 10 + t * 26;
    const hw = 3 + t * 9;
    const strength = Math.pow(1 - t, 1.1);
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x + 0.5 - cx) / hw;
      if (d >= 1) continue;
      const q = strength * (1 - d * d) * 4;
      let level = Math.floor(q);
      if (q - level > bayer(x, y)) level++;
      if (level > 0) img.set(x, y, level >= 3 ? P.l0 : P.l1, Math.min(1, level / 4));
    }
  }
  return img;
}

function caustics(seed) {
  const W = 64;
  const H = 14;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(seed);
  const points = Array.from({ length: 10 }, () => [rng.range(0, W), rng.range(-3, H + 3)]);
  for (let y = 0; y < H; y++) {
    const fade = 1 - (y / H) * 0.75;
    for (let x = 0; x < W; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      for (const [px, py] of points) {
        for (const ox of [-W, 0, W]) {
          const dx = x + 0.5 - (px + ox);
          const dy = (y + 0.5 - py) * 1.8;
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      const edge = d2 - d1;
      if (edge < 1) img.set(x, y, P.l0, 0.9 * fade);
      else if (edge < 2.2 && bayer(x, y) < 0.5) img.set(x, y, P.l1, 0.5 * fade);
    }
  }
  return img;
}

function glow() {
  const S = 40;
  const img = new Pixels(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
      if (d >= 1) continue;
      const q = Math.pow(1 - d, 1.6) * 4;
      let level = Math.floor(q);
      if (q - level > bayer(x, y)) level++;
      if (level > 0) img.set(x, y, P.l1, Math.min(1, level / 4) * 0.8);
    }
  }
  return img;
}

function bubble() {
  const img = new Pixels(5, 5);
  const ring = [
    [1, 0],
    [2, 0],
    [3, 0],
    [0, 1],
    [4, 1],
    [0, 2],
    [4, 2],
    [0, 3],
    [4, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ];
  img.rect(1, 1, 3, 3, '#7fd8e8', 0.2);
  for (const [x, y] of ring) img.set(x, y, '#bff3ff', 0.85);
  img.set(1, 1, P.white);
  return img;
}

function speck() {
  const img = new Pixels(1, 1);
  img.set(0, 0, '#dfe8cf');
  return img;
}

// ---------------------------------------------------------------- cây cối lớp chơi (không viền, để vật tương tác nổi hơn)

function decoKelp() {
  const img = new Pixels(14, 64);
  kelpStalk(img, 6, 63, 4, 0.6, P.g2, P.g3, P.g4);
  kelpStalk(img, 8, 63, 22, 2.4, P.g1, P.g2, P.g3);
  return img;
}

function decoWeed() {
  // Kiểu rotala trong ảnh mẫu: thân mảnh, lá tròn mọc đối.
  const img = new Pixels(20, 28);
  const rng = createRng(41);
  for (const [sx, top, phase] of [
    [5, 7, 0.3],
    [10, 2, 1.7],
    [15, 10, 3.1],
    [8, 14, 4.2],
  ]) {
    let side = rng.chance(0.5) ? 1 : -1;
    for (let y = 27; y >= top; y--) {
      const k = 27 - y;
      const x = sx + Math.round(Math.sin(k * 0.15 + phase) * 1.4);
      img.set(x, y, P.g1);
      if (k % 3 === 1 && y < 25) {
        const nearTop = (y - top) / (27 - top);
        const len = nearTop < 0.2 ? 1 : rng.int(2, 3);
        const leaf = nearTop < 0.3 ? P.g4 : rng.chance(0.6) ? P.g3 : P.g2;
        for (let j = 1; j <= len; j++) img.set(x + side * j, y - (j === len ? 1 : 0), leaf);
        side = -side;
      }
    }
    img.set(sx + Math.round(Math.sin((27 - top) * 0.15 + phase) * 1.4), top - 1, P.g4);
  }
  return img;
}

function decoCoral() {
  const img = new Pixels(26, 22);
  const rng = createRng(51);
  const cols = [P.c0, P.c1, P.c2, P.c3];
  branch(img, 12, 21, -0.1, 7, true, 2, rng, cols);
  branch(img, 7, 21, -0.6, 5, false, 2, rng, cols);
  branch(img, 17, 21, 0.6, 5, false, 2, rng, cols);
  img.rect(8, 21, 10, 1, P.c0);
  return img;
}

function decoTube() {
  const img = new Pixels(16, 15);
  for (const [x, h] of [
    [1, 9],
    [5, 14],
    [10, 11],
  ]) {
    const top = 15 - h;
    img.rect(x, top, 4, h, P.p1);
    img.rect(x, top, 1, h, P.p2);
    img.rect(x + 3, top, 1, h, P.p0);
    img.rect(x, top, 4, 1, P.p3);
    img.rect(x + 1, top + 1, 2, 1, P.p0);
    img.set(x + 1, top + Math.floor(h / 2), P.p2);
  }
  return img;
}

function decoGrass() {
  const img = new Pixels(16, 10);
  const rng = createRng(61);
  for (let i = 0; i < 9; i++) {
    const x = 1 + i * 1.6;
    const lean = rng.range(-3, 3);
    const h = rng.int(5, 9);
    img.line(x, 9, x + lean, 9 - h, i % 3 === 0 ? P.g4 : i % 2 ? P.g3 : P.g2);
  }
  return img;
}

function decoStones() {
  const img = new Pixels(24, 11);
  const stone = (cx, cy, rx, ry) => {
    img.ellipse(cx, cy, rx, ry, P.s2);
    img.ellipse(cx - 1, cy - 1, rx - 1.5, ry - 1.5, P.s3);
    img.set(cx - rx / 2, cy - ry + 1, P.s4);
    for (let x = Math.floor(cx - rx + 1); x < cx + rx - 1; x++)
      if (x % 3 !== 0) img.set(x, Math.floor(cy - ry + 0.6), P.g3);
  };
  stone(7, 7, 6, 4);
  stone(16, 8, 5, 3);
  stone(21, 9, 3, 2);
  img.rect(2, 10, 21, 1, P.s1);
  return img;
}

// ---------------------------------------------------------------- trạm tái chế (xưởng ống đồng)

function station() {
  const img = new Pixels(48, 40);
  // Tường đá.
  for (let y = 10; y < 40; y++) {
    for (let x = 3; x < 45; x++) {
      let c = P.s2;
      if (y === 10 || x === 3) c = P.s3;
      else if (x === 44 || y === 39) c = P.s1;
      img.set(x, y, c);
    }
  }
  for (let row = 0; row < 5; row++) {
    const y = 15 + row * 6;
    img.rect(4, y, 40, 1, P.s1);
    for (let x = 4 + (row % 2) * 4; x < 44; x += 8) img.rect(x, y - 5, 1, 5, P.s1);
  }
  // Rêu trên mái.
  const rng = createRng(71);
  for (let x = 3; x < 45; x++) {
    img.set(x, 9, P.g3);
    img.set(x, 10, P.g2);
    if (rng.chance(0.3)) img.set(x, 8, P.g4);
    if (rng.chance(0.15)) img.rect(x, 11, 1, rng.int(1, 4), P.g2);
  }
  // Cửa vòm, bên trong ánh lửa xưởng.
  const inDoor = (x, y) => {
    if (x < 15 || x > 32 || y < 17) return false;
    if (y >= 26) return true;
    const dx = x + 0.5 - 24;
    const dy = y + 0.5 - 26;
    return dx * dx + dy * dy <= 81;
  };
  for (let y = 15; y < 40; y++) {
    for (let x = 13; x < 35; x++) {
      if (inDoor(x, y)) img.set(x, y, ramp([P.r0, P.r1, P.r2, P.r3], (y - 17) / 22, x, y));
      else if (inDoor(x - 1, y) || inDoor(x + 1, y) || inDoor(x, y + 1)) img.set(x, y, P.s4);
    }
  }
  img.rect(17, 33, 14, 2, P.r0); // bàn làm việc
  img.rect(18, 35, 1, 4, P.r0);
  img.rect(29, 35, 1, 4, P.r0);
  img.rect(20, 23, 1, 5, P.r0); // dụng cụ treo
  img.rect(23, 22, 1, 6, P.r0);
  img.rect(22, 22, 3, 1, P.r0);
  img.rect(26, 23, 1, 4, P.r0);
  img.rect(15, 38, 18, 2, P.r4, 0.6);
  // Ống đồng hình chữ U ngược cắm xuống mái.
  for (const lx of [25, 38]) {
    img.rect(lx, 2, 4, 9, P.r2);
    img.rect(lx, 2, 1, 9, P.r3);
    img.rect(lx + 3, 2, 1, 9, P.r1);
    img.rect(lx - 1, 7, 6, 2, P.r1);
    img.rect(lx - 1, 7, 6, 1, P.r4);
  }
  img.rect(25, 1, 17, 4, P.r2);
  img.rect(26, 1, 15, 1, P.r3);
  img.rect(26, 4, 12, 1, P.r1);
  img.set(25, 1, P.r1);
  img.set(41, 1, P.r1);
  img.rect(31, 1, 2, 4, P.r1);
  img.rect(31, 1, 2, 1, P.r4);
  // Đồng hồ áp suất.
  img.ellipse(9, 18, 4.2, 4.2, P.r1);
  img.ellipse(9, 18, 3.1, 3.1, '#e9e4d4');
  img.line(9, 18, 11, 16, P.c1);
  img.set(8, 17, P.white);
  // Van tay quay đỏ.
  img.rect(7, 29, 5, 1, P.c1);
  img.rect(9, 27, 1, 5, P.c1);
  img.rect(8, 28, 3, 3, P.c2);
  img.set(9, 29, P.ink);
  // Đèn lồng.
  img.rect(36, 16, 1, 2, P.r1);
  img.rect(35, 18, 3, 1, P.r1);
  img.rect(35, 19, 3, 3, P.l1);
  img.set(36, 20, P.l0);
  img.rect(35, 22, 3, 1, P.r1);
  img.outline(P.ink);
  return img;
}

// ---------------------------------------------------------------- cá (16–28px, viền tối 1px)

function fishGuppy() {
  const img = new Pixels(19, 13);
  // Đuôi quạt nhiều màu.
  for (let x = 1; x <= 6; x++) {
    const half = Math.round(1 + (6 - x) * 0.8);
    for (let y = 6 - half; y <= 6 + half; y++) {
      const c = x <= 2 ? P.l2 : (x + y) % 3 === 0 ? '#4fb7ff' : '#ff6b3d';
      img.set(x, y, c);
    }
  }
  img.ellipse(11.5, 6.5, 6, 3.6, '#ff8c2e');
  img.ellipse(12, 7.6, 4.5, 2, '#ffd08a');
  img.rect(8, 3, 6, 1, '#e0601c');
  img.rect(9, 2, 3, 1, '#ff6b3d');
  img.rect(14, 5, 2, 2, P.ink);
  img.set(14, 5, P.white);
  img.set(11, 9, '#ff6b3d');
  img.outline(P.ink);
  return img;
}

function fishNeon() {
  const img = new Pixels(17, 10);
  img.rect(1, 3, 3, 4, '#c8d0d8', 0.8);
  img.set(1, 2, '#c8d0d8', 0.8);
  img.set(1, 7, '#c8d0d8', 0.8);
  img.ellipse(9, 5, 6.5, 2.8, '#3b4a5a');
  img.ellipse(9.5, 6, 5.5, 1.6, '#d8dde6');
  for (let x = 3; x < 10; x++) img.rect(x, 5, 1, 2, '#ff3b4a');
  for (let x = 4; x < 15; x++) img.set(x, 4, '#3fe0ff');
  img.set(8, 3, '#9ff3ff');
  img.rect(12, 4, 2, 2, P.ink);
  img.set(12, 4, P.white);
  img.outline(P.ink);
  return img;
}

function fishAngel() {
  // Thân đĩa dẹt, vây lưng và vây bụng là hai tam giác vuốt dài về sau.
  const img = new Pixels(21, 26);
  const fin = '#e4e4da';
  tri(img, [8, 8], [15, 8], [3, 0], fin);
  tri(img, [8, 17], [15, 17], [3, 25], fin);
  tri(img, [7, 12.5], [2, 8], [2, 17], '#d6d6ca');
  img.ellipse(12, 12.5, 6.2, 6.6, '#f2f1e8');
  img.ellipse(13, 14.5, 4, 3, '#dcdcd0');
  // Sọc đen chạy suốt thân và vây.
  for (const [sx, wide] of [
    [7, true],
    [11, true],
    [15, false],
  ]) {
    for (let y = 0; y < img.height; y++) {
      if (img.alphaAt(sx, y) === 0) continue;
      img.set(sx, y, '#1d1d24');
      if (wide && img.alphaAt(sx + 1, y) > 0) img.set(sx + 1, y, '#1d1d24');
    }
  }
  img.rect(16, 8, 2, 2, '#ffe08a');
  img.rect(15, 10, 2, 2, P.ink);
  img.set(15, 10, P.white);
  img.line(13, 18, 11, 23, fin);
  img.outline(P.ink);
  return img;
}

// ---------------------------------------------------------------- rác, xu, ngọc, thức ăn (viền tối 1px)

function trashBottle() {
  const img = new Pixels(15, 8);
  img.rect(1, 2, 9, 4, '#3fa86a');
  img.rect(1, 5, 9, 1, '#23683f');
  img.rect(2, 2, 7, 1, '#9fe3b0');
  img.rect(10, 3, 2, 2, '#3fa86a');
  img.rect(12, 3, 2, 2, '#d94c4c');
  img.rect(4, 2, 3, 4, '#e8dcc0');
  img.rect(4, 5, 3, 1, '#b8a888');
  img.outline(P.ink);
  return img;
}

function trashBag() {
  const img = new Pixels(13, 14);
  img.rect(2, 4, 9, 8, '#e6ecef');
  img.rect(3, 12, 7, 1, '#e6ecef');
  img.rect(8, 4, 3, 8, '#b8c4cc');
  img.rect(5, 6, 1, 4, '#b8c4cc');
  img.rect(2, 1, 2, 3, '#e6ecef');
  img.rect(9, 1, 2, 3, '#e6ecef');
  img.clear(3, 2);
  img.clear(10, 2);
  img.rect(3, 5, 1, 2, P.white);
  img.outline(P.ink);
  return img;
}

function trashCan() {
  const img = new Pixels(8, 11);
  img.rect(1, 1, 6, 9, '#d63c3c');
  img.rect(1, 1, 6, 1, '#c8ccd2');
  img.rect(1, 9, 6, 1, '#9aa0a8');
  img.rect(2, 2, 1, 7, '#ff8a7a');
  img.rect(5, 2, 1, 7, '#9a2428');
  img.rect(3, 5, 2, 2, P.white);
  img.set(6, 4, '#9a2428');
  img.outline(P.ink);
  return img;
}

function trashTire() {
  const img = new Pixels(16, 16);
  img.ellipse(8, 8, 7, 7, '#26262b');
  img.ellipse(8, 8, 5.6, 5.6, '#3c3c44');
  img.ellipse(8, 8, 3.2, 3.2, '#5a5a64');
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - 8, y + 0.5 - 8) <= 2.3) img.clear(x, y);
  img.set(4, 4, '#8a8a96');
  img.set(5, 3, '#8a8a96');
  for (const [x, y] of [
    [8, 1],
    [14, 8],
    [8, 14],
    [1, 8],
    [3, 3],
    [12, 12],
  ])
    img.set(x, y, '#3c3c44');
  img.outline(P.ink);
  return img;
}

function dropCoin() {
  const img = new Pixels(8, 8);
  img.ellipse(4, 4, 3, 3, '#c98a1a');
  img.ellipse(3.6, 3.6, 2.3, 2.3, '#ffd23f');
  img.set(3, 2, '#fff3a0');
  img.set(2, 3, '#fff3a0');
  img.outline(P.ink);
  return img;
}

function dropPearl() {
  const img = new Pixels(8, 8);
  img.ellipse(4, 4, 3, 3, '#c9c2d8');
  img.ellipse(3.6, 3.6, 2.3, 2.3, '#f4f1f8');
  img.set(3, 2, P.white);
  img.set(2, 3, '#ffd6f0');
  img.outline(P.ink);
  return img;
}

function foodPellet() {
  const img = new Pixels(4, 4);
  img.rect(1, 1, 2, 2, '#c97a3a');
  img.set(1, 1, '#ffb066');
  img.outline(P.ink);
  return img;
}

// ---------------------------------------------------------------- tiền cảnh (HD-2D: tối, mờ, cuộn nhanh hơn camera)

const FG = { dark: '#05061a', mid: '#0c0e2c', rim: '#1c1f52' };
const GLOWS = ['#ff5fd2', '#6ff6ff', '#ffb35c', '#b48cff'];

/** Viền sáng 1px ở mép trên mọi phần đặc (ánh sáng từ trên xuống). */
function rimTop(img, color) {
  const rim = [];
  for (let y = 1; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.alphaAt(x, y) > 0 && img.alphaAt(x, y - 1) === 0) rim.push([x, y]);
    }
  }
  for (const [x, y] of rim) img.set(x, y, color);
}

/** Dải đá / san hô tối dưới đáy; chỉ cao tới mép cát để chừa vùng chơi. */
function fgFloor() {
  const W = 512;
  const H = 72;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(111);
  for (let x = 0; x < W; x++) {
    const u = (x / W) * Math.PI * 2;
    const ground = Math.round(16 + Math.sin(u * 3) * 3 + Math.sin(u * 7 + 1) * 2);
    img.rect(x, H - ground, 1, ground, FG.dark);
  }
  for (let i = 0; i < 7; i++) {
    img.ellipse(rng.int(0, W - 1), H, rng.int(14, 34), rng.int(18, 34), FG.dark);
  }
  for (let i = 0; i < 5; i++) {
    const x = rng.int(0, W - 1);
    const cols = [FG.dark, FG.mid, FG.mid, FG.rim];
    branch(img, x, H - rng.int(14, 22), rng.range(-0.3, 0.3), rng.int(9, 14), true, 3, rng, cols);
  }
  rimTop(img, FG.rim);
  img.blur(1.4);
  // Đốm phát quang sắc nét vẽ sau khi làm mờ, để bloom bắt sáng.
  for (let i = 0; i < 28; i++) {
    const x = rng.int(0, W - 1);
    let y = 0;
    while (y < H && img.alphaAt(x, y) < 170) y++;
    if (y >= H - 4) continue;
    const c = rng.pick(GLOWS);
    img.set(x, y + 1, c);
    img.set(x, y + 2, c, 0.6);
    if (rng.chance(0.4)) img.set(x + 1, y + 1, c);
  }
  return img;
}

/** Sợi tảo bẹ tối vươn cao ở tiền cảnh. */
function fgKelp() {
  const W = 30;
  const H = 240;
  const img = new Pixels(W, H);
  const cx = 14;
  for (let y = H - 1; y >= 6; y--) {
    const k = H - y;
    const x = cx + Math.round(Math.sin(k * 0.03 + 0.5) * 5);
    img.rect(x - 1, y, 3, 1, FG.mid);
    if (k % 13 === 6 && y > 14) {
      const side = Math.floor(k / 13) % 2 === 0 ? 1 : -1;
      for (let j = 1; j <= 10; j++) img.rect(x + side * j, y - Math.round(j * 0.45), 2, 1, FG.mid);
    }
  }
  rimTop(img, FG.rim);
  return img.blur(1.2);
}

// ---------------------------------------------------------------- sinh vật phát quang

function jelly() {
  const img = new Pixels(13, 19);
  for (let y = 0; y <= 7; y++) {
    for (let x = 0; x < 13; x++) {
      const dx = (x + 0.5 - 6.5) / 6.2;
      const dy = (y + 0.5 - 7.5) / 7;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      img.set(x, y, r > 0.72 ? '#ff6a2a' : r > 0.38 ? '#ff9a3c' : '#ffd36e');
    }
  }
  img.set(4, 2, '#fff6cf');
  img.set(5, 2, '#fff6cf');
  img.set(4, 3, '#fff6cf');
  for (let x = 1; x < 12; x += 2) img.set(x, 8, '#ff7a3a');
  for (const [tx, phase] of [
    [3, 0],
    [5, 1.3],
    [8, 2.1],
    [10, 0.7],
  ]) {
    for (let y = 9; y < 19; y++) {
      img.set(tx + Math.round(Math.sin(y * 0.6 + phase)), y, '#ffb26a', y < 15 ? 0.85 : 0.45);
    }
  }
  return img;
}

function glowCoral() {
  const img = new Pixels(24, 21);
  const rng = createRng(121);
  const cols = ['#5a1650', '#c2338f', '#ff6fcf', '#ffe3f7'];
  branch(img, 11, 20, 0, 6, true, 3, rng, cols);
  branch(img, 5, 20, -0.5, 4, false, 2, rng, cols);
  branch(img, 18, 20, 0.5, 4, false, 2, rng, cols);
  img.rect(7, 20, 10, 1, cols[0]);
  return img;
}

function anemone() {
  const img = new Pixels(17, 14);
  const rng = createRng(131);
  for (let i = 0; i < 9; i++) {
    const x0 = 3 + i * 1.3;
    const lean = rng.range(-2.5, 2.5);
    const h = rng.int(6, 10);
    img.line(x0, 11, x0 + lean, 11 - h, '#6b4fc4');
    img.set(x0 + lean, 11 - h, '#8ff8ff');
    img.set(x0 + lean, 12 - h, '#c8fbff', 0.8);
  }
  img.ellipse(8.5, 12.5, 6.5, 2.2, '#2d2160');
  img.rect(4, 11, 9, 1, '#4a3a96');
  return img;
}

/** "Đèn biển": cây nấm phát sáng cyan như trong ảnh mẫu. */
function seaLamp() {
  const img = new Pixels(15, 17);
  const cap = (cx, cy, rx, ry, stalk) => {
    img.rect(Math.round(cx) - 1, cy, 2, stalk, '#23405e');
    for (let y = Math.floor(cy - ry); y < cy; y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) img.set(x, y, dx * dx + dy * dy < 0.35 ? '#bff6ff' : '#3cc8f0');
      }
    }
    img.rect(Math.round(cx - rx + 1), cy, Math.round(rx * 2 - 1), 1, '#1f7aa0');
  };
  cap(9, 7, 6, 5.5, 10);
  cap(3, 12, 2.6, 2.4, 5);
  img.set(7, 3, '#e8feff');
  img.set(11, 5, '#e8feff');
  return img;
}

/** Quầng sáng mượt ở hậu cảnh (vùng nước "phát sáng" như ảnh mẫu). */
function haze() {
  const S = 128;
  const img = new Pixels(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
      if (d < 1) img.set(x, y, '#a8f4ff', Math.pow(1 - d, 2) * 0.8);
    }
  }
  return img;
}

function plankton() {
  const img = new Pixels(1, 1);
  img.set(0, 0, '#d6fdff');
  return img;
}

// ---------------------------------------------------------------- rặn san hô và tảo (spec 12.4, 3 ảnh mẫu 2026-11-06)

/** Nét dày `w` px dọc theo đoạn thẳng; mép trái dùng `lit`, phần còn lại `body`. */
function stroke(img, x0, y0, x1, y1, w, body, lit) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    for (let k = 0; k < w; k++) img.set(x + k - Math.floor(w / 2), y, k === 0 && lit ? lit : body);
  }
}

/** Tảo bẹ cao kiểu ảnh mẫu 1: thân tối cong, lá dài so le, mép trên của lá bắt nắng vàng-xanh, bọng tím. */
function kelpTall(seed) {
  const W = 40;
  const H = 128;
  const img = new Pixels(W, H);
  const rng = createRng(seed);
  const C = {
    stem: '#0b1b30',
    stemLit: '#173552',
    leaf: '#12323f',
    leafMid: '#1d4a4c',
    edge: '#6f9a34',
    tip: '#c9dc5c',
    bulb: '#4d50a8',
    bulbLit: '#7c80dc',
  };
  /** Một dải lá: thân lá cong, rộng ở giữa, mép phía trên bắt nắng, gần đầu lá sáng dần. */
  const blade = (bx, by, angle, len, maxW, bend) => {
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = angle + bend * u;
      // Tâm dải lá đi theo góc đang cong dần.
      const px = bx + Math.sin(angle) * len * u + Math.sin(a) * len * u * 0.15;
      const py = by - Math.cos(angle) * len * u - Math.cos(a) * len * u * 0.15;
      const hw = maxW * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 0.7);
      // Pháp tuyến hướng lên trên là mép bắt nắng.
      let nx = Math.cos(a);
      let ny = Math.sin(a);
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      for (let w = -hw; w <= hw + 0.01; w += 0.5) {
        const x = px + nx * w;
        const y = py + ny * w;
        const top = w > hw - 0.5 && u > 0.12;
        const c = top ? (u > 0.8 ? C.tip : C.edge) : u > 0.9 ? C.edge : w > 0 ? C.leafMid : C.leaf;
        img.set(x, y, c);
      }
    }
  };

  const stalk = (cx, topY, phase, scale) => {
    const stemX = (y) => cx + Math.sin((H - y) * 0.05 + phase) * 3;
    let side = rng.chance(0.5) ? 1 : -1;
    for (let y = H - 8; y > topY + 4; y -= rng.int(4, 6)) {
      const t = (H - y) / (H - topY); // 0 ở gốc, 1 ở ngọn
      const len = (1 - t * 0.45) * rng.range(13, 20) * scale;
      const angle = side * rng.range(0.55, 1.0) * (1 - t * 0.35);
      blade(stemX(y), y, angle, len, rng.range(1.6, 2.4) * scale, -side * rng.range(0.2, 0.6));
      if (rng.chance(0.3)) {
        const bx = Math.round(stemX(y) + side * 2);
        img.rect(bx, Math.round(y - 2), 2, 2, C.bulb);
        img.set(bx, Math.round(y - 2), C.bulbLit);
      }
      side = -side;
    }
    for (let y = H - 1; y >= topY; y--) {
      const x = stemX(y);
      img.set(x, y, C.stemLit);
      if (y > topY + (H - topY) * 0.4) img.set(x + 1, y, C.stem);
    }
    blade(stemX(topY), topY, side * 0.25, 7 * scale, 1.3, 0);
  };

  // Thân phụ thấp phía sau trước, thân chính sau.
  stalk(
    W / 2 + rng.range(5, 8) * (rng.chance(0.5) ? 1 : -1),
    Math.round(H * 0.42),
    rng.range(0, 6),
    0.8,
  );
  stalk(W / 2, 8, rng.range(0, 6), 1);
  return img;
}

/** Tảo vàng phân nhánh kiểu ảnh mẫu 3: nhánh nâu-cam, túi khí vàng mọc so le và ở đầu nhánh. */
function goldKelp(seed) {
  const W = 40;
  const H = 84;
  const img = new Pixels(W, H);
  const rng = createRng(seed);
  const stem = ['#5e2a10', '#a4521c', '#d9822c'];
  const pod = { dark: '#a8651a', body: '#f0b030', lit: '#ffe07a', shine: '#fff6c8' };

  const pods = [];
  const grow = (x, y, angle, len, width, depth) => {
    let px = x;
    let py = y;
    let a = angle;
    let side = rng.chance(0.5) ? 1 : -1;
    for (let i = 0; i < len; i++) {
      const nx = px + Math.sin(a);
      const ny = py - Math.cos(a);
      stroke(img, px, py, nx, ny, width, width > 1 ? stem[1] : stem[2], width > 1 ? stem[2] : null);
      if (width > 1) img.set(nx + 1, ny, stem[0]);
      px = nx;
      py = ny;
      a += rng.range(-0.1, 0.1) + Math.sin(i * 0.4) * 0.03;
      if (i > 3 && i % 4 === 2) {
        pods.push([px + side * 2, py - 1, side]);
        side = -side;
      }
    }
    if (depth > 0) {
      grow(px, py, a - rng.range(0.35, 0.6), Math.round(len * rng.range(0.55, 0.75)), 1, depth - 1);
      grow(px, py, a + rng.range(0.35, 0.6), Math.round(len * rng.range(0.55, 0.75)), 1, depth - 1);
    } else {
      pods.push([px, py - 2, 0]);
    }
  };
  grow(W / 2, H - 1, rng.range(-0.08, 0.08), rng.int(28, 34), 3, 2);

  for (const [x, y, side] of pods) {
    if (side !== 0) img.set(x - side, y + 1, stem[2]); // cuống ngắn
    const bx = Math.round(x) - 1;
    const by = Math.round(y) - 2;
    img.rect(bx, by, 3, 4, pod.body);
    img.clear(bx, by);
    img.clear(bx + 2, by);
    img.set(bx + 1, by, pod.lit);
    img.set(bx, by + 1, pod.lit);
    img.set(bx, by + 2, pod.lit);
    img.set(bx + 2, by + 2, pod.dark);
    img.set(bx + 1, by + 3, pod.dark);
    img.clear(bx, by + 3);
    img.clear(bx + 2, by + 3);
    img.set(bx + 1, by + 1, pod.shine);
  }
  return img;
}

/** San hô nhánh gạc hươu kiểu ảnh mẫu 2; `cols` = [tối, thân, sáng, đầu nhánh]. */
function branchCoral(seed, cols) {
  const W = 42;
  const H = 44;
  const img = new Pixels(W, H);
  const rng = createRng(seed);
  const grow = (x, y, angle, len, width, depth) => {
    let px = x;
    let py = y;
    let a = angle;
    for (let i = 0; i < len; i++) {
      const nx = px + Math.sin(a) * 0.9;
      const ny = py - Math.cos(a);
      stroke(img, px, py, nx, ny, width, cols[1], width > 1 ? cols[2] : null);
      if (width > 1) img.set(nx + width - 1, ny, cols[0]);
      px = nx;
      py = ny;
      a = a * 0.9 + rng.range(-0.08, 0.08); // nhánh cong dần lên trên
    }
    if (depth > 0) {
      const n = rng.int(2, 3);
      for (let k = 0; k < n; k++) {
        const spread = (k - (n - 1) / 2) * rng.range(0.7, 1.0);
        grow(
          px,
          py,
          a + spread,
          Math.round(len * rng.range(0.6, 0.85)),
          Math.max(1, width - 1),
          depth - 1,
        );
      }
    } else {
      img.set(px, py - 1, cols[3]);
      img.set(px, py, cols[2]);
    }
  };
  grow(W / 2, H - 2, rng.range(-0.15, 0.15), 13, 4, 3);
  grow(W / 2 - 5, H - 2, -0.65, 10, 3, 2);
  grow(W / 2 + 5, H - 2, 0.65, 10, 3, 2);
  // Chân bám trên đá.
  img.ellipse(W / 2, H - 1, 11, 2.5, cols[0]);
  return img;
}

/** San hô não: gò vàng có rãnh lượn. */
function brainCoral() {
  const W = 34;
  const H = 21;
  const img = new Pixels(W, H);
  const C = {
    dark: '#8a4a08',
    groove: '#c87c10',
    body: '#ffb820',
    lit: '#ffdc50',
    shine: '#fff6c0',
  };
  const cx = W / 2;
  const base = H - 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 16;
      const dy = (y + 0.5 - base) / 19;
      if (dx * dx + dy * dy > 1 || y >= base) continue;
      const light = -dx * 0.5 - dy * 0.6; // sáng phía trên trái
      let c = light > 0.75 ? C.lit : light > 0.35 ? C.body : light > 0.05 ? C.groove : C.dark;
      // Rãnh lượn kiểu não.
      if (Math.sin(x * 0.75 + Math.sin(y * 0.65) * 2.2) > 0.72) c = c === C.lit ? C.body : C.groove;
      img.set(x, y, c);
    }
  }
  img.set(10, 5, C.shine);
  img.set(11, 5, C.shine);
  img.set(10, 6, C.shine);
  img.rect(2, base, W - 4, 1, C.dark);
  return img;
}

/** San hô quả cầu hồng sần (ảnh mẫu 3), ba quả chụm. */
function pinkBall() {
  const W = 26;
  const H = 20;
  const img = new Pixels(W, H);
  const C = { dark: '#8a1068', body: '#ff38b0', lit: '#ff8ae0', shine: '#ffe0f6' };
  const ball = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = (x + 0.5 - cx) / r;
        const dy = (y + 0.5 - cy) / r;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const light = -dx - dy;
        let c = light > 0.6 ? C.lit : light > -0.5 ? C.body : C.dark;
        if ((x + y) % 2 === 0 && d > 0.25) c = c === C.lit ? C.body : c === C.body ? C.dark : c; // bề mặt sần
        img.set(x, y, c);
      }
    }
    img.set(cx - r * 0.45, cy - r * 0.5, C.shine);
  };
  ball(7, 13, 6);
  ball(19, 13.5, 5.4);
  ball(13, 8, 6);
  return img;
}

/** Cỏ biển xanh tươi, lá cong mềm. */
function seaGrass() {
  const W = 28;
  const H = 38;
  const img = new Pixels(W, H);
  const rng = createRng(171);
  const cols = ['#1f7a28', '#38c040', '#8af050', '#e0ff90'];
  for (let i = 0; i < 12; i++) {
    const x0 = 3 + i * 1.9;
    const h = rng.int(20, 36);
    const bend = rng.range(-5, 5);
    for (let s = 0; s <= h; s++) {
      const u = s / h;
      const x = x0 + bend * u * u;
      const y = H - 1 - s;
      const c = u > 0.85 ? cols[3] : u > 0.5 ? cols[2] : u > 0.2 ? cols[1] : cols[0];
      img.set(x, y, c);
      if (u < 0.3) img.set(x + 1, y, cols[0]);
    }
  }
  return img;
}

/** Bọt biển ống màu cam, miệng ống tối. */
function tubeSponge() {
  const W = 24;
  const H = 36;
  const img = new Pixels(W, H);
  const C = {
    dark: '#8a2a04',
    body: '#ff6418',
    lit: '#ffa040',
    shine: '#ffd890',
    mouth: '#3a0c02',
  };
  for (const [x, h] of [
    [1, 20],
    [7, 34],
    [14, 26],
  ]) {
    const top = H - h;
    img.rect(x, top + 1, 6, h - 1, C.body);
    img.rect(x, top + 1, 2, h - 1, C.lit);
    img.rect(x + 5, top + 1, 1, h - 1, C.dark);
    img.rect(x, top, 6, 1, C.shine);
    img.rect(x + 1, top + 1, 4, 1, C.mouth);
    for (let y = top + 4; y < H - 1; y += 4) img.set(x + 2, y, C.dark); // vân ngang
  }
  return img;
}

// ---------------------------------------------------------------- thêm 19 loài đáy (ảnh mẫu 4, 2026-11-06)

/** Hình tròn có bóng (sáng trên trái); `c` = [tối, thân, sáng]. */
function shadedBall(img, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - cy) / r;
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.7 - dy * 0.8;
      img.set(x, y, l > 0.45 ? c[2] : l > -0.45 ? c[1] : c[0]);
    }
  }
}

/** San hô bàn: tán phẳng xanh dương trên một chân ngắn. */
function tableCoral() {
  const img = new Pixels(40, 24);
  const C = ['#0e2e70', '#2462d0', '#4c9aff', '#bfe6ff'];
  img.rect(17, 12, 6, 12, C[0]);
  img.rect(17, 12, 2, 12, C[1]);
  img.ellipse(20, 11, 19, 3.2, C[0]);
  img.ellipse(20, 9.5, 18.5, 3, C[1]);
  img.ellipse(19, 8.5, 16, 2, C[2]);
  for (let x = 4; x < 36; x += 3) img.set(x, 8 + ((x * 7) % 3), C[3]);
  return img;
}

/** Quạt biển (gorgonian): lưới nhánh mảnh đỏ hình quạt. */
function seaFan() {
  const img = new Pixels(40, 44);
  const rng = createRng(301);
  const cols = ['#7a0c1c', '#e0283c', '#ff6a5a', '#ffd0c0'];
  for (const a of [-1.0, -0.5, 0, 0.5, 1.0])
    branch(img, 20, 43, a * 0.55, 11, a === 0, 3, rng, cols);
  // Mắt lưới: nối ngang các nhánh gần nhau.
  for (let y = 6; y < 38; y += 3) {
    let last = -1;
    for (let x = 0; x < 40; x++) {
      if (img.alphaAt(x, y) > 0) {
        if (last >= 0 && x - last > 1 && x - last < 6) img.line(last, y, x, y, cols[1]);
        last = x;
      }
    }
  }
  return img;
}

/** Roi biển: các que mảnh cam vàng cong nhẹ. */
function seaWhip() {
  const img = new Pixels(26, 48);
  const rng = createRng(311);
  const C = ['#a8420a', '#ff8a1c', '#ffd060'];
  for (let i = 0; i < 7; i++) {
    const x0 = 6 + i * 2.2;
    const h = rng.int(26, 46);
    const bend = rng.range(-6, 6);
    for (let s = 0; s < h; s++) {
      const u = s / h;
      const x = x0 + bend * u * u;
      img.set(x, 47 - s, u > 0.9 ? C[2] : C[1]);
      if (u < 0.6) img.set(x + 1, 47 - s, C[0]);
    }
  }
  return img;
}

/** San hô cột: các trụ tròn phủ polyp lông tơ. */
function pillarCoral() {
  const img = new Pixels(28, 40);
  const C = ['#7a5a34', '#c8a070', '#ecd2a0', '#fff2d4'];
  for (const [x, h] of [
    [3, 22],
    [10, 38],
    [18, 29],
  ]) {
    const top = 40 - h;
    img.rect(x, top + 2, 7, h - 2, C[1]);
    img.rect(x, top + 2, 2, h - 2, C[2]);
    img.rect(x + 6, top + 2, 1, h - 2, C[0]);
    img.ellipse(x + 3.5, top + 2.5, 3.5, 2.2, C[2]);
    // Polyp lông tơ ở mép trụ.
    for (let y = top + 1; y < 40; y += 2) {
      img.set(x - 1, y + (y % 4 === 0 ? 1 : 0), C[3]);
      img.set(x + 7, y, C[2]);
    }
  }
  return img;
}

/** San hô nấm (leather toadstool): chân kem, mũ vàng-xanh gợn nếp. */
function mushroomCoral() {
  const img = new Pixels(30, 26);
  img.rect(11, 12, 8, 14, '#d8c08e');
  img.rect(11, 12, 2, 14, '#f2e2b8');
  img.rect(18, 12, 1, 14, '#9a8458');
  img.ellipse(15, 10, 14, 6, '#7a9a28');
  img.ellipse(14.5, 9, 13, 5, '#b4d44c');
  img.ellipse(13, 7.5, 9, 3, '#dcf07a');
  for (let x = 3; x < 27; x += 2) img.set(x, 13 + (x % 4 === 1 ? 1 : 0), '#7a9a28'); // mép mũ gợn
  return img;
}

/** San hô bong bóng: chùm bóng trắng ngà. */
function bubbleCoral() {
  const img = new Pixels(28, 18);
  const C = ['#6a7aa0', '#c8d8f0', '#ffffff'];
  img.ellipse(14, 16, 12, 2.5, '#3a3a5a');
  for (const [x, y, r] of [
    [6, 12, 4],
    [12, 9, 4.5],
    [19, 11, 4.2],
    [24, 14, 3],
    [10, 14, 3.2],
    [16, 14, 3.5],
  ]) {
    shadedBall(img, x, y, r, C);
  }
  return img;
}

/** Polyp sao: thảm tím có chấm sao xanh lá. */
function starPolyps() {
  const img = new Pixels(30, 10);
  img.ellipse(15, 8, 14, 3, '#3a1a5a');
  img.ellipse(15, 7, 13, 2.2, '#6a3a9a');
  for (let x = 3; x < 28; x += 2) {
    const y = 5 + ((x * 5) % 3);
    img.set(x, y, '#5cff7a');
    img.set(x, y - 1, '#c8ffd0');
  }
  return img;
}

/** Zoanthid: các polyp nút áo nhiều màu, giữa tối. */
function zoanthids() {
  const img = new Pixels(30, 12);
  img.ellipse(15, 10.5, 14, 2.2, '#2a2a40');
  const colors = ['#ff7a1a', '#3cff8a', '#ff3aa0', '#ffd23a', '#3ad0ff'];
  let i = 0;
  for (const [x, y] of [
    [4, 8],
    [9, 7],
    [14, 6],
    [19, 7],
    [24, 8],
    [7, 4],
    [12, 3],
    [17, 3],
    [22, 4],
  ]) {
    const c = colors[i++ % colors.length];
    img.ellipse(x, y, 2.6, 2, c);
    img.set(x - 1, y - 1, '#ffffff');
    img.set(x, y, '#2a1020');
  }
  return img;
}

/** San hô sừng nai: nhánh dẹt to, chĩa ngang. */
function elkhornCoral() {
  const img = new Pixels(44, 30);
  const C = ['#8a4a18', '#e08a3c', '#ffbc70'];
  // Nhánh dẹt: vẽ thành dải dày theo pháp tuyến, mép trên sáng, mép dưới tối.
  const limb = (x0, y0, x1, y1, w) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    for (let k = -w / 2; k <= w / 2; k += 0.5) {
      const c = k < -w / 2 + 1 ? C[2] : k > w / 2 - 1 ? C[0] : C[1];
      img.line(x0 + nx * k, y0 + ny * k, x1 + nx * k, y1 + ny * k, c);
    }
  };
  limb(22, 29, 22, 17, 6);
  limb(22, 19, 8, 9, 6);
  limb(22, 19, 36, 9, 6);
  limb(9, 10, 3, 2, 4);
  limb(11, 10, 14, 2, 4);
  limb(35, 10, 41, 2, 4);
  limb(32, 10, 28, 2, 4);
  for (const [x, y] of [
    [3, 2],
    [14, 2],
    [41, 2],
    [28, 2],
  ])
    img.set(x, y, '#ffe0b0');
  return img;
}

/** San hô phủ xanh dương: gò sần như đá xanh trong ảnh mẫu. */
function encrustBlue() {
  const img = new Pixels(36, 16);
  const C = ['#102a6a', '#2458c8', '#4c90f0', '#a8d4ff'];
  for (let x = 0; x < 36; x++) {
    const h =
      6 + Math.sin(x * 0.45) * 2.5 + Math.sin(x * 1.3) * 1.5 + (1 - Math.abs(x - 18) / 18) * 6;
    for (let y = 15; y > 15 - h; y--) {
      const fromTop = y - (15 - h);
      img.set(x, y, fromTop < 1.5 ? C[3] : fromTop < 3 ? C[2] : y > 13 ? C[0] : C[1]);
    }
  }
  return img;
}

/** Bọt biển thùng: thân loe dần, gân dọc, miệng tối. */
function barrelSponge() {
  const img = new Pixels(28, 30);
  const C = ['#5a1e14', '#a8442c', '#e07a50', '#ffb08a'];
  for (let y = 4; y < 30; y++) {
    const hw = 8 + (30 - y) * 0.18;
    for (let x = Math.round(14 - hw); x <= Math.round(14 + hw); x++) {
      const u = (x - (14 - hw)) / (2 * hw);
      let c = u < 0.25 ? C[2] : u > 0.8 ? C[0] : C[1];
      if (Math.round(x - 14) % 4 === 0) c = C[0]; // gân dọc
      img.set(x, y, c);
    }
  }
  img.ellipse(14, 4.5, 12.5, 2.6, C[3]);
  img.ellipse(14, 5, 10, 1.7, '#2a0a06');
  return img;
}

/** Bọt biển bình tím. */
function vaseSponge() {
  const img = new Pixels(20, 32);
  const C = ['#3a1868', '#8a44d0', '#c88cff', '#f0d8ff'];
  for (let y = 3; y < 32; y++) {
    const u = (y - 3) / 29;
    const hw = 3 + Math.sin(u * Math.PI * 0.9 + 0.3) * 5.5;
    for (let x = Math.round(10 - hw); x <= Math.round(10 + hw); x++) {
      const v = (x - (10 - hw)) / (2 * hw);
      img.set(x, y, v < 0.3 ? C[2] : v > 0.78 ? C[0] : C[1]);
    }
  }
  img.ellipse(10, 3.5, 7, 2, C[3]);
  img.ellipse(10, 4, 5, 1.3, '#1a0830');
  return img;
}

/** Trai khổng lồ: vỏ trắng gợn sóng, màng áo xanh lam lốm đốm. */
function giantClam() {
  const img = new Pixels(26, 14);
  for (let x = 1; x < 25; x++) {
    const wave = Math.round(Math.sin(x * 0.9) * 1.5);
    img.rect(x, 7 + wave, 1, 7 - wave, '#d8d2c0');
    img.set(x, 7 + wave, '#ffffff');
    img.set(x, 13, '#8a8474');
  }
  for (let x = 3; x < 23; x++) {
    const y = 6 + Math.round(Math.sin(x * 0.9) * 1.5);
    img.rect(x, y - 2, 1, 2, x % 3 === 0 ? '#7ae0ff' : '#2a5aff');
  }
  for (const x of [6, 11, 16, 20]) img.set(x, 5, '#c8ffff');
  return img;
}

/** Sao biển cam năm cánh. */
function starfish() {
  const img = new Pixels(16, 14);
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    img.line(8, 7.5, 8 + Math.cos(a) * 7, 7.5 + Math.sin(a) * 6.5, '#ff6a1c');
    img.line(8.5, 7.5, 8.5 + Math.cos(a) * 5, 7.5 + Math.sin(a) * 4.5, '#ff6a1c');
    img.set(8 + Math.cos(a) * 3, 7 + Math.sin(a) * 3, '#ffd080');
  }
  img.ellipse(8, 7.5, 2.5, 2.2, '#ff8c3a');
  img.set(7, 6, '#ffe0a0');
  return img;
}

/** Nhím biển: thân tím đen, gai toả tròn. */
function seaUrchin() {
  const img = new Pixels(16, 13);
  for (let k = 0; k < 16; k++) {
    const a = Math.PI + (k / 15) * Math.PI;
    img.line(8, 10, 8 + Math.cos(a) * 7.5, 10 + Math.sin(a) * 9, k % 2 ? '#5a2a8a' : '#2a1040');
  }
  img.ellipse(8, 10, 4.2, 3, '#3a1858');
  img.set(6, 8, '#a87ad8');
  return img;
}

/** Giun lông vũ: cuống mảnh, vương miện lông vằn đỏ trắng. */
function featherDuster() {
  const img = new Pixels(24, 32);
  for (const [x, top] of [
    [7, 12],
    [15, 6],
  ]) {
    img.line(x, 31, x, top, '#b49a6a');
    for (let k = 0; k < 11; k++) {
      const a = -Math.PI + (k / 10) * Math.PI;
      for (let s = 1; s <= 6; s++) {
        img.set(x + Math.cos(a) * s, top + Math.sin(a) * s * 0.9, s % 2 ? '#ff3a4a' : '#fff0e8');
      }
    }
  }
  return img;
}

/** Giun cây thông: các nón xoắn nhỏ nhiều màu trên tảng đá. */
function christmasTree() {
  const img = new Pixels(22, 16);
  img.ellipse(11, 14, 10, 4, '#3a3a52');
  img.ellipse(10, 12.5, 8, 2.5, '#5a5a78');
  const cols = ['#3ab0ff', '#ff7a1a', '#ff3a6a', '#ffe23a'];
  [
    [5, 10],
    [11, 9],
    [16, 10],
  ].forEach(([x, base], i) => {
    for (let s = 0; s < 6; s++) {
      const w = Math.round((6 - s) / 2);
      img.rect(x - w, base - s, w * 2 + 1, 1, s % 2 ? cols[i] : cols[(i + 1) % 4]);
    }
  });
  return img;
}

/** Tảo nho (caulerpa): thân bò, chùm hạt tròn xanh. */
function caulerpa() {
  const img = new Pixels(28, 22);
  img.line(1, 21, 27, 20, '#2a7a2a');
  for (const [x, h] of [
    [4, 10],
    [10, 16],
    [16, 12],
    [22, 18],
  ]) {
    img.line(x, 20, x, 21 - h, '#3a9a32');
    for (let y = 21 - h; y < 18; y += 2) {
      shadedBall(img, x - 1.5, y, 1.3, ['#2a8a2a', '#5ad05a', '#b4ff8a']);
      shadedBall(img, x + 1.5, y + 1, 1.3, ['#2a8a2a', '#5ad05a', '#b4ff8a']);
    }
  }
  return img;
}

/** Rau diếp biển: lá xanh tươi gợn sóng, mép sáng. */
function seaLettuce() {
  const img = new Pixels(30, 20);
  for (const [cx, w, h] of [
    [8, 7, 14],
    [17, 8, 19],
    [24, 6, 12],
  ]) {
    for (let y = 19; y > 19 - h; y--) {
      const u = (19 - y) / h;
      const hw = w * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.1));
      const sway = Math.sin(y * 0.6 + cx) * 1.5;
      for (let x = Math.round(cx - hw + sway); x <= Math.round(cx + hw + sway); x++) {
        const edge = x <= cx - hw + sway + 1 || x >= cx + hw + sway - 1;
        img.set(x, y, edge ? '#b8ff6a' : u > 0.6 ? '#62d83a' : '#2e9a2a');
      }
    }
  }
  return img;
}

// ---------------------------------------------------------------- mặt đáy lồi lõm và đá gồ ghề (spec mục 8, 12.4)

/** Độ nhô của đáy tại x (px trên floorY): nội suy cosine, khớp `floorAt` trong src/core/sim/terrain.ts. */
function riseAt(x) {
  const pts = ZONE.terrain ?? [];
  if (pts.length === 0) return 0;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, r1] = pts[i];
    if (x <= x1) {
      const [x0, r0] = pts[i - 1];
      const t = x1 === x0 ? 1 : (x - x0) / (x1 - x0);
      return r0 + (r1 - r0) * ((1 - Math.cos(Math.PI * t)) / 2);
    }
  }
  return pts[pts.length - 1][1];
}

/** Nhiễu giá trị 2D mượt, tất định theo seed (dùng cho mép đá loang lổ). */
function valueNoise(seed, smooth = false) {
  const hash = (ix, iy) => {
    let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y, size) => {
    const gx = x / size;
    const gy = y / size;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const sx = smooth ? fx * fx * (3 - 2 * fx) : fx;
    const sy = smooth ? fy * fy * (3 - 2 * fy) : fy;
    const a = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
    const b = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

const ROCK = ['#0b1430', '#152550', '#22397a', '#3a5aa6', '#6a8ad0'];
const REEF_SPECKS = ['#ff6a1c', '#ffd23a', '#ff3aa0', '#3ad0ff', '#9c40f0', '#5cff7a'];

/** Thêm vài đốm san hô li ti lên mặt đá đã vẽ (chỉ ở pixel có đá ngay dưới và trống ngay trên). */
function sprinkleReef(img, rng, chance, isRock) {
  for (let y = 1; y < img.height - 1; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!isRock(x, y) || img.alphaAt(x, y - 1) > 0 || !rng.chance(chance)) continue;
      const c = rng.pick(REEF_SPECKS);
      img.set(x, y - 1, c);
      if (rng.chance(0.5)) img.set(x + 1, y - 1, c);
      if (rng.chance(0.35)) img.set(x, y - 2, mixHex(c, '#ffffff', 0.4));
    }
  }
}

/**
 * Nền đất lớp chơi bám đúng mặt đáy (`terrain`). Ảnh đặt tại y = floorY - TERRAIN_HEADROOM,
 * phủ hết chiều rộng khu. Gò thấp là cát; gò cao chuyển thành mỏm đá xanh tối có san hô bám.
 */
const TERRAIN_HEADROOM = 40;
function terrain() {
  const top = ZONE.floorY - TERRAIN_HEADROOM;
  const W = ZONE.width;
  const H = ZONE.height - top;
  const img = new Pixels(W, H);
  const rng = createRng(401);
  const noise = valueNoise(17);
  const isRockAt = [];
  for (let x = 0; x < W; x++) {
    const rise = riseAt(x);
    const surface = Math.round(TERRAIN_HEADROOM - rise);
    // Gò càng cao càng nhiều đá; mép đá loang theo nhiễu.
    const rockiness = Math.max(0, Math.min(1, (rise - 10) / 16));
    for (let y = surface; y < H; y++) {
      const depth = y - surface;
      const n = noise(x, y, 7) * 0.7 + noise(x, y, 3) * 0.3;
      const rock = n < rockiness * 0.95 && y < TERRAIN_HEADROOM + 6;
      isRockAt[y * W + x] = rock;
      let c;
      if (rock) {
        const crack = noise(x, y, 2) > 0.82;
        c =
          depth === 0
            ? ROCK[4]
            : depth < 2
              ? ROCK[3]
              : crack
                ? ROCK[0]
                : n < 0.25
                  ? ROCK[1]
                  : ROCK[2];
      } else {
        c = depth === 0 ? P.d4 : depth < 2 ? P.d3 : depth < 10 ? P.d2 : depth < 22 ? P.d1 : P.d0;
        if (depth > 1 && rng.chance(0.08)) c = shade(SAND, c, rng.chance(0.5) ? 1 : -1);
      }
      img.set(x, y, c);
    }
  }
  // Mép đá giáp cát tối hơn để khối đá nổi khối.
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W - 1; x++) {
      const here = isRockAt[y * W + x];
      if (
        here &&
        (!isRockAt[y * W + x - 1] || !isRockAt[y * W + x + 1]) &&
        img.alphaAt(x, y - 1) > 0
      ) {
        img.set(x, y, ROCK[0]);
      }
    }
  }
  // Sỏi, vỏ sò rải trên cát.
  for (let i = 0; i < W / 40; i++) {
    const x = rng.int(4, W - 6);
    const y = Math.round(TERRAIN_HEADROOM - riseAt(x)) + rng.int(3, 20);
    if (isRockAt[y * W + x]) continue;
    img.rect(x, y, 3, 2, P.s2);
    img.set(x, y, P.s4);
    img.rect(x + 1, y + 2, 3, 1, P.d0);
  }
  sprinkleReef(img, rng, 0.18, (x, y) => isRockAt[y * W + x] === true);
  img.recolor((x, y, c) => mixHex(c, '#2b3266', 0.22));
  return img;
}

/** Lớp đá tảng gồ ghề phía sau rạn (ảnh mẫu 4): khối đá xanh tối mép lởm chởm, san hô bám trên mặt. */
function reefRocks() {
  const W = 360;
  const H = 84;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(411);
  const noise = valueNoise(23);
  const solid = new Uint8Array(W * H);
  let x = 0;
  while (x < W) {
    const w = rng.int(40, 90);
    const h = rng.int(30, 78);
    const cx = x + w / 2;
    for (let px = x - 6; px < x + w + 6; px++) {
      for (let y = 0; y < H; y++) {
        const dx = (px + 0.5 - cx) / (w / 2 + 6);
        const dy = (y + 0.5 - H) / h;
        const edge = 1 + (noise(px, y, 5) - 0.5) * 0.55 + (noise(px, y, 2) - 0.5) * 0.2;
        if (dx * dx + dy * dy <= edge * edge) {
          const wx = ((px % W) + W) % W;
          solid[y * W + wx] = 1;
        }
      }
    }
    x += w + rng.int(4, 34);
  }
  for (let px = 0; px < W; px++) {
    let fromTop = -1;
    for (let y = 0; y < H; y++) {
      if (!solid[y * W + px]) {
        fromTop = -1;
        continue;
      }
      fromTop++;
      const left = solid[y * W + ((px - 1 + W) % W)];
      const right = solid[y * W + ((px + 1) % W)];
      // Sáng ở mặt trên, tối dần xuống chân; nhiễu thô chỉ lệch một bậc.
      let step = fromTop < 1 ? 4 : fromTop < 3 ? 3 : fromTop < 12 ? 2 : 1;
      if (noise(px, y, 9) < 0.3) step = Math.max(0, step - 1);
      if (!left) step = Math.min(4, step + 1); // mép trái đón sáng
      if (!right) step = 0; // mép phải khuất sáng
      if (fromTop > 2 && noise(px, y, 3) > 0.9) step = 0; // vết nứt
      img.set(px, y, ROCK[step]);
    }
  }
  sprinkleReef(img, rng, 0.22, (px, y) => solid[y * W + px] === 1);
  // Vài cụm san hô nhánh nhỏ trên đỉnh đá.
  for (let i = 0; i < 9; i++) {
    const px = rng.int(0, W - 1);
    let y = 0;
    while (y < H - 1 && !solid[y * W + px]) y++;
    if (y >= H - 8) continue;
    const cols = rng.pick([CORAL_PINK, CORAL_ORANGE, CORAL_PURPLE]);
    branch(img, px, y, rng.range(-0.3, 0.3), rng.int(4, 7), false, 2, rng, cols);
  }
  img.recolor((px, y, c) => mixHex(c, '#1a2a5a', 0.18));
  return img;
}

// ---------------------------------------------------------------- bản thử góc nhìn chéo (P2-Iso)

/**
 * Mặt đáy nhìn từ trên xuống, 1024×1024: cát gợn sóng, mảng đá có mép trên sáng / mép dưới tối
 * để nổi khối khi nhìn chéo, rêu, sỏi và mảnh san hô vụn.
 */
function isoGround() {
  const S = 1024;
  const img = new Pixels(S, S);
  const rng = createRng(501);
  const noise = valueNoise(31, true);
  const rockAt = new Uint8Array(S * S);
  const rockField = (x, y) =>
    noise(x, y, 90) * 0.62 + noise(x, y, 28) * 0.28 + noise(x, y, 9) * 0.1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) rockAt[y * S + x] = rockField(x, y) > 0.66 ? 1 : 0;
  }
  const isRock = (x, y) => x >= 0 && y >= 0 && x < S && y < S && rockAt[y * S + x] === 1;
  const sandRamp = [P.d0, P.d1, P.d2, P.d3, P.d4];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (isRock(x, y)) {
        // Mép trên đón sáng, mép dưới khuất; lòng đá loang theo nhiễu.
        const top = !isRock(x, y - 1) || !isRock(x, y - 2);
        const bottom = !isRock(x, y + 1) || !isRock(x, y + 3);
        const n = noise(x, y, 14);
        let c = top ? ROCK[4] : bottom ? ROCK[0] : n < 0.4 ? ROCK[1] : n < 0.72 ? ROCK[2] : ROCK[3];
        if (noise(x, y, 4) > 0.82) c = ROCK[0]; // vết nứt
        if (!bottom && noise(x, y, 22) > 0.62 && noise(x, y, 5) > 0.42) {
          c = noise(x, y, 3) > 0.6 ? P.g3 : P.g2; // rêu
        }
        // Sỏi đá thấp: pha mạnh về màu cát để không thành mảng xanh phẳng cạnh khối đá.
        img.set(x, y, mixHex(mixHex(c, '#4a5560', 0.3), P.d1, 0.5));
        continue;
      }
      // Gợn cát: sóng ngang bị bẻ cong theo nhiễu lớn.
      const warp = noise(x, y, 70) * 60 + noise(x, y, 23) * 14;
      const wave = Math.sin((y + warp) * 0.3);
      // Gợn cát chỉ hiện từng vùng, nhẹ; tông sáng tối chuyển dần bằng dither.
      const rippleMask = Math.max(0, (noise(x + 400, y, 55) - 0.42) * 2.4);
      const tone = 2.1 + (noise(x, y, 130) - 0.5) * 2.2 + (noise(x, y, 18) - 0.5) * 0.7;
      let step = Math.floor(tone + wave * rippleMask * 0.55 + bayer(x, y));
      // Bóng đổ của đá xuống cát phía dưới mép đá.
      if (isRock(x, y - 2) || isRock(x, y - 4) || isRock(x - 2, y - 3)) step = 0;
      img.set(x, y, sandRamp[Math.max(0, Math.min(4, step))]);
    }
  }
  // Sỏi và vụn san hô trên cát.
  for (let i = 0; i < 2600; i++) {
    const x = rng.int(2, S - 6);
    const y = rng.int(2, S - 6);
    if (isRock(x, y)) continue;
    if (rng.chance(0.2)) {
      const c = rng.pick(REEF_SPECKS);
      img.rect(x, y, 2, 2, c);
      img.set(x, y, mixHex(c, '#ffffff', 0.45));
      img.rect(x, y + 2, 2, 1, P.d0);
    } else {
      const w = rng.int(1, 3);
      img.rect(x, y, w, 1, P.s3);
      img.set(x, y, P.s4);
      img.rect(x, y + 1, w, 1, P.d0);
    }
  }
  // Đốm san hô bám trên đá.
  for (let i = 0; i < 2200; i++) {
    const x = rng.int(2, S - 4);
    const y = rng.int(2, S - 4);
    if (!isRock(x, y) || !isRock(x, y + 4)) continue;
    const c = rng.pick(REEF_SPECKS);
    img.set(x, y, c);
    img.set(x + 1, y, c);
    img.set(x, y - 1, mixHex(c, '#ffffff', 0.4));
  }
  img.recolor((x, y, c) => mixHex(mixHex(c, '#ffffff', 0.1), '#2fb4c4', 0.14));
  return img;
}

/**
 * Vân sáng cho mặt đáy nhìn chéo: lưới Voronoi 256×256 nối liền cả hai chiều, đường cong theo nhiễu,
 * độ đậm thay đổi từng vùng để không thành lưới đều.
 */
function isoCaustics() {
  const S = 512;
  const img = new Pixels(S, S);
  const TAU = Math.PI * 2;
  const ITERATIONS = 5;
  const INTENSITY = 0.005;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Giao thoa nhiều lớp sóng; toạ độ lấy theo chu kỳ TAU nên ảnh lặp liền mạch.
      const px = ((x / S) * TAU * 2) % TAU;
      const py = ((y / S) * TAU * 2) % TAU;
      let ix = px - 250;
      let iy = py - 250;
      let c = 1;
      for (let n = 0; n < ITERATIONS; n++) {
        const t = 1.7 * (1 - 3.5 / (n + 1));
        const nx = px - 250 + Math.cos(t - ix) + Math.sin(t + iy);
        const ny = py - 250 + Math.sin(t - iy) + Math.cos(t + ix);
        ix = nx;
        iy = ny;
        const ax = (px - 250) / (Math.sin(ix + t) / INTENSITY);
        const ay = (py - 250) / (Math.cos(iy + t) / INTENSITY);
        c += 1 / Math.hypot(ax, ay);
      }
      c = 1.17 - Math.pow(c / ITERATIONS, 1.4);
      const line = Math.min(1, Math.pow(Math.abs(c), 13));
      if (line <= 0.03) continue;
      // Từng vùng đậm nhạt khác nhau, nên không thành lưới đều.
      const region = 0.5 + 0.5 * Math.sin((TAU * x) / S + 1) * Math.sin((TAU * y) / S + 2);
      img.set(x, y, mixHex('#ff8a20', '#ffe6a0', line), line * (0.45 + 0.55 * region));
    }
  }
  return img;
}

/** Một tia nắng mềm: sáng ở đỉnh, mờ dần xuống dưới và ra hai mép, không dither. */
function isoRay() {
  const W = 96;
  const H = 256;
  const img = new Pixels(W, H);
  for (let y = 0; y < H; y++) {
    const along = Math.pow(1 - y / H, 1.8);
    for (let x = 0; x < W; x++) {
      const across = Math.pow(Math.cos(Math.PI * ((x + 0.5) / W - 0.5)), 2);
      img.set(x, y, '#d8f6ff', across * along * 0.85);
    }
  }
  return img;
}

/** Khối đá nhìn chéo 3/4: mặt trên sáng có rêu, mặt trước tối dần xuống chân. */
function isoRock(seed, W, H) {
  const img = new Pixels(W, H);
  const rng = createRng(seed);
  const noise = valueNoise(seed, true);
  const solid = new Uint8Array(W * H);
  const lumps = [[W / 2, H * 0.62, W * 0.47, H * 0.4]];
  for (let i = 0; i < 5; i++) {
    lumps.push([
      rng.range(W * 0.2, W * 0.8),
      rng.range(H * 0.38, H * 0.72),
      rng.range(W * 0.14, W * 0.3),
      rng.range(H * 0.18, H * 0.34),
    ]);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = 1 + (noise(x, y, 6) - 0.5) * 0.28;
      for (const [cx, cy, rx, ry] of lumps) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= edge * edge) solid[y * W + x] = 1;
      }
    }
  }
  const capDepth = Math.round(H * 0.3);
  for (let x = 0; x < W; x++) {
    let fromTop = -1;
    for (let y = 0; y < H; y++) {
      if (!solid[y * W + x]) {
        fromTop = -1;
        continue;
      }
      fromTop++;
      const right = x + 1 < W && solid[y * W + x + 1];
      const left = x > 0 && solid[y * W + x - 1];
      const n = noise(x, y, 7);
      let c;
      if (fromTop < capDepth) {
        // Mặt trên hứng sáng; rêu mọc thành mảng.
        c = fromTop < 3 ? ROCK[4] : n > 0.42 ? ROCK[4] : ROCK[3];
        if (noise(x, y, 6) > 0.72 && fromTop > 0) c = noise(x, y, 3) > 0.55 ? P.g3 : P.g2;
      } else {
        const u = (fromTop - capDepth) / Math.max(1, H - capDepth);
        c = u < 0.25 ? ROCK[1] : ROCK[0];
        if (u < 0.25 && n > 0.62) c = ROCK[2];
        if (n > 0.78) c = ROCK[0]; // kẽ đá
      }
      if (!right) c = ROCK[0];
      if (!left && fromTop >= capDepth) c = ROCK[2];
      img.set(x, y, c);
    }
  }
  sprinkleReef(img, rng, 0.2, (x, y) => solid[y * W + x] === 1);
  img.recolor((x, y, c) => mixHex(c, '#5a7a86', 0.08));
  return img;
}

// ---------------------------------------------------------------- địa hình 3/4 (P2-Iso, 5 góp ý)

/** Vân đá của vách trước: dải địa tầng ngang, sáng bên trái, tối xuống chân. `v` = 0 ở mép vách, 1 ở chân. */
function strataColor(noise, x, y, u, v) {
  const band = Math.sin(y * 0.55 + noise(x, y, 40) * 7);
  // Vách là mặt khuất sáng: tối hơn hẳn mặt trên, sáng bên trái và tối dần xuống chân.
  let step = 1.9 - v * 1.7 - u * 0.7 + band * 0.45 + (noise(x, y, 13) - 0.5) * 0.8;
  if (noise(x, y * 0.3, 5) > 0.74) step -= 2.2; // khe đá sâu
  return ROCK[Math.max(0, Math.min(4, Math.round(step)))];
}

/**
 * Cao nguyên vẽ sẵn theo góc 3/4: mặt trên `topH` px (cát, rêu, san hô vụn), vách trước phía dưới.
 * Trả thêm `wallTop(x)` để vẽ tiếp lên vách (cửa hang).
 */
function buildCliff(seed, W, H, topH) {
  const img = new Pixels(W, H);
  const rng = createRng(seed);
  const noise = valueNoise(seed, true);
  // Bo góc: hai đầu thụt vào, dùng chung cho mặt trên và chân vách.
  const round = (x) => {
    const e = Math.min(x, W - 1 - x) / (W * 0.09);
    return e >= 1 ? 0 : 1 - Math.sqrt(1 - (1 - e) * (1 - e));
  };
  const topEdge = (x) => Math.round(round(x) * topH * 0.55 + noise(x, 3, 20) * 5);
  const wallTop = (x) => Math.round(topH - 3 + noise(x, 40, 16) * 8 - round(x) * topH * 0.1);
  const footEdge = (x) => Math.round(H - 1 - round(x) * 22 - noise(x, 90, 12) * 7);

  for (let x = 0; x < W; x++) {
    const a = topEdge(x);
    const b = wallTop(x);
    const c = footEdge(x);
    for (let y = a; y <= c; y++) {
      if (y < b) {
        // Mặt trên hứng sáng.
        const n = noise(x, y, 11);
        const tone = 3 + (noise(x, y, 40) - 0.5) * 1.6 + bayer(x, y) * 0.8 - 0.4;
        let col = SAND[Math.max(1, Math.min(4, Math.floor(tone)))];
        if (n > 0.67)
          col = mixHex(noise(x, y, 4) > 0.5 ? P.g3 : P.g2, col, 0.3); // rêu thành mảng nhỏ
        else if (noise(x + 500, y, 15) > 0.72) col = mixHex(ROCK[3], col, 0.35); // đá lộ
        if (y - a < 2) col = mixHex(col, '#ffffff', 0.35); // mép xa bắt sáng
        img.set(x, y, mixHex(col, '#fff4d0', 0.14)); // mặt trên hứng sáng
      } else {
        const u = x / W;
        const v = (y - b) / Math.max(1, c - b);
        let col = strataColor(noise, x, y, u, v);
        if (y - b < 2) col = ROCK[4]; // gờ vách đón sáng
        // Rêu rủ từ mép xuống.
        if (y - b < 3 + noise(x, 7, 5) * 11 && noise(x, 11, 7) > 0.55)
          col = noise(x, y, 3) > 0.5 ? P.g2 : P.g1;
        // Bóng dưới gờ: ngay dưới mép trên tối lại, tạo cảm giác mặt trên nhô ra.
        if (y - b >= 2 && y - b < 7) col = mixHex(col, '#030716', 0.45);
        // Mặt bên phải quay khỏi nguồn sáng.
        if (x > W - 20) col = mixHex(col, '#040a20', 0.35 + ((x - (W - 20)) / 20) * 0.5);
        // Chân vách có bóng tiếp xúc, tối nhất ở sát đất.
        if (c - y < 14) col = mixHex(col, '#030716', (1 - (c - y) / 14) * 0.85);
        img.set(x, y, mixHex(col, '#5a7a86', 0.05));
      }
    }
    // Chân vách tối, tiếp đất.
    img.rect(x, c - 1, 1, 2, ROCK[0]);
  }
  // San hô li ti ở mép và mặt trên.
  for (let i = 0; i < W / 3; i++) {
    const x = rng.int(4, W - 5);
    const y = rng.int(topEdge(x) + 2, wallTop(x) + 2);
    if (img.alphaAt(x, y) === 0) continue;
    const c = rng.pick(REEF_SPECKS);
    img.set(x, y, c);
    img.set(x + 1, y, c);
    img.set(x, y - 1, mixHex(c, '#ffffff', 0.45));
  }
  return { img, wallTop, footEdge, noise };
}

const isoCliff = (seed, W, H, topH) => buildCliff(seed, W, H, topH).img;

/** Vách đá có cửa hang: lòng hang tối, vành đá sáng, ánh cyan le lói từ trong. */
function isoCave() {
  const W = 240;
  const H = 157;
  const { img, footEdge, noise } = buildCliff(551, W, H, 65);
  const cx = 118;
  const foot = footEdge(cx);
  const rx = 42;
  const ry = 62;
  for (let y = foot - ry - 5; y <= foot; y++) {
    for (let x = cx - rx - 5; x <= cx + rx + 5; x++) {
      const wob = 1 + (noise(x, y, 8) - 0.5) * 0.16;
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - foot) / ry);
      if (d > 1.1 * wob) continue;
      if (d > wob) {
        img.set(x, y, x < cx ? ROCK[4] : ROCK[2]); // vành đá
        continue;
      }
      // Càng vào sâu càng tối, đáy hang có ánh cyan.
      const glow = Math.max(0, 1 - Math.hypot((x - cx) / 22, (y - foot + 10) / 16));
      const c = mixHex('#04081a', '#5ff0f0', glow * glow * 0.75);
      img.set(x, y, c);
    }
  }
  return img;
}

/** Đền đổ nát 3/4 trên bậc đá: hàng cột, cửa sổ phát sáng cyan, mái vòm rêu phong, góc phải sụp. */
function isoTemple() {
  const W = 200;
  const H = 176;
  const img = new Pixels(W, H);
  const rng = createRng(561);
  const noise = valueNoise(561, true);
  const STONE_C = ['#2a3350', '#4a5878', '#7486a4', '#a9b8c8', '#dbe4e6'];
  const face = (x0, y0, w, h, topLit) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const u = (x - x0) / w;
        const row = Math.floor((y - y0) / 8);
        const brickX = (x + (row % 2) * 9) % 18;
        const joint = (y - y0) % 8 === 7 || brickX === 0;
        const step = joint
          ? 0.4
          : 1.9 - u * 1.1 + (noise(x, y, 18) - 0.5) * 0.5 - ((y - y0) / h) * 0.3;
        img.set(x, y, STONE_C[Math.max(0, Math.min(4, Math.round(step)))]);
      }
    }
    img.rect(x0, y0, w, 2, topLit);
  };
  // Ba bậc nền, mỗi bậc có mặt trên sáng.
  [
    [2, 142, 196, 34],
    [18, 126, 164, 20],
    [34, 112, 132, 18],
  ].forEach(([x, y, w, h]) => {
    img.rect(x, y - 6, w, 6, STONE_C[3]);
    img.rect(x, y - 6, w, 1, STONE_C[4]);
    face(x, y, w, h, STONE_C[4]);
  });
  // Thân đền: nền tối, cửa sổ vòm phát sáng giữa các cột.
  face(46, 50, 108, 62, STONE_C[3]);
  img.rect(52, 62, 96, 50, '#0c1630');
  for (const x of [58, 86, 114]) {
    const w = 16;
    for (let y = 72; y < 112; y++) {
      for (let px = x; px < x + w; px++) {
        const dy = y < 80 ? (80 - y) / 8 : 0;
        const dx = Math.abs(px + 0.5 - (x + w / 2)) / (w / 2);
        if (dx * dx + dy * dy > 1) continue;
        const t = (y - 72) / 40;
        img.set(px, y, mixHex('#d8fff8', '#2fd8e0', t * 0.8));
      }
    }
  }
  // Cột.
  for (const x of [48, 76, 104, 132]) {
    const broken = x === 132;
    const top = broken ? 80 : 54;
    img.rect(x, top, 10, 112 - top, STONE_C[2]);
    img.rect(x, top, 3, 112 - top, STONE_C[3]);
    img.rect(x + 8, top, 2, 112 - top, STONE_C[0]);
    for (let y = top + 7; y < 110; y += 8) img.rect(x, y, 10, 1, STONE_C[1]);
    if (!broken) img.rect(x - 2, top - 2, 14, 3, STONE_C[4]);
    else for (let px = x; px < x + 10; px++) img.clearRect(px, top - 1, 1, (px * 7) % 5);
  }
  // Mái vòm rêu phong; góc phải sụp.
  for (let y = 4; y < 54; y++) {
    for (let x = 40; x < 160; x++) {
      const dx = (x + 0.5 - 100) / 58;
      const dy = (y + 0.5 - 54) / 48;
      if (dx * dx + dy * dy > 1) continue;
      if (x > 138 && y < 30 + noise(x, y, 8) * 12) continue;
      const l = -dx * 0.75 - dy * 0.55;
      let c = l > 0.72 ? STONE_C[4] : l > 0.42 ? STONE_C[3] : l > 0.12 ? STONE_C[2] : STONE_C[1];
      if (noise(x, y, 9) > 0.62) c = noise(x, y, 3) > 0.5 ? P.g3 : P.g2;
      if (Math.sin(y * 0.8) > 0.93) c = STONE_C[1];
      img.set(x, y, c);
    }
  }
  img.rect(42, 50, 116, 4, STONE_C[4]);
  // Đá vỡ rơi bên phải, rêu và san hô bám nền.
  for (let i = 0; i < 7; i++) {
    const x = rng.int(150, 192);
    const y = rng.int(128, 166);
    const w = rng.int(5, 12);
    img.rect(x, y, w, 4, STONE_C[2]);
    img.rect(x, y, w, 1, STONE_C[4]);
    img.rect(x, y + 4, w, 1, STONE_C[0]);
  }
  for (let i = 0; i < 90; i++) {
    const x = rng.int(4, W - 5);
    const y = rng.int(118, H - 3);
    if (img.alphaAt(x, y) === 0) continue;
    const c = i % 3 === 0 ? rng.pick(REEF_SPECKS) : rng.chance(0.5) ? P.g3 : P.g2;
    img.set(x, y, c);
    img.set(x + 1, y, c);
  }
  return img;
}

/** Hậu cảnh: dãy vách xa đã mờ, màu sương, lặp ngang. */
function isoBackwall() {
  const W = 640;
  const H = 230;
  const img = new Pixels(W, H, { wrapX: true });
  const rng = createRng(571);
  const ridge = (base, amp, color, phase) => {
    const offs = Array.from({ length: 5 }, () => [
      rng.int(1, 5),
      rng.range(0, 6.28),
      rng.range(0.4, 1),
    ]);
    for (let x = 0; x < W; x++) {
      let h = 0;
      for (const [f, p, a] of offs) h += Math.sin((x / W) * Math.PI * 2 * f * 2 + p + phase) * a;
      const top = Math.round(base - h * amp);
      img.rect(x, Math.max(0, top), 1, H - Math.max(0, top), color);
    }
  };
  ridge(70, 18, '#3a9ec4', 0);
  ridge(120, 22, '#2f88b0', 1.7);
  ridge(170, 16, '#27749c', 3.3);
  img.blur(2);
  return img;
}

/** Tiền cảnh tối, đã mờ: đá và san hô chìm trong bóng, góc dưới. `flip` để dùng cho góc phải. */
function isoForeground(seed, flip) {
  const W = 250;
  const H = 180;
  const img = new Pixels(W, H);
  const rng = createRng(seed);
  const noise = valueNoise(seed, true);
  const X = (x) => (flip ? W - 1 - x : x);
  const dark = '#06102a';
  const mid = '#0d1e45';
  const cols = [dark, mid, '#3a2c50', '#e08a40'];
  // Nhánh san hô đứng trước nền đá, để lộ bóng dáng.
  for (let i = 0; i < 7; i++) {
    const x0 = rng.int(20, 180);
    branch(
      img,
      X(x0),
      H - rng.int(20, 60),
      (flip ? -1 : 1) * rng.range(-0.3, 0.5),
      rng.int(14, 24),
      true,
      3,
      rng,
      cols,
    );
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const e = x / W + (1 - y / H) * 1.25 + (noise(x, y, 20) - 0.5) * 0.28;
      if (e < 0.72)
        img.set(X(x), y, e > 0.695 ? '#c8703a' : e > 0.66 ? '#3a3560' : e > 0.58 ? mid : dark);
    }
  }
  img.blur(1.4);
  return img;
}

/** Bóng tiếp xúc: tối nhất ở tâm (điểm chạm đất) rồi nhạt dần ra ngoài. */
function isoContact() {
  const W = 48;
  const H = 20;
  const img = new Pixels(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x + 0.5 - W / 2) / (W / 2), (y + 0.5 - H / 2) / (H / 2));
      if (d < 1)
        img.set(x, y, '#030716', Math.pow(1 - d, 1.4) * 1.5 > 1 ? 1 : Math.pow(1 - d, 1.4) * 1.5);
    }
  }
  return img;
}

/** Bóng đổ dài mép mềm (đặt lệch theo hướng sáng). */
function isoShadowLong() {
  const W = 64;
  const H = 24;
  const img = new Pixels(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x + 0.5 - W / 2) / (W / 2), (y + 0.5 - H / 2) / (H / 2));
      if (d < 1) img.set(x, y, '#061230', Math.min(1, (1 - d) * 2) * 0.85);
    }
  }
  return img;
}

// Bão hoà cao để rạn san hô nổi trên nền nước xanh–tím (theo ảnh mẫu 2).
const CORAL_PURPLE = ['#4c1488', '#9c40f0', '#d48cff', '#fbe8ff'];
const CORAL_PINK = ['#880c4c', '#ff2e86', '#ff86bc', '#ffe8f2'];
const CORAL_ORANGE = ['#882c04', '#ff6a12', '#ffa840', '#fff2c8'];

// ---------------------------------------------------------------- ghi file

const ASSETS = {
  water,
  surface,
  air,
  wall,
  room,
  'back-glass': backGlass,
  'glass-streak': glassStreak,
  'glass-bubble': glassBubble,
  'glass-moss': glassMoss,
  'frame-top': frameTop,
  shadow,
  sand,
  distant,
  ruins,
  rocks,
  school,
  'surface-glow': surfaceGlow,
  headlight,
  vignette,
  sunray,
  'caustics-a': () => caustics(81),
  'caustics-b': () => caustics(82),
  glow,
  bubble,
  speck,
  'deco-kelp': decoKelp,
  'deco-weed': decoWeed,
  'deco-coral': decoCoral,
  'deco-tube': decoTube,
  'deco-grass': decoGrass,
  'deco-stones': decoStones,
  'deco-jelly': jelly,
  'deco-glowcoral': glowCoral,
  'deco-anemone': anemone,
  'deco-lamp': seaLamp,
  'deco-kelptall-a': () => kelpTall(201),
  'deco-kelptall-b': () => kelpTall(202),
  'deco-goldkelp-a': () => goldKelp(211),
  'deco-goldkelp-b': () => goldKelp(212),
  'deco-coral-purple': () => branchCoral(221, CORAL_PURPLE),
  'deco-coral-pink': () => branchCoral(222, CORAL_PINK),
  'deco-coral-orange': () => branchCoral(223, CORAL_ORANGE),
  'deco-braincoral': brainCoral,
  'deco-pinkball': pinkBall,
  'deco-seagrass': seaGrass,
  'deco-tubesponge': tubeSponge,
  terrain,
  'reef-rocks': reefRocks,
  'iso-ground': isoGround,
  'iso-caustics': isoCaustics,
  'iso-ray': isoRay,
  'iso-cliff-a': () => isoCliff(531, 260, 153, 82),
  'iso-cliff-b': () => isoCliff(532, 240, 130, 71),
  'iso-cliff-c': () => isoCliff(533, 360, 177, 93),
  'iso-ledge': () => isoCliff(534, 120, 67, 33),
  'iso-cave': isoCave,
  'iso-temple': isoTemple,
  'iso-backwall': isoBackwall,
  'iso-fg-a': () => isoForeground(581, false),
  'iso-fg-b': () => isoForeground(582, true),
  'iso-shadow-long': isoShadowLong,
  'iso-contact': isoContact,
  'iso-rock-a': () => isoRock(511, 58, 46),
  'iso-rock-b': () => isoRock(512, 38, 30),
  'iso-rock-c': () => isoRock(513, 90, 68),
  'deco-tablecoral': tableCoral,
  'deco-seafan': seaFan,
  'deco-seawhip': seaWhip,
  'deco-pillarcoral': pillarCoral,
  'deco-mushroomcoral': mushroomCoral,
  'deco-bubblecoral': bubbleCoral,
  'deco-starpolyps': starPolyps,
  'deco-zoanthids': zoanthids,
  'deco-elkhorn': elkhornCoral,
  'deco-encrustblue': encrustBlue,
  'deco-barrelsponge': barrelSponge,
  'deco-vasesponge': vaseSponge,
  'deco-giantclam': giantClam,
  'deco-starfish': starfish,
  'deco-urchin': seaUrchin,
  'deco-featherduster': featherDuster,
  'deco-christmastree': christmasTree,
  'deco-caulerpa': caulerpa,
  'deco-sealettuce': seaLettuce,
  'fg-floor': fgFloor,
  'fg-kelp': fgKelp,
  haze,
  plankton,
  station,
  'fish-guppy': fishGuppy,
  'fish-neon': fishNeon,
  'fish-angel': fishAngel,
  'trash-bottle': trashBottle,
  'trash-bag': trashBag,
  'trash-can': trashCan,
  'trash-tire': trashTire,
  'drop-coin': dropCoin,
  'drop-pearl': dropPearl,
  'food-pellet': foodPellet,
  ...ROOM_ASSETS,
  ...SHOP_ASSETS,
};

const made = {};
for (const [name, draw] of Object.entries(ASSETS)) {
  const img = draw();
  img.save(path.join(OUT_DIR, `${name}.png`));
  made[name] = img;
  console.log(`${name}.png  ${img.width}×${img.height}`);
}

// Ảnh xem trước các sprite nhỏ, phóng ×4 trên nền nước.
const previewFile = process.argv[2];
if (previewFile) {
  const small = Object.entries(made).filter(([, img]) => img.width <= 48 && img.height <= 64);
  const scale = 4;
  const sheet = new Pixels(1000, 420);
  sheet.rect(0, 0, sheet.width, sheet.height, P.w4);
  let x = 8;
  let y = 8;
  let rowH = 0;
  for (const [, img] of small) {
    const w = img.width * scale;
    const h = img.height * scale;
    if (x + w > sheet.width - 8) {
      x = 8;
      y += rowH + 8;
      rowH = 0;
    }
    sheet.draw(img, x, y, scale);
    x += w + 8;
    rowH = Math.max(rowH, h);
  }
  sheet.save(previewFile);
  console.log(`preview → ${previewFile}`);
}
