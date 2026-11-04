import type Phaser from 'phaser';
import { t } from '../../core/i18n';
import { TextureKeys } from '../art/keys';
import { HUD_MARGIN } from './layout';
import { addPixelText } from './text';

const SIZE = 48;

/** Nút Hút ở góc dưới phải: chạm để bật/tắt; nền sáng = đang bật. */
export class VacuumButton {
  private readonly background: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private on = false;

  constructor(scene: Phaser.Scene, onPress: () => void) {
    this.background = scene.add.image(0, 0, TextureKeys.button).setInteractive();
    this.background.on('pointerdown', onPress);
    this.icon = scene.add.image(0, 0, TextureKeys.iconVacuum);
    this.label = addPixelText(scene, 0, 0, t('ui.vacuum')).setOrigin(0.5, 0);
  }

  layout(width: number, height: number): void {
    const x = width - HUD_MARGIN - SIZE / 2;
    const y = height - HUD_MARGIN - SIZE / 2;
    this.background.setPosition(x, y);
    this.icon.setPosition(x, y - 7);
    this.label.setPosition(x, y + 4);
  }

  setOn(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.background.setTexture(on ? TextureKeys.buttonOn : TextureKeys.button);
  }
}
