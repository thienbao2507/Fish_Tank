import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../config';
import { t } from '../../core/i18n';
import { keysToDirection, type Direction } from '../../core/input';
import { nearestLane } from '../../core/sim/lanes';
import { InventoryWindow } from '../../ui/inventory';
import { TextureKeys } from '../art/keys';
import { getSoundDirector } from '../audio/SoundDirector';
import { getContext, type GameContext } from '../context';
import { ActionButton } from '../hud/ActionButton';
import { Hud } from '../hud/Hud';
import { HUD_MARGIN, HUD_TOP_RESERVED } from '../hud/layout';
import { SickFishArrows } from '../hud/SickFishArrows';
import type { IsoPrototypeScene } from './IsoPrototypeScene';
import { Toasts } from '../hud/Toasts';
import { VirtualJoystick } from '../input/VirtualJoystick';
import { PauseButton } from '../menu/PauseButton';
import { enterRoom, openPauseMenu } from '../sceneFlow';
import { SceneKeys } from './keys';

interface MoveKeys {
  readonly up: Phaser.Input.Keyboard.Key[];
  readonly down: Phaser.Input.Keyboard.Key[];
  readonly left: Phaser.Input.Keyboard.Key[];
  readonly right: Phaser.Input.Keyboard.Key[];
}

interface DiveKeys {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
}

const STILL: Direction = { x: 0, y: 0 };
/** Khoảng cách giữa tâm hai nút trong cụm nút. */
const BUTTON_STEP = ActionButton.SIZE + 8;
const DIVE_BUTTON_SIZE = 28;
const DEPTH_GAUGE_GAP = 7;

function anyDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

/**
 * Lớp HUD vẽ đè lên GameScene (camera không cuộn): thông số, joystick, cụm nút, thông báo,
 * mũi tên chỉ cá ốm. Ghi hướng điều khiển vào ctx.input mỗi khung hình.
 * Bàn phím để test trên PC: WASD/mũi tên, giữ Q/E (nổi/lặn), Space (hút), F (thức ăn), R (thuốc).
 */
export class UIScene extends Phaser.Scene {
  private ctx!: GameContext;
  private hud!: Hud;
  private vacuumButton!: ActionButton;
  private foodButton!: ActionButton;
  private medicineButton!: ActionButton;
  private diveUpButton!: ActionButton;
  private diveDownButton!: ActionButton;
  private backToRoomButton!: ActionButton;
  private inventoryButton!: ActionButton;
  private pauseButton!: PauseButton;
  private toasts!: Toasts;
  private joystick!: VirtualJoystick;
  private arrows!: SickFishArrows;
  private moveKeys?: MoveKeys;
  private diveKeys?: DiveKeys;
  private diveUpHeld = false;
  private diveDownHeld = false;
  private inventoryWindow?: InventoryWindow;
  private lastRobotLane = 0;

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
        if (world.feed()) getSoundDirector(this).play('feed');
      },
      medicine: (): void => {
        world.giveMedicine();
      },
      backToRoom: (): void => {
        this.resetDiveInput();
        enterRoom(this);
      },
      inventory: (): void => {
        this.openInventory();
      },
      pause: (): void => {
        this.openPauseMenu();
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
    this.diveUpButton = new ActionButton(this, {
      icon: TextureKeys.laneIn,
      label: '',
      onPress: () => undefined,
      onHold: (active) => this.setDiveHeld(1, active),
      size: DIVE_BUTTON_SIZE,
    });
    this.diveDownButton = new ActionButton(this, {
      icon: TextureKeys.laneOut,
      label: '',
      onPress: () => undefined,
      onHold: (active) => this.setDiveHeld(-1, active),
      size: DIVE_BUTTON_SIZE,
    });
    this.backToRoomButton = new ActionButton(this, {
      icon: TextureKeys.iconRoom,
      label: t('ui.backToRoom'),
      onPress: actions.backToRoom,
      size: DIVE_BUTTON_SIZE,
    });
    this.inventoryButton = new ActionButton(this, {
      icon: TextureKeys.iconInventory,
      label: t('ui.inventory'),
      onPress: actions.inventory,
      size: DIVE_BUTTON_SIZE,
    });
    this.pauseButton = new PauseButton(this, actions.pause, 100);
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
    this.lastRobotLane = nearestLane(world.robot.z);

    const offToast = bus.on('toast', ({ key, params }) => {
      if (!this.scene.isSleeping(SceneKeys.UI) && !this.scene.isPaused(SceneKeys.UI)) {
        this.toasts.show(t(key, params));
      }
    });
    const onResize = (gameSize: Phaser.Structs.Size): void => this.layout(gameSize.width);
    const onWake = (): void => {
      this.joystick.reset();
      this.input.keyboard?.resetKeys();
      this.ctx.input.moveX = 0;
      this.ctx.input.moveY = 0;
      this.resetDiveInput();
      this.lastRobotLane = nearestLane(this.ctx.world.robot.z);
      this.ctx.world.returnToTank(this.ctx.clock.now());
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.on(Phaser.Scenes.Events.WAKE, onWake);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inventoryWindow?.destroy();
      getSoundDirector(this).resume('inventory');
      this.inventoryWindow = undefined;
      offToast();
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.events.off(Phaser.Scenes.Events.WAKE, onWake);
      this.resetDiveInput();
    });

    this.layout(this.scale.width);
    world.returnToTank(this.ctx.clock.now());
  }

  override update(): void {
    const { world, content, input } = this.ctx;
    world.checkDeliveries(this.ctx.clock.now());
    this.refreshDiveInput();
    const direction = this.joystick.isActive ? this.joystick.direction : this.keyboardDirection();
    input.moveX = direction.x;
    input.moveY = direction.y;

    this.hud.refresh();
    this.vacuumButton.setOn(world.robot.vacuumOn);
    this.foodButton.setEnabled(world.wallet.get('coins') >= content.balance.food.price);
    this.medicineButton.setEnabled(world.canGiveMedicine());
    this.diveUpButton.setEnabled(world.robot.z < 2);
    this.diveDownButton.setEnabled(world.robot.z > 0);
    this.arrows.draw(this.scale.width, GAME_HEIGHT);
    const robotLane = nearestLane(world.robot.z);
    if (robotLane !== this.lastRobotLane) {
      this.lastRobotLane = robotLane;
      getSoundDirector(this).play('lane');
    }
  }

  /** Cụm nút phải đặt theo lưới `BUTTON_STEP`, đủ khoảng trống cho từng vùng chạm. */
  private layout(width: number): void {
    const cornerX = width - HUD_MARGIN - ActionButton.SIZE / 2;
    const cornerY = GAME_HEIGHT - HUD_MARGIN - ActionButton.SIZE / 2;
    const foodX = cornerX - BUTTON_STEP;
    const upperY = cornerY - BUTTON_STEP;
    this.vacuumButton.setPosition(cornerX, cornerY);
    this.foodButton.setPosition(foodX, cornerY);
    this.medicineButton.setPosition(cornerX, upperY);
    this.backToRoomButton.setPosition(foodX, upperY);

    const diveX = foodX - BUTTON_STEP;
    this.diveUpButton.setPosition(diveX, upperY);
    this.diveDownButton.setPosition(diveX, cornerY);
    this.hud.layoutDepthGauge(
      diveX - DIVE_BUTTON_SIZE / 2 - DEPTH_GAUGE_GAP,
      (upperY + cornerY) / 2,
    );

    // Kho giữ góc trên trái; chỉ nhãn của chính nó quyết định khoảng lùi khỏi mép.
    const inventoryHalf = Math.ceil(
      Math.max(DIVE_BUTTON_SIZE, this.inventoryButton.labelWidth) / 2,
    );
    this.inventoryButton.setPosition(
      HUD_MARGIN + inventoryHalf,
      HUD_TOP_RESERVED + DIVE_BUTTON_SIZE / 2,
    );
    this.pauseButton.layout(width);
    this.hud.layout(width);
    this.toasts.layout(width);
  }

  private setupKeyboard(actions: {
    vacuum: () => void;
    feed: () => void;
    medicine: () => void;
    pause: () => void;
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
    this.diveKeys = {
      up: key(KeyCodes.Q),
      down: key(KeyCodes.E),
    };
    key(KeyCodes.SPACE).on('down', actions.vacuum);
    key(KeyCodes.F).on('down', actions.feed);
    key(KeyCodes.R).on('down', actions.medicine);
    key(KeyCodes.ESC).on('down', actions.pause);
  }

  private openPauseMenu(): void {
    if (this.inventoryWindow) return;
    this.joystick.reset();
    this.input.keyboard?.resetKeys();
    this.ctx.input.moveX = 0;
    this.ctx.input.moveY = 0;
    this.resetDiveInput();
    openPauseMenu(this, 'tank');
  }

  private openInventory(): void {
    if (this.inventoryWindow) return;
    const sound = getSoundDirector(this);
    const inventory = new InventoryWindow({
      world: this.ctx.world,
      content: this.ctx.content,
      playSound: (cue) => sound.play(cue),
      onClose: () => {
        if (this.inventoryWindow !== inventory) return;
        this.inventoryWindow = undefined;
        sound.resume('inventory');
        this.scene.resume(SceneKeys.Game);
        this.scene.resume(SceneKeys.UI);
        this.joystick.reset();
        this.input.keyboard?.resetKeys();
        this.ctx.input.moveX = 0;
        this.ctx.input.moveY = 0;
        this.resetDiveInput();
      },
    });
    this.inventoryWindow = inventory;
    sound.suspend('inventory');
    inventory.open();
    this.ctx.input.moveX = 0;
    this.ctx.input.moveY = 0;
    this.resetDiveInput();
    this.scene.pause(SceneKeys.Game);
    this.scene.pause(SceneKeys.UI);
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

  private setDiveHeld(direction: 1 | -1, active: boolean): void {
    if (direction === 1) this.diveUpHeld = active;
    else this.diveDownHeld = active;
    this.refreshDiveInput();
  }

  private refreshDiveInput(): void {
    const up = this.diveUpHeld || this.diveKeys?.up.isDown === true;
    const down = this.diveDownHeld || this.diveKeys?.down.isDown === true;
    this.ctx.input.dive = up === down ? 0 : up ? 1 : -1;
  }

  private resetDiveInput(): void {
    this.diveUpHeld = false;
    this.diveDownHeld = false;
    this.ctx.input.dive = 0;
  }
}
