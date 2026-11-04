import type Phaser from 'phaser';
import { UI_FONT_FAMILY } from '../../config';

export const TEXT_COLOR = '#e6f1ff';
export const SHADOW_COLOR = '#0b1d2e';
export const WARNING_COLOR = '#ff8a80';
export const COIN_COLOR = '#f2c94c';

/** Chữ pixel (VT323 16px) có bóng 1px để đọc được trên nền nước. */
export function addPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: UI_FONT_FAMILY, fontSize: '16px', color: TEXT_COLOR })
    .setShadow(1, 1, SHADOW_COLOR, 0, false, true);
}
