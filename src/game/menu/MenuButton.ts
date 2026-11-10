import type Phaser from 'phaser';
import type { StringKey } from '../../core/i18n';
import { t } from '../../core/i18n';
import { TextureKeys } from '../art/keys';
import { addPixelText } from '../hud/text';

const BUTTON_WIDTH = 252;
const BUTTON_HEIGHT = 34;
const BUTTON_SLICE = 6;

export class MenuButton {
  readonly background: Phaser.GameObjects.NineSlice;
  readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    y: number,
    labelKey: StringKey,
    onHover: () => void,
    onPress: () => void,
    width = BUTTON_WIDTH,
  ) {
    this.background = scene.add
      .nineslice(
        0,
        y,
        TextureKeys.menuButton,
        0,
        width,
        BUTTON_HEIGHT,
        BUTTON_SLICE,
        BUTTON_SLICE,
        BUTTON_SLICE,
        BUTTON_SLICE,
      )
      .setInteractive({ useHandCursor: true });
    this.background.on('pointerover', onHover);
    this.background.on('pointerdown', onPress);
    this.label = addPixelText(scene, 0, y, t(labelKey)).setOrigin(0.5);
    parent.add([this.background, this.label]);
  }

  setSelected(selected: boolean): void {
    this.background.setFrame(selected ? 1 : 0);
  }
}
