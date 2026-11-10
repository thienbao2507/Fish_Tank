import type { DayBalance } from '../../core/time/dayClock';

/** Trọng số bốn ảnh cửa sổ; tổng luôn bằng 1. */
export interface WindowWeights {
  readonly night: number;
  readonly morning: number;
  readonly noon: number;
  readonly dusk: number;
}

export interface DayLight {
  readonly windows: WindowWeights;
  /** Độ đậm lớp nắng ban mai, 0–1. */
  readonly sun: number;
  /** Hệ số nhân alpha cho các lớp đèn: đêm 1, ban ngày thấp hơn. */
  readonly lights: number;
  /** Lớp tối phủ phòng. */
  readonly shade: { readonly alpha: number; readonly color: number };
}

const MINUTES_PER_DAY = 1440;
/** Nửa bề rộng (phút) của khoảng chuyển mượt quanh mỗi mốc buổi: tổng 60 phút. */
const BLEND_HALF = 30;
const DAY_LIGHT_FACTOR = 0.4;
const NIGHT_SHADE_COLOR = 0x0b1230;

type Point = readonly [minute: number, value: number];

/** Độ sáng ban ngày (0 đêm, 1 ngày) theo giờ; dùng để hạ độ sáng các đèn. */
const DAYLIGHT: readonly Point[] = [
  [0, 0],
  [330, 0],
  [420, 1],
  [1080, 1],
  [1200, 0],
  [1440, 0],
];
/** Nắng ban mai: cao nhất 06:30–09:30, tắt dần tới chiều tối. */
const SUN: readonly Point[] = [
  [0, 0],
  [360, 0],
  [390, 1],
  [570, 1],
  [840, 0.4],
  [1080, 0],
  [1440, 0],
];
/** Alpha lớp tối: đêm ~0.35, ngày 0, chiều chạng vạng nhẹ. */
const SHADE: readonly Point[] = [
  [0, 0.35],
  [300, 0.35],
  [390, 0],
  [1020, 0],
  [1110, 0.12],
  [1200, 0.35],
  [1440, 0.35],
];

function curve(points: readonly Point[], minute: number): number {
  for (let i = 1; i < points.length; i++) {
    const [m1, v1] = points[i] as Point;
    if (minute <= m1) {
      const [m0, v0] = points[i - 1] as Point;
      const t = m1 === m0 ? 1 : (minute - m0) / (m1 - m0);
      return v0 + (v1 - v0) * t;
    }
  }
  return (points[points.length - 1] as Point)[1];
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

type WindowKey = keyof WindowWeights;

/** Trọng số cửa sổ: chuyển mượt trong 60 phút quanh mỗi mốc buổi. */
export function windowWeights(balance: DayBalance, minute: number): WindowWeights {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const boundaries: readonly { at: number; before: WindowKey; after: WindowKey }[] = [
    { at: balance.morningFrom, before: 'night', after: 'morning' },
    { at: balance.noonFrom, before: 'morning', after: 'noon' },
    // Buổi chiều 14–17 vẫn là trời trưa; hoàng hôn từ duskFrom (17:00).
    { at: balance.duskFrom, before: 'noon', after: 'dusk' },
    { at: balance.nightFrom, before: 'dusk', after: 'night' },
  ];
  const weights = { night: 0, morning: 0, noon: 0, dusk: 0 };
  for (const { at, before, after } of boundaries) {
    // Khoảng cách có dấu tới mốc, tính vòng quanh ngày.
    let delta = m - at;
    if (delta > MINUTES_PER_DAY / 2) delta -= MINUTES_PER_DAY;
    if (delta < -MINUTES_PER_DAY / 2) delta += MINUTES_PER_DAY;
    if (Math.abs(delta) < BLEND_HALF) {
      const t = smoothstep((delta + BLEND_HALF) / (2 * BLEND_HALF));
      weights[before] = 1 - t;
      weights[after] = t;
      return weights;
    }
  }
  // Ngoài vùng chuyển: lấy buổi của giờ hiện tại.
  if (m >= balance.nightFrom || m < balance.morningFrom) weights.night = 1;
  else if (m >= balance.duskFrom) weights.dusk = 1;
  else if (m >= balance.noonFrom) weights.noon = 1;
  else weights.morning = 1;
  return weights;
}

/** Toàn bộ thông số ánh sáng của phòng tại một giờ trong ngày (phút, 0–1439.99). */
export function dayLightAt(balance: DayBalance, minute: number): DayLight {
  const m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const daylight = curve(DAYLIGHT, m);
  return {
    windows: windowWeights(balance, m),
    sun: curve(SUN, m),
    lights: 1 - (1 - DAY_LIGHT_FACTOR) * daylight,
    shade: { alpha: curve(SHADE, m), color: NIGHT_SHADE_COLOR },
  };
}
