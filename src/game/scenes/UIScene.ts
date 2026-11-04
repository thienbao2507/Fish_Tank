import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../config';
import { t } from '../../core/i18n';
import { keysToDirection, type Direction } from '../../core/input';
import { getContext, type GameContext } from '../context';
import { Hud } from '../hud/Hud';
import { HUD_TOP_RESERVED } from '../hud/layout';
import { Toasts } from '../hud/Toasts';
import { VacuumButton } from '../hud/VacuumButton';
import { VirtualJoystick } from '../input/VirtualJoystick';
import { SceneKeys } from './keys';

interface MoveKeys {
  readonly up: Phaser.Input.Keyboard.Key[];
  readonly down: Phaser.Input.Keyboard.Key[];
  readonly left: Phaser.Input.Keyboard.Key[];
  readonly right: Phaser.Input.Keyboard.Key[];
}

const STILL: Direction = { x: 0, y: 0 };

function anyDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

/**
 * Lớp HUD vẽ đè lên GameScene (camera không cuộn): thông số, joystick, nút Hút, thông báo.
 * Ghi hướng điều khiển vào ctx.input mỗi khung hình. Bàn phím (WASD/mũi tên, Space) để test trên PC.
 */
export class UIScene extends Phaser.Scene {
  private ctx!: GameContext;
  private hud!: Hud;
  private vacuumButton!: VacuumButton;
  private toasts!: Toasts;
  private joystick!: VirtualJoystick;
  private moveKeys?: MoveKeys;

  constructor() {
    super(SceneKeys.UI);
  }

  create(): void {
    this.ctx = getContext(this);
    const { world, bus } = this.ctx;
    const toggleVacuum = (): void => {
      world.toggleVacuum();
    };

    this.hud = new Hud(this, world);
    this.vacuumButton = new VacuumButton(this, toggleVacuum);
    this.toasts = new Toasts(this);
    this.joystick = new VirtualJoystick(this, {
      baseRadius: 28,
      knobRadius: 11,
      maxDistance: 24,
      deadzone: 6,
      topInset: HUD_TOP_RESERVED,
    });
    this.setupKeyboard(toggleVacuum);

    const offToast = bus.on('toast', ({ key, params }) => this.toasts.show(t(key, params)));
    const onResize = (gameSize: Phaser.Structs.Size): void => this.layout(gameSize.width);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offToast();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });

    this.layout(this.scale.width);
  }

  override update(): void {
    const direction = this.joystick.isActive ? this.joystick.direction : this.keyboardDirection();
    this.ctx.input.moveX = direction.x;
    this.ctx.input.moveY = direction.y;
    this.hud.refresh();
    this.vacuumButton.setOn(this.ctx.world.robot.vacuumOn);
  }

  private layout(width: number): void {
    this.hud.layout(width);
    this.vacuumButton.layout(width, GAME_HEIGHT);
    this.toasts.layout(width);
  }

  private setupKeyboard(toggleVacuum: () => void): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const { KeyCodes } = Phaser.Input.Keyboard;
    const key = (code: number): Phaser.Input.Keyboard.Key => keyboard.addKey(code);
    this.moveKeys = {
      up: [key(KeyCodes.W), key(KeyCodes.UP)],
      down: [key(KeyCodes.S), key(KeyCodes.DOWN)],
      left: [key(KeyCodes.A), key(KeyCodes.LEFT)],
      right: [key(KeyCodes.D), key(KeyCodes.RIGHT)],
    };
    key(KeyCodes.SPACE).on('down', toggleVacuum);
  }

  private keyboardDirection(): Direction {
    const keys = this.moveKeys;
    if (!keys) return STILL;
    return keysToDirection(
      anyDown(keys.left),
      anyDown(keys.right),
      anyDown(keys.up),
      anyDown(keys.down),
    );
  }
}
