import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../config';
import { t } from '../../core/i18n';
import { keysToDirection, type Direction } from '../../core/input';
import { TextureKeys } from '../art/keys';
import { getContext, type GameContext } from '../context';
import { ActionButton } from '../hud/ActionButton';
import { Hud } from '../hud/Hud';
import { HUD_MARGIN, HUD_TOP_RESERVED } from '../hud/layout';
import { SickFishArrows } from '../hud/SickFishArrows';
import type { IsoPrototypeScene } from './IsoPrototypeScene';
import { Toasts } from '../hud/Toasts';
import { VirtualJoystick } from '../input/VirtualJoystick';
import { SceneKeys } from './keys';

interface MoveKeys {
  readonly up: Phaser.Input.Keyboard.Key[];
  readonly down: Phaser.Input.Keyboard.Key[];
  readonly left: Phaser.Input.Keyboard.Key[];
  readonly right: Phaser.Input.Keyboard.Key[];
}

const STILL: Direction = { x: 0, y: 0 };
/** Khoảng cách giữa tâm hai nút trong cụm nút. */
const BUTTON_STEP = ActionButton.SIZE + 8;
const LANE_BUTTON_SIZE = 28;
const LANE_BUTTON_GAP = 4;
const JOYSTICK_RESERVED_DIAMETER = 56;

function anyDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

/**
 * Lớp HUD vẽ đè lên GameScene (camera không cuộn): thông số, joystick, cụm nút, thông báo,
 * mũi tên chỉ cá ốm. Ghi hướng điều khiển vào ctx.input mỗi khung hình.
 * Bàn phím để test trên PC: WASD/mũi tên, Q/E (đổi làn), Space (hút), F (thức ăn), R (thuốc).
 */
export class UIScene extends Phaser.Scene {
  private ctx!: GameContext;
  private hud!: Hud;
  private vacuumButton!: ActionButton;
  private foodButton!: ActionButton;
  private medicineButton!: ActionButton;
  private laneInButton!: ActionButton;
  private laneOutButton!: ActionButton;
  private toasts!: Toasts;
  private joystick!: VirtualJoystick;
  private arrows!: SickFishArrows;
  private moveKeys?: MoveKeys;

  constructor() {
    super(SceneKeys.UI);
  }

  create(): void {
    this.ctx = getContext(this);
    const { world, bus, content } = this.ctx;
    const actions = {
      vacuum: (): void => {
        world.toggleVacuum();
      },
      feed: (): void => {
        world.feed();
      },
      medicine: (): void => {
        world.giveMedicine();
      },
      laneIn: (): void => {
        world.changeLane(1);
      },
      laneOut: (): void => {
        world.changeLane(-1);
      },
    };

    this.hud = new Hud(this, world, content.balance.fish);
    this.vacuumButton = new ActionButton(this, {
      icon: TextureKeys.iconVacuum,
      label: t('ui.vacuum'),
      onPress: actions.vacuum,
    });
    this.foodButton = new ActionButton(this, {
      icon: TextureKeys.iconFood,
      label: t('ui.price', { price: content.balance.food.price }),
      onPress: actions.feed,
    });
    this.medicineButton = new ActionButton(this, {
      icon: TextureKeys.iconMedicine,
      label: t('ui.price', { price: content.balance.medicine.price }),
      onPress: actions.medicine,
    });
    this.laneInButton = new ActionButton(this, {
      icon: TextureKeys.laneIn,
      label: '',
      onPress: actions.laneIn,
      size: LANE_BUTTON_SIZE,
    });
    this.laneOutButton = new ActionButton(this, {
      icon: TextureKeys.laneOut,
      label: '',
      onPress: actions.laneOut,
      size: LANE_BUTTON_SIZE,
    });
    this.toasts = new Toasts(this);
    const gameScene = this.scene.get(SceneKeys.Game) as IsoPrototypeScene;
    this.arrows = new SickFishArrows(this, world, (fish) => gameScene.toScreen(fish));
    this.joystick = new VirtualJoystick(this, {
      baseRadius: 28,
      knobRadius: 11,
      maxDistance: 24,
      deadzone: 6,
      topInset: HUD_TOP_RESERVED,
    });
    this.setupKeyboard(actions);

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
    const { world, content, input } = this.ctx;
    const direction = this.joystick.isActive ? this.joystick.direction : this.keyboardDirection();
    input.moveX = direction.x;
    input.moveY = direction.y;

    this.hud.refresh();
    this.vacuumButton.setOn(world.robot.vacuumOn);
    this.foodButton.setEnabled(world.wallet.get('coins') >= content.balance.food.price);
    this.medicineButton.setEnabled(world.canGiveMedicine());
    this.laneInButton.setEnabled(world.robot.lane < 2);
    this.laneOutButton.setEnabled(world.robot.lane > 0);
    this.arrows.draw(this.scale.width, GAME_HEIGHT);
  }

  /** Cụm nút góc dưới phải: Hút ở góc, Thức ăn bên trái, Thuốc phía trên. */
  private layout(width: number): void {
    const cornerX = width - HUD_MARGIN - ActionButton.SIZE / 2;
    const cornerY = GAME_HEIGHT - HUD_MARGIN - ActionButton.SIZE / 2;
    this.vacuumButton.setPosition(cornerX, cornerY);
    this.foodButton.setPosition(cornerX - BUTTON_STEP, cornerY);
    this.medicineButton.setPosition(cornerX, cornerY - BUTTON_STEP);
    const laneX = HUD_MARGIN + LANE_BUTTON_SIZE / 2;
    const laneOutY =
      GAME_HEIGHT -
      HUD_MARGIN -
      JOYSTICK_RESERVED_DIAMETER -
      LANE_BUTTON_GAP -
      LANE_BUTTON_SIZE / 2;
    const laneInY = laneOutY - LANE_BUTTON_SIZE - LANE_BUTTON_GAP;
    this.laneInButton.setPosition(laneX, laneInY);
    this.laneOutButton.setPosition(laneX, laneOutY);
    this.hud.layout(width);
    this.hud.layoutLaneIndicator(laneX + LANE_BUTTON_SIZE / 2 + 7, (laneInY + laneOutY) / 2);
    this.toasts.layout(width);
  }

  private setupKeyboard(actions: {
    vacuum: () => void;
    feed: () => void;
    medicine: () => void;
    laneIn: () => void;
    laneOut: () => void;
  }): void {
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
    key(KeyCodes.SPACE).on('down', actions.vacuum);
    key(KeyCodes.F).on('down', actions.feed);
    key(KeyCodes.R).on('down', actions.medicine);
    key(KeyCodes.Q).on('down', actions.laneIn);
    key(KeyCodes.E).on('down', actions.laneOut);
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
