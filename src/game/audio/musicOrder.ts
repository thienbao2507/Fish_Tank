/** Chỉ số bài kế tiếp, quay vòng về bài đầu sau bài cuối. */
export function nextTrackIndex(current: number, count: number): number {
  if (count <= 0) return 0;
  return (current + 1) % count;
}
