import type Phaser from 'phaser';
import { TextureKeys } from '../art/keys';
import { addPixelText } from './text';

export interface ActionButtonOptions {
  readonly icon: string;
  readonly label: string;
  readonly onPress: () => void;
  /** Cạnh nút hiển thị; mặc định 48px. */
  readonly size?: number;
}

const DISABLED_ALPHA = 0.45;

/**
 * Nút vuông 48px ở cụm nút bên phải: icon + nhãn ngắn.
 * `setOn` đổi nền sáng (đang bật), `setEnabled(false)` làm mờ (vẫn bấm được để hiện thông báo lý do).
 */
export class ActionButton {
  static readonly SIZE = 48;

  private readonly background: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly iconOnly: boolean;
  private on = false;
  private enabled = true;
  private visible = true;

  constructor(
    scene: Phaser.Scene,
    { icon, label, onPress, size = ActionButton.SIZE }: ActionButtonOptions,
  ) {
    this.background = scene.add
      .image(0, 0, TextureKeys.button)
      .setDisplaySize(size, size)
      .setInteractive();
    this.background.on('pointerdown', onPress);
    this.icon = scene.add.image(0, 0, icon);
    this.label = addPixelText(scene, 0, 0, label).setOrigin(0.5, 0);
    this.iconOnly = label.length === 0;
  }

  /** Chiều rộng nhãn chữ (px logic), để đặt nút sát mép mà nhãn không bị cắt. */
  get labelWidth(): number {
    return this.label.width;
  }

  /** Đặt tâm nút. */
  setPosition(x: number, y: number): void {
    this.background.setPosition(x, y);
    this.icon.setPosition(x, this.iconOnly ? y : y - 7);
    this.label.setPosition(x, y + 4);
  }

  setOn(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.background.setTexture(on ? TextureKeys.buttonOn : TextureKeys.button);
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    const alpha = enabled ? 1 : DISABLED_ALPHA;
    this.background.setAlpha(alpha);
    this.icon.setAlpha(alpha);
    this.label.setAlpha(alpha);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.background.setVisible(visible);
    this.icon.setVisible(visible);
    this.label.setVisible(visible);
    if (visible) this.background.setInteractive();
    else this.background.disableInteractive();
  }

  setDepth(depth: number): void {
    this.background.setDepth(depth);
    this.icon.setDepth(depth);
    this.label.setDepth(depth);
  }
}
