import Phaser from 'phaser';
import { TextureKeys } from '../art/keys';
import { getSoundDirector } from '../audio/SoundDirector';
import { addPixelText } from './text';

export interface ActionButtonOptions {
  readonly icon: string;
  readonly label: string;
  readonly onPress: () => void;
  /** Báo bắt đầu/kết thúc giữ nút; kết thúc cả khi kéo ra ngoài hoặc game mất focus. */
  readonly onHold?: (active: boolean) => void;
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
  private holdPointerId: number | null = null;

  constructor(
    scene: Phaser.Scene,
    { icon, label, onPress, onHold, size = ActionButton.SIZE }: ActionButtonOptions,
  ) {
    this.background = scene.add
      .image(0, 0, TextureKeys.button)
      .setDisplaySize(size, size)
      .setInteractive();
    this.background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      getSoundDirector(scene).play('click');
      onPress();
      if (!onHold || this.holdPointerId !== null) return;
      this.holdPointerId = pointer.id;
      onHold(true);
    });
    if (onHold) {
      const release = (pointer?: Phaser.Input.Pointer): void => {
        if (this.holdPointerId === null) return;
        if (pointer && pointer.id !== this.holdPointerId) return;
        this.holdPointerId = null;
        onHold(false);
      };
      const releaseAll = (): void => release();
      this.background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, release);
      this.background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, release);
      scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
      scene.input.on(Phaser.Input.Events.GAME_OUT, releaseAll);
      scene.game.events.on(Phaser.Core.Events.BLUR, releaseAll);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        releaseAll();
        scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
        scene.input.off(Phaser.Input.Events.GAME_OUT, releaseAll);
        scene.game.events.off(Phaser.Core.Events.BLUR, releaseAll);
      });
    }
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
    else {
      this.background.disableInteractive();
      this.background.emit(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT);
    }
  }

  setDepth(depth: number): void {
    this.background.setDepth(depth);
    this.icon.setDepth(depth);
    this.label.setDepth(depth);
  }
}
