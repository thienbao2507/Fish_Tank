export const MURK_MAX = 0.38;

export function murkAlpha(water: number): number {
  const clean = Math.max(0, Math.min(100, water));
  return clean >= 85 ? 0 : MURK_MAX * (1 - clean / 85);
}

export function sunrayAlpha(water: number): number {
  const fraction = Math.max(0, Math.min(100, water)) / 100;
  return 0.08 * (1 - fraction) + 0.3 * fraction;
}

/** Đèn pha tàu ngầm: nước càng đục, luồng sáng càng thấy rõ. */
export function headlightAlpha(water: number): number {
  const dirt = 1 - Math.max(0, Math.min(100, water)) / 100;
  return 0.3 + 0.4 * dirt;
}

/** Tỉ lệ hạt lơ lửng còn thấy khi nước sạch hoàn toàn (cho nước có "sự sống"). */
export const SPECK_MIN_RATIO = 0.15;

/** Số hạt lơ lửng hiện ra trong tổng `max`: nước càng bẩn càng nhiều. */
export function speckCount(water: number, max: number): number {
  const dirt = 1 - Math.max(0, Math.min(100, water)) / 100;
  return Math.round(max * (SPECK_MIN_RATIO + (1 - SPECK_MIN_RATIO) * dirt));
}
