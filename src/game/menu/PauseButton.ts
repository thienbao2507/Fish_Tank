import type Phaser from 'phaser';
import { TextureKeys } from '../art/keys';
import { HUD_MARGIN, HUD_TOP_RESERVED } from '../hud/layout';

const SIZE = 20;

/** Nút pause 20px bám góc phải, ngay dưới hai hàng tiền của HUD. */
export class PauseButton {
  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, onPress: () => void, depth?: number) {
    this.image = scene.add
      .image(0, HUD_TOP_RESERVED + SIZE / 2 + 2, TextureKeys.menuPause)
      .setInteractive({ useHandCursor: true });
    this.image.on('pointerdown', onPress);
    if (depth !== undefined) this.image.setDepth(depth);
  }

  layout(width: number): void {
    this.image.setX(width - HUD_MARGIN - SIZE / 2);
  }
}
