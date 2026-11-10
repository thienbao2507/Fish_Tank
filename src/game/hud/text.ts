import type Phaser from 'phaser';
import { UI_FONT_FAMILY } from '../../config';

export const TEXT_COLOR = '#e6f1ff';
export const SHADOW_COLOR = '#0b1d2e';
export const WARNING_COLOR = '#ff8a80';
export const COIN_COLOR = '#f2c94c';

/**
 * Mọi điểm của SVN-Determination Sans nằm trên lưới 75/1000 em, nên ở cỡ này mỗi ô pixel của font
 * khớp đúng một pixel logic. Cỡ khác (vd. 16px) làm nét dày mỏng không đều và nhòe khi phóng to.
 */
export const UI_FONT_SIZE = 1000 / 75;
/** Pixel nào đặc từ mức này trở lên thì giữ hẳn, thấp hơn thì bỏ: chữ không còn mép xám khử răng cưa. */
const ALPHA_CUTOFF = 128;

function snapAlpha(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
  if (canvas.width === 0 || canvas.height === 0) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 3; i < data.length; i += 4) {
    data[i] = (data[i] as number) >= ALPHA_CUTOFF ? 255 : 0;
  }
  context.putImageData(image, 0, 0);
}

/** Chữ pixel (font UI ở cỡ khớp lưới) có bóng 1px để đọc được trên nền nước. */
export function addPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
): Phaser.GameObjects.Text {
  const label = scene.add.text(x, y, text, {
    fontFamily: UI_FONT_FAMILY,
    fontSize: `${UI_FONT_SIZE}px`,
    color: TEXT_COLOR,
  });
  // Phaser gọi context.restore() ngay sau khi vẽ chữ và trước khi đưa canvas lên texture,
  // nên lọc ngưỡng ở đây áp dụng cho mọi lần cập nhật chữ.
  const { canvas, context } = label;
  const restore = context.restore.bind(context);
  context.restore = (): void => {
    restore();
    snapAlpha(canvas, context);
  };
  return label.setShadow(1, 1, SHADOW_COLOR, 0, false, true);
}
