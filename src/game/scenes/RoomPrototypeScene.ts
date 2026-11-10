import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../config';
import { t } from '../../core/i18n';
import { keysToDirection, type Direction } from '../../core/input';
import { PcDesktop } from '../../ui/pcDesktop';
import { TextureKeys } from '../art/keys';
import { getContext, type GameContext } from '../context';
import { addCameraBloom } from '../env/bloom';
import { ActionButton } from '../hud/ActionButton';
import { HUD_MARGIN } from '../hud/layout';
import { Toasts } from '../hud/Toasts';
import { VirtualJoystick } from '../input/VirtualJoystick';
import {
  facingFromDirection,
  HERO_SPEED,
  HERO_START,
  heroDepth,
  moveInRoomByDirection,
  nearestInteraction,
  projectRoom,
  ROOM_DOOR_GLOW,
  ROOM_INTERACTIONS,
  ROOM_LIGHT_DEPTH,
  ROOM_LIGHTS,
  ROOM_PROPS,
  ROOM_SHELL_WIDTH,
  ROOM_SHELL_Y,
  type RoomFacing,
  type RoomPosition,
} from '../room/layout';
import { RoomHud } from '../room/RoomHud';
import { enterTank, openPauseMenu } from '../sceneFlow';
import { SceneKeys } from './keys';

interface MoveKeys {
  readonly up: Phaser.Input.Keyboard.Key[];
  readonly down: Phaser.Input.Keyboard.Key[];
  readonly left: Phaser.Input.Keyboard.Key[];
  readonly right: Phaser.Input.Keyboard.Key[];
}

interface PropView {
  readonly prop: (typeof ROOM_PROPS)[number];
  readonly image: Phaser.GameObjects.Image;
}

const STILL: Direction = { x: 0, y: 0 };
const MAX_FRAME_SECONDS = 0.1;
const HERO_FRONT_ANIMATION = 'room.hero.front.walk';
const HERO_BACK_ANIMATION = 'room.hero.back.walk';
const ROOM_INTERACTIONS_WITHOUT_DOOR = ROOM_INTERACTIONS.filter(({ id }) => id !== 'door');

function anyDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

export class RoomPrototypeScene extends Phaser.Scene {
  private ctx!: GameContext;
  private shell!: Phaser.GameObjects.Image;
  private propViews: PropView[] = [];
  private hero!: Phaser.GameObjects.Sprite;
  private lightLayers: Phaser.GameObjects.Image[] = [];
  private joystick!: VirtualJoystick;
  private enterTankButton!: ActionButton;
  private usePcButton!: ActionButton;
  private collectButton!: ActionButton;
  private doorGlow!: Phaser.GameObjects.Image;
  private toasts!: Toasts;
  private roomHud!: RoomHud;
  private moveKeys?: MoveKeys;
  private activeInteractionId: string | null = null;
  private pcDesktop?: PcDesktop;
  private shellX = 0;
  private position: RoomPosition = { ...HERO_START };
  private facing: RoomFacing = 'SE';

  constructor() {
    super(SceneKeys.Room);
  }

  create(): void {
    this.ctx = getContext(this);
    this.ctx.world.leaveTank(this.ctx.clock.now());
    this.cameras.main.setBackgroundColor('#140f1c');
    this.shell = this.add.image(0, 0, TextureKeys.roomShell).setOrigin(0, 0);
    this.propViews = ROOM_PROPS.map((prop) => ({
      prop,
      image: this.add.image(0, 0, TextureKeys[prop.key]).setOrigin(0, 0).setDepth(prop.depth),
    }));

    this.createHeroAnimations();
    this.hero = this.add.sprite(0, 0, TextureKeys.roomHero, 0).setOrigin(12 / 24, 42 / 44);
    this.lightLayers = ROOM_LIGHTS.map(({ key, alpha }) =>
      this.add
        .image(0, 0, TextureKeys[key])
        .setOrigin(0, 0)
        .setDepth(ROOM_LIGHT_DEPTH)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    this.doorGlow = this.add
      .image(0, 0, TextureKeys.roomDoorGlow)
      .setOrigin(0, 0)
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.joystick = new VirtualJoystick(this, {
      baseRadius: 28,
      knobRadius: 11,
      maxDistance: 24,
      deadzone: 6,
      topInset: 0,
    });
    this.joystick.setDepth(ROOM_LIGHT_DEPTH + 1);
    this.enterTankButton = new ActionButton(this, {
      icon: TextureKeys.iconTank,
      label: t('ui.enterTank'),
      onPress: () => this.activateInteraction(),
    });
    this.enterTankButton.setDepth(ROOM_LIGHT_DEPTH + 1);
    this.usePcButton = new ActionButton(this, {
      icon: TextureKeys.iconPc,
      label: t('ui.usePc'),
      onPress: () => this.activateInteraction(),
    });
    this.usePcButton.setDepth(ROOM_LIGHT_DEPTH + 1);
    this.collectButton = new ActionButton(this, {
      icon: TextureKeys.iconDoor,
      label: t('ui.collect'),
      onPress: () => this.activateInteraction(),
    });
    this.collectButton.setDepth(ROOM_LIGHT_DEPTH + 1);
    this.toasts = new Toasts(this);
    (this.children.list[this.children.list.length - 1] as Phaser.GameObjects.Text).setDepth(
      ROOM_LIGHT_DEPTH + 2,
    );
    this.roomHud = new RoomHud(this, this.ctx.world, () => this.openPauseMenu());
    this.setupKeyboard();
    addCameraBloom(this, { threshold: 0.86, blendAmount: 0.4 });

    const onResize = (gameSize: Phaser.Structs.Size): void => this.layout(gameSize.width);
    const offToast = this.ctx.bus.on('toast', ({ key, params }) => {
      if (!this.scene.isSleeping(SceneKeys.Room) && !this.scene.isPaused(SceneKeys.Room)) {
        this.toasts.show(t(key, params));
      }
    });
    const onWake = (): void => {
      this.ctx.world.leaveTank(this.ctx.clock.now());
      this.joystick.reset();
      this.input.keyboard?.resetKeys();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.on(Phaser.Scenes.Events.WAKE, onWake);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pcDesktop?.destroy();
      this.pcDesktop = undefined;
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.events.off(Phaser.Scenes.Events.WAKE, onWake);
      offToast();
    });
    this.layout(this.scale.width);
    this.updateHero(false);
    this.refreshDeliveryState(0);
    this.roomHud.refresh();
  }

  override update(time: number, delta: number): void {
    this.ctx.world.checkDeliveries(this.ctx.clock.now());
    const direction = this.joystick.isActive ? this.joystick.direction : this.keyboardDirection();
    const nextFacing = facingFromDirection(direction, this.facing);
    let moved = false;
    if (nextFacing) {
      this.facing = nextFacing;
      const previous = this.position;
      const seconds = Math.min(Math.max(delta, 0) / 1000, MAX_FRAME_SECONDS);
      this.position = moveInRoomByDirection(previous, direction, HERO_SPEED * seconds);
      moved = this.position.gx !== previous.gx || this.position.gy !== previous.gy;
    }

    this.updateHero(moved);
    this.refreshDeliveryState(time);
    this.roomHud.refresh();
  }

  private createHeroAnimations(): void {
    if (!this.anims.exists(HERO_FRONT_ANIMATION)) {
      this.anims.create({
        key: HERO_FRONT_ANIMATION,
        frames: this.anims.generateFrameNumbers(TextureKeys.roomHero, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!this.anims.exists(HERO_BACK_ANIMATION)) {
      this.anims.create({
        key: HERO_BACK_ANIMATION,
        frames: this.anims.generateFrameNumbers(TextureKeys.roomHero, { start: 4, end: 7 }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  private setupKeyboard(): void {
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
    key(KeyCodes.E).on('down', () => this.activateInteraction());
    key(KeyCodes.SPACE).on('down', () => this.activateInteraction());
    key(KeyCodes.ESC).on('down', () => this.openPauseMenu());
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

  private layout(width: number): void {
    this.shellX = Math.round((width - ROOM_SHELL_WIDTH) / 2);
    this.shell.setPosition(this.shellX, ROOM_SHELL_Y);
    for (const light of this.lightLayers) {
      light.setPosition(this.shellX, ROOM_SHELL_Y);
    }
    for (const { prop, image } of this.propViews) {
      image.setPosition(this.shellX + prop.x, ROOM_SHELL_Y + prop.y);
    }
    this.enterTankButton.setPosition(
      width - HUD_MARGIN - ActionButton.SIZE / 2,
      GAME_HEIGHT - HUD_MARGIN - ActionButton.SIZE / 2,
    );
    this.usePcButton.setPosition(
      width - HUD_MARGIN - ActionButton.SIZE / 2,
      GAME_HEIGHT - HUD_MARGIN - ActionButton.SIZE / 2,
    );
    this.collectButton.setPosition(
      width - HUD_MARGIN - ActionButton.SIZE / 2,
      GAME_HEIGHT - HUD_MARGIN - ActionButton.SIZE / 2,
    );
    this.doorGlow.setPosition(this.shellX + ROOM_DOOR_GLOW.x, ROOM_SHELL_Y + ROOM_DOOR_GLOW.y);
    this.toasts.layout(width);
    this.updateHero(this.hero.anims.isPlaying);
  }

  private refreshDeliveryState(time: number): void {
    const hasArrived = this.ctx.world.hasArrivedDeliveries(this.ctx.clock.now());
    this.doorGlow.setVisible(hasArrived).setAlpha(0.7 + 0.3 * Math.sin(time * 0.004));
    this.refreshInteraction(hasArrived);
  }

  private refreshInteraction(hasArrived: boolean): void {
    const nearest = nearestInteraction(
      this.position,
      hasArrived ? ROOM_INTERACTIONS : ROOM_INTERACTIONS_WITHOUT_DOOR,
    );
    this.activeInteractionId = nearest?.id ?? null;
    this.enterTankButton.setVisible(this.activeInteractionId === 'tank');
    this.usePcButton.setVisible(this.activeInteractionId === 'pc');
    this.collectButton.setVisible(this.activeInteractionId === 'door');
  }

  private activateInteraction(): void {
    if (this.pcDesktop) return;
    if (this.activeInteractionId === 'tank') {
      enterTank(this);
    } else if (this.activeInteractionId === 'pc') {
      this.openPcDesktop();
    } else if (this.activeInteractionId === 'door') {
      this.ctx.world.collectDeliveries(this.ctx.clock.now());
      this.refreshDeliveryState(0);
    }
  }

  private openPauseMenu(): void {
    if (this.pcDesktop) return;
    this.joystick.reset();
    this.input.keyboard?.resetKeys();
    openPauseMenu(this, 'room');
  }

  private openPcDesktop(): void {
    if (this.pcDesktop) return;
    const desktop = new PcDesktop({
      world: this.ctx.world,
      content: this.ctx.content,
      now: () => this.ctx.clock.now(),
      onClose: () => {
        if (this.pcDesktop !== desktop) return;
        this.pcDesktop = undefined;
        this.scene.resume();
        this.joystick.reset();
        this.input.keyboard?.resetKeys();
      },
    });
    this.pcDesktop = desktop;
    desktop.open();
    this.scene.pause();
  }

  private updateHero(walking: boolean): void {
    const point = projectRoom(this.position.gx, this.position.gy, this.shellX, ROOM_SHELL_Y);
    const front = this.facing === 'SE' || this.facing === 'SW';
    const animation = front ? HERO_FRONT_ANIMATION : HERO_BACK_ANIMATION;
    this.hero
      .setPosition(Math.round(point.sx), Math.round(point.sy))
      .setFlipX(this.facing === 'SW' || this.facing === 'NW')
      .setDepth(heroDepth(this.position, ROOM_PROPS));

    if (walking) {
      if (!this.hero.anims.isPlaying || this.hero.anims.currentAnim?.key !== animation) {
        this.hero.play(animation);
      }
    } else {
      this.hero.anims.stop();
      this.hero.setFrame(front ? 0 : 4);
    }
  }
}
