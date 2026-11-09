export const LANE_COUNT = 3;

/** Làm tròn vị trí sâu liên tục về làn gần nhất và kẹp trong phạm vi hợp lệ. */
export function nearestLane(z: number): number {
  return Math.min(LANE_COUNT - 1, Math.max(0, Math.round(z)));
}

/** Trượt `z` về làn đích tối đa `maxStep`, không bao giờ đi quá đích. */
export function stepLane(z: number, targetLane: number, maxStep: number): number {
  const step = Math.max(0, maxStep);
  if (z < targetLane) return Math.min(targetLane, z + step);
  return Math.max(targetLane, z - step);
}
