import type Phaser from 'phaser';
import { HUD_TOP_RESERVED } from './layout';
import { addPixelText } from './text';

const VISIBLE_MS = 1800;
const FADE_MS = 400;

/** Thông báo ngắn giữa mép trên; thông báo mới thay thế thông báo cũ. */
export class Toasts {
  private readonly text: Phaser.GameObjects.Text;
  private fade?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene) {
    this.text = addPixelText(scene, 0, HUD_TOP_RESERVED + 4, '')
      .setOrigin(0.5, 0)
      .setBackgroundColor('rgba(11, 29, 46, 0.8)')
      .setPadding(6, 2, 6, 2)
      .setAlpha(0);
  }

  layout(width: number): void {
    this.text.setX(Math.round(width / 2));
  }

  show(message: string): void {
    this.fade?.stop();
    this.text.setText(message).setAlpha(1);
    this.fade = this.scene.tweens.add({
      targets: this.text,
      alpha: 0,
      delay: VISIBLE_MS,
      duration: FADE_MS,
    });
  }
}
