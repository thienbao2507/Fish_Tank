/** Bộ sinh số ngẫu nhiên có seed (mulberry32): cùng seed → cùng chuỗi, để test và tái hiện lỗi. */
export interface Rng {
  /** Số thực trong [0, 1). */
  next(): number;
  /** Số nguyên trong [min, max], bao gồm cả hai đầu. */
  int(min: number, max: number): number;
  /** true với xác suất `probability` (0–1). */
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export interface Weighted<T> {
  readonly item: T;
  readonly weight: number;
}

/** Chọn một phần tử theo tỉ trọng (weight càng lớn càng dễ được chọn). */
export function pickWeighted<T>(rng: Rng, entries: readonly Weighted<T>[]): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) {
    throw new RangeError('Tổng tỉ trọng phải lớn hơn 0');
  }
  let roll = rng.next() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry.item;
  }
  // Sai số dấu phẩy động: rơi vào phần tử cuối.
  return (entries.at(-1) as Weighted<T>).item;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    int(min: number, max: number): number {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`Khoảng số nguyên không hợp lệ: [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(probability: number): boolean {
      return next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError('Không thể chọn từ danh sách rỗng');
      }
      return items[Math.floor(next() * items.length)] as T;
    },
  };
}
