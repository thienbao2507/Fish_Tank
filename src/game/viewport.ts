import { GAME_HEIGHT, GAME_MAX_WIDTH, GAME_MIN_WIDTH } from '../config';

/**
 * Chiều rộng logic cho một khung hiển thị (spec mục 12.1):
 * giữ chiều cao GAME_HEIGHT, kéo rộng theo tỉ lệ màn hình trong [GAME_MIN_WIDTH, GAME_MAX_WIDTH].
 * Màn hình hẹp hơn 16:9 → GAME_MIN_WIDTH (Scale.FIT tạo viền trên dưới).
 */
export function viewWidthFor(parentWidth: number, parentHeight: number): number {
  if (!(parentWidth > 0) || !(parentHeight > 0)) {
    return GAME_MIN_WIDTH;
  }
  const width = Math.round((GAME_HEIGHT * parentWidth) / parentHeight);
  return Math.min(GAME_MAX_WIDTH, Math.max(GAME_MIN_WIDTH, width));
}
