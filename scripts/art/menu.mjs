// Hình cho màn tiêu đề, menu tạm dừng và cài đặt (spec 19). generate.mjs đăng ký các hàm trong MENU_ASSETS.
import { Pixels, bayer, createRng, ramp } from './lib.mjs';

const INK = '#17121f';
const METAL_DARK = '#1f2733';
const METAL = '#3a4656';
const METAL_MID = '#4b596b';
const METAL_LIGHT = '#6f8094';
const NEON = '#62f0e6';

/** Nền màn tiêu đề: nhìn vào lòng bể qua kính, rộng tối đa 840 nên mọi tỉ lệ màn hình đều phủ kín. */
export function menuBackdrop() {
  const W = 840;
  const H = 360;
  const p = new Pixels(W, H);
  const rng = createRng(9091);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) p.set(x, y, ramp(['#3aa6b0', '#1d7488', '#0f4a63', '#0a2a40'], y / H, x, y));
  }
  // Tia nắng chéo từ mặt nước.
  for (const [start, width, strength] of [[120, 46, 0.16], [300, 30, 0.12], [470, 60, 0.15], [660, 34, 0.12]]) {
    for (let y = 0; y < 300; y++) {
      const shift = Math.round(y * 0.35);
      const fade = 1 - y / 300;
      for (let w = 0; w < width; w++) {
        const x = start + shift + w;
        if (bayer(x, y) < 0.55) p.set(x, y, '#c8fff4', strength * fade);
      }
    }
  }
  // Rặng đá và rong xa, càng xa càng nhạt.
  const ridge = (base, amp, freq, phase, color) => {
    for (let x = 0; x < W; x++) {
      const top = Math.round(base - amp * (0.6 + 0.4 * Math.sin(x * freq + phase)) - amp * 0.3 * Math.sin(x * freq * 3.1));
      for (let y = top; y < H; y++) p.set(x, y, color);
    }
  };
  ridge(262, 34, 0.012, 1, '#145566');
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, W);
    const h = rng.int(30, 80);
    for (let k = 0; k < h; k++) p.rect(x + Math.round(Math.sin(k * 0.18 + i) * 3), 250 - k, 2, 1, '#17606a');
  }
  ridge(292, 26, 0.02, 3, '#0f4252');
  // Nền cát có vân sáng.
  for (let y = 300; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wave = Math.sin(x * 0.07 + Math.sin(y * 0.3) * 2) + Math.sin(x * 0.023 - y * 0.2);
      let color = ramp(['#8c7a52', '#6a5b3c', '#4a3f2a'], (y - 300) / 60, x, y);
      if (wave > 1.55 && bayer(x, y) > 0.3) color = '#c9b27a';
      p.set(x, y, color);
    }
  }
  for (let i = 0; i < 70; i++) p.rect(rng.int(0, W), rng.int(306, H), rng.int(1, 3), 1, rng.pick(['#3a3122', '#b8a070', '#5f5438']));
  // Rong gần ở hai mép, tối hơn để làm khung.
  const weed = (x, h, colors, sway) => {
    for (let k = 0; k < h; k++) {
      const dx = Math.round(Math.sin(k * 0.12 + sway) * (k / h) * 8);
      const c = colors[Math.min(colors.length - 1, Math.floor((k / h) * colors.length))];
      p.rect(x + dx, H - k, 4, 1, c);
      if (k % 9 === 4) p.rect(x + dx + 4, H - k - 1, 4, 2, c);
    }
  };
  for (const [x, h, s] of [[6, 220, 0], [22, 160, 2], [38, 260, 4], [60, 120, 1], [780, 240, 3], [800, 180, 5], [820, 280, 1], [760, 130, 2]]) {
    weed(x, h, ['#0a2a26', '#123f34', '#1b5a44'], s);
  }
  // Bọt khí rải sẵn.
  for (let i = 0; i < 40; i++) {
    const x = rng.int(80, W - 80);
    const y = rng.int(20, 280);
    const r = rng.pick([1, 1, 2]);
    p.ellipse(x, y, r, r, '#d6fff4', 0.55);
  }
  // Mặt nước sáng ở mép trên.
  for (let x = 0; x < W; x++) {
    const y = 4 + Math.round(Math.sin(x * 0.05) * 2);
    p.rect(x, 0, 1, y, '#8fe8e0');
    p.set(x, y, '#d6fff4');
  }
  return p;
}

const GLYPHS = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  n: ['00000', '00000', '10110', '11001', '10001', '10001', '10001'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
};

/** Logo chữ pixel "FishTank": khối vàng cam đổ bóng xanh đậm, chấm chữ i là bọt khí. */
export function menuLogo() {
  const S = 4;
  const word = 'FishTank';
  const p = new Pixels(196, 40);
  const ox = 4;
  const oy = 4;
  const drawWord = (dx, dy, colorAt) => {
    [...word].forEach((ch, index) => {
      GLYPHS[ch].forEach((row, gy) => {
        [...row].forEach((bit, gx) => {
          if (bit !== '1') return;
          if (ch === 'i' && gy === 0) return;
          const x = ox + dx + index * 23 + gx * S;
          const y = oy + dy + gy * S;
          for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) p.set(x + px, y + py, colorAt(gy * S + py, x + px, y + py));
        });
      });
    });
  };
  drawWord(2, 3, () => '#123a52');
  drawWord(0, 0, (row, x, y) => {
    const t = row / 28;
    if (row % S === 0 && t < 0.5) return '#fff3c4';
    return ramp(['#ffe08a', '#f5b850', '#e07d3a'], t, x, y);
  });
  // Chấm chữ i thành bọt khí.
  const bx = ox + 23 + 2 * S + 2;
  p.ellipse(bx, oy + 1, 4, 4, NEON);
  p.ellipse(bx, oy + 1, 2, 2, '#0f4a63');
  p.set(bx - 2, oy - 1, '#ffffff');
  p.outline(INK);
  return p;
}

function bevel(p, x0, y0, w, h, face, light, dark) {
  p.rect(x0, y0, w, h, face);
  p.rect(x0, y0, w, 1, light);
  p.rect(x0, y0, 1, h, light);
  p.rect(x0, y0 + h - 1, w, 1, dark);
  p.rect(x0 + w - 1, y0, 1, h, dark);
}

/** Bảng điều khiển kim loại 48×48 dùng nine-slice (góc 12), có ốc ở bốn góc. */
export function menuPanel() {
  const p = new Pixels(48, 48);
  p.rect(0, 0, 48, 48, INK);
  bevel(p, 1, 1, 46, 46, METAL, METAL_LIGHT, METAL_DARK);
  bevel(p, 3, 3, 42, 42, METAL_MID, METAL_DARK, METAL_LIGHT);
  for (const [x, y] of [[5, 5], [40, 5], [5, 40], [40, 40]]) {
    p.rect(x, y, 3, 3, METAL_LIGHT);
    p.set(x + 1, y + 1, METAL_DARK);
  }
  return p;
}

/** Nút nine-slice 48×24, hai khung: thường và đang chọn (sáng hơn, có đèn LED). */
export function menuButton() {
  const p = new Pixels(96, 24);
  for (const [frame, face, light, led] of [[0, '#1f5a63', '#3b8a8f', '#2b6f70'], [1, '#2f8a8f', '#7fd8d0', NEON]]) {
    const x0 = frame * 48;
    p.rect(x0, 0, 48, 24, INK);
    bevel(p, x0 + 1, 1, 46, 21, face, light, '#123a40');
    p.rect(x0 + 1, 22, 46, 1, '#0b2226');
    p.rect(x0 + 4, 9, 3, 4, led);
    p.rect(x0 + 41, 9, 3, 4, led);
  }
  return p;
}

/** Màn hình LCD nhỏ 24×24 nine-slice (góc 5) để hiện số liệu bể. */
export function menuScreen() {
  const p = new Pixels(24, 24);
  p.rect(0, 0, 24, 24, INK);
  bevel(p, 1, 1, 22, 22, METAL_DARK, '#0e131a', METAL_LIGHT);
  for (let y = 3; y < 21; y++) for (let x = 3; x < 21; x++) p.set(x, y, y % 2 === 0 ? '#0c1f1a' : '#10291f');
  return p;
}

/** Nút tạm dừng 20×20 trên HUD. */
export function menuPause() {
  const p = new Pixels(20, 20);
  p.rect(0, 0, 20, 20, INK);
  bevel(p, 1, 1, 18, 18, METAL, METAL_LIGHT, METAL_DARK);
  p.rect(6, 5, 3, 10, '#e6f1ff');
  p.rect(11, 5, 3, 10, '#e6f1ff');
  return p;
}

/** Công tắc 24×12, hai khung: tắt (núm trái, đèn xám) và bật (núm phải, đèn xanh). */
export function menuToggle() {
  const p = new Pixels(48, 12);
  for (const on of [0, 1]) {
    const x0 = on * 24;
    p.rect(x0, 0, 24, 12, INK);
    bevel(p, x0 + 1, 1, 22, 10, on ? '#1f5a3a' : METAL_DARK, on ? '#2f8a5a' : METAL, '#0e131a');
    const knob = on ? x0 + 13 : x0 + 2;
    bevel(p, knob, 2, 9, 8, METAL_LIGHT, '#a9b6c6', METAL);
    p.rect(on ? x0 + 4 : x0 + 15, 5, 3, 2, on ? '#62e08a' : '#5d6578');
  }
  return p;
}

export const MENU_ASSETS = {
  'menu-backdrop': menuBackdrop,
  'menu-logo': menuLogo,
  'menu-panel': menuPanel,
  'menu-button': menuButton,
  'menu-screen': menuScreen,
  'menu-pause': menuPause,
  'menu-toggle': menuToggle,
};
