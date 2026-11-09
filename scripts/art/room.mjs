// Asset pixel art của căn phòng isometric (spec 17.5). generate.mjs đăng ký các hàm trong ROOM_ASSETS.
// Toạ độ khớp bảng trong src/game/room/layout.ts: lưới sàn 8×8, (gx−gy)×30 và (gx+gy)×15.
import { Pixels, bayer, createRng, hexToRgb, mixHex, ramp } from './lib.mjs';

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

/** Bóng tiếp xúc trên sàn quanh một chân đế, mờ dần theo khoảng cách lưới. */
function contactShadow(s, x0, y0, x1, y1, spread = 0.42, strength = 0.58) {
  const clamp = (v) => Math.max(0, Math.min(ROOM, v));
  s.top(clamp(x0 - spread), clamp(y0 - spread), clamp(x1 + spread), clamp(y1 + spread), 0, (gx, gy, x, y) => {
    const dx = Math.max(x0 - gx, 0, gx - x1);
    const dy = Math.max(y0 - gy, 0, gy - y1);
    const d = Math.hypot(dx, dy);
    if (d >= spread) return null;
    const t = 1 - d / spread;
    const level = Math.round(t * t * 5 + bayer(x, y) * 0.7) / 5;
    if (level > 0) s.p.set(x, y, '#0d0914', level * strength);
    return null;
  });
}

/** Tối dần phần tường ngay sau một món đồ (ambient occlusion). */
function wallShade(s, side, a0, a1, height, strength = 0.32) {
  const pad = 0.22;
  const shade = (along, z, x, y) => {
    const edge = Math.min((along - (a0 - pad)) / pad, (a1 + pad - along) / pad, (height + 8 - z) / 12, 1);
    if (edge <= 0) return null;
    const level = Math.round(edge * 4 + bayer(x, y) * 0.6) / 4;
    if (level > 0) s.p.set(x, y, '#0d0914', level * strength);
    return null;
  };
  const from = Math.max(0, a0 - pad);
  const to = Math.min(ROOM, a1 + pad);
  if (side === 'left') s.faceX(0, from, to, 0, height + 8, shade);
  else s.faceY(0, from, to, 0, height + 8, shade);
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

  // Bóng tiếp xúc và tối góc phòng.
  for (const [x0, y0, x1, y1, spread, strength] of [
    [0.5, 0.08, 1.1, 0.74],
    [2.3, 0.08, 2.95, 0.85],
    [1.12, 0, 3, 0.9, 0.16, 0.5],
    [1.72, 1.02, 2.26, 1.38, 0.2, 0.4],
    [3.5, 0, 6.2, 1.1, 0.5],
    [0, 5, 3.2, 7.2, 0.5],
    [0, 4.25, 0.7, 4.95, 0.34],
    [0.02, 0.1, 0.48, 1.3, 0.34],
    [0.15, 7.45, 0.55, 7.85, 0.32],
  ]) {
    contactShadow(s, x0, y0, x1, y1, spread, strength);
  }
  wallShade(s, 'right', 0.5, 3, 62);
  wallShade(s, 'right', 3.5, 6.2, 72);
  wallShade(s, 'left', 5, 7.2, 44);
  wallShade(s, 'left', 4.25, 4.95, 28);
  wallShade(s, 'left', 0.1, 1.3, 78);
  for (const [color, face] of [
    ['#0d0914', (fn) => s.faceX(0, 0, 0.5, 0, WALL_H, fn)],
    ['#0d0914', (fn) => s.faceY(0, 0, 0.5, 0, WALL_H, fn)],
  ]) {
    face((along, z, x, y) => {
      const level = Math.round((1 - along / 0.5) * 3 + bayer(x, y) * 0.6) / 3;
      if (level > 0) s.p.set(x, y, color, level * 0.3);
      return null;
    });
  }

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
  // Bảng các pha trăng tự vẽ phía cuối tường trái.
  s.faceX(0, 7.0, 7.72, 60, 92, C.woodLight);
  s.faceX(0, 7.04, 7.68, 62, 90, '#17203a');
  for (let i = 0; i < 4; i++) {
    const [mx, my] = onLeft(7.36, 66 + i * 7);
    s.p.ellipse(mx, my, 3, 3, '#e8e0c4');
    if (i < 3) s.p.ellipse(mx + 1 + i, my, 3 - i * 0.6, 3, '#17203a');
  }
  for (const [gy, z, w, color] of [
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
  // Tối nền một chút để ba lớp sáng rời (PC, hồ cá, đèn ngủ) nổi lên; chỉ giữ đèn tường và ánh trăng.
  s.p.recolor((x, y, color) => mixHex(color, '#100c1c', 0.24));
  glow(s.p, onLeft(4.9, 78)[0], onLeft(4.9, 78)[1], 34, 28, C.warm, 0.2);
  glow(s.p, onRight(6.3, 80)[0], onRight(6.3, 80)[1], 40, 32, C.warm, 0.2);
  glow(s.p, s.sx(1.7, 3.2), s.sy(1.7, 3.2), 74, 34, C.moon, 0.2);
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
  const top = 66;
  s.faceY(0, gx0, gx1, 0, top, (gx, z, x, y) => {
    const edge = Math.min(gx - gx0, gx1 - gx);
    if (edge < 0.07 || z >= top - 3) return C.woodDark;
    const inner = Math.min(gx - gx0 - 0.17, gx1 - gx - 0.17);
    const panel = inner > 0 && (inRange(z, 9, 29) || inRange(z, 35, 58));
    if (panel) return ramp([C.woodMid, C.woodLight], (z % 26) / 26, x, y);
    return Math.sin(z * 0.9 + gx * 2) > 0.92 ? C.woodLight : C.woodHigh;
  });
  const hx = Math.round(s.sx(7.54, 0));
  const hy = Math.round(s.sy(7.54, 0, 31));
  s.p.rect(hx - 1, hy, 4, 2, C.gold);
  s.p.rect(hx - 1, hy + 2, 1, 1, '#a07f3a');
  // Túi vải treo sau cửa.
  s.faceY(0, 6.92, 7.24, 36, 50, (gx, z) => (Math.abs(gx - 7.08) < 0.05 && z > 42 && z < 46 ? C.teal : C.linen));
  s.faceY(0, 6.98, 7.04, 50, 57, C.linenShade);
  s.faceY(0, 7.12, 7.18, 50, 57, C.linenShade);
  return s.p;
}

const RGB = ['#ff5ccf', '#b86bff', '#58a6ff', '#62f0e6'];

/** Một quạt RGB trên mặt kính của case; (px, pz) là toạ độ trên mặt, (cx, cz) là tâm quạt. */
function fanPixel(px, pz, cx, cz) {
  const d = Math.hypot(px - cx, pz - cz);
  if (d > 6.6) return null;
  const angle = Math.atan2(pz - cz, px - cx) + Math.PI;
  if (d >= 5) return RGB[Math.floor((angle / (Math.PI * 2)) * RGB.length) % RGB.length];
  if (d < 1.6) return C.metalLight;
  return Math.floor((angle / (Math.PI * 2)) * 6 + d * 0.4) % 2 === 0 ? '#2b3350' : '#171b2a';
}

/** Dòng code giả: mỗi hàng một mảng đoạn [bắt đầu, độ dài, màu], tính theo 0..1 chiều ngang. */
function codeRows(rng, count) {
  const tokens = ['#c792ea', '#82aaff', '#c3e88d', '#ffcb6b', '#89ddff', '#d6deeb'];
  const rows = [];
  let indent = 0;
  for (let i = 0; i < count; i++) {
    if (rng.chance(0.14)) {
      rows.push([]);
      continue;
    }
    indent = Math.max(0, Math.min(3, indent + rng.int(-1, 1)));
    const row = [];
    let at = 0.16 + indent * 0.07;
    while (at < 0.92 && rng.next() > row.length * 0.14) {
      const len = rng.range(0.07, 0.2);
      row.push([at, len, rng.pick(tokens)]);
      at += len + 0.03;
    }
    rows.push(row);
  }
  return rows;
}

export function roomDesk() {
  const s = new Stage(218, 24, 120, 148);
  const rng = createRng(4109);
  const wood = {
    top: (gx, gy, x, y) => (bayer(x, y) > 0.8 ? C.woodMid : C.woodLight),
    left: C.woodMid,
    right: C.woodDark,
    edge: C.woodHigh,
  };

  // Case kính: mặt trái thấy linh kiện và hai quạt RGB.
  s.box(0.5, 0.08, 1.1, 0.74, 0, 48, {
    top: (gx, gy) => (Math.floor(gx * 14) + Math.floor(gy * 14)) % 2 === 0 ? C.metal : C.black,
    left: (gx, z) => {
      const px = (gx - 0.5) * 30;
      if (px < 1 || px > 17 || z < 2 || z > 46) return C.metalLight;
      const fan = fanPixel(px, z, 9, 12) ?? fanPixel(px, z, 9, 35);
      if (fan) return fan;
      if (z > 21 && z < 26) return z > 24 ? C.neon : C.metal;
      return '#10131c';
    },
    right: (gy, z) => (Math.floor(z / 3) % 2 === 0 ? C.black : C.metal),
    edge: C.metalLight,
  });

  // Tủ ngăn kéo, chân bàn, mặt bàn, LED dưới bàn.
  s.box(2.3, 0.08, 2.95, 0.85, 0, 20, {
    top: C.woodLight,
    left: (gx, z) => (Math.abs(z - 7) < 0.8 || Math.abs(z - 14) < 0.8 ? C.woodDark : C.woodMid),
    right: C.woodDark,
  });
  s.box(1.16, 0.72, 1.26, 0.85, 0, 20, { top: C.woodDark, left: C.metal, right: C.black });
  s.box(1.12, 0, 3, 0.9, 20, 24, wood);
  s.faceY(0.9, 1.12, 3, 18, 20, (gx) =>
    RGB[Math.min(RGB.length - 1, Math.floor(((gx - 1.12) / 1.88) * RGB.length))],
  );

  // Cây nhỏ góc sau bàn.
  s.box(1.17, 0.08, 1.33, 0.24, 24, 31, { top: C.woodDark, left: '#a8603f', right: '#7d452f' });
  for (let i = 0; i < 18; i++) {
    const x = Math.round(s.sx(1.25, 0.16)) + rng.int(-5, 5);
    const y = Math.round(s.sy(1.25, 0.16, 32)) - rng.int(0, 11);
    s.p.rect(x, y, 2, 2, rng.pick([C.leaf, C.leafLight, C.leafDark]));
  }

  // Cột và màn hình phụ phía trên: bảng số liệu bể cá.
  s.box(1.66, 0.2, 1.74, 0.28, 24, 66, { top: C.metal, left: C.metalLight, right: C.metal });
  s.faceY(0.4, 1.35, 2.1, 64, 84, (gx, z, x, y) => {
    const edge = Math.min(gx - 1.35, 2.1 - gx, (z - 64) / 20, (84 - z) / 20);
    if (edge < 0.04) return C.black;
    const curve = 73 + Math.sin(gx * 13) * 3 + Math.sin(gx * 31) * 1.5;
    if (Math.abs(z - curve) < 0.8) return C.neon;
    if (z < curve) return bayer(x, y) > 0.55 ? '#16405c' : '#10233f';
    return Math.floor(z) % 6 === 0 ? '#1b3355' : '#10233f';
  });

  // Màn hình chính: trình soạn code.
  s.box(1.66, 0.3, 1.76, 0.4, 24, 34, { top: C.metal, left: C.metalLight, right: C.black });
  const main = codeRows(rng, 8);
  s.faceY(0.42, 1.18, 2.24, 33, 62, (gx, z) => {
    const edge = Math.min(gx - 1.18, 2.24 - gx, (z - 33) / 29, (62 - z) / 29);
    if (edge < 0.04) return C.black;
    const u = (gx - 1.18) / 1.06;
    if (z > 58.5) return Math.floor(u * 12) % 4 === 0 ? '#2b3350' : '#1a2036';
    if (u < 0.1) return '#141a2e';
    const row = main[Math.floor((58 - z) / 3)];
    if ((58 - z) % 3 < 1.5 && row) {
      const hit = row.find(([at, len]) => u >= at && u < at + len);
      if (hit) return hit[2];
    }
    return Math.abs(Math.floor((58 - z) / 3) - 3) < 1 ? '#22294a' : '#1a2036';
  });
  const noteX = Math.round(s.sx(2.12, 0.42));
  const noteY = Math.round(s.sy(2.12, 0.42, 37));
  s.p.rect(noteX, noteY, 4, 4, C.gold);

  // Màn hình dọc: terminal.
  s.box(2.54, 0.28, 2.62, 0.36, 24, 34, { top: C.metal, left: C.metalLight, right: C.black });
  const term = codeRows(rng, 11);
  s.faceY(0.36, 2.3, 2.88, 33, 72, (gx, z) => {
    const edge = Math.min(gx - 2.3, 2.88 - gx, (z - 33) / 39, (72 - z) / 39);
    if (edge < 0.05) return C.black;
    const u = (gx - 2.3) / 0.58;
    const index = Math.floor((69 - z) / 3);
    const row = term[index];
    if ((69 - z) % 3 < 1.5 && row && row.some(([at, len]) => u >= at - 0.1 && u < at + len)) {
      return index % 4 === 0 ? C.waterHigh : '#a7f3c0';
    }
    return '#0c1a1c';
  });

  // Lót chuột, bàn phím RGB, chuột, cốc.
  s.top(1.32, 0.56, 2.56, 0.88, 24, (gx, gy) => {
    const edge = Math.min(gx - 1.32, 2.56 - gx, gy - 0.56, 0.88 - gy);
    return edge < 0.025 ? '#58a6ff' : '#141a2e';
  });
  s.box(1.42, 0.62, 2.06, 0.82, 24, 26, {
    top: (gx, gy) => {
      if (Math.floor(gx * 26) % 2 === 1 || Math.floor(gy * 34) % 2 === 1) return C.black;
      return RGB[Math.floor(((gx - 1.42) / 0.64) * RGB.length) % RGB.length];
    },
    left: C.metal,
    right: C.black,
  });
  s.box(2.2, 0.66, 2.32, 0.8, 24, 26, { top: C.metalLight, left: C.metal, right: C.black });
  s.p.set(Math.round(s.sx(2.26, 0.73)), Math.round(s.sy(2.26, 0.73, 26)), C.neon);
  s.box(1.16, 0.6, 1.28, 0.72, 24, 31, { top: '#2a1d1c', left: C.linen, right: C.linenShade });

  // Tai nghe trên giá.
  s.box(2.72, 0.66, 2.78, 0.72, 24, 44, { top: C.metal, left: C.metalLight, right: C.metal });
  const hx = Math.round(s.sx(2.75, 0.69));
  const hy = Math.round(s.sy(2.75, 0.69, 46));
  s.p.line(hx - 6, hy + 5, hx - 3, hy, C.black);
  s.p.line(hx - 3, hy, hx + 3, hy, C.metalLight);
  s.p.line(hx + 3, hy, hx + 6, hy + 5, C.black);
  s.p.rect(hx - 8, hy + 5, 3, 7, C.black);
  s.p.rect(hx + 6, hy + 5, 3, 7, C.black);
  s.p.rect(hx - 7, hy + 7, 1, 3, C.neon);
  s.p.rect(hx + 7, hy + 7, 1, 3, C.neon);

  // Ghế xoay, lệch sang phải để không che case.
  s.box(1.94, 1.12, 2.02, 1.2, 4, 15, { top: C.metal, left: C.metalLight, right: C.metal });
  s.top(1.68, 0.98, 2.28, 1.42, 2, (gx, gy) =>
    Math.abs(gx - 1.98) < 0.05 || Math.abs(gy - 1.2) < 0.05 ? C.metal : null,
  );
  s.box(1.7, 1.0, 2.26, 1.4, 15, 19, { top: '#374256', left: C.black, right: C.black, edge: C.metalLight });
  s.box(1.72, 1.3, 2.24, 1.4, 19, 33, {
    top: C.metalLight,
    left: (gx, z, x, y) => (bayer(x, y) > 0.6 ? C.metal : '#28303f'),
    right: C.black,
    edge: C.metalLight,
  });
  s.p.outline(C.ink);
  return s.p;
}

export function roomNightstand() {
  const s = new Stage(99, 128, 43, 61);
  s.box(0, 4.25, 0.7, 4.95, 0, 18, {
    top: (gx, gy, x, y) => (bayer(x, y) > 0.82 ? C.woodMid : C.woodLight),
    left: (gx, z) => {
      if (Math.abs(z - 9) < 0.8) return C.woodDark;
      return Math.abs(gx - 0.35) < 0.05 && (Math.abs(z - 5) < 1 || Math.abs(z - 13) < 1)
        ? C.gold
        : C.woodMid;
    },
    right: C.woodDark,
    edge: C.woodHigh,
  });
  s.box(0.08, 4.72, 0.3, 4.9, 18, 21, { top: '#a8493f', left: '#7d352f', right: '#5c2823' });
  s.box(0.26, 4.42, 0.48, 4.64, 18, 20, { top: C.metalLight, left: C.metal, right: C.black });
  s.box(0.35, 4.52, 0.39, 4.56, 20, 30, { top: C.metal, left: C.metalLight, right: C.metal });
  const lx = Math.round(s.sx(0.37, 4.54));
  const ly = Math.round(s.sy(0.37, 4.54, 34));
  s.p.ellipse(lx, ly + 1, 9, 4, '#ffb05c');
  s.p.ellipse(lx, ly - 1, 8, 4, '#ffd591');
  s.p.ellipse(lx, ly - 3, 5, 2, '#fff0c4');
  s.p.outline(C.ink);
  return s.p;
}

/** Điểm trên tường hoặc sàn ứng với pixel (x, y) của ảnh tường+sàn; null nếu không thuộc mặt nào. */
function surfaceAt(x, y) {
  const dx = x + 0.5 - OX;
  const dy = y + 0.5 - OY;
  const gx = (dx / U + dy / V) / 2;
  const gy = (dy / V - dx / U) / 2;
  if (gx >= 0 && gy >= 0 && gx <= ROOM && gy <= ROOM) {
    return { px: gx, py: gy, pz: 0, nx: 0, ny: 0, nz: 1 };
  }
  const along = Math.abs(dx) / U;
  const z = (OY + along * V - y - 0.5) / U;
  if (along > ROOM || z < 0 || z > WALL_H / U) return null;
  return dx < 0
    ? { px: 0, py: along, pz: z, nx: 1, ny: 0, nz: 0 }
    : { px: along, py: 0, pz: z, nx: 0, ny: 1, nz: 0 };
}

/** Lớp cộng sáng: mỗi nguồn là điểm sáng 3D; chỉ tô trong hình căn phòng, chia bậc để giữ chất pixel. */
function lightLayer(sources) {
  const shell = roomShell();
  const layer = new Pixels(SHELL_W, SHELL_H);
  const BANDS = 10;
  for (let y = 0; y < SHELL_H; y++) {
    for (let x = 0; x < SHELL_W; x++) {
      if (shell.alphaAt(x, y) === 0) continue;
      const surface = surfaceAt(x, y);
      if (!surface) continue;
      let total = 0;
      let [r, g, b] = [0, 0, 0];
      for (const light of sources) {
        const lx = light.x - surface.px;
        const ly = light.y - surface.py;
        const lz = light.z - surface.pz;
        const d = Math.hypot(lx, ly, lz) || 0.001;
        const facing = Math.max(0, (lx * surface.nx + ly * surface.ny + lz * surface.nz) / d);
        const fall = Math.max(0, 1 - d / light.range);
        let amount = light.strength * fall * fall * (0.3 + 0.7 * facing);
        if (light.ripple && surface.nz === 1) {
          amount *= 0.72 + 0.28 * Math.sin(surface.px * 7 + Math.sin(surface.py * 6) * 2);
        }
        const [cr, cg, cb] = hexToRgb(light.color);
        total += amount;
        r += cr * amount;
        g += cg * amount;
        b += cb * amount;
      }
      if (total <= 0) continue;
      const level = Math.min(1, Math.round(total * BANDS + (bayer(x, y) - 0.5) * 0.9) / BANDS);
      if (level <= 0) continue;
      const scale = level / total;
      layer.set(x, y, rgbHex(r * scale, g * scale, b * scale));
    }
  }
  return layer;
}

function rgbHex(r, g, b) {
  const part = (v) => Math.round(Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

export const roomLightPc = () =>
  lightLayer([
    { x: 1.75, y: 0.6, z: 1.9, color: '#4f94ff', range: 3.6, strength: 0.42 },
    { x: 1.7, y: 0.42, z: 2.1, color: '#3fd7ff', range: 2.0, strength: 0.42 },
    { x: 2.0, y: 1.0, z: 0.25, color: '#c05cff', range: 1.5, strength: 0.6 },
    { x: 0.8, y: 0.85, z: 0.7, color: '#ff5ccf', range: 1.0, strength: 0.32 },
  ]);

export const roomLightTank = () =>
  lightLayer([
    { x: 4.85, y: 1.3, z: 1.5, color: '#2fe3b4', range: 4.2, strength: 0.5, ripple: true },
    { x: 4.85, y: 0.5, z: 2.6, color: '#2fe3b4', range: 2.2, strength: 0.32 },
  ]);

export const roomLightLamp = () =>
  lightLayer([{ x: 0.38, y: 4.62, z: 1.35, color: '#ffb05c', range: 4.4, strength: 0.62 }]);

export function roomTank() {
  const s = new Stage(320, 82, 114, 132);
  const rng = createRng(5333);
  const gx0 = 3.5;
  const gx1 = 6.2;
  const gy1 = 1.1;
  const onFront = (gx, z) => [Math.round(s.sx(gx, gy1)), Math.round(s.sy(gx, gy1, z))];

  // Tủ gỗ có hai cánh, tay nắm đồng.
  s.box(gx0, 0, gx1, gy1, 0, 30, {
    top: C.woodLight,
    left: (gx, z, x, y) => {
      if (Math.abs(gx - 4.85) < 0.03 || z < 3 || z > 27 || gx < 3.56 || gx > 6.14) return C.woodDark;
      if ((Math.abs(gx - 4.72) < 0.03 || Math.abs(gx - 4.98) < 0.03) && z > 12 && z < 19) return C.gold;
      if (Math.sin(gx * 34 + z * 0.12) > 0.95) return C.woodDark;
      return bayer(x, y) > 0.88 ? C.woodLight : C.woodMid;
    },
    right: (gy, z) => (z < 3 || z > 27 ? '#2d1d17' : C.woodDark),
    edge: C.woodHigh,
  });

  // Nước sâu dần về phía sau: nền mờ, các vệt nắng từ đèn.
  const waterAt = (a, z, x, y) => {
    if (z > 66) return C.glass;
    const shaft = Math.sin(a * 8.5 + 1.1) > 0.62 && z > 44 && bayer(x, y) > 0.5;
    if (shaft) return '#3fb48a';
    return ramp(['#0d3f3e', '#14665a', '#249270'], (z - 32) / 34, x, y);
  };
  s.faceY(gy1, gx0, gx1, 30, 68, waterAt);
  s.faceX(gx1, 0, gy1, 30, 68, (gy, z, x, y) => {
    if (z > 66) return C.glass;
    return ramp(['#0a3234', '#115047', '#1b7560'], (z - 32) / 34, x, y);
  });
  s.top(gx0, 0, gx1, gy1, 68, (gx, gy, x, y) => {
    const ripple = Math.sin(gx * 8 + Math.sin(gy * 7) * 2);
    if (ripple > 0.86) return '#2f9a70';
    return bayer(x, y) > 0.7 ? '#1a6a52' : '#134f46';
  });

  const stalk = (gx, base, height, colors, sway) => {
    for (let k = 0; k < height; k++) {
      const [x, y] = onFront(gx, base + k);
      const dx = Math.round(Math.sin(k * 0.32 + sway) * 1.6);
      s.p.rect(x + dx, y, 2, 1, colors[Math.min(colors.length - 1, Math.floor((k / height) * colors.length))]);
      if (k % 3 === 0 && k > 2) s.p.set(x + dx + (k % 6 === 0 ? 2 : -1), y, colors[colors.length - 1]);
    }
  };

  // Lớp xa: bóng cây phai màu, nền cát cao dần về sau.
  for (let i = 0; i < 16; i++) {
    stalk(rng.range(gx0 + 0.08, gx1 - 0.08), 37, rng.int(14, 28), ['#155049', '#1b6a58'], rng.range(0, 6));
  }
  for (let x = Math.round(s.sx(gx0, gy1)); x < Math.round(s.sx(gx1, gy1)); x++) {
    const gx = gx0 + (x - s.sx(gx0, gy1)) / U;
    const base = s.sy(gx, gy1);
    const bed = 37 - (gx - gx0) * 1.4 + Math.sin(gx * 4.3) * 1.4;
    for (let y = Math.round(base - bed); y < Math.round(base - 30); y++) {
      s.put(x, y, ramp(['#4f4630', '#8a7a52'], (base - y - 30) / 8, x, y));
    }
  }

  // Lớp giữa: đá, lũa, cây.
  const rock = (gx, z, rx, ry) => {
    const [x, y] = onFront(gx, z);
    s.p.ellipse(x, y, rx, ry, '#37414e');
    s.p.ellipse(x - 1, y - 1, rx - 1, ry - 1, '#5b6775');
    s.p.ellipse(x - 2, y - 2, Math.max(1, rx - 4), Math.max(1, ry - 3), '#8d9aa4');
  };
  rock(3.98, 40, 10, 8);
  rock(4.28, 37, 7, 5);
  rock(5.62, 39, 9, 7);
  const branch = (points, width, color) => {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = onFront(...points[i]);
      const [bx, by] = onFront(...points[i + 1]);
      for (let w = 0; w < width; w++) s.p.line(ax + w, ay, bx + w, by, color);
    }
  };
  branch([[4.72, 36], [4.95, 45], [5.3, 53], [5.5, 60]], 3, '#3b271e');
  branch([[4.72, 36], [4.95, 45], [5.3, 53], [5.5, 60]], 1, '#8a6240');
  branch([[5.02, 47], [4.82, 56], [4.72, 60]], 2, '#4a3226');
  branch([[5.3, 53], [5.68, 54]], 2, '#4a3226');
  for (let i = 0; i < 12; i++) {
    stalk(rng.range(gx0 + 0.1, gx1 - 0.1), 36, rng.int(9, 22), [C.leafDark, '#3e8a52', C.leaf], rng.range(0, 6));
  }

  // Đàn cá nhỏ giữa nước và vài con lớn.
  const school = [];
  for (let i = 0; i < 11; i++) school.push([4.2 + rng.range(-0.34, 0.5), 55 + rng.range(-5, 6)]);
  for (const [gx, z] of school) {
    const [x, y] = onFront(gx, z);
    s.p.rect(x, y, 3, 1, '#62e0f4');
    s.p.set(x, y + 1, '#ff6b5e');
  }
  for (const [gx, z, color] of [
    [5.2, 62, '#ffb45e'],
    [5.72, 48, '#f0e0a0'],
    [3.86, 60, '#ff8f6b'],
  ]) {
    const [x, y] = onFront(gx, z);
    s.p.rect(x, y, 5, 3, color);
    s.p.rect(x - 2, y, 2, 3, color);
    s.p.set(x + 4, y, C.ink);
  }

  // Lớp gần: thảm cỏ sáng và cây đỏ làm điểm nhấn.
  for (let i = 0; i < 80; i++) {
    const gx = rng.range(gx0 + 0.03, gx1 - 0.03);
    const [x, y] = onFront(gx, 33 + rng.range(0, 3));
    s.p.rect(x, y - rng.int(1, 5), 1, rng.int(3, 6), rng.pick([C.leaf, C.leafLight, '#5fa84a']));
  }
  stalk(5.92, 36, 24, ['#a84a35', '#d9603f', '#f08a5b'], 1);
  stalk(5.98, 36, 18, ['#a84a35', '#d9603f', '#f08a5b'], 3);
  stalk(3.72, 36, 26, ['#2f6a3e', C.leaf, C.leafLight], 2);
  stalk(3.8, 36, 20, ['#2f6a3e', C.leaf, C.leafLight], 4);

  // Mặt nước, khung kính, đèn máng.
  for (let x = Math.round(s.sx(gx0, gy1)); x < Math.round(s.sx(gx1, gy1)); x++) {
    const gx = gx0 + (x - s.sx(gx0, gy1)) / U;
    if (Math.sin(gx * 21) > 0.2) s.put(x, Math.round(s.sy(gx, gy1, 65)), '#8fe8c0');
  }
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
  s.p.outline(C.ink);
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
  const woodGrain = (a, z, x, y) => {
    if (Math.sin(a * 28 + z * 0.2) > 0.95) return C.woodDark;
    return bayer(x, y) > 0.86 ? C.woodLight : C.woodMid;
  };

  // Đầu giường đặt sát tường, vẽ trước vì nằm sau gối.
  s.box(0, gy0, 0.14, gy1, 0, 44, {
    top: C.woodHigh,
    left: C.woodDark,
    right: woodGrain,
    edge: C.woodHigh,
  });

  // Khung, nệm, chăn kẻ có nếp gấp.
  s.box(0.05, gy0, gx1, gy1, 0, 12, {
    top: C.woodLight,
    left: woodGrain,
    right: C.woodDark,
    edge: C.woodHigh,
  });
  s.box(0.1, gy0 + 0.06, gx1 - 0.08, gy1 - 0.06, 12, 22, {
    top: C.linen,
    left: C.linenShade,
    right: '#8d8079',
  });
  s.box(1.08, gy0 + 0.02, gx1 - 0.03, gy1 - 0.02, 12, 25, {
    top: (gx, gy, x, y) => {
      const fold = Math.sin(gx * 5.2 + gy * 1.4);
      if (fold > 0.9 && bayer(x, y) > 0.35) return C.tealDark;
      return plaid(gx, gy, x, y);
    },
    left: (gx, z, x, y) => (z < 15 ? C.tealDark : plaid(gx, z / 30, x, y)),
    right: (gy, z, x, y) => (z < 15 ? '#183a3d' : bayer(x, y) > 0.5 ? C.tealDark : C.teal),
    edge: '#4e8e86',
  });
  s.box(1.08, gy0 + 0.02, 1.5, gy1 - 0.02, 25, 28, {
    top: (gx, gy, x, y) => (bayer(x, y) > 0.82 ? C.linenShade : C.linen),
    left: C.linenShade,
    right: '#8d8079',
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
  s.box(2.1, 5.72, 2.62, 6.42, 25, 27, {
    top: (gx, gy) => {
      if (Math.abs(gy - 6.07) < 0.03) return C.linenShade;
      return Math.floor((gy - 5.72) * 18) % 3 === 0 ? '#b8ae9f' : '#f3ecdd';
    },
    left: '#7d352f',
    right: '#5c2823',
  });
  s.p.outline(C.ink);
  return s.p;
}

export function roomBookcase() {
  const s = new Stage(209, 25, 51, 106);
  const rng = createRng(6211);
  const gy0 = 0.1;
  const gy1 = 1.3;
  const shelves = [3, 22, 41, 60];
  const colors = ['#a8493f', '#d0a24f', '#3e6f8f', '#6c5a9a', '#3f8a6f', '#c9c0ae'];
  const books = shelves.map(() => {
    const row = [];
    for (let gy = gy0 + 0.09; gy < gy1 - 0.09; ) {
      const w = rng.range(0.05, 0.1);
      row.push({ from: gy, to: gy + w, high: rng.int(10, 16), color: rng.chance(0.14) ? null : rng.pick(colors) });
      gy += w + 0.006;
    }
    return row;
  });

  s.box(0.02, gy0, 0.48, gy1, 0, 80, {
    top: (gx, gy, x, y) => (bayer(x, y) > 0.82 ? C.woodMid : C.woodLight),
    left: C.woodDark,
    right: (gy, z) => {
      if (gy < gy0 + 0.06 || gy > gy1 - 0.06 || z < 3 || z > 77) return C.woodMid;
      const shelf = shelves.findIndex((b) => z >= b && z < b + 19);
      if (shelf < 0) return '#241812';
      const base = shelves[shelf];
      if (z < base + 2) return C.woodLight;
      const book = books[shelf].find((b) => gy >= b.from && gy < b.to);
      if (book && book.color && z < base + 2 + book.high) return book.color;
      return '#241812';
    },
    edge: C.woodHigh,
  });

  // Mô hình tàu ngầm nhỏ trên tầng trên, đồng hồ cát trên nóc.
  const mx = Math.round(s.sx(0.48, 0.5));
  const my = Math.round(s.sy(0.48, 0.5, 67));
  s.p.rect(mx - 6, my, 12, 5, '#2f4a86');
  s.p.rect(mx - 2, my - 3, 4, 3, '#2f4a86');
  s.p.rect(mx - 6, my + 2, 12, 1, C.gold);
  s.p.rect(mx + 5, my + 1, 2, 2, '#ffe2a8');
  const tx = Math.round(s.sx(0.25, 0.75));
  const ty = Math.round(s.sy(0.25, 0.75, 81));
  s.p.rect(tx - 3, ty - 1, 7, 1, C.gold);
  s.p.rect(tx - 2, ty - 5, 5, 4, '#62d8f0');
  s.p.rect(tx - 3, ty - 6, 7, 1, C.gold);
  s.p.outline(C.ink);
  return s.p;
}

export function roomPlant() {
  const s = new Stage(8, 150, 44, 84);
  const rng = createRng(7789);
  s.box(0.15, 7.45, 0.55, 7.85, 0, 18, {
    top: '#3a2820',
    left: (gx, z) => (z > 14 ? '#c9754f' : '#a8603f'),
    right: (gy, z) => (z > 14 ? '#a8603f' : '#7d452f'),
    edge: '#dd8e66',
  });
  const cx = Math.round(s.sx(0.35, 7.65));
  const cy = Math.round(s.sy(0.35, 7.65, 18));
  const leaves = [];
  for (let i = 0; i < 12; i++) {
    leaves.push({ angle: -Math.PI / 2 + rng.range(-1.1, 1.1), length: rng.range(20, 42) });
  }
  leaves.sort((a, b) => b.length - a.length);
  for (const { angle, length } of leaves) {
    const reach = Math.min(length, 20 / Math.max(0.2, Math.abs(Math.cos(angle))));
    const steps = Math.round(reach);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = cx + Math.cos(angle) * k + Math.sin(t * Math.PI) * Math.cos(angle) * 2;
      const y = cy + Math.sin(angle) * k + t * t * 8;
      const half = Math.round(Math.sin(t * Math.PI) * 3.2);
      for (let w = -half; w <= half; w++) {
        const color = w === 0 ? C.leafLight : w < 0 ? C.leaf : C.leafDark;
        s.p.set(Math.round(x + w), Math.round(y), color);
      }
    }
  }
  s.p.outline(C.ink);
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
  'room-nightstand': roomNightstand,
  'room-light-pc': roomLightPc,
  'room-light-tank': roomLightTank,
  'room-light-lamp': roomLightLamp,
  'room-bookcase': roomBookcase,
  'room-plant': roomPlant,
};
