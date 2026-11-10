// Thiết bị đặt trong bể và icon hàng trong Peeshop (spec 7, 17). generate.mjs đăng ký các hàm trong SHOP_ASSETS.
import { Pixels, createRng } from './lib.mjs';

const INK = '#17121f';
const METAL_DARK = '#2c3442';
const METAL = '#4a5668';
const METAL_LIGHT = '#8493a6';
const NEON = '#62f0e6';
const AMBER = '#e7bf5d';
const AMBER_DARK = '#a8743a';
const ROCK_DARK = '#2c3540';
const ROCK = '#55616f';
const ROCK_LIGHT = '#93a2a8';

const DEVICE_W = 40;
const DEVICE_H = 44;
const ICON = 24;

function rockBase(p, cx, cy, rx) {
  p.ellipse(cx, cy, rx, 5, ROCK_DARK);
  p.ellipse(cx - 1, cy - 1, rx - 2, 4, ROCK);
  p.ellipse(cx - 3, cy - 2, Math.max(1, rx - 7), 2, ROCK_LIGHT);
}

/** Bình lọc có hai ống nước và vạch chất lọc nhìn qua cửa kính. */
export function deviceFilter() {
  const p = new Pixels(DEVICE_W, DEVICE_H);
  rockBase(p, 20, 38, 16);
  p.rect(12, 12, 16, 26, METAL);
  p.rect(12, 12, 3, 26, METAL_LIGHT);
  p.rect(25, 12, 3, 26, METAL_DARK);
  p.rect(10, 8, 20, 5, METAL_LIGHT);
  p.rect(10, 12, 20, 1, METAL_DARK);
  p.rect(16, 16, 8, 16, '#10333a');
  for (const [y, color] of [[17, '#c9c0ae'], [21, '#6c8a5a'], [25, '#3f6f8f'], [29, '#c9c0ae']]) {
    p.rect(17, y, 6, 2, color);
  }
  p.line(14, 8, 14, 3, METAL_DARK);
  p.line(14, 3, 6, 3, METAL_DARK);
  p.line(6, 3, 6, 18, METAL_DARK);
  p.line(26, 8, 26, 5, METAL_LIGHT);
  p.line(26, 5, 34, 5, METAL_LIGHT);
  p.line(34, 5, 34, 14, METAL_LIGHT);
  p.rect(26, 34, 2, 2, NEON);
  p.set(33, 17, '#d6fff0');
  p.set(35, 20, '#d6fff0');
  p.outline(INK);
  return p;
}

/** Máy cho ăn: phễu chứa viên thức ăn trên cột, có vòi thả. */
export function deviceFeeder() {
  const p = new Pixels(DEVICE_W, DEVICE_H);
  rockBase(p, 20, 38, 13);
  p.rect(18, 20, 5, 18, METAL);
  p.rect(18, 20, 2, 18, METAL_LIGHT);
  for (let i = 0; i < 9; i++) {
    const half = 12 - i;
    p.rect(20 - half, 8 + i, half * 2 + 1, 1, i < 2 ? AMBER : AMBER_DARK);
    p.rect(20 - half, 8 + i, 2, 1, AMBER);
  }
  p.rect(8, 5, 25, 3, METAL_LIGHT);
  p.rect(15, 10, 11, 4, '#3a2a20');
  for (const x of [16, 19, 22, 24]) p.rect(x, 11 + (x % 2), 2, 2, '#d98a4f');
  p.rect(23, 17, 9, 3, METAL);
  p.rect(30, 20, 3, 3, METAL_DARK);
  p.set(31, 25, '#d98a4f');
  p.set(30, 29, '#d98a4f');
  p.rect(24, 22, 2, 2, NEON);
  p.outline(INK);
  return p;
}

/** Trạm sạc phụ: bệ có vòng cuộn dây phát sáng và tia sét. */
export function deviceCharger() {
  const p = new Pixels(DEVICE_W, DEVICE_H);
  rockBase(p, 20, 38, 17);
  p.ellipse(20, 33, 14, 5, METAL_DARK);
  p.ellipse(20, 32, 12, 4, METAL);
  p.ellipse(20, 32, 9, 3, NEON);
  p.ellipse(20, 32, 7, 2, '#10333a');
  p.rect(9, 12, 3, 20, METAL);
  p.rect(9, 12, 1, 20, METAL_LIGHT);
  p.rect(28, 12, 3, 20, METAL_DARK);
  p.rect(9, 9, 22, 4, METAL_LIGHT);
  p.rect(9, 12, 22, 1, METAL_DARK);
  for (const [x, y, w] of [[21, 15, 3], [19, 18, 4], [17, 21, 6], [20, 24, 3], [19, 27, 2]]) {
    p.rect(x, y, w, 3, AMBER);
  }
  p.rect(20, 18, 1, 6, '#fff0c4');
  p.outline(INK);
  return p;
}

/** San hô nhánh mọc trên đá. */
export function deviceCoral() {
  const p = new Pixels(DEVICE_W, DEVICE_H);
  const rng = createRng(8123);
  rockBase(p, 20, 38, 15);
  const tones = ['#b03a6a', '#e0568c', '#ff9ac0'];
  const branch = (x, y, angle, length, depth) => {
    let px = x;
    let py = y;
    for (let i = 0; i < length; i++) {
      px += Math.cos(angle);
      py += Math.sin(angle);
      const tone = tones[Math.min(2, depth)];
      p.rect(Math.round(px), Math.round(py), depth === 0 ? 3 : 2, 2, tone);
      p.set(Math.round(px), Math.round(py), tones[Math.min(2, depth + 1)]);
    }
    if (depth < 2) {
      branch(px, py, angle - rng.range(0.35, 0.7), length * 0.68, depth + 1);
      branch(px, py, angle + rng.range(0.35, 0.7), length * 0.68, depth + 1);
    } else {
      p.rect(Math.round(px), Math.round(py) - 1, 2, 2, '#ffd8e6');
    }
  };
  branch(19, 35, -Math.PI / 2, 11, 0);
  branch(13, 36, -Math.PI / 2 - 0.5, 8, 1);
  branch(26, 36, -Math.PI / 2 + 0.5, 8, 1);
  p.outline(INK);
  return p;
}

export function iconCargo() {
  const p = new Pixels(ICON, ICON);
  p.rect(4, 8, 16, 12, '#8a5a36');
  p.rect(4, 8, 16, 2, '#c08a56');
  p.rect(4, 13, 16, 1, '#5b3b29');
  p.rect(7, 8, 2, 12, '#5b3b29');
  p.rect(15, 8, 2, 12, '#5b3b29');
  p.rect(10, 12, 4, 3, AMBER);
  p.outline(INK);
  return p;
}

export function iconSpeed() {
  const p = new Pixels(ICON, ICON);
  p.ellipse(12, 12, 3, 3, METAL_LIGHT);
  p.ellipse(12, 12, 1, 1, METAL_DARK);
  for (const [x, y, w, h] of [[8, 3, 7, 6], [15, 10, 6, 6], [4, 13, 7, 5]]) {
    p.rect(x, y, w, h, '#58a6ff');
    p.rect(x, y, w, 1, '#a8d4ff');
  }
  p.outline(INK);
  return p;
}

export function iconVacuum() {
  const p = new Pixels(ICON, ICON);
  p.rect(4, 4, 10, 8, METAL);
  p.rect(4, 4, 10, 2, METAL_LIGHT);
  p.rect(12, 9, 4, 8, METAL_DARK);
  p.rect(9, 16, 12, 4, AMBER);
  p.rect(9, 19, 12, 1, AMBER_DARK);
  p.rect(6, 7, 3, 2, NEON);
  p.outline(INK);
  return p;
}

export function iconBattery() {
  const p = new Pixels(ICON, ICON);
  p.rect(3, 7, 16, 11, METAL_DARK);
  p.rect(19, 10, 2, 5, METAL_LIGHT);
  for (const x of [5, 9, 13]) p.rect(x, 9, 3, 7, '#62e08a');
  p.outline(INK);
  return p;
}

export function iconCharger() {
  const p = new Pixels(ICON, ICON);
  p.rect(5, 12, 14, 8, METAL);
  p.rect(5, 12, 14, 2, METAL_LIGHT);
  p.rect(8, 7, 2, 5, METAL_LIGHT);
  p.rect(14, 7, 2, 5, METAL_LIGHT);
  for (const [x, y, w] of [[12, 14, 2], [10, 16, 4], [10, 18, 2]]) p.rect(x, y, w, 2, AMBER);
  p.outline(INK);
  return p;
}

export function iconPowerBank() {
  const p = new Pixels(ICON, ICON);
  p.rect(7, 4, 10, 17, '#3f6f8f');
  p.rect(7, 4, 2, 17, '#6c9fbf');
  p.rect(10, 7, 4, 1, NEON);
  for (const [x, y, w] of [[12, 10, 2], [10, 12, 4], [10, 14, 2]]) p.rect(x, y, w, 2, AMBER);
  p.outline(INK);
  return p;
}

export const SHOP_ASSETS = {
  'device-filter': deviceFilter,
  'device-feeder': deviceFeeder,
  'device-charger': deviceCharger,
  'device-coral': deviceCoral,
  'shop-cargo': iconCargo,
  'shop-speed': iconSpeed,
  'shop-vacuum': iconVacuum,
  'shop-battery': iconBattery,
  'shop-charger': iconCharger,
  'shop-powerbank': iconPowerBank,
};
