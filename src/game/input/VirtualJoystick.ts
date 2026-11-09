import Phaser from 'phaser';
import { quantizeDirection, type Direction } from '../../core/input';

export interface JoystickOptions {
  /** Bán kính vòng nền (px logic). */
  readonly baseRadius: number;
  readonly knobRadius: number;
  /** Núm đi xa tâm tối đa chừng này. */
  readonly maxDistance: number;
  /** Kéo ngắn hơn chừng này → đứng yên. */
  readonly deadzone: number;
  /** Chạm phía trên đường này (vùng HUD) không mở joystick. */
  readonly topInset: number;
}

const STILL: Direction = { x: 0, y: 0 };
const BASE_FILL = 0x0b1d2e;
const LINE_COLOR = 0xe6f1ff;

/**
 * Joystick nổi 8 hướng: chạm vào nửa trái màn hình thì joystick hiện ngay tại chỗ chạm.
 * Chạm trúng nút (game object tương tác) thì bỏ qua, nên joystick và nút dùng được cùng lúc.
 */
export class VirtualJoystick {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private current: Direction = STILL;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: JoystickOptions,
  ) {
    this.graphics = scene.add.graphics();
    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
      input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
      input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    });
  }

  get isActive(): boolean {
    return this.pointerId !== null;
  }

  get direction(): Direction {
    return this.current;
  }

  reset(): void {
    this.pointerId = null;
    this.current = STILL;
    this.graphics.clear();
  }

  setDepth(depth: number): void {
    this.graphics.setDepth(depth);
  }

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.pointerId !== null || over.length > 0) return;
    if (pointer.x > this.scene.scale.width / 2 || pointer.y < this.options.topInset) return;
    this.pointerId = pointer.id;
    this.originX = Math.round(pointer.x);
    this.originY = Math.round(pointer.y);
    this.track(pointer);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.pointerId) this.track(pointer);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.reset();
  }

  private track(pointer: Phaser.Input.Pointer): void {
    const { maxDistance, deadzone } = this.options;
    const dx = pointer.x - this.originX;
    const dy = pointer.y - this.originY;
    const distance = Math.hypot(dx, dy);
    const k = distance > maxDistance ? maxDistance / distance : 1;
    this.current = quantizeDirection(dx, dy, deadzone);
    this.draw(Math.round(this.originX + dx * k), Math.round(this.originY + dy * k));
  }

  private draw(knobX: number, knobY: number): void {
    const { baseRadius, knobRadius } = this.options;
    this.graphics
      .clear()
      .fillStyle(BASE_FILL, 0.35)
      .fillCircle(this.originX, this.originY, baseRadius)
      .lineStyle(2, LINE_COLOR, 0.5)
      .strokeCircle(this.originX, this.originY, baseRadius)
      .fillStyle(LINE_COLOR, 0.75)
      .fillCircle(knobX, knobY, knobRadius);
  }
}
