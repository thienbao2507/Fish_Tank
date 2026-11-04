/**
 * Độ phân giải logic (pixel art, spec mục 12.1): cao cố định, rộng thay đổi theo tỉ lệ màn hình.
 * Scale.FIT phóng to bằng nearest-neighbor lên màn hình thật.
 */
export const GAME_HEIGHT = 360;
export const GAME_MIN_WIDTH = 640; // 16:9
export const GAME_MAX_WIDTH = 840; // 21:9

/** Font pixel có đủ dấu tiếng Việt, đóng gói trong public/fonts (đường dẫn tương đối với index.html). */
export const UI_FONT_FAMILY = 'VT323';
export const UI_FONT_URL = 'fonts/VT323-Regular.ttf';

/** Bật panel debug bằng cách thêm `?debug=1` vào URL. */
export function isDebugMode(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1';
}
