import Phaser from 'phaser';
import { keysToDirection, type Direction } from '../../core/input';
import { TextureKeys } from '../art/keys';
import { addCameraBloom } from '../env/bloom';
import { VirtualJoystick } from '../input/VirtualJoystick';
import {
  facingFromDirection,
  HERO_SPEED,
  HERO_START,
  heroDepth,
  moveInRoom,
  projectRoom,
  ROOM_LIGHT_DEPTH,
  ROOM_LIGHTS,
  ROOM_PROPS,
  ROOM_SHELL_WIDTH,
  ROOM_SHELL_Y,
  type RoomFacing,
  type RoomPosition,
} from '../room/layout';
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

function anyDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

export class RoomPrototypeScene extends Phaser.Scene {
  private shell!: Phaser.GameObjects.Image;
  private propViews: PropView[] = [];
  private hero!: Phaser.GameObjects.Sprite;
  private lightLayers: Phaser.GameObjects.Image[] = [];
  private joystick!: VirtualJoystick;
  private moveKeys?: MoveKeys;
  private shellX = 0;
  private position: RoomPosition = { ...HERO_START };
  private facing: RoomFacing = 'SE';

  constructor() {
    super(SceneKeys.Room);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#140f1c');
    this.shell = this.add.image(0, 0, TextureKeys.roomShell).setOrigin(0, 0);
    this.propViews = ROOM_PROPS.map((prop) => ({
      prop,
      image: this.add.image(0, 0, TextureKeys[prop.key]).setOrigin(0, 0).setDepth(prop.depth),
    }));

    this.createHeroAnimations();
    this.hero = this.add.sprite(0, 0, TextureKeys.roomHero, 0).setOrigin(12 / 24, 38 / 40);
    this.lightLayers = ROOM_LIGHTS.map(({ key, alpha }) =>
      this.add
        .image(0, 0, TextureKeys[key])
        .setOrigin(0, 0)
        .setDepth(ROOM_LIGHT_DEPTH)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    this.joystick = new VirtualJoystick(this, {
      baseRadius: 28,
      knobRadius: 11,
      maxDistance: 24,
      deadzone: 6,
      topInset: 0,
    });
    this.setupKeyboard();
    addCameraBloom(this, { threshold: 0.86, blendAmount: 0.4 });

    const onResize = (gameSize: Phaser.Structs.Size): void => this.layout(gameSize.width);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
    this.layout(this.scale.width);
    this.updateHero(false);
  }

  override update(_time: number, delta: number): void {
    const direction = this.joystick.isActive ? this.joystick.direction : this.keyboardDirection();
    const nextFacing = facingFromDirection(direction, this.facing);
    if (!nextFacing) {
      this.updateHero(false);
      return;
    }

    this.facing = nextFacing;
    const previous = this.position;
    const seconds = Math.min(Math.max(delta, 0) / 1000, MAX_FRAME_SECONDS);
    this.position = moveInRoom(previous, this.facing, HERO_SPEED * seconds);
    const moved = this.position.gx !== previous.gx || this.position.gy !== previous.gy;
    this.updateHero(moved);
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
    this.updateHero(this.hero.anims.isPlaying);
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
