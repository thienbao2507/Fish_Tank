// Asset pixel art của căn phòng isometric (spec 17.5). generate.mjs đăng ký các hàm trong ROOM_ASSETS.
// Toạ độ khớp bảng trong src/game/room/layout.ts: lưới sàn 8×8, (gx−gy)×30 và (gx+gy)×15.
import { Pixels, bayer, createRng, ramp } from './lib.mjs';

const SHELL_W = 496;
const SHELL_H = 352;
const OX = 248;
const OY = 104;
const U = 30;
const V = 15;
const WALL_H = 96;
const ROOM = 8;

const C = {
  ink: '#17121f',
  wallDark: '#1f3039',
  wallMid: '#2a404a',
  wallLight: '#365259',
  wallWarm: '#3e5a58',
  trimDark: '#33231d',
  trimMid: '#4a3226',
  trimLight: '#654630',
  rim: '#5a4a56',
  slab: '#2a1d1c',
  woodDark: '#3b271e',
  woodMid: '#5b3b29',
  woodLight: '#7a5236',
  woodHigh: '#9a6d46',
  plankA: '#6a4630',
  plankB: '#6f4a34',
  plankC: '#64422e',
  plankD: '#745039',
  seam: '#3a261f',
  rugEdge: '#b89a6c',
  rugDeep: '#1f3a55',
  rugMid: '#2b5068',
  rugLine: '#d8c28e',
  linen: '#d9cdbb',
  linenShade: '#a99b92',
  teal: '#2f6a68',
  tealDark: '#214c50',
  tan: '#c7a15f',
  black: '#14141c',
  metal: '#3a3f4e',
  metalLight: '#5d6578',
  screenDeep: '#1a2f66',
  screenMid: '#2c62a8',
  screenHigh: '#74c3e6',
  neon: '#62f0e6',
  leaf: '#4f8f3e',
  leafDark: '#2f5f33',
  leafLight: '#86bd52',
  waterDeep: '#1d6b4a',
  waterMid: '#2f9a55',
  waterHigh: '#7fe08a',
  glass: '#b9f2e2',
  gold: '#e7bf5d',
  warm: '#ffb45e',
  green: '#62e08a',
  moon: '#6f8fe0',
};

const inRange = (v, a, b) => v >= a && v < b;
const resolve = (color, ...args) => (typeof color === 'function' ? color(...args) : color);

/** Khung vẽ đặt tại (ox, oy) trong toạ độ ảnh tường+sàn; vẽ các mặt theo toạ độ lưới. */
class Stage {
  constructor(ox, oy, w, h) {
    this.ox = ox;
    this.oy = oy;
    this.p = new Pixels(w, h);
  }

  sx(gx, gy) {
    return OX + (gx - gy) * U - this.ox;
  }

  sy(gx, gy, z = 0) {
    return OY + (gx + gy) * V - z - this.oy;
  }

  put(x, y, color) {
    if (color) this.p.set(x, y, color);
  }

  /** Mặt ngang ở độ cao z. color(gx, gy, x, y). */
  top(gx0, gy0, gx1, gy1, z, color) {
    const left = Math.floor(this.sx(gx0, gy1));
    const right = Math.ceil(this.sx(gx1, gy0));
    const up = Math.floor(this.sy(gx0, gy0, z));
    const down = Math.ceil(this.sy(gx1, gy1, z));
    for (let y = up; y <= down; y++) {
      for (let x = left; x <= right; x++) {
        const dx = x + 0.5 + this.ox - OX;
        const dy = y + 0.5 + this.oy + z - OY;
        const gx = (dx / U + dy / V) / 2;
        const gy = (dy / V - dx / U) / 2;
        if (inRange(gx, gx0, gx1) && inRange(gy, gy0, gy1)) {
          this.put(x, y, resolve(color, gx, gy, x, y));
        }
      }
    }
  }

  /** Mặt đứng tại gy cố định, thấy ở cạnh dưới-trái. color(gx, z, x, y). */
  faceY(gy, gx0, gx1, z0, z1, color) {
    const a = Math.round(this.sx(gx0, gy));
    const b = Math.round(this.sx(gx1, gy));
    for (let x = a; x < b; x++) {
      const gx = gx0 + ((x + 0.5 - a) / (b - a)) * (gx1 - gx0);
      const base = this.sy(gx, gy);
      for (let y = Math.round(base - z1); y < Math.round(base - z0); y++) {
        this.put(x, y, resolve(color, gx, base - y, x, y));
      }
    }
  }

  /** Mặt đứng tại gx cố định, thấy ở cạnh dưới-phải. color(gy, z, x, y). */
  faceX(gx, gy0, gy1, z0, z1, color) {
    const a = Math.round(this.sx(gx, gy1));
    const b = Math.round(this.sx(gx, gy0));
    for (let x = a; x < b; x++) {
      const gy = gy1 - ((x + 0.5 - a) / (b - a)) * (gy1 - gy0);
      const base = this.sy(gx, gy);
      for (let y = Math.round(base - z1); y < Math.round(base - z0); y++) {
        this.put(x, y, resolve(color, gy, base - y, x, y));
      }
    }
  }

  /** Hộp: mặt trên, mặt trái (gy1), mặt phải (gx1) và viền bắt sáng. */
  box(gx0, gy0, gx1, gy1, z0, z1, { top, left, right, edge }) {
    this.faceY(gy1, gx0, gx1, z0, z1, left);
    this.faceX(gx1, gy0, gy1, z0, z1, right);
    this.top(gx0, gy0, gx1, gy1, z1, top);
    if (edge) {
      const corner = (gx, gy) => [Math.round(this.sx(gx, gy)), Math.round(this.sy(gx, gy, z1))];
      const [ax, ay] = corner(gx0, gy1);
      const [bx, by] = corner(gx1, gy1);
      const [cx, cy] = corner(gx1, gy0);
      this.p.line(ax, ay, bx, by, edge);
      this.p.line(bx, by, cx, cy, edge);
    }
  }
}

/** Phủ quầng sáng theo bậc lên các pixel đã có màu (giữ ảnh đặc). */
function glow(p, cx, cy, rx, ry, color, strength) {
  for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(p.height, cy + ry); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(p.width, cx + rx); x++) {
      if (p.alphaAt(x, y) === 0) continue;
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) continue;
      const a = Math.round((1 - d) * (1 - d) * 6 + bayer(x, y) * 0.9) / 6;
      if (a > 0) p.set(x, y, color, a * strength);
    }
  }
}

function floorColor(gx, gy, x, y) {
  const row = Math.floor(gy / 0.5);
  const local = gy / 0.5 - row;
  if (local < 0.09) return C.seam;
  const offset = (row * 0.73) % 2;
  if ((gx + offset) % 2 < 0.05) return C.seam;
  const piece = Math.floor((gx + offset) / 2);
  const tones = [C.plankA, C.plankB, C.plankC, C.plankD];
  const tone = tones[Math.abs(row * 7 + piece * 13) % 4];
  const grain = Math.sin(gx * 9 + row * 2.1) + Math.sin(gx * 23 + row);
  if (grain > 1.5 && bayer(x, y) > 0.35) return C.plankC;
  return tone;
}

function rugColor(gx, gy, x, y) {
  const x0 = 2.9;
  const y0 = 2.9;
  const x1 = 6.3;
  const y1 = 6.5;
  const edge = Math.min(gx - x0, x1 - gx, gy - y0, y1 - gy);
  if (edge < 0.08) return C.rugEdge;
  if (edge < 0.16) return C.rugDeep;
  if (edge < 0.22) return C.rugLine;
  const flow = Math.sin(gx * 2.6 + Math.sin(gy * 1.9) * 1.4);
  if (Math.abs(flow - 0.55) < 0.07) return C.rugLine;
  const star = Math.sin(gx * 17.3) * Math.sin(gy * 13.1);
  if (star > 0.985) return C.rugLine;
  return ramp([C.rugDeep, C.rugMid], flow * 0.5 + 0.5, x, y);
}

function wallColor(lit) {
  return (along, z, x, y) => {
    if (z >= 93) return C.trimLight;
    if (z < 3) return C.trimDark;
    if (z < 20) {
      if (z >= 18) return C.trimLight;
      return Math.floor(along * 3) % 2 === 0 && (along * 3) % 1 < 0.12 ? C.trimDark : C.trimMid;
    }
    const stripe = (along * 4) % 1 < 0.08;
    const stops = lit
      ? [C.wallDark, C.wallMid, C.wallLight]
      : [C.wallDark, C.wallDark, C.wallMid];
    const color = ramp(stops, (z - 20) / 76, x, y);
    return stripe && bayer(x, y) > 0.5 ? C.wallDark : color;
  };
}

function hangingPlant(stage, rng, onWall, along, topZ, length) {
  for (let i = 0; i < length; i++) {
    const a = along + Math.sin(i * 0.6) * 0.05;
    const z = topZ - i * 3;
    const [x, y] = onWall(a, z);
    stage.put(x, y, C.leafDark);
    if (i % 2 === 0) {
      const side = rng.chance(0.5) ? 1 : -1;
      stage.p.rect(x + side, y, 2, 2, rng.pick([C.leaf, C.leafLight, C.leafDark]));
    }
  }
}

export function roomShell() {
  const s = new Stage(0, 0, SHELL_W, SHELL_H);
  const rng = createRng(1709);
  const onLeft = (gy, z) => [Math.round(s.sx(0, gy)), Math.round(s.sy(0, gy, z))];
  const onRight = (gx, z) => [Math.round(s.sx(gx, 0)), Math.round(s.sy(gx, 0, z))];

  // Tường trái (gx = 0), tường phải (gy = 0), viền trên.
  s.faceX(0, 0, ROOM, 0, WALL_H, wallColor(false));
  s.faceY(0, 0, ROOM, 0, WALL_H, wallColor(true));
  s.faceX(0, 0, ROOM, WALL_H, WALL_H + 3, C.rim);
  s.faceY(0, 0, ROOM, WALL_H, WALL_H + 3, C.rim);

  // Sàn gỗ, tấm thảm, thảm chùi chân, bệ sàn.
  s.top(0, 0, ROOM, ROOM, 0, floorColor);
  s.top(2.9, 2.9, 6.3, 6.5, 0, rugColor);
  s.top(6.6, 0.2, 7.8, 1.1, 0, (gx, gy) => {
    const edge = Math.min(gx - 6.6, 7.8 - gx, gy - 0.2, 1.1 - gy);
    return edge < 0.08 ? C.trimMid : Math.floor(gx * 8) % 2 === 0 ? C.linenShade : '#8c8078';
  });
  s.faceY(ROOM, 0, ROOM, -8, 0, C.slab);
  s.faceX(ROOM, 0, ROOM, -8, 0, '#211617');

  // Bóng tiếp đất dọc chân tường.
  s.top(0, 0, ROOM, 0.35, 0, (gx, gy, x, y) => (bayer(x, y) > 0.55 + gy ? C.seam : null));
  s.top(0, 0, 0.35, ROOM, 0, (gx, gy, x, y) => (bayer(x, y) > 0.55 + gx ? C.seam : null));

  // Kệ và sách trên tường phải, phía trên bàn PC.
  s.faceY(0, 0.6, 2.9, 80, 83, C.woodLight);
  const bookColors = ['#a8493f', '#d0a24f', '#3e6f8f', '#6c5a9a', '#3f8a6f', '#c9c0ae'];
  for (let gx = 0.7; gx < 2.75; ) {
    const width = rng.range(0.07, 0.13);
    const high = rng.int(83 + 6, 83 + 11);
    if (rng.chance(0.85)) s.faceY(0, gx, gx + width, 83, high, rng.pick(bookColors));
    gx += width + 0.012;
  }

  // Tranh tự vẽ: đại dương lúc hoàng hôn trên tường phải.
  s.faceY(0, 4.15, 5.55, 77, 94, C.woodLight);
  s.faceY(0, 4.2, 5.5, 79, 92, (gx, z, x, y) => {
    if (z < 83 + Math.sin(gx * 9) * 0.8) return C.rugMid;
    return ramp(['#f0a35e', '#c56a7d', '#4b4f8f'], (z - 83) / 9, x, y);
  });

  // Tranh và mảnh ghi chú trên tường trái.
  s.faceX(0, 5.35, 6.75, 52, 76, C.woodLight);
  s.faceX(0, 5.4, 6.7, 54, 74, (gy, z, x, y) => {
    const peak = 60 + Math.abs(Math.sin(gy * 4.4)) * 8;
    return z < peak ? C.tealDark : ramp(['#d98a5b', '#6e5a8d', '#2d3560'], (z - 60) / 14, x, y);
  });
  for (const [gy, z, w, color] of [
    [0.55, 54, 0.34, '#d9cdbb'],
    [1.0, 62, 0.28, '#c7a15f'],
    [0.5, 72, 0.4, '#8fb0a8'],
    [4.75, 42, 0.32, '#d9cdbb'],
  ]) {
    s.faceX(0, gy, gy + w, z, z + 12, color);
  }

  // Đèn tường có quầng ấm, cây rủ.
  const sconces = [
    [onLeft(4.9, 78), glowSconce],
    [onRight(3.25, 86), glowSconce],
    [onRight(6.3, 80), glowSconce],
  ];
  for (const [[x, y], paint] of sconces) paint(s, x, y);

  hangingPlant(s, rng, onLeft, 1.32, 95, 13);
  hangingPlant(s, rng, onLeft, 4.55, 95, 9);
  hangingPlant(s, rng, onRight, 0.32, 95, 11);
  hangingPlant(s, rng, onRight, 6.05, 95, 8);

  // Ánh sáng nướng vào ảnh: đèn ấm, hồ cá xanh, trăng qua cửa sổ.
  glow(s.p, onLeft(4.9, 78)[0], onLeft(4.9, 78)[1], 62, 50, C.warm, 0.34);
  glow(s.p, onRight(3.25, 86)[0], onRight(3.25, 86)[1], 52, 38, C.warm, 0.26);
  glow(s.p, onRight(6.3, 80)[0], onRight(6.3, 80)[1], 54, 44, C.warm, 0.3);
  glow(s.p, s.sx(1.3, 6.1), s.sy(1.3, 6.1), 118, 58, C.warm, 0.18);
  glow(s.p, s.sx(4.9, 1.9), s.sy(4.9, 1.9), 96, 48, C.green, 0.3);
  glow(s.p, s.sx(1.75, 1.6), s.sy(1.75, 1.6), 70, 36, C.neon, 0.16);
  glow(s.p, s.sx(1.7, 3.2), s.sy(1.7, 3.2), 74, 34, C.moon, 0.26);
  return s.p;
}

function glowSconce(stage, x, y) {
  stage.p.rect(x - 2, y - 2, 5, 3, C.metal);
  stage.p.rect(x - 1, y + 1, 3, 2, C.warm);
  stage.p.rect(x, y + 3, 1, 1, '#ffe2a8');
}

export function roomWindow() {
  const s = new Stage(116, 42, 84, 94);
  const rng = createRng(2203);
  const gy0 = 1.6;
  const gy1 = 4.4;
  const skyline = [];
  for (let i = 0; i < 16; i++) skyline.push({ height: rng.range(9, 25), lit: rng.next() });

  s.faceX(0, gy0, gy1, 34, 86, (gy, z, x, y) => {
    const edge = Math.min(gy - gy0, gy1 - gy);
    if (edge < 0.1 || z < 37 || z >= 83) return z >= 83 || edge < 0.05 ? C.woodMid : C.woodLight;
    const pane = Math.abs(gy - 3) < 0.04 || Math.abs(z - 60) < 1;
    if (pane) return C.woodMid;
    if (z > 72 && Math.floor(z) % 3 === 0) return C.woodDark;
    if (z > 72) return C.woodLight;
    const tower = skyline[Math.min(15, Math.floor(((gy - gy0) / (gy1 - gy0)) * 16))];
    const horizon = 37 + tower.height;
    if (z < horizon) {
      const windowLit =
        Math.floor(x / 3) % 2 === 0 &&
        Math.floor(y / 4) % 2 === 0 &&
        Math.sin(x * 7.1 + y * 3.3 + tower.lit * 9) > 0.1;
      return windowLit ? C.warm : '#1b2038';
    }
    if (Math.sin(x * 12.9898 + y * 78.233) > 0.992) return '#f2ecd5';
    return ramp(['#54508f', '#2c3a78', '#172452'], (z - 37) / 35, x, y);
  });
  return s.p;
}

export function roomDoor() {
  const s = new Stage(449, 128, 30, 92);
  const gx0 = 6.7;
  const gx1 = 7.7;
  s.faceY(0, gx0, gx1, 0, 76, (gx, z, x, y) => {
    const edge = Math.min(gx - gx0, gx1 - gx);
    if (edge < 0.07 || z >= 73) return C.woodDark;
    const inner = Math.min(gx - gx0 - 0.17, gx1 - gx - 0.17);
    const panel = inner > 0 && (inRange(z, 10, 34) || inRange(z, 41, 67));
    if (panel) return ramp([C.woodMid, C.woodLight], (z % 30) / 30, x, y);
    return C.woodHigh;
  });
  const hx = Math.round(s.sx(7.54, 0));
  const hy = Math.round(s.sy(7.54, 0, 36));
  s.p.rect(hx - 1, hy, 4, 2, C.gold);
  s.p.rect(hx - 1, hy + 2, 1, 1, '#a07f3a');
  return s.p;
}

export function roomDesk() {
  const s = new Stage(218, 41, 120, 131);
  const rng = createRng(4109);
  const wood = {
    top: (gx, gy, x, y) => (bayer(x, y) > 0.8 ? C.woodMid : C.woodLight),
    left: C.woodMid,
    right: C.woodDark,
    edge: C.woodHigh,
  };

  // Thân máy phát sáng ở sau bàn, ngăn kéo, chân bàn.
  s.box(0.56, 0.1, 0.98, 0.72, 0, 36, {
    top: C.metal,
    left: (gx, z, x, y) => {
      const ring = Math.hypot(gx - 0.77, (z - 20) / 26);
      if (ring > 0.13 && ring < 0.19) return C.neon;
      return bayer(x, y) > 0.7 ? C.metal : C.black;
    },
    right: C.black,
    edge: C.metalLight,
  });
  s.box(2.3, 0.08, 2.95, 0.85, 0, 20, {
    top: C.woodLight,
    left: (gx, z) => (Math.abs(z - 7) < 0.8 || Math.abs(z - 14) < 0.8 ? C.woodDark : C.woodMid),
    right: C.woodDark,
  });
  s.box(1.1, 0.72, 1.2, 0.85, 0, 20, { top: C.woodDark, left: C.woodMid, right: C.woodDark });

  // Mặt bàn.
  s.box(0.95, 0, 3, 0.9, 20, 24, wood);

  // Hai màn hình: tranh cá bơi tự vẽ, cửa sổ làm việc.
  s.box(1.5, 0.32, 1.62, 0.44, 24, 34, { top: C.metal, left: C.metal, right: C.black });
  s.faceY(0.42, 1.04, 2.14, 33, 63, (gx, z, x, y) => {
    const edge = Math.min(gx - 1.04, 2.14 - gx, (z - 33) / 28, (63 - z) / 28);
    if (edge < 0.05) return C.black;
    const wave = 43 + Math.sin(gx * 15) * 2;
    if (z < wave) return ramp([C.screenDeep, C.screenMid], (z - 33) / 10, x, y);
    return ramp([C.screenMid, C.screenHigh, '#f0b98a'], (z - wave) / 18, x, y);
  });
  const fishX = Math.round(s.sx(1.55, 0.42));
  const fishY = Math.round(s.sy(1.55, 0.42, 42));
  s.p.rect(fishX, fishY, 5, 3, C.warm);
  s.p.rect(fishX + 5, fishY + 1, 2, 2, C.gold);
  s.box(2.42, 0.3, 2.5, 0.38, 24, 34, { top: C.metal, left: C.metal, right: C.black });
  s.faceY(0.36, 2.2, 2.82, 33, 59, (gx, z) => {
    const edge = Math.min(gx - 2.2, 2.82 - gx, (z - 33) / 26, (59 - z) / 26);
    if (edge < 0.05) return C.black;
    const row = Math.floor(z / 4);
    if (row % 2 === 0 && (gx * 11 + row) % 1 > 0.25) return C.screenHigh;
    return C.screenDeep;
  });

  // Bàn phím, chuột, cốc, cây nhỏ.
  s.top(1.25, 0.55, 2.0, 0.8, 24, (gx, gy) =>
    (Math.floor(gx * 18) + Math.floor(gy * 22)) % 2 === 0 ? C.screenHigh : C.metal,
  );
  s.top(2.1, 0.62, 2.2, 0.76, 24, C.metalLight);
  s.box(1.02, 0.55, 1.14, 0.67, 24, 31, { top: '#2a1d1c', left: C.linen, right: C.linenShade });
  s.box(0.97, 0.08, 1.17, 0.28, 24, 33, { top: C.woodDark, left: '#a8603f', right: '#7d452f' });
  for (let i = 0; i < 26; i++) {
    const x = Math.round(s.sx(1.07, 0.18)) + rng.int(-7, 7);
    const y = Math.round(s.sy(1.07, 0.18, 34)) - rng.int(0, 15);
    s.p.rect(x, y, 2, 2, rng.pick([C.leaf, C.leafLight, C.leafDark]));
  }

  // Ghế xoay ở phía trước bàn.
  s.box(1.48, 1.12, 1.56, 1.2, 4, 15, { top: C.metal, left: C.metalLight, right: C.metal });
  s.top(1.22, 0.98, 1.82, 1.42, 2, (gx, gy) =>
    Math.abs(gx - 1.52) < 0.05 || Math.abs(gy - 1.2) < 0.05 ? C.metal : null,
  );
  s.box(1.24, 1.0, 1.8, 1.4, 15, 19, { top: '#374256', left: C.black, right: C.black, edge: C.metalLight });
  s.box(1.26, 1.3, 1.78, 1.4, 19, 44, {
    top: C.metalLight,
    left: (gx, z, x, y) => (bayer(x, y) > 0.6 ? C.metal : '#28303f'),
    right: C.black,
    edge: C.metalLight,
  });

  glow(s.p, s.sx(1.6, 0.42), s.sy(1.6, 0.42, 48), 34, 28, C.screenHigh, 0.15);
  return s.p;
}

export function roomTank() {
  const s = new Stage(320, 82, 114, 132);
  const rng = createRng(5333);
  const gx0 = 3.5;
  const gx1 = 6.2;
  const gy1 = 1.1;

  // Tủ gỗ.
  s.box(gx0, 0, gx1, gy1, 0, 30, {
    top: C.woodLight,
    left: (gx, z, x, y) => {
      const door = Math.abs(gx - 4.85) < 0.03 || z < 3 || z > 27 || gx < 3.56 || gx > 6.14;
      if (door) return C.woodDark;
      return bayer(x, y) > 0.86 ? C.woodLight : C.woodMid;
    },
    right: C.woodDark,
    edge: C.woodHigh,
  });

  // Khối nước, kính trước có cảnh thuỷ sinh.
  const front = (gx, z, x, y) => {
    const t = (z - 32) / 34;
    if (z > 66) return C.glass;
    const bed = 34 + Math.sin(gx * 5) * 1.5;
    if (z < bed) return '#7a6a43';
    const rollingHill = 40 + Math.sin(gx * 2.4 + 1) * 8;
    if (z < rollingHill) return bayer(x, y) > 0.5 ? C.leaf : C.leafDark;
    return ramp([C.waterDeep, C.waterMid, C.waterHigh], t, x, y);
  };
  s.faceY(gy1, gx0, gx1, 30, 68, front);
  s.faceX(gx1, 0, gy1, 30, 68, (gy, z, x, y) =>
    z > 66 ? C.glass : ramp([C.waterDeep, C.waterMid], (z - 30) / 36, x, y),
  );
  s.top(gx0, 0, gx1, gy1, 68, (gx, gy, x, y) => {
    const ripple = Math.sin(gx * 8 + Math.sin(gy * 7) * 2);
    if (ripple > 0.86) return C.waterMid;
    return bayer(x, y) > 0.7 ? '#237a50' : C.waterDeep;
  });

  // Cây thuỷ sinh và cá trên kính trước.
  const onFront = (gx, z) => [Math.round(s.sx(gx, gy1)), Math.round(s.sy(gx, gy1, z))];
  for (let i = 0; i < 26; i++) {
    const gx = rng.range(gx0 + 0.1, gx1 - 0.1);
    const height = rng.int(8, 25);
    const color = rng.pick([C.leaf, C.leafLight, C.leafDark, '#3e9a5a']);
    const sway = rng.range(0, 6);
    for (let k = 0; k < height; k++) {
      const [x, y] = onFront(gx, 36 + k);
      const dx = Math.round(Math.sin(k * 0.35 + sway) * 1.5);
      s.p.rect(x + dx, y, 2, 1, color);
    }
  }
  const fish = [
    [4.2, 58, '#ffb45e'],
    [4.9, 51, '#62d8f0'],
    [5.5, 60, '#f0e0a0'],
    [5.75, 49, '#62d8f0'],
    [3.95, 47, '#ff8f6b'],
  ];
  for (const [gx, z, color] of fish) {
    const [x, y] = onFront(gx, z);
    s.p.rect(x, y, 4, 2, color);
    s.p.rect(x - 1, y - 1, 1, 4, color);
    s.p.set(x + 3, y, C.ink);
  }

  // Khung kính và đèn máng.
  for (const [a, b, c, d] of [
    [gx0, gy1, gx1, gy1],
    [gx1, gy1, gx1, 0],
  ]) {
    s.p.line(
      Math.round(s.sx(a, b)),
      Math.round(s.sy(a, b, 68)),
      Math.round(s.sx(c, d)),
      Math.round(s.sy(c, d, 68)),
      C.glass,
    );
  }
  for (const gx of [gx0, gx1]) {
    const x = Math.round(s.sx(gx, gy1));
    const yTop = Math.round(s.sy(gx, gy1, 68));
    for (let y = yTop; y < yTop + 38; y++) s.p.set(x, y, C.glass);
  }
  s.box(3.8, 0.42, 5.9, 0.68, 71, 74, { top: C.metalLight, left: C.black, right: C.black, edge: C.metal });
  s.top(3.8, 0.42, 5.9, 0.68, 70, null);
  glow(s.p, s.sx(4.85, 1.1), s.sy(4.85, 1.1, 50), 62, 42, C.green, 0.16);
  return s.p;
}

export function roomBed() {
  const s = new Stage(32, 135, 162, 125);
  const gy0 = 5;
  const gy1 = 7.2;
  const gx1 = 3.2;

  const plaid = (a, b, x, y) => {
    const lineA = (a * 3.2) % 1 < 0.14;
    const lineB = (b * 3.2) % 1 < 0.14;
    if (lineA && lineB) return C.tan;
    if (lineA || lineB) return bayer(x, y) > 0.45 ? C.tan : C.teal;
    return C.teal;
  };

  // Đầu giường đặt sát tường, vẽ trước vì nằm sau gối.
  s.box(0, gy0, 0.14, gy1, 0, 44, {
    top: C.woodHigh,
    left: C.woodDark,
    right: (gy, z, x, y) => (bayer(x, y) > 0.84 ? C.woodLight : C.woodMid),
    edge: C.woodHigh,
  });

  // Khung, nệm, chăn kẻ.
  s.box(0.05, gy0, gx1, gy1, 0, 12, {
    top: C.woodLight,
    left: C.woodDark,
    right: C.woodDark,
    edge: C.woodHigh,
  });
  s.box(0.1, gy0 + 0.06, gx1 - 0.08, gy1 - 0.06, 12, 22, {
    top: C.linen,
    left: C.linenShade,
    right: C.linenShade,
  });
  s.box(1.08, gy0 + 0.02, gx1 - 0.03, gy1 - 0.02, 12, 25, {
    top: (gx, gy, x, y) => plaid(gx, gy, x, y),
    left: (gx, z, x, y) => (z < 15 ? C.tealDark : plaid(gx, z / 30, x, y)),
    right: (gy, z, x, y) => (z < 15 ? C.tealDark : plaid(gy, z / 30, x, y)),
    edge: '#4e8e86',
  });
  s.box(1.08, gy0 + 0.02, 1.5, gy1 - 0.02, 25, 28, {
    top: (gx, gy, x, y) => (bayer(x, y) > 0.82 ? C.linenShade : C.linen),
    left: C.linenShade,
    right: C.linenShade,
    edge: '#efe6d6',
  });

  // Hai gối và thú bông cá tròn tự thiết kế.
  const pillow = { top: '#efe6d6', left: C.linenShade, right: '#c4b6aa', edge: '#fff6e8' };
  s.box(0.24, 5.2, 0.92, 6.02, 22, 29, pillow);
  s.box(0.24, 6.18, 0.92, 7.0, 22, 29, pillow);
  const px = Math.round(s.sx(0.7, 6.1));
  const py = Math.round(s.sy(0.7, 6.1, 31));
  s.p.ellipse(px, py - 4, 7, 6, '#f0a24f');
  s.p.ellipse(px, py - 2, 5, 3, '#ffd28a');
  s.p.rect(px - 11, py - 7, 4, 7, '#d9803f');
  s.p.rect(px + 3, py - 7, 2, 2, C.ink);
  s.p.rect(px - 3, py - 7, 2, 2, C.ink);

  // Cuốn sách mở trên chăn.
  s.top(2.1, 5.72, 2.62, 6.42, 25, (gx, gy) => {
    if (Math.abs(gy - 6.07) < 0.03) return C.linenShade;
    return Math.floor(gx * 22) % 3 === 0 ? '#9c9286' : '#f3ecdd';
  });
  return s.p;
}

const FRAME_W = 24;
const FRAME_H = 40;

function drawHero(p, ox, oy, frame, back) {
  const skin = '#f0c29d';
  const skinShade = '#d39a7a';
  const hair = '#3b2a3a';
  const hairHigh = '#5e4258';
  const hoodie = '#d9963f';
  const hoodieShade = '#a96a2b';
  const pants = '#2e4266';
  const pantsShade = '#233352';
  const shoe = '#e9e2d4';

  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const stepA = frame === 1 ? 2 : frame === 3 ? -1 : 0;
  const stepB = frame === 3 ? 2 : frame === 1 ? -1 : 0;
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;

  const rect = (x, y, w, h, color) => p.rect(ox + x, oy + y, w, h, color);

  // Chân, giày.
  rect(8 + stepB, 30, 3, 6, pantsShade);
  rect(8 + stepB, 36, 4, 2, shoe);
  rect(13 + stepA, 30, 3, 6, pants);
  rect(13 + stepA, 36, 4, 2, shoe);

  // Thân áo, tay.
  rect(7, 20 + bob, 10, 11, hoodie);
  rect(7, 28 + bob, 10, 3, hoodieShade);
  rect(5, 21 + bob + swing, 3, 8, hoodieShade);
  rect(5, 29 + bob + swing, 3, 2, skin);
  rect(16, 21 + bob - swing, 3, 8, hoodie);
  rect(16, 29 + bob - swing, 3, 2, skin);
  if (!back) {
    rect(11, 22 + bob, 5, 1, '#f0d9a8');
    rect(13, 23 + bob, 1, 3, '#f0d9a8');
  } else {
    rect(8, 20 + bob, 8, 4, hoodieShade);
  }

  // Đầu to kiểu chibi.
  rect(7, 7 + bob, 11, 14, skin);
  rect(6, 9 + bob, 13, 10, skin);
  if (back) {
    rect(6, 7 + bob, 13, 12, hair);
    rect(7, 5 + bob, 11, 2, hair);
    rect(8, 19 + bob, 9, 2, hair);
    rect(9, 6 + bob, 6, 2, hairHigh);
    rect(16, 10 + bob, 2, 6, hairHigh);
  } else {
    rect(6, 7 + bob, 13, 5, hair);
    rect(7, 5 + bob, 11, 2, hair);
    rect(6, 12 + bob, 4, 5, hair);
    rect(9, 6 + bob, 5, 2, hairHigh);
    rect(17, 11 + bob, 2, 2, hair);
    rect(11, 13 + bob, 2, 3, C.ink);
    rect(16, 13 + bob, 2, 3, C.ink);
    rect(10, 17 + bob, 2, 1, '#e8947f');
    rect(17, 17 + bob, 1, 1, '#e8947f');
    rect(13, 18 + bob, 3, 1, skinShade);
  }
}

export function roomHero() {
  const sheet = new Pixels(FRAME_W * 4, FRAME_H * 2);
  for (let row = 0; row < 2; row++) {
    for (let frame = 0; frame < 4; frame++) {
      drawHero(sheet, frame * FRAME_W, row * FRAME_H, frame, row === 1);
    }
  }
  sheet.outline(C.ink);

  // Bóng đổ dạng chấm ở dưới chân, chỉ vào chỗ trống.
  for (let row = 0; row < 2; row++) {
    for (let frame = 0; frame < 4; frame++) {
      const cx = frame * FRAME_W + 12;
      const cy = row * FRAME_H + 38;
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (let x = cx - 7; x <= cx + 7; x++) {
          const inside = Math.hypot((x - cx) / 7.5, (y - cy) / 1.8) < 1;
          if (inside && sheet.alphaAt(x, y) === 0 && (x + y) % 2 === 0) sheet.set(x, y, C.ink);
        }
      }
    }
  }
  return sheet;
}

export const ROOM_ASSETS = {
  'room-shell': roomShell,
  'room-window': roomWindow,
  'room-door': roomDoor,
  'room-desk': roomDesk,
  'room-tank': roomTank,
  'room-bed': roomBed,
  'room-hero': roomHero,
};
