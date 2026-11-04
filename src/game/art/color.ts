/** "#rrggbb" → số 0xrrggbb (định dạng màu của Phaser). */
export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** Trộn hai màu "#rrggbb" theo tỉ lệ t ∈ [0, 1]; trả về "#rrggbb". */
export function mixHex(from: string, to: string, t: number): string {
  const a = hexToNumber(from);
  const b = hexToNumber(to);
  const channel = (shift: number): number => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  const value = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${value.toString(16).padStart(6, '0')}`;
}
