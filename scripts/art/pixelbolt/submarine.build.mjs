// Sinh recipe Pixelbolt cho tàu ngầm người chơi (spec 12.2): thân navy viền vàng theo ảnh mẫu, quay phải.
// Chạy: node scripts/art/pixelbolt/submarine.build.mjs  → ghi submarine.json cạnh file này.
// Mỗi frame là lưới 56×48 ký tự; chỉ chân vịt đổi giữa 4 frame.
import { writeFileSync } from 'node:fs';

const W = 56;
const H = 48;

const palette = {
  k: '#0a0d1a', // viền
  0: '#122045',
  1: '#1c3166',
  2: '#28468c',
  3: '#365fb0',
  4: '#4c7dcc',
  5: '#7ba6ea',
  a: '#5c3a0e',
  b: '#9a6a1c',
  c: '#d6a334',
  d: '#f5d061',
  e: '#fff3b0',
  g: '#0c3440',
  h: '#23808a',
  i: '#6fd8d0',
  j: '#e2fff9',
  l: '#fffbe6',
  m: '#ffdf6b',
  n: '#f0a830',
};
const ramps = [
  ['0', '1', '2', '3', '4', '5'],
  ['a', 'b', 'c', 'd', 'e'],
];

const CY = 28; // tâm thân theo chiều dọc
const HULL_TOP = 19;

/** Nửa chiều cao thân tại cột x (0 = không có thân). */
function halfHeight(x) {
  if (x < 8 || x > 52) return 0;
  if (x < 17) return 5 + ((x - 8) / 9) * 4; // đuôi thuôn
  if (x <= 43) return 9;
  const t = (x - 43) / 9.5; // mũi bo tròn
  return t >= 1 ? 0 : 9 * Math.sqrt(1 - t * t);
}

function blank() {
  return Array.from({ length: H }, () => Array(W).fill('.'));
}

function body() {
  const g = blank();
  const set = (x, y, c) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c;
  };

  // Thân: tô theo ramp navy, sáng ở trên (ánh sáng từ trên trái).
  for (let x = 8; x <= 52; x++) {
    const hh = halfHeight(x);
    if (hh <= 0) continue;
    const top = Math.round(CY - hh);
    const bottom = Math.round(CY + hh);
    for (let y = top; y <= bottom; y++) {
      const v = (y - top) / Math.max(1, bottom - top);
      let c = v < 0.1 ? '5' : v < 0.3 ? '4' : v < 0.62 ? '3' : v < 0.86 ? '2' : '1';
      if (x > 46 && c === '3') c = '2'; // mũi hơi tối để đèn nổi
      set(x, y, c);
    }
  }

  // Vây đuôi trên và dưới (viền vàng ở mép sau và mép ngoài).
  // Mép sau đứng ở x = 10, mép trên dốc xuống tới thân ở x = 18; vây bám liền vào thân.
  for (let x = 10; x <= 18; x++) {
    const tip = Math.round(13 + ((x - 10) * 6) / 8);
    const hullTop = Math.round(CY - halfHeight(x));
    const hullBottom = Math.round(CY + halfHeight(x));
    for (let y = tip; y < hullTop; y++) {
      const edge = y === tip || x === 10;
      set(x, y, edge ? 'd' : y - tip < 2 ? '4' : '3');
    }
    const bottomTip = 2 * CY - tip;
    for (let y = hullBottom + 1; y <= bottomTip; y++) {
      const edge = y === bottomTip || x === 10;
      set(x, y, edge ? 'c' : '2');
    }
  }

  // Vành vàng chia đuôi và thân; vành cổ đuôi.
  for (let y = 0; y < H; y++) {
    if (g[y][17] !== '.') set(17, y, y < 22 ? 'd' : y > 34 ? 'b' : 'c');
    if (g[y][9] !== '.') set(9, y, y < 26 ? 'c' : 'b');
  }

  // Đường nối tấm thân.
  for (let y = HULL_TOP + 1; y <= 37; y++) {
    if (g[y][42] !== '.') set(42, y, '1');
  }

  // Tháp: cạnh trước vát, sáng bên trái.
  const towerRows = [
    [27, 36],
    [27, 38],
    [27, 39],
    [27, 40],
    [27, 40],
    [27, 40],
    [27, 40],
  ];
  towerRows.forEach(([x0, x1], i) => {
    const y = 12 + i;
    for (let x = x0; x <= x1; x++) {
      let c = i === 0 ? '5' : x === x0 ? '4' : x >= x1 - 1 ? '2' : '3';
      set(x, y, c);
    }
  });
  // Cửa sổ phát sáng trên tháp.
  for (const x of [33, 34, 36, 37, 38]) {
    set(x, 14, 'e');
    set(x, 15, 'm');
  }
  set(35, 14, '1');
  set(35, 15, '1');
  // Khe thông gió phía sau tháp.
  for (const y of [14, 16]) for (let x = 29; x <= 31; x++) set(x, y, '0');
  // Nắp tròn vàng nhỏ.
  set(24, 18, 'b');
  set(25, 17, 'd');
  set(26, 17, 'c');
  set(25, 18, 'c');
  set(26, 18, 'c');
  set(27, 18, 'b');

  // Ống ngắm: thân ống, cổ vàng, khuỷu quay về phía trước, mắt kính.
  for (let y = 6; y <= 11; y++) {
    set(30, y, '4');
    set(31, y, '2');
  }
  set(30, 10, 'd');
  set(31, 10, 'b');
  for (let x = 30; x <= 34; x++) {
    set(x, 4, x === 30 ? '4' : '4');
    set(x, 5, '2');
  }
  set(35, 3, 'd');
  set(35, 4, 'i');
  set(35, 5, 'h');
  set(35, 6, 'b');
  set(36, 4, 'j');
  set(36, 5, 'c');

  // Tay vịn vàng trên lưng.
  for (let x = 21; x <= 26; x++) set(x, 20, x === 21 ? 'b' : 'd');
  set(21, 21, 'b');

  // Ba cửa sổ tròn vành vàng.
  for (const cx of [21, 29, 37]) {
    const ring = [
      [-1, -3, 'd'],
      [0, -3, 'd'],
      [1, -3, 'c'],
      [-2, -2, 'd'],
      [2, -2, 'c'],
      [-3, -1, 'd'],
      [3, -1, 'c'],
      [-3, 0, 'c'],
      [3, 0, 'b'],
      [-3, 1, 'c'],
      [3, 1, 'b'],
      [-2, 2, 'c'],
      [2, 2, 'b'],
      [-1, 3, 'b'],
      [0, 3, 'b'],
      [1, 3, 'a'],
    ];
    const cy = 25;
    for (const [dx, dy, c] of ring) set(cx + dx, cy + dy, c);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
        if (Math.abs(dx) + Math.abs(dy) > 3) continue;
        set(cx + dx, cy + dy, dy >= 1 ? 'g' : 'h');
      }
    }
    set(cx - 1, cy - 1, 'j');
    set(cx, cy - 2, 'i');
    set(cx + 1, cy, 'i');
  }

  // Sọc vàng dọc thân.
  for (let x = 18; x <= 46; x++) {
    set(x, 30, 'd');
    set(x, 31, 'b');
  }
  // Vạch chéo gần đuôi.
  for (const x0 of [11, 14]) {
    set(x0 + 1, 29, 'd');
    set(x0, 30, 'd');
    set(x0 + 1, 30, 'c');
    set(x0, 31, 'b');
  }

  // Tấm thông gió dưới sọc.
  for (let x = 19; x <= 27; x++) {
    set(x, 33, '1');
    set(x, 37, '0');
  }
  for (let y = 33; y <= 37; y++) {
    set(19, y, '1');
    set(27, y, '1');
  }
  for (const y of [34, 36]) for (let x = 21; x <= 25; x++) set(x, y, '0');
  set(20, 34, 'c');
  set(26, 34, 'c');

  // Ba khe sáng vàng.
  for (const x of [32, 34, 36]) {
    set(x, 33, 'e');
    set(x, 34, 'm');
    set(x, 35, 'n');
  }

  // Đinh tán vàng dọc đường nối.
  for (const y of [22, 26, 34]) set(42, y, 'c');
  for (const x of [13, 45]) set(x, 27, 'c');

  // Thanh trượt dạng ống dưới bụng, hai cột đỡ vàng.
  for (let x = 20; x <= 38; x++) {
    set(x, 39, '3');
    set(x, 40, '1');
  }
  set(19, 40, '2');
  set(39, 40, '2');
  for (const x of [23, 35]) {
    set(x, 38, 'c');
    set(x + 1, 38, 'b');
    set(x, 39, 'd');
    set(x + 1, 39, 'c');
    set(x, 40, 'b');
    set(x + 1, 40, 'b');
  }

  // Đèn pha: vành vàng, lõi sáng.
  const LX = 50;
  const LY = 28;
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > 5.6) continue;
      let c;
      if (r > 4.4) c = dy < 0 || dx < -2 ? 'd' : 'b';
      else if (r > 3.3) c = 'n';
      else if (r > 2) c = 'm';
      else c = 'l';
      set(LX + dx, LY + dy, c);
    }
  }
  set(LX - 1, LY - 2, 'l');
  return g;
}

/** Chân vịt 3 cánh nhìn ngang: cánh trước sáng, cánh sau tối. */
function drawPropeller(g, phase) {
  const setOver = (x, y, c) => {
    if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c;
  };
  const hubY = CY;
  const blades = [0, 1, 2].map((i) => phase + (i * 2 * Math.PI) / 3);
  // Vẽ cánh sau trước, cánh trước sau.
  blades.sort((p, q) => Math.cos(p) - Math.cos(q));
  for (const a of blades) {
    const front = Math.cos(a) > 0;
    const len = Math.abs(9 * Math.sin(a));
    const steps = Math.round(len);
    if (steps < 2) continue; // cánh hướng thẳng vào người xem: chỉ thấy đầu trục
    const dir = Math.sign(Math.sin(a));
    // Cánh hình lá: hẹp ở gốc, rộng 2px ở giữa, bo ở đầu; cánh sau lùi 1px và tối hơn.
    const x0 = front ? 3 : 4;
    for (let s = 2; s <= steps; s++) {
      const y = hubY + dir * s;
      const wide = s > 2 && s < steps;
      const [lit, dark] = front ? ['d', 'c'] : ['b', 'a'];
      setOver(x0 + 1, y, dark);
      if (wide) setOver(x0, y, lit);
    }
  }
  // Đầu chân vịt và trục.
  for (const [x, y, c] of [
    [4, 27, 'd'],
    [3, 28, 'd'],
    [4, 28, 'c'],
    [5, 28, 'c'],
    [4, 29, 'b'],
    [5, 27, 'c'],
    [5, 29, 'b'],
    [6, 27, '3'],
    [6, 28, '2'],
    [6, 29, '1'],
    [7, 28, '2'],
    [8, 28, '2'],
  ]) {
    setOver(x, y, c);
  }
}

/** Viền 1px màu ink quanh mọi pixel đã tô (4 hướng). */
function outline(g) {
  const out = g.map((row) => row.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] !== '.') continue;
      const near = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && nx < W && ny >= 0 && ny < H && g[ny][nx] !== '.';
      });
      if (near) out[y][x] = 'k';
    }
  }
  return out;
}

const PHASES = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2]; // 3 cánh đối xứng 120°: 4 bước 30° là một vòng lặp
const frames = PHASES.map((phase, i) => {
  const g = body();
  drawPropeller(g, phase);
  return {
    name: `spin-${i}`,
    duration: 90,
    ops: [{ op: 'grid', x: 0, y: 0, rows: outline(g).map((r) => r.join('')) }],
  };
});

const recipe = {
  version: 1,
  name: 'navy-submarine',
  width: W,
  height: H,
  palette,
  ramps,
  frames,
  animations: { spin: { frames: frames.map((f) => f.name), loop: true } },
  sheet: { columns: 4, padding: 0, scale: 1, trim: false },
};

writeFileSync(new URL('./submarine.json', import.meta.url), `${JSON.stringify(recipe, null, 2)}\n`);
