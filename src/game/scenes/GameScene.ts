import Phaser from 'phaser';
import type { ZoneDef } from '../../core/content/schemas';
import { t } from '../../core/i18n';
import type { Drop } from '../../core/sim/drops';
import type { Fish } from '../../core/sim/fish';
import type { FoodPellet } from '../../core/sim/food';
import { floorAt } from '../../core/sim/terrain';
import type { TrashItem } from '../../core/sim/trash';
import { TextureKeys } from '../art/keys';
import { getContext, type GameContext } from '../context';
import { Background } from '../env/Background';
import { addCameraBloom } from '../env/bloom';
import { layerPlacement } from '../env/perspective';
import { addCameraPostFx } from '../env/postfx';
import { shadowStyle } from '../env/shadows';
import { headlightAlpha } from '../env/waterVisual';
import { addPixelText, COIN_COLOR, TEXT_COLOR, WARNING_COLOR } from '../hud/text';
import { SpriteSync, type Destroyable } from '../SpriteSync';
import { SceneKeys } from './keys';

const Depth = {
  room: -7,
  tankBack: -6,
  bgWater: -5,
  bgFar: -4,
  bgMid: -3,
  floor: -2,
  environment: 0,
  shadow: 0.5,
  station: 1,
  items: 2,
  fish: 3,
  robot: 4,
  waterVolume: 5,
  particles: 5.5,
  surface: 5.8,
  foreground: 6,
  tankFront: 7,
  labels: 8,
} as const;

/** Khung hình bị khựng lâu (chuyển tab…) không được làm robot nhảy xa. */
const MAX_FRAME_SECONDS = 0.1;
const CAMERA_LERP = 0.15;
const VACUUM_RING_COLOR = 0xbfefff;
const FLOAT_TEXT_RISE = 18;
const FLOAT_TEXT_MS = 1200;
const HEALED_COLOR = '#6fe08a';
/** Cá ốm nhạt màu đi. */
const SICK_TINT = 0x9fb8a0;
/** Xu/ngọc nhấp nháy trong mấy giây cuối trước khi tự cộng. */
const DROP_BLINK_SECONDS = 5;
/** Góc nghiêng khi cá nhảy khỏi bể (độ). */
const LEAVING_ANGLE = 60;
const ROBOT_SPIN_ANIMATION = 'robot.spin';
const ROBOT_SPIN_IDLE_SCALE = 0.35;
const ROBOT_SPIN_MAX_SCALE = 1.6;
/** Tâm đèn trên sprite 56×48 nằm tại (50, 27), so với origin giữa là (+22, +3). */
const HEADLIGHT_DX = 22;
const HEADLIGHT_DY = 4;
/** Độ sâu phối cảnh của một làn (spec 12.5): làn 0 / 1 / 2 → z = 0 / 0.3 / 0.6. */
const LANE_DEPTH = 0.3;
/**
 * Vật ở làn sau vẽ dưới nền đất và hàng cây chơi (env − 0.05 … 0) nhưng trên lớp đá tảng
 * (env − 0.07), nên rạn gần che chân chúng. Làn càng sâu càng vẽ sớm hơn.
 */
const BACK_LANE_BASE = -0.06;
/** Màu nước ám lên vật ở làn Xa (làn Giữa ám một nửa). */
const LANE_FOG_COLOR = 0x86a8c8;

/** Vị trí chiếu của một điểm ở làn `laneZ`. */
interface LaneProjection {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly scrollFactor: number;
}

type LaneObject = Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.ScrollFactor;

interface ShadowedView extends Destroyable {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
}

interface FishView extends ShadowedView {
  readonly alert: Phaser.GameObjects.Image;
  readonly countdown: Phaser.GameObjects.Text;
}

/**
 * Thế giới bể cá: vẽ khu hiện tại, robot, rác, thức ăn, xu, cá theo trạng thái của World.
 * Luật chơi nằm trong World (src/core); scene này chỉ gọi update và hiển thị.
 */
export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private background!: Background;
  private robotSprite!: Phaser.GameObjects.Sprite;
  private robotShadow!: Phaser.GameObjects.Image;
  private headlight!: Phaser.GameObjects.Image;
  private vacuumRing!: Phaser.GameObjects.Graphics;
  private trashViews!: SpriteSync<TrashItem, ShadowedView>;
  private foodViews!: SpriteSync<FoodPellet, Phaser.GameObjects.Image>;
  private dropViews!: SpriteSync<Drop, ShadowedView>;
  private fishViews!: SpriteSync<Fish, FishView>;
  /** Camera bám theo toạ độ thế giới của tàu (sprite tàu nằm ở toạ độ đã chiếu theo làn). */
  private cameraTarget!: Phaser.GameObjects.Zone;
  /** Thời điểm khung hình hiện tại (ms) — dùng cho hiệu ứng nhấp nhô/nhấp nháy. */
  private now = 0;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.ctx = getContext(this);
    const { world, bus } = this.ctx;
    const { zone } = world;

    this.buildEnvironment(zone);
    this.createViews();
    if (!this.anims.exists(ROBOT_SPIN_ANIMATION)) {
      this.anims.create({
        key: ROBOT_SPIN_ANIMATION,
        frames: this.anims.generateFrameNumbers(TextureKeys.robot, { start: 0, end: 3 }),
        frameRate: 1000 / 90,
        repeat: -1,
      });
    }
    this.robotShadow = this.add.image(0, 0, TextureKeys.shadow).setDepth(Depth.shadow);
    this.robotSprite = this.add
      .sprite(world.robot.x, world.robot.y, TextureKeys.robot)
      .setScale(1, 1)
      .play(ROBOT_SPIN_ANIMATION)
      .setDepth(Depth.robot);
    // Trên lớp nước đục để luồng sáng "xuyên" qua nước bẩn.
    this.headlight = this.add
      .image(0, 0, TextureKeys.headlight)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.particles);
    this.vacuumRing = this.add.graphics().setDepth(Depth.particles);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, zone.width, zone.height);
    this.cameraTarget = this.add.zone(world.robot.x, world.robot.y, 1, 1);
    camera.startFollow(this.cameraTarget, true, CAMERA_LERP, CAMERA_LERP);
    addCameraBloom(this);
    addCameraPostFx(this);

    const unsubscribers = [
      bus.on('station:sold', ({ coins, x, y, z }) => {
        this.floatText(t('float.coins', { coins }), x, y, z, COIN_COLOR);
      }),
      bus.on('drop:collected', ({ currency, amount, x, y, z }) => {
        const pearls = currency === 'pearls';
        const message = pearls
          ? t('float.pearls', { pearls: amount })
          : t('float.coins', { coins: amount });
        this.floatText(message, x, y, z, pearls ? TEXT_COLOR : COIN_COLOR);
      }),
      bus.on('fish:healed', ({ x, y, z }) => {
        this.floatText(t('float.healed'), x, y - 6, z, HEALED_COLOR);
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    });

    this.syncRobot();
    this.syncViews();
    this.scene.launch(SceneKeys.UI);
  }

  override update(time: number, delta: number): void {
    const { world, input, clock } = this.ctx;
    world.update(Math.min(delta / 1000, MAX_FRAME_SECONDS), input, clock.scale);
    this.background.update(world.water, Math.min(delta / 1000, MAX_FRAME_SECONDS), world.robot.x);
    this.now = time;
    this.syncRobot();
    this.syncViews();
  }

  private buildEnvironment(zone: ZoneDef): void {
    this.background = new Background(this, zone, {
      room: Depth.room,
      tankBack: Depth.tankBack,
      water: Depth.bgWater,
      far: Depth.bgFar,
      mid: Depth.bgMid,
      floor: Depth.floor,
      env: Depth.environment,
      waterVolume: Depth.waterVolume,
      particles: Depth.particles,
      surface: Depth.surface,
      foreground: Depth.foreground,
      tankFront: Depth.tankFront,
    });

    const { station } = zone;
    this.add
      .image(station.x, station.y, TextureKeys.station)
      .setOrigin(0)
      .setDisplaySize(station.width, station.height)
      .setDepth(Depth.station);
    addPixelText(this, Math.round(station.x + station.width / 2), station.y - 2, t('world.station'))
      .setOrigin(0.5, 1)
      .setDepth(Depth.labels);
  }

  private createViews(): void {
    const { balance } = this.ctx.content;

    this.trashViews = new SpriteSync(
      (item) => this.createShadowedView(item.type.texture, Depth.items, item.lane),
      (view, item) => {
        // Rác nổi nhấp nhô 1px theo sóng.
        const bob =
          item.type.layer === 'float' ? Math.round(Math.sin(this.now / 400 + item.id)) : 0;
        const y = Math.round(item.y) + bob;
        this.placeInLane(view.sprite, item.x, y, item.lane);
        this.updateShadow(view.shadow, item.x, y, item.lane);
      },
    );

    this.foodViews = new SpriteSync(
      (pellet) =>
        this.applyLaneLook(this.add.image(0, 0, TextureKeys.foodPellet), Depth.items, pellet.lane),
      (sprite, pellet) => this.placeInLane(sprite, pellet.x, pellet.y, pellet.lane),
    );

    const blinkAfter = balance.drops.autoCollectSeconds - DROP_BLINK_SECONDS;
    this.dropViews = new SpriteSync(
      (drop) =>
        this.createShadowedView(
          drop.kind === 'coin' ? TextureKeys.dropCoin : TextureKeys.dropPearl,
          Depth.items,
          drop.lane,
        ),
      (view, drop) => {
        const visible = drop.age < blinkAfter || Math.floor(this.now / 150) % 2 === 0;
        this.placeInLane(view.sprite, drop.x, drop.y, drop.lane);
        view.sprite.setVisible(visible);
        this.updateShadow(view.shadow, drop.x, drop.y, drop.lane);
        view.shadow.setVisible(visible);
      },
    );

    this.fishViews = new SpriteSync(
      (fish) => this.createFishView(fish),
      (view, fish) => this.updateFishView(view, fish),
    );
  }

  private createFishView(fish: Fish): FishView {
    const sprite = this.add.image(0, 0, fish.species.texture).setDepth(Depth.fish);
    const shadow = this.add.image(0, 0, TextureKeys.shadow).setDepth(Depth.shadow);
    const alert = this.add.image(0, 0, TextureKeys.alert).setDepth(Depth.labels).setVisible(false);
    const countdown = addPixelText(this, 0, 0, '')
      .setOrigin(0, 1)
      .setColor(WARNING_COLOR)
      .setDepth(Depth.labels)
      .setVisible(false);
    return {
      sprite,
      shadow,
      alert,
      countdown,
      destroy: () => {
        sprite.destroy();
        shadow.destroy();
        alert.destroy();
        countdown.destroy();
      },
    };
  }

  private updateFishView(view: FishView, fish: Fish): void {
    const { world, content } = this.ctx;
    const x = Math.round(fish.x);
    const y = Math.round(fish.y);
    const sick = !fish.leaving && world.moodOf(fish) === 'sick';

    // Cá đổi làn liên tục (z trượt), nên thứ tự vẽ và màu cập nhật mỗi khung hình.
    this.placeInLane(view.sprite, x, y, fish.z);
    view.sprite.setFlipX(fish.facingX < 0).setDepth(this.laneDepth(Depth.fish, fish.z));
    view.shadow.setDepth(this.laneDepth(Depth.shadow, fish.z));
    this.updateShadow(view.shadow, x, y, fish.z);
    view.sprite.setTint(sick ? SICK_TINT : this.laneTint(fish.z));

    if (fish.leaving) {
      // Nhảy khỏi bể: chúc đầu lên, mờ dần khi đã lên khỏi mặt nước.
      view.sprite.setAngle(fish.facingX > 0 ? -LEAVING_ANGLE : LEAVING_ANGLE);
      const above = world.zone.surfaceY - fish.y;
      view.sprite.setAlpha(above > 0 ? Math.max(0, 1 - above / 20) : 1);
    }

    view.alert.setVisible(sick);
    view.countdown.setVisible(sick);
    if (sick) {
      // Dấu "!" và bộ đếm giữ cỡ 1× cho dễ đọc, chỉ đặt theo vị trí chiếu của làn.
      const top = y - fish.species.radius - 6;
      this.placeInLane(view.alert, x, top - 4, fish.z, false);
      const secondsLeft = Math.max(
        0,
        Math.ceil(content.balance.fish.leaveAfterSeconds - fish.sickSeconds),
      );
      const label = String(secondsLeft);
      if (view.countdown.text !== label) view.countdown.setText(label);
      this.placeInLane(view.countdown, x + 4, top + 2, fish.z, false);
    }
  }

  private syncRobot(): void {
    const { robot } = this.ctx.world;
    const x = Math.round(robot.x);
    const y = Math.round(robot.y);
    const facingLeft = robot.facingX < 0;
    this.cameraTarget.setPosition(robot.x, robot.y);
    const p = this.placeInLane(this.robotSprite, x, y, robot.z);
    this.robotSprite
      .setFlipX(facingLeft)
      .setDepth(this.laneDepth(Depth.robot, robot.z))
      .setTint(this.laneTint(robot.z));
    this.robotShadow.setDepth(this.laneDepth(Depth.shadow, robot.z));
    const speedRatio = Phaser.Math.Clamp(
      Math.hypot(robot.vx, robot.vy) / this.ctx.content.balance.robot.maxSpeed,
      0,
      1,
    );
    this.robotSprite.anims.timeScale = Phaser.Math.Linear(
      ROBOT_SPIN_IDLE_SCALE,
      ROBOT_SPIN_MAX_SCALE,
      speedRatio,
    );
    this.updateShadow(this.robotShadow, x, y, robot.z);
    this.placeInLane(
      this.headlight,
      facingLeft ? x - HEADLIGHT_DX : x + HEADLIGHT_DX,
      y + HEADLIGHT_DY,
      robot.z,
    );
    this.headlight
      .setOrigin(facingLeft ? 1 : 0, 0.5)
      .setFlipX(facingLeft)
      .setAlpha(headlightAlpha(this.ctx.world.water));

    // Vòng máy hút vẽ quanh gốc (0, 0) rồi đặt và co theo làn như sprite tàu.
    this.vacuumRing.clear();
    this.vacuumRing
      .setScrollFactor(p.scrollFactor)
      .setPosition(p.x, p.y)
      .setScale(p.scale)
      .setDepth(this.laneDepth(Depth.particles, robot.z));
    if (robot.vacuumOn) {
      const { radius } = this.ctx.content.balance.robot.vacuum;
      const alpha = 0.45 + 0.2 * Math.sin(this.now / 120);
      this.vacuumRing.lineStyle(1, VACUUM_RING_COLOR, alpha).strokeCircle(0, 0, radius);
    }
  }

  private syncViews(): void {
    const { world } = this.ctx;
    this.trashViews.sync(world.trash.items);
    this.foodViews.sync(world.food.pellets);
    this.dropViews.sync(world.drops.items);
    this.fishViews.sync(world.fish);
  }

  /** Vật đứng yên trong một làn (rác, xu): đặt thứ tự vẽ và màu một lần lúc tạo. */
  private createShadowedView(texture: string, depth: number, lane: number): ShadowedView {
    const sprite = this.applyLaneLook(this.add.image(0, 0, texture), depth, lane);
    const shadow = this.add
      .image(0, 0, TextureKeys.shadow)
      .setDepth(this.laneDepth(Depth.shadow, lane));
    return {
      sprite,
      shadow,
      destroy: () => {
        sprite.destroy();
        shadow.destroy();
      },
    };
  }

  private applyLaneLook(
    image: Phaser.GameObjects.Image,
    depth: number,
    laneZ: number,
  ): Phaser.GameObjects.Image {
    return image.setDepth(this.laneDepth(depth, laneZ)).setTint(this.laneTint(laneZ));
  }

  /** Phép chiếu một điểm thế giới ở làn `laneZ` (spec 12.5), khớp cách Background đặt lớp nền. */
  private projectLane(x: number, y: number, laneZ: number): LaneProjection {
    const p = layerPlacement(laneZ * LANE_DEPTH, this.scale.width, this.scale.height);
    return {
      x: Math.round(x * p.scale + p.offsetX),
      y: Math.round(y * p.scale + p.offsetY),
      scale: p.scale,
      scrollFactor: p.scrollFactor,
    };
  }

  /** Đặt object theo phép chiếu của làn; `scaled = false` giữ cỡ 1× (chữ, dấu cảnh báo). */
  private placeInLane(
    object: LaneObject,
    x: number,
    y: number,
    laneZ: number,
    scaled = true,
  ): LaneProjection {
    const p = this.projectLane(x, y, laneZ);
    object.setScrollFactor(p.scrollFactor).setPosition(p.x, p.y);
    if (scaled) object.setScale(p.scale);
    return p;
  }

  /** Làn Gần giữ thứ tự vẽ cũ; làn sau nằm dưới hàng cây chơi, làn càng sâu càng vẽ sớm. */
  private laneDepth(base: number, laneZ: number): number {
    if (laneZ < 0.05) return base;
    return Depth.environment + BACK_LANE_BASE + base * 0.001 - laneZ * 0.003;
  }

  /** Làn càng sâu càng ám màu nước. */
  private laneTint(laneZ: number): number {
    const t = Phaser.Math.Clamp(laneZ / 2, 0, 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff),
      Phaser.Display.Color.ValueToColor(LANE_FOG_COLOR),
      100,
      Math.round(t * 100),
    );
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
  }

  private updateShadow(
    shadow: Phaser.GameObjects.Image,
    x: number,
    objectY: number,
    laneZ: number,
  ): void {
    const { zone } = this.ctx.world;
    const { surfaceY } = zone;
    const floorY = floorAt(zone, x);
    const style = shadowStyle(objectY, floorY, surfaceY);
    const p = this.placeInLane(shadow, x, floorY - 1, laneZ, false);
    shadow.setAlpha(style.alpha).setScale(style.scaleX * p.scale, p.scale);
  }

  private floatText(message: string, x: number, y: number, laneZ: number, color: string): void {
    const label = addPixelText(this, 0, 0, message)
      .setOrigin(0.5, 1)
      .setColor(color)
      .setDepth(Depth.labels);
    this.placeInLane(label, x, y - 4, laneZ, false);
    this.tweens.add({
      targets: label,
      y: label.y - FLOAT_TEXT_RISE,
      alpha: 0,
      duration: FLOAT_TEXT_MS,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
