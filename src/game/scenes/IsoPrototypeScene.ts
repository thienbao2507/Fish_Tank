import Phaser from 'phaser';
import { isDebugMode } from '../../config';
import { keysToDirection, type Direction } from '../../core/input';
import { createRng } from '../../core/rng';
import { TextureKeys } from '../art/keys';
import { addCameraBloom } from '../env/bloom';
import { addCameraPostFx } from '../env/postfx';
import { VirtualJoystick } from '../input/VirtualJoystick';
import { composeReefs, SPAWN, type ReefProp } from '../iso/layout';
import { FOCAL, groundRow, project, type GroundPoint } from '../iso/projection';
import { CLEARINGS, HEROES, PALETTES, PLATEAUS, REEFS, type Plateau } from '../iso/scenePlan';
import { shadowProfileOf, type ShadowProfile } from '../iso/shadowProfile';
import { altitudeShadow, heightAt, sortZ } from '../iso/terrain';
import { SceneKeys } from './keys';

interface MoveKeys {
  readonly up: Phaser.Input.Keyboard.Key[];
  readonly down: Phaser.Input.Keyboard.Key[];
  readonly left: Phaser.Input.Keyboard.Key[];
  readonly right: Phaser.Input.Keyboard.Key[];
}

interface IsoPlayer {
  x: number;
  z: number;
}

interface GroundStrip {
  readonly ground: Phaser.GameObjects.TileSprite;
  readonly caustics: Phaser.GameObjects.TileSprite;
  readonly top: number;
  readonly bottom: number;
}

interface PropView {
  readonly prop: ReefProp;
  readonly sprite: Phaser.GameObjects.Image;
  readonly phase: number;
  /** Bóng tiếp xúc sát chân, vật nào cũng có. */
  readonly contact: Phaser.GameObjects.Image;
  /** Bóng đổ: elip mềm hoặc theo hình vật, tuỳ kiểu bóng của vật. */
  readonly cast?: Phaser.GameObjects.Image;
  /** Che bớt vân sáng quanh chân, để bóng tiếp xúc không bị vân sáng làm nhoà. */
  readonly causticCover: Phaser.GameObjects.Image;
  readonly profile: ShadowProfile;
  /** Độ rộng phần chân chạm đất, tính bằng pixel ảnh. */
  readonly footWidth: number;
}

interface PlateauView {
  readonly plateau: Plateau;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  readonly contact: Phaser.GameObjects.Image;
}

interface BubbleView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly x: number;
  readonly z: number;
  readonly speed: number;
  readonly phase: number;
  y: number;
}

interface LightPoolView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly alpha: number;
}

/** Camera nhìn trước tàu một đoạn: tàu nằm thấp hơn giữa màn hình, thấy được địa hình phía xa. */
const LOOK_AHEAD = 60;
const STRIP_H = 3;
const PLAYER_SPEED = 130;
const PLAYER_MIN = 30;
const PLAYER_MAX = 994;
const PLAYER_HEIGHT = 34;
const PLAYER_ALTITUDE_LERP = 0.15;
const CAMERA_LERP = 0.12;
const MAX_FRAME_SECONDS = 0.1;
const FOG_NEAR = 430;
const FOG_FAR = 860;
const FOG_COLOR = 0x2f93bd;
const GROUND_DEPTH = -2000;
const CAUSTIC_DEPTH = -1999;
const LIGHT_POOL_DEPTH = -1998;
const BACKWALL_DEPTH = -1900;
const RAY_DEPTH = -400;
const WASH_DEPTH = -300;
const SURFACE_GLOW_DEPTH = -299;
const FOREGROUND_DEPTH = 5000;
const ROBOT_ANIMATION = 'iso.robot.swim';
const HEADLIGHT_OFFSET = 24;
const BUBBLE_COUNT = 14;
const BUBBLE_MAX_HEIGHT = 180;
const CULL_MARGIN = 96;
const WORLD_BACKWALL_WIDTH = 1800;
const SHADOW_WIDTH = 64;
const SHADOW_HEIGHT = 24;
const CONTACT_WIDTH = 48;
const CONTACT_HEIGHT = 20;
const SUB_SHADOW_WIDTH = 62;
/** Lớp bóng trên cát: ngay trên mặt đáy, nên không bao giờ đè lên vật khác. */
const GROUND_SHADOW_DEPTH = -1950;
const CAST_MIN_HEIGHT = 40;
const CAST_COLOR = 0x061230;
/** Vật rất to (đền, khối đá lớn): bóng dễ thành mảng, nên nhân thêm độ nhạt. */
const CAST_HUGE_HEIGHT = 100;
const CAST_HUGE_FACTOR = 0.5;
/** Ảnh bóng đổ mềm neo một đầu ở chân vật rồi kéo về phải dưới. */
const OVAL_ANGLE = 18;
const OVAL_ORIGIN_X = 0.12;
/** Vật chôn xuống nền chừng này (px) để chân không nằm lơ trên mặt cát. */
const FOOT_SINK = 0.5;
const CONTACT_MIN_WIDTH = 8;
const CONTACT_DROP = 0.2;
/** Màu cát trung bình, dùng che vân sáng quanh chân mà không tạo quầng đen. */
const CAUSTIC_COVER_COLOR = 0x3b5452;
const CAUSTIC_COVER_ALPHA = 0.55;
/** Bóng đổ về phải dưới, ngược hướng nguồn sáng ở trên trái. */
const CAST_ANGLE = -60;
const CAST_SCALE_X = 0.8;
const FOOT_ALPHA_MIN = 128;
const FOOT_ROWS = 3;
const STILL: Direction = { x: 0, y: 0 };

/** Lớp màu nước phủ toàn màn hình: nâng vùng tối lên tông xanh, bớt ngả nâu. */
const WATER_WASH_COLOR = 0x1f8fb0;
const WATER_WASH_ALPHA = 0.04;
/** Tông chung: đáy tối và xanh, vách dịu xuống, để vân sáng và tia nắng nổi lên. */
const GROUND_GRADE = 0x6a94b8;
const PLATEAU_GRADE = 0xb8c8dc;
/** Hàng màn hình (0 đỉnh, 1 đáy) vân sáng mạnh nhất, và độ rộng vùng mạnh. */
const CAUSTIC_PEAK_ROW = 0.62;
const CAUSTIC_SPREAD = 0.55;
const CAUSTIC_MAX_ALPHA = 0.9;
const CAUSTIC_MIN_ALPHA = 0.08;
/** Chùm tia toả hình quạt từ phía trên giữa màn hình. */
const RAY_FAN = [
  { angle: -40, width: 0.5, alpha: 0.3 },
  { angle: -31, width: 0.28, alpha: 0.42 },
  { angle: -22, width: 0.62, alpha: 0.4 },
  { angle: -13, width: 0.3, alpha: 0.55 },
  { angle: -5, width: 0.7, alpha: 0.5 },
  { angle: 4, width: 0.3, alpha: 0.6 },
  { angle: 12, width: 0.6, alpha: 0.46 },
  { angle: 21, width: 0.26, alpha: 0.46 },
  { angle: 30, width: 0.5, alpha: 0.34 },
  { angle: 39, width: 0.3, alpha: 0.26 },
] as const;

const LIGHT_POOL_POINTS = [
  { x: 512, z: 560, size: 1.7, alpha: 0.2 },
  { x: 512, z: 420, size: 1.2, alpha: 0.14 },
  { x: 285, z: 620, size: 0.9, alpha: 0.12 },
  { x: 735, z: 610, size: 0.9, alpha: 0.12 },
] as const;

function anyDown(keys: readonly Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

/** Bản thử đáy bể 2.5D, hoàn toàn tách biệt với trạng thái của GameScene. */
export class IsoPrototypeScene extends Phaser.Scene {
  private readonly player: IsoPlayer = { x: SPAWN.x, z: SPAWN.z };
  private readonly focus: GroundPoint & { x: number; z: number } = {
    x: SPAWN.x,
    z: SPAWN.z,
  };
  private altitude = 0;
  private strips: GroundStrip[] = [];
  private propViews: PropView[] = [];
  private readonly footWidths = new Map<string, number>();
  private plateauViews: PlateauView[] = [];
  private bubbles: BubbleView[] = [];
  private lightPools: LightPoolView[] = [];
  private rays: Phaser.GameObjects.Image[] = [];
  private topGlow!: Phaser.GameObjects.Image;
  private joystick!: VirtualJoystick;
  private moveKeys?: MoveKeys;
  private backwall!: Phaser.GameObjects.TileSprite;
  private surfaceGlow!: Phaser.GameObjects.Image;
  private foregroundLeft!: Phaser.GameObjects.Image;
  private foregroundRight!: Phaser.GameObjects.Image;
  private robot!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private headlight!: Phaser.GameObjects.Image;
  private facing = 1;

  constructor() {
    super(SceneKeys.IsoPrototype);
  }

  create(): void {
    this.rebuildStrips(this.scale.width, this.scale.height);
    this.createBackdrop();
    this.createPlateaus();
    this.createProps();
    this.createAtmosphere();
    this.createForeground();
    this.createPlayer();
    this.shadow.setTexture(TextureKeys.isoContact);
    this.joystick = new VirtualJoystick(this, {
      baseRadius: 28,
      knobRadius: 11,
      maxDistance: 24,
      deadzone: 6,
      topInset: 0,
    });
    this.setupKeyboard();

    addCameraBloom(this);
    addCameraPostFx(this, {
      tiltRadius: 0.34,
      vignetteRadius: 0.92,
      vignetteStrength: 0.3,
    });

    const onResize = (gameSize: Phaser.Structs.Size): void => {
      this.rebuildStrips(gameSize.width, gameSize.height);
      this.layoutRays(gameSize.width, gameSize.height);
      this.layoutFixedOverlays(gameSize.width);
      this.layoutForeground(gameSize.width, gameSize.height);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

    const debugWindow = window as typeof window & {
      fishtankIso?: { player: IsoPlayer; readonly fps: number };
    };
    const game = this.game;
    if (isDebugMode()) {
      debugWindow.fishtankIso = {
        player: this.player,
        get fps() {
          return game.loop.actualFps;
        },
      };
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      if (debugWindow.fishtankIso?.player === this.player) delete debugWindow.fishtankIso;
    });

    this.renderScene(0, 0);
  }

  override update(time: number, delta: number): void {
    const seconds = Math.min(delta / 1000, MAX_FRAME_SECONDS);
    const direction = this.joystick.isActive ? this.joystick.direction : this.keyboardDirection();
    this.player.x = Phaser.Math.Clamp(
      this.player.x + direction.x * PLAYER_SPEED * seconds,
      PLAYER_MIN,
      PLAYER_MAX,
    );
    this.player.z = Phaser.Math.Clamp(
      this.player.z - direction.y * PLAYER_SPEED * seconds,
      PLAYER_MIN,
      PLAYER_MAX,
    );
    if (direction.x !== 0) this.facing = Math.sign(direction.x);

    const altitudeLerp = 1 - Math.pow(1 - PLAYER_ALTITUDE_LERP, seconds * 60);
    this.altitude = Phaser.Math.Linear(
      this.altitude,
      heightAt(PLATEAUS, this.player.x, this.player.z),
      altitudeLerp,
    );

    const cameraLerp = 1 - Math.pow(1 - CAMERA_LERP, seconds * 60);
    this.focus.x = Phaser.Math.Clamp(
      Phaser.Math.Linear(this.focus.x, this.player.x, cameraLerp),
      340,
      684,
    );
    this.focus.z = Phaser.Math.Clamp(
      Phaser.Math.Linear(this.focus.z, this.player.z + LOOK_AHEAD, cameraLerp),
      190,
      860,
    );
    this.renderScene(time, seconds);
  }

  private rebuildStrips(viewW: number, viewH: number): void {
    for (const strip of this.strips) {
      strip.ground.destroy();
      strip.caustics.destroy();
    }
    this.strips = [];

    for (let bottom = viewH; bottom > 0; bottom -= STRIP_H) {
      const top = Math.max(0, bottom - STRIP_H);
      const height = bottom - top;
      const y = (top + bottom) / 2;
      const ground = this.add
        .tileSprite(viewW / 2, y, viewW, height, TextureKeys.isoGround)
        .setDepth(GROUND_DEPTH);
      const caustics = this.add
        .tileSprite(viewW / 2, y, viewW, height, TextureKeys.isoCaustics)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(CAUSTIC_DEPTH);
      this.strips.push({ ground, caustics, top, bottom });
    }
  }

  private createBackdrop(): void {
    const sourceHeight = this.textures.getFrame(TextureKeys.isoBackwall).height;
    this.backwall = this.add
      .tileSprite(0, 0, WORLD_BACKWALL_WIDTH, sourceHeight, TextureKeys.isoBackwall)
      .setOrigin(0.5, 1)
      .setDepth(BACKWALL_DEPTH);
    this.surfaceGlow = this.add
      .image(0, 0, TextureKeys.surfaceGlow)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.8)
      .setDepth(SURFACE_GLOW_DEPTH);
    this.layoutFixedOverlays(this.scale.width);
  }

  private createPlateaus(): void {
    this.plateauViews = PLATEAUS.map((plateau) => ({
      plateau,
      sprite: this.add.image(0, 0, plateau.key).setOrigin(0.5, 1),
      shadow: this.add.image(0, 0, TextureKeys.isoShadowLong).setOrigin(0.5).setAlpha(0.4),
      contact: this.add.image(0, 0, TextureKeys.isoContact).setAlpha(0.9),
    }));
  }

  private createProps(): void {
    const props: readonly ReefProp[] = [
      ...composeReefs(0x25d, REEFS, CLEARINGS, PALETTES),
      ...HEROES.map((hero) => ({ ...hero, sway: false })),
    ];

    this.propViews = props.map((prop) => {
      const sprite = this.add.image(0, 0, prop.key).setOrigin(0.5, 1);
      const worldHeight = sprite.height * prop.scale;
      const profile = shadowProfileOf(prop.key);
      return {
        prop,
        sprite,
        phase: prop.x * 0.017 + prop.z * 0.013,
        footWidth: this.measureFoot(prop.key),
        profile,
        cast: this.createCast(prop.key, profile, worldHeight),
        causticCover: this.add
          .image(0, 0, TextureKeys.isoContact)
          .setTintMode(Phaser.TintModes.FILL)
          .setAlpha(CAUSTIC_COVER_ALPHA)
          .setDepth(GROUND_SHADOW_DEPTH - 1),
        contact: this.add.image(0, 0, TextureKeys.isoContact).setAlpha(1),
      };
    });
  }

  /** Bóng đổ theo kiểu của vật: san hô nhánh dùng chính hình vật, vật đặc dùng elip mềm. */
  private createCast(
    key: string,
    profile: ShadowProfile,
    worldHeight: number,
  ): Phaser.GameObjects.Image | undefined {
    if (profile.cast === 'none' || worldHeight < CAST_MIN_HEIGHT) return undefined;
    const alpha = profile.castAlpha * (worldHeight >= CAST_HUGE_HEIGHT ? CAST_HUGE_FACTOR : 1);
    if (profile.cast === 'oval') {
      return this.add
        .image(0, 0, TextureKeys.isoShadowLong)
        .setOrigin(OVAL_ORIGIN_X, 0.5)
        .setAngle(OVAL_ANGLE)
        .setAlpha(alpha);
    }
    return this.add
      .image(0, 0, key)
      .setOrigin(0.5, 0)
      .setFlipY(true)
      .setTintMode(Phaser.TintModes.FILL)
      .setTint(CAST_COLOR)
      .setAlpha(alpha)
      .setAngle(CAST_ANGLE);
  }

  /** Độ rộng phần chân chạm đất của ảnh: các pixel đặc ở vài hàng dưới cùng. */
  private measureFoot(key: string): number {
    const cached = this.footWidths.get(key);
    if (cached !== undefined) return cached;
    const { width, height } = this.textures.getFrame(key);
    const solid = (x: number, y: number): boolean =>
      (this.textures.getPixelAlpha(x, y, key) ?? 0) > FOOT_ALPHA_MIN;

    let lowest = height - 1;
    for (; lowest > 0; lowest--) {
      let found = false;
      for (let x = 0; x < width && !found; x++) found = solid(x, lowest);
      if (found) break;
    }
    let left = width;
    let right = -1;
    for (let y = lowest; y > lowest - FOOT_ROWS && y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        if (!solid(x, y)) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    const foot = right >= left ? right - left + 1 : width;
    this.footWidths.set(key, foot);
    return foot;
  }

  /** Bóng trên cát nằm ở lớp sát mặt đáy; trên cao nguyên thì ngay trên mặt cao nguyên đó. */
  private shadowDepthAt(x: number, z: number, viewW: number, viewH: number): number {
    const plateau = PLATEAUS.find(
      (p) => Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2,
    );
    if (!plateau) return GROUND_SHADOW_DEPTH;
    return -project(plateau.x, 0, plateau.z - plateau.d / 2, this.focus, viewW, viewH).zc + 0.02;
  }

  private createAtmosphere(): void {
    for (const point of LIGHT_POOL_POINTS) {
      this.lightPools.push({
        ...point,
        sprite: this.add
          .image(0, 0, TextureKeys.haze)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffe9a8)
          .setDepth(LIGHT_POOL_DEPTH),
      });
    }

    for (const ray of RAY_FAN) {
      this.rays.push(
        this.add
          .image(0, 0, TextureKeys.isoRay)
          .setOrigin(0.5, 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAngle(ray.angle)
          .setAlpha(ray.alpha)
          .setDepth(RAY_DEPTH),
      );
    }
    this.topGlow = this.add
      .image(0, 0, TextureKeys.haze)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xbff4ff)
      .setAlpha(0.3)
      .setDepth(SURFACE_GLOW_DEPTH);
    this.layoutRays(this.scale.width, this.scale.height);
    this.add
      .rectangle(0, 0, 2000, 1000, WATER_WASH_COLOR)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(WATER_WASH_ALPHA)
      .setDepth(WASH_DEPTH);

    const rng = createRng(0x1b00b1e);
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      this.bubbles.push({
        sprite: this.add.image(0, 0, TextureKeys.bubble),
        x: rng.int(80, 944),
        z: rng.int(80, 944),
        y: rng.next() * BUBBLE_MAX_HEIGHT,
        speed: rng.int(18, 34),
        phase: rng.next() * Math.PI * 2,
      });
    }
  }

  private createForeground(): void {
    this.foregroundLeft = this.add
      .image(0, 0, TextureKeys.isoFgA)
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(FOREGROUND_DEPTH);
    this.foregroundRight = this.add
      .image(0, 0, TextureKeys.isoFgB)
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(FOREGROUND_DEPTH);
    this.layoutForeground(this.scale.width, this.scale.height);
  }

  private createPlayer(): void {
    if (!this.anims.exists(ROBOT_ANIMATION)) {
      this.anims.create({
        key: ROBOT_ANIMATION,
        frames: this.anims.generateFrameNumbers(TextureKeys.robot, { start: 0, end: 3 }),
        frameRate: 1000 / 90,
        repeat: -1,
      });
    }
    this.altitude = heightAt(PLATEAUS, this.player.x, this.player.z);
    this.shadow = this.add.image(0, 0, TextureKeys.isoShadowLong).setOrigin(0.5).setAlpha(0.5);
    this.robot = this.add.sprite(0, 0, TextureKeys.robot).play(ROBOT_ANIMATION);
    this.headlight = this.add
      .image(0, 0, TextureKeys.headlight)
      .setBlendMode(Phaser.BlendModes.ADD);
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

  private renderScene(time: number, seconds: number): void {
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    this.updateGround(time, viewW, viewH);
    this.updateBackdrop(viewW, viewH);
    this.updatePlateaus(viewW, viewH);
    this.updateLightPools(time, viewW, viewH);
    this.updateRays(time);
    this.updateProps(time, viewW, viewH);
    this.updateBubbles(time, seconds, viewW, viewH);
    this.updatePlayer(viewW, viewH);
    this.layoutForeground(viewW, viewH);
  }

  private updateGround(time: number, viewW: number, viewH: number): void {
    for (const strip of this.strips) {
      const middleY = (strip.top + strip.bottom) / 2;
      const top = groundRow(strip.top, this.focus, viewH);
      const bottom = groundRow(strip.bottom, this.focus, viewH);
      const middle = groundRow(middleY, this.focus, viewH);
      const deltaZ = Math.abs(top.z - bottom.z);
      const height = strip.bottom - strip.top;
      const scaleY = height / deltaZ;

      // Phaser 4 nhận tilePosition theo pixel nguồn. Trục texture y dùng -z để z xa cuộn lên màn hình.
      const positionX = this.focus.x - viewW / (2 * middle.scale);
      const positionY = -middle.z - height / (2 * scaleY);
      const fog = this.fogTint(FOCAL / middle.scale);
      strip.ground
        .setTileScale(middle.scale, scaleY)
        .setTilePosition(positionX, positionY)
        .setTint(this.multiplyColor(fog, GROUND_GRADE));
      // Vân sáng mạnh ở giữa cảnh, mờ về phía xa và sát mép dưới.
      const rowOffset = (middleY / viewH - CAUSTIC_PEAK_ROW) / CAUSTIC_SPREAD;
      strip.caustics
        .setTileScale(middle.scale, scaleY)
        .setTilePosition(positionX + time * 0.012, positionY - time * 0.006)
        .setAlpha(
          CAUSTIC_MIN_ALPHA +
            (CAUSTIC_MAX_ALPHA - CAUSTIC_MIN_ALPHA) * Math.max(0, 1 - rowOffset * rowOffset),
        );
    }
  }

  private updateBackdrop(viewW: number, viewH: number): void {
    const p = project(512, 0, 1010, this.focus, viewW, viewH);
    this.backwall.setPosition(p.sx, p.sy).setScale(p.scale).setTint(this.fogTint(p.zc));
  }

  private updatePlateaus(viewW: number, viewH: number): void {
    for (const view of this.plateauViews) {
      const plateau = view.plateau;
      const frontZ = plateau.z - plateau.d / 2;
      const front = project(plateau.x, 0, frontZ, this.focus, viewW, viewH);
      // Nguồn sáng trên trái: bóng đổ sang phải và về phía trước, lệch theo độ cao vách.
      const shadowPoint = project(
        plateau.x + plateau.w * 0.16 + plateau.height * 0.3,
        0,
        frontZ - plateau.height * 0.24,
        this.focus,
        viewW,
        viewH,
      );
      const visible = this.onScreen(front.sx, front.sy, front.zc, viewW, viewH);
      view.sprite.setVisible(visible);
      view.shadow.setVisible(visible);
      view.contact.setVisible(visible);
      if (!visible) continue;

      const depth = -front.zc;
      view.contact
        .setPosition(front.sx, front.sy - 3 * front.scale)
        .setScale(
          ((plateau.w * 1.02) / CONTACT_WIDTH) * front.scale,
          (18 / CONTACT_HEIGHT) * front.scale,
        )
        .setDepth(GROUND_SHADOW_DEPTH + 0.01);
      view.shadow
        .setPosition(shadowPoint.sx, shadowPoint.sy)
        .setScale(
          ((plateau.w * 0.95) / SHADOW_WIDTH) * shadowPoint.scale,
          ((plateau.height * 0.6) / SHADOW_HEIGHT) * shadowPoint.scale,
        )
        .setDepth(GROUND_SHADOW_DEPTH)
        .setTint(this.fogTint(shadowPoint.zc));
      view.sprite
        .setPosition(front.sx, front.sy)
        .setScale((plateau.w / plateau.texW) * front.scale)
        .setDepth(depth)
        .setTint(this.multiplyColor(this.fogTint(front.zc), PLATEAU_GRADE));
    }
  }

  private updateLightPools(time: number, viewW: number, viewH: number): void {
    for (const pool of this.lightPools) {
      const p = project(pool.x, 0, pool.z, this.focus, viewW, viewH);
      const visible = this.onScreen(p.sx, p.sy, p.zc, viewW, viewH);
      pool.sprite.setVisible(visible);
      if (!visible) continue;
      pool.sprite
        .setPosition(p.sx, p.sy)
        .setScale(3.2 * pool.size * p.scale, 1.7 * pool.size * p.scale)
        .setAlpha(pool.alpha + 0.04 * Math.sin(time * 0.001));
    }
  }

  private updateProps(time: number, viewW: number, viewH: number): void {
    for (const view of this.propViews) {
      const y = heightAt(PLATEAUS, view.prop.x, view.prop.z);
      const position = project(view.prop.x, y, view.prop.z, this.focus, viewW, viewH);
      const sortedZ = sortZ(PLATEAUS, view.prop.x, view.prop.z);
      const sorted = project(view.prop.x, y, sortedZ, this.focus, viewW, viewH);
      const visible = this.onScreen(position.sx, position.sy, position.zc, viewW, viewH);
      view.sprite.setVisible(visible);
      view.contact.setVisible(visible);
      view.cast?.setVisible(visible);
      // Vân sáng chỉ có trên mặt đáy; trên cao nguyên không cần che.
      view.causticCover.setVisible(visible && y === 0);
      if (!visible) continue;

      const depth = -sorted.zc;
      const shadowDepth = this.shadowDepthAt(view.prop.x, view.prop.z, viewW, viewH);
      const { profile } = view;
      const footWorld = view.footWidth * view.prop.scale;
      const contactWidth = Math.max(CONTACT_MIN_WIDTH, footWorld * profile.footScale);
      const contactHeight = Math.min(profile.maxHeight, contactWidth * profile.heightRatio);
      view.contact
        .setPosition(position.sx, position.sy + contactHeight * CONTACT_DROP * position.scale)
        .setScale(
          (contactWidth / CONTACT_WIDTH) * position.scale,
          (contactHeight / CONTACT_HEIGHT) * position.scale,
        )
        .setDepth(shadowDepth + 0.01);
      if (y === 0) {
        view.causticCover
          .setPosition(position.sx, position.sy)
          .setScale(
            ((contactWidth * 1.7) / CONTACT_WIDTH) * position.scale,
            ((contactHeight * 2.4) / CONTACT_HEIGHT) * position.scale,
          )
          .setTint(this.multiplyColor(CAUSTIC_COVER_COLOR, this.fogTint(position.zc)));
      }
      if (view.cast) {
        const worldHeight = view.sprite.height * view.prop.scale;
        if (profile.cast === 'oval') {
          view.cast
            .setPosition(position.sx, position.sy)
            .setScale(
              ((worldHeight * profile.castLength) / SHADOW_WIDTH) * position.scale,
              ((footWorld * 0.5) / SHADOW_HEIGHT) * position.scale,
            )
            .setDepth(shadowDepth);
        } else {
          view.cast
            .setPosition(position.sx, position.sy)
            .setScale(
              position.scale * view.prop.scale * CAST_SCALE_X,
              position.scale * view.prop.scale * profile.castLength,
            )
            .setDepth(shadowDepth);
        }
      }
      view.sprite
        .setPosition(position.sx, position.sy + FOOT_SINK * position.scale)
        .setScale(position.scale * view.prop.scale)
        .setDepth(depth)
        .setAngle(view.prop.sway ? Math.sin(time * 0.0012 + view.phase) * 2.5 : 0);
      this.applyLight(view.sprite, position.zc, 0.93 + 0.07 * Math.sin(time * 0.0016 + view.phase));
    }
  }

  private updateBubbles(time: number, seconds: number, viewW: number, viewH: number): void {
    for (const bubble of this.bubbles) {
      bubble.y = (bubble.y + bubble.speed * seconds) % BUBBLE_MAX_HEIGHT;
      const driftX = Math.sin(time * 0.0015 + bubble.phase) * 5;
      const p = project(bubble.x + driftX, bubble.y, bubble.z, this.focus, viewW, viewH);
      const visible = this.onScreen(p.sx, p.sy, p.zc, viewW, viewH);
      bubble.sprite.setVisible(visible);
      if (!visible) continue;
      bubble.sprite
        .setPosition(p.sx, p.sy)
        .setScale(p.scale)
        .setDepth(-p.zc + 0.2)
        .setTint(this.fogTint(p.zc));
    }
  }

  private updatePlayer(viewW: number, viewH: number): void {
    const sortedZ = sortZ(PLATEAUS, this.player.x, this.player.z);
    const bodyY = this.altitude + PLAYER_HEIGHT;
    const body = project(this.player.x, bodyY, this.player.z, this.focus, viewW, viewH);
    const sorted = project(this.player.x, bodyY, sortedZ, this.focus, viewW, viewH);
    const nose = project(
      this.player.x + this.facing * HEADLIGHT_OFFSET,
      bodyY,
      this.player.z,
      this.focus,
      viewW,
      viewH,
    );
    // Bóng bám đúng mặt địa hình ngay dưới tàu, lệch nhẹ theo hướng sáng khi tàu ở cao.
    const roughClearance = bodyY - heightAt(PLATEAUS, this.player.x, this.player.z);
    const shadowX = this.player.x + roughClearance * 0.25;
    const shadowZ = this.player.z - roughClearance * 0.15;
    const surface = heightAt(PLATEAUS, shadowX, shadowZ);
    const style = altitudeShadow(bodyY - surface);
    const shadowPoint = project(shadowX, surface, shadowZ, this.focus, viewW, viewH);
    const depth = -sorted.zc;
    this.shadow
      .setPosition(shadowPoint.sx, shadowPoint.sy)
      .setScale(
        ((SUB_SHADOW_WIDTH * style.scale) / CONTACT_WIDTH) * shadowPoint.scale,
        ((SUB_SHADOW_WIDTH * style.scale * 0.42) / CONTACT_HEIGHT) * shadowPoint.scale,
      )
      .setAlpha(style.alpha)
      .setDepth(this.shadowDepthAt(shadowX, shadowZ, viewW, viewH) + 0.03);
    this.robot
      .setPosition(body.sx, body.sy)
      .setScale(body.scale)
      .setFlipX(this.facing < 0)
      .setDepth(depth + 0.2);
    this.applyLight(this.robot, body.zc, 1);
    this.headlight
      .setPosition(nose.sx, nose.sy)
      .setOrigin(this.facing < 0 ? 1 : 0, 0.5)
      .setFlipX(this.facing < 0)
      .setScale(body.scale)
      .setDepth(depth + 0.3)
      .setTint(this.fogTint(body.zc));
  }

  private layoutRays(viewW: number, viewH: number): void {
    this.rays.forEach((image, i) => {
      const ray = RAY_FAN[i] as (typeof RAY_FAN)[number];
      image
        .setPosition(viewW / 2 - ray.angle * 3, -viewH * 0.2)
        .setScale(ray.width, (viewH * 1.25) / image.height);
    });
    this.topGlow?.setPosition(viewW / 2, -viewH * 0.06).setScale(5.5, 1.7);
  }

  private updateRays(time: number): void {
    this.rays.forEach((image, i) => {
      const ray = RAY_FAN[i] as (typeof RAY_FAN)[number];
      image.setAlpha(ray.alpha * (0.82 + 0.18 * Math.sin(time * 0.0007 + i * 1.7)));
    });
  }

  private layoutFixedOverlays(viewW: number): void {
    this.surfaceGlow.setPosition(viewW / 2, 0).setScale(viewW / this.surfaceGlow.width, 1);
  }

  private layoutForeground(viewW: number, viewH: number): void {
    const parallaxX = (this.focus.x - 512) * 0.3;
    const parallaxY = (this.focus.z - 500) * 0.08;
    // Chỉ cho trôi ra phía ngoài màn hình, nếu không sẽ lộ mép ảnh.
    const lift = Math.max(0, parallaxY);
    this.foregroundLeft.setPosition(Math.min(0, -parallaxX), viewH + lift);
    this.foregroundRight.setPosition(viewW + Math.max(0, -parallaxX), viewH + lift);
  }

  private onScreen(x: number, y: number, zc: number, viewW: number, viewH: number): boolean {
    return (
      zc > 0 &&
      x >= -CULL_MARGIN &&
      x <= viewW + CULL_MARGIN &&
      y >= -CULL_MARGIN &&
      y <= viewH + CULL_MARGIN
    );
  }

  /** Ánh sáng từ mặt nước phía trên trái: đỉnh sáng, chân tối, bên phải tối hơn bên trái. */
  private applyLight(
    sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite,
    zc: number,
    shimmer: number,
  ): void {
    const fog = this.fogTint(zc);
    const shade = (r: number, g: number, b: number): number =>
      (Math.round(((fog >> 16) & 0xff) * r) << 16) |
      (Math.round(((fog >> 8) & 0xff) * g) << 8) |
      Math.round((fog & 0xff) * b);
    // Đỉnh hứng nắng ấm, chân ngả xanh lạnh.
    sprite.setTint(
      shade(shimmer, 0.96 * shimmer, 0.82 * shimmer),
      shade(0.86 * shimmer, 0.82 * shimmer, 0.72 * shimmer),
      shade(0.55, 0.66, 0.78),
      shade(0.42, 0.52, 0.66),
    );
  }

  private multiplyColor(a: number, b: number): number {
    const channel = (shift: number): number =>
      Math.round((((a >> shift) & 0xff) * ((b >> shift) & 0xff)) / 255);
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
  }

  private fogTint(zc: number): number {
    const amount = Phaser.Math.Clamp((zc - FOG_NEAR) / (FOG_FAR - FOG_NEAR), 0, 1);
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff),
      Phaser.Display.Color.ValueToColor(FOG_COLOR),
      100,
      amount * 100,
    );
    return Phaser.Display.Color.GetColor(color.r, color.g, color.b);
  }
}
