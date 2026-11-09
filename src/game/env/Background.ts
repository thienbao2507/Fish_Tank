import Phaser from 'phaser';
import type { ZoneDef } from '../../core/content/schemas';
import { createRng, pickWeighted, type Rng, type Weighted } from '../../core/rng';
import { floorAt } from '../../core/sim/terrain';
import { TextureKeys } from '../art/keys';
import { frontGlassAlpha, layerPlacement } from './perspective';
import { murkAlpha, speckCount, sunrayAlpha } from './waterVisual';

export interface BackgroundDepths {
  readonly room: number;
  readonly tankBack: number;
  readonly water: number;
  readonly far: number;
  readonly mid: number;
  readonly floor: number;
  readonly env: number;
  readonly waterVolume: number;
  readonly particles: number;
  readonly surface: number;
  readonly foreground: number;
  readonly tankFront: number;
}

/**
 * Seed riêng cho phần trang trí: bố cục cây/đá giống nhau mỗi lần chơi
 * và không lấy số từ chuỗi ngẫu nhiên của luật chơi (ctx.rng).
 */
const DECOR_SEED = 0x5eed;

// Màu và độ mờ của các lớp nền đã vẽ sẵn trong ảnh (scripts/art/generate.mjs) theo vị trí dưới đây:
// đổi DISTANT_LIFT / RUINS_LIFT / ROCKS_SINK thì sửa cả LAYOUT trong script rồi chạy `npm run art`.
const DISTANT_LIFT = 0;
const RUINS_LIFT = 0;
const ROCKS_SINK = 0;
const DISTANT_Z = 1;
const RUINS_Z = 0.7;
const ROCKS_Z = 0.4;
/** Lớp đá tảng gồ ghề phía sau rạn gần. */
const REEF_ROCKS_Z = 0.12;
/** Ảnh `env.terrain` bắt đầu ở floorY - TERRAIN_HEADROOM; phải bằng TERRAIN_HEADROOM trong generate.mjs. */
const TERRAIN_HEADROOM = 40;
const HAZE_Z = 0.85;
const SCHOOL_Z = 0.65;
const FRONT_GLASS_Z = -0.08;
const ROOM_SCROLL = 0.05;
const HAZE_COUNT = 4;
const HAZE_ALPHA = 0.22;
const SCHOOL_COUNT = 2;
const RAY_SCROLL = 0.6;
const RAY_COUNT = 5;
const JELLY_COUNT = 5;
const FAR_JELLY_COUNT = 3;
/** Sứa ở hậu cảnh chỉ còn là đốm sáng mờ (vẽ cộng sáng). */
const FAR_JELLY_ALPHA = 0.4;
const PLANKTON_COUNT = 40;
const FG_SCROLL = 1.3;
const FG_KELP_COUNT = 3;
/** Tiền cảnh lún xuống dưới đáy khu vài px để không lộ mép dưới. */
const FG_SINK = 6;
const BUBBLE_COUNT = 18;
const BUBBLE_VENTS = 3;
const SPECK_MAX = 70;
const SURFACE_SPEED = 6;
const CAUSTIC_SPEEDS = [5, -3] as const;
/** Vân sáng trên cát sáng hơn tia nắng bao nhiêu lần. */
const CAUSTIC_GAIN = 1.6;
const VOLUME_CAUSTIC_ALPHA = 0.08;
const FLOOR_BANDS = 12;
const FLOOR_NEAR_COLOR = 0x766b62;
const FLOOR_FAR_COLOR = 0x295c72;
const SIDE_GLASS_COLOR = 0x4f9da5;
const SILICONE_COLOR = 0xa2d9d0;
const BACK_GLASS_ALPHA = 0.62;
/** Không trồng cây sát trạm để trạm luôn nhìn rõ. */
const STATION_CLEARANCE = 18;
/**
 * Rạn san hô / tảo: bề rộng một rạn và khoảng cát trống giữa hai rạn (px, spec 12.4).
 * Mật độ gấp 4 bản đầu: rạn rộng hơn, khoảng trống hẹp hơn, cây mọc sát nhau hơn.
 */
const REEF_WIDTH: readonly [number, number] = [100, 180];
const REEF_GAP: readonly [number, number] = [30, 70];

/** Một loại cây: biên độ đung đưa (độ, 0 = đứng yên). */
interface PlantKind {
  readonly key: string;
  readonly sway: number;
}

/** Thành phần của các rạn trong một hàng sâu: cây cao mọc giữa rạn, cây thấp ở mép. */
interface ReefRow {
  readonly tall: readonly Weighted<PlantKind>[];
  readonly short: readonly Weighted<PlantKind>[];
  /** Khoảng cách giữa hai cây trong rạn (px). */
  readonly spacing: readonly [number, number];
}

type PerspectiveObject = Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;

const kind = (key: string, sway = 0): PlantKind => ({ key, sway });
const w = (weight: number, item: PlantKind): Weighted<PlantKind> => ({ weight, item });

/** Hàng xa (z 0.5): rừng tảo bẹ cao (ảnh mẫu 1), roi biển, quạt biển. */
const REEF_FAR: ReefRow = {
  tall: [
    w(3, kind(TextureKeys.decoKelpTallA, 1.5)),
    w(3, kind(TextureKeys.decoKelpTallB, 1.5)),
    w(1, kind(TextureKeys.decoSeaWhip, 1.5)),
  ],
  short: [
    w(2, kind(TextureKeys.decoSeaGrass, 3)),
    w(1, kind(TextureKeys.decoGoldKelpA, 1.5)),
    w(1, kind(TextureKeys.decoSeaFan)),
  ],
  spacing: [6, 10],
};

/** Hàng giữa (z 0.25): tảo vàng có túi khí (ảnh mẫu 3), quạt biển, san hô cột, bọt biển. */
const REEF_MID: ReefRow = {
  tall: [
    w(3, kind(TextureKeys.decoGoldKelpA, 1.5)),
    w(3, kind(TextureKeys.decoGoldKelpB, 1.5)),
    w(2, kind(TextureKeys.decoSeaFan)),
    w(2, kind(TextureKeys.decoSeaWhip, 1.5)),
    w(1, kind(TextureKeys.decoPillarCoral)),
    w(1, kind(TextureKeys.decoKelpTallB, 1.5)),
  ],
  short: [
    w(2, kind(TextureKeys.decoCoralPurple)),
    w(2, kind(TextureKeys.decoCoralOrange)),
    w(2, kind(TextureKeys.decoSeaGrass, 3)),
    w(1, kind(TextureKeys.decoPinkBall)),
    w(1, kind(TextureKeys.decoTableCoral)),
    w(1, kind(TextureKeys.decoVaseSponge)),
    w(1, kind(TextureKeys.decoBarrelSponge)),
    w(1, kind(TextureKeys.decoElkhorn)),
  ],
  spacing: [5, 9],
};

/** Hàng chơi (z 0): rạn san hô màu (ảnh mẫu 2 và 4), thấp để không che tàu, kèm sinh vật phát quang. */
const REEF_NEAR: ReefRow = {
  tall: [
    w(3, kind(TextureKeys.decoCoralPurple)),
    w(3, kind(TextureKeys.decoCoralPink)),
    w(3, kind(TextureKeys.decoCoralOrange)),
    w(2, kind(TextureKeys.decoSeaGrass, 3)),
    w(2, kind(TextureKeys.decoTubeSponge)),
    w(2, kind(TextureKeys.decoElkhorn)),
    w(1, kind(TextureKeys.decoPillarCoral)),
    w(1, kind(TextureKeys.decoMushroomCoral)),
    w(1, kind(TextureKeys.decoFeatherDuster)),
    w(1, kind(TextureKeys.decoTableCoral)),
    w(1, kind(TextureKeys.decoBarrelSponge)),
    w(1, kind(TextureKeys.decoVaseSponge)),
    w(1, kind(TextureKeys.decoGlowCoral)),
    w(1, kind(TextureKeys.decoLamp)),
  ],
  short: [
    w(3, kind(TextureKeys.decoBrainCoral)),
    w(3, kind(TextureKeys.decoPinkBall)),
    w(2, kind(TextureKeys.decoEncrustBlue)),
    w(2, kind(TextureKeys.decoBubbleCoral)),
    w(2, kind(TextureKeys.decoZoanthids)),
    w(2, kind(TextureKeys.decoSeaLettuce, 2)),
    w(2, kind(TextureKeys.decoCaulerpa)),
    w(1, kind(TextureKeys.decoStarPolyps)),
    w(1, kind(TextureKeys.decoAnemone)),
    w(1, kind(TextureKeys.decoGiantClam)),
    w(1, kind(TextureKeys.decoStarfish)),
    w(1, kind(TextureKeys.decoUrchin)),
    w(1, kind(TextureKeys.decoChristmasTree)),
    w(1, kind(TextureKeys.decoStones)),
  ],
  spacing: [5, 9],
};

interface PerspectiveLayer {
  readonly object: PerspectiveObject;
  readonly z: number;
  readonly worldX: number;
  readonly worldY: number;
}

interface Ray {
  readonly sprite: Phaser.GameObjects.Image;
  /** Hệ số nhấp nháy 0–1, được tween; alpha thật = sunrayAlpha × pulse. */
  readonly pulse: { value: number };
}

interface School {
  readonly sprite: Phaser.GameObjects.Image;
  x: number;
  readonly y: number;
  readonly z: number;
  /** px/s, âm = bơi sang trái. */
  readonly speed: number;
  readonly span: number;
}

interface Jelly {
  readonly sprite: Phaser.GameObjects.Image;
  readonly halo: Phaser.GameObjects.Image | null;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly phase: number;
}

interface Drifter {
  readonly sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  readonly speed: number;
  phase: number;
}

function mixColor(from: number, to: number, t: number): number {
  const amount = Math.max(0, Math.min(1, t));
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** Toàn bộ môi trường của một khu: hộp bể 2.5D, nền, cây cỏ, ánh sáng và độ đục. */
export class Background {
  private readonly scene: Phaser.Scene;
  private readonly zone: ZoneDef;
  private readonly rng: Rng;
  private readonly perspectiveLayers: PerspectiveLayer[] = [];
  private readonly rays: Ray[] = [];
  private readonly caustics: { layer: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private readonly volumeCaustic: Phaser.GameObjects.TileSprite;
  private readonly surface: Phaser.GameObjects.TileSprite;
  private readonly bubbles: Drifter[] = [];
  private readonly specks: Drifter[] = [];
  private readonly vents: number[] = [];
  private readonly schools: School[] = [];
  private readonly jellies: Jelly[] = [];
  private readonly plankton: Drifter[] = [];
  private readonly murk: Phaser.GameObjects.Rectangle;
  private readonly floorGeometry: Phaser.GameObjects.Graphics;
  private readonly tankGeometry: Phaser.GameObjects.Graphics;
  private readonly frontGlassGeometry: Phaser.GameObjects.Graphics;
  private readonly frontGlassDecor: Phaser.GameObjects.Image[] = [];
  private elapsed = 0;

  constructor(scene: Phaser.Scene, zone: ZoneDef, depths: BackgroundDepths) {
    this.scene = scene;
    this.zone = zone;
    this.rng = createRng(DECOR_SEED);
    const { width, surfaceY, floorY, height, wallWidth, station } = zone;
    const waterHeight = floorY - surfaceY;
    const sandHeight = height - floorY;
    const texHeight = (key: string) => scene.textures.getFrame(key).height;

    // Phòng ngoài cùng: rõ ở dải không khí, chỉ lờ mờ qua lớp nước alpha 0.9.
    scene.add
      .tileSprite(0, 0, width, height, TextureKeys.room)
      .setOrigin(0)
      .setScrollFactor(ROOM_SCROLL, ROOM_SCROLL)
      .setDepth(depths.room);

    this.tankGeometry = scene.add.graphics().setScrollFactor(0).setDepth(depths.tankBack);
    this.floorGeometry = scene.add.graphics().setScrollFactor(0).setDepth(depths.floor);

    const backGlass = scene.add
      .tileSprite(0, 0, width, waterHeight, TextureKeys.backGlass)
      .setOrigin(0)
      .setAlpha(BACK_GLASS_ALPHA)
      .setDepth(depths.tankBack);
    this.addPerspectiveLayer(backGlass, 1, 0, surfaceY);

    scene.add
      .tileSprite(0, 0, width, surfaceY, TextureKeys.air)
      .setOrigin(0)
      .setAlpha(0.42)
      .setDepth(depths.water);
    scene.add
      .tileSprite(0, surfaceY, width, waterHeight, TextureKeys.water)
      .setOrigin(0)
      .setAlpha(0.9)
      .setDepth(depths.water);

    // Ba lớp nền theo z; scale và scroll factor luôn khớp phép chiếu ở cả hai trục.
    const distant = scene.add
      .tileSprite(0, 0, width, texHeight(TextureKeys.distant), TextureKeys.distant)
      .setOrigin(0, 1)
      .setDepth(depths.far);
    this.addPerspectiveLayer(distant, DISTANT_Z, 0, floorY - DISTANT_LIFT);

    const hazeSpan = width + scene.scale.width;
    for (let i = 0; i < HAZE_COUNT; i++) {
      const haze = scene.add
        .image(
          Math.round(((i + 0.2 + this.rng.next() * 0.6) / HAZE_COUNT) * hazeSpan),
          this.rng.int(surfaceY + 90, floorY - 200),
          TextureKeys.haze,
        )
        .setScale(2)
        .setAlpha(HAZE_ALPHA)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(depths.far + 0.05);
      this.addPerspectiveLayer(haze, HAZE_Z, haze.x, haze.y);
    }

    const ruins = scene.add
      .tileSprite(0, 0, width, texHeight(TextureKeys.ruins), TextureKeys.ruins)
      .setOrigin(0, 1)
      .setDepth(depths.far + 0.1);
    this.addPerspectiveLayer(ruins, RUINS_Z, 0, floorY - RUINS_LIFT);

    // Đàn cá nhỏ và sứa xa cũng tuân theo phối cảnh z.
    const schoolSpan = width + scene.scale.width;
    for (let i = 0; i < SCHOOL_COUNT; i++) {
      const speed = this.rng.int(5, 11) * (i % 2 === 0 ? 1 : -1);
      const x = this.rng.int(0, Math.round(schoolSpan));
      const y = this.rng.int(surfaceY + 50, floorY - 230);
      const sprite = scene.add
        .image(0, 0, TextureKeys.school)
        .setFlipX(speed < 0)
        .setAlpha(0.75)
        .setDepth(depths.far + 0.15);
      this.schools.push({ sprite, x, y, z: SCHOOL_Z, speed, span: schoolSpan });
      this.placePerspectiveObject(sprite, SCHOOL_Z, x, y);
    }
    for (let i = 0; i < FAR_JELLY_COUNT; i++) {
      const x = this.rng.int(0, Math.round(schoolSpan));
      const y = this.rng.int(surfaceY + 70, floorY - 200);
      const sprite = scene.add
        .image(0, 0, TextureKeys.decoJelly)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(FAR_JELLY_ALPHA)
        .setDepth(depths.far + 0.15);
      this.jellies.push({
        sprite,
        halo: null,
        x,
        y,
        z: SCHOOL_Z,
        phase: this.rng.next() * Math.PI * 2,
      });
      this.placePerspectiveObject(sprite, SCHOOL_Z, x, y);
    }

    const rocks = scene.add
      .tileSprite(0, 0, width, texHeight(TextureKeys.rocks), TextureKeys.rocks)
      .setOrigin(0, 1)
      .setDepth(depths.mid);
    this.addPerspectiveLayer(rocks, ROCKS_Z, 0, floorY + ROCKS_SINK);

    // Tia nắng nằm trên sinh vật trong khối nước.
    const raySpan = width * RAY_SCROLL + scene.scale.width * (1 - RAY_SCROLL);
    for (let i = 0; i < RAY_COUNT; i++) {
      const x = ((i + this.rng.next() * 0.6 + 0.2) / RAY_COUNT) * raySpan;
      const sprite = scene.add
        .image(Math.round(x), surfaceY, TextureKeys.sunray)
        .setOrigin(0.5, 0)
        .setScale(this.rng.chance(0.5) ? 2 : 1, 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(RAY_SCROLL, 1)
        .setDepth(depths.waterVolume + 0.1);
      const pulse = { value: 0.75 };
      scene.tweens.add({
        targets: pulse,
        value: 1,
        yoyo: true,
        repeat: -1,
        duration: this.rng.int(2600, 4600),
        delay: this.rng.int(0, 2000),
        ease: 'Sine.easeInOut',
      });
      this.rays.push({ sprite, pulse });
    }

    // Lớp đá tảng gồ ghề phía sau rạn gần (z nhỏ, gần như sắc nét).
    const reefRocks = scene.add
      .tileSprite(0, 0, width, texHeight(TextureKeys.reefRocks), TextureKeys.reefRocks)
      .setOrigin(0, 1)
      .setDepth(depths.env - 0.07);
    this.addPerspectiveLayer(reefRocks, REEF_ROCKS_Z, 0, floorY + 2);

    // Nền đất lớp chơi bám đúng mặt đáy lồi lõm (spec mục 8). Nằm trên hai hàng cây xa
    // để gò đất che chân cây phía sau, dưới hàng cây gần.
    if (sandHeight > 0) {
      scene.add
        .image(0, floorY - TERRAIN_HEADROOM, TextureKeys.terrain)
        .setOrigin(0)
        .setDepth(depths.env - 0.05);
      const causticLayers = [
        { key: TextureKeys.causticsA, speed: CAUSTIC_SPEEDS[0] },
        { key: TextureKeys.causticsB, speed: CAUSTIC_SPEEDS[1] },
      ];
      for (const { key, speed } of causticLayers) {
        const layer = scene.add
          .tileSprite(0, floorY, width, texHeight(key), key)
          .setOrigin(0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(depths.env - 0.04);
        this.caustics.push({ layer, speed });
      }
    }

    // Hai hàng cây xa nhỏ và hoà màu nước; hàng z=0 giữ sắc nét như cũ.
    this.plant(scene, REEF_FAR, depths.env - 0.2, 0.5, 0x538395);
    this.plant(scene, REEF_MID, depths.env - 0.1, 0.25, 0xb4d2c8);
    this.plant(scene, REEF_NEAR, depths.env, 0);

    // Sứa cam phát sáng trôi lơ lửng (sau cá và tàu, không tương tác).
    for (let i = 0; i < JELLY_COUNT; i++) {
      const x = Math.round(((i + 0.2 + this.rng.next() * 0.6) / JELLY_COUNT) * width);
      const y = this.rng.int(surfaceY + 90, floorY - 110);
      this.jellies.push({
        sprite: scene.add.image(x, y, TextureKeys.decoJelly).setDepth(depths.env),
        halo: scene.add
          .image(x, y, TextureKeys.glow)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(depths.env),
        x,
        y,
        z: 0,
        phase: this.rng.next() * Math.PI * 2,
      });
    }

    // Lớp vân sáng mờ phủ toàn vùng nước, để sinh vật cũng nhận caustics.
    this.volumeCaustic = scene.add
      .tileSprite(0, surfaceY, width, waterHeight, TextureKeys.causticsA)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depths.waterVolume + 0.2);

    this.murk = scene.add
      .rectangle(0, surfaceY, width, height - surfaceY, 0x2f4a33)
      .setOrigin(0, 0)
      .setDepth(depths.waterVolume);

    // Dải sáng và mặt nước đè lên sinh vật.
    scene.add
      .tileSprite(0, surfaceY, width, texHeight(TextureKeys.surfaceGlow), TextureKeys.surfaceGlow)
      .setOrigin(0)
      .setDepth(depths.surface);
    this.surface = scene.add
      .tileSprite(0, surfaceY - 2, width, texHeight(TextureKeys.surface), TextureKeys.surface)
      .setOrigin(0)
      .setDepth(depths.surface);

    // Ánh lửa, bong bóng, hạt và phù du nằm ở lớp particles.
    const glow = scene.add
      .image(
        Math.round(station.x + station.width / 2),
        Math.round(station.y + station.height * 0.7),
        TextureKeys.glow,
      )
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setDepth(depths.particles);
    scene.tweens.add({
      targets: glow,
      alpha: 0.85,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: 'Sine.easeInOut',
    });

    for (let i = 0; i < BUBBLE_VENTS; i++) {
      this.vents.push(this.rng.int(wallWidth + 40, width - wallWidth - 40));
    }
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const x = this.bubbleX();
      const y = this.rng.int(surfaceY, floorY);
      this.bubbles.push({
        sprite: scene.add
          .image(x, y, TextureKeys.bubble)
          .setScale(this.rng.chance(0.3) ? 2 : 1)
          .setDepth(depths.particles),
        x,
        y,
        speed: this.rng.int(14, 30),
        phase: this.rng.next() * Math.PI * 2,
      });
    }

    for (let i = 0; i < SPECK_MAX; i++) {
      const x = this.rng.int(wallWidth, width - wallWidth);
      const y = this.rng.int(surfaceY, floorY);
      this.specks.push({
        sprite: scene.add.image(x, y, TextureKeys.speck).setAlpha(0.55).setDepth(depths.particles),
        x,
        y,
        speed: this.rng.int(2, 6),
        phase: this.rng.next() * Math.PI * 2,
      });
    }

    for (let i = 0; i < PLANKTON_COUNT; i++) {
      const x = this.rng.int(wallWidth, width - wallWidth);
      const y = this.rng.int(surfaceY + 20, floorY);
      this.plankton.push({
        sprite: scene.add
          .image(x, y, TextureKeys.plankton)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(depths.particles),
        x,
        y,
        speed: this.rng.int(1, 4),
        phase: this.rng.next() * Math.PI * 2,
      });
    }

    // Tiền cảnh: dải đá/san hô tối dưới đáy + vài sợi tảo mảnh vươn cao.
    const fgSpan = Math.ceil(width * FG_SCROLL + scene.scale.width);
    const fgHeight = texHeight(TextureKeys.fgFloor);
    scene.add
      .tileSprite(0, height - fgHeight + FG_SINK, fgSpan, fgHeight, TextureKeys.fgFloor)
      .setOrigin(0)
      .setScrollFactor(FG_SCROLL, 1)
      .setDepth(depths.foreground);
    for (let i = 0; i < FG_KELP_COUNT; i++) {
      const kelp = scene.add
        .image(
          Math.round(((i + 0.3 + this.rng.next() * 0.4) / FG_KELP_COUNT) * fgSpan),
          height + FG_SINK,
          TextureKeys.fgKelp,
        )
        .setOrigin(0.5, 1)
        .setAlpha(0.92)
        .setScrollFactor(FG_SCROLL, 1)
        .setDepth(depths.foreground)
        .setAngle(-1.5);
      scene.tweens.add({
        targets: kelp,
        angle: 1.5,
        yoyo: true,
        repeat: -1,
        duration: this.rng.int(3000, 4500),
        ease: 'Sine.easeInOut',
      });
    }

    // Kính trước: khung luôn rõ; mép, vệt, bọt và rêu nhận alpha theo vị trí robot.
    const frame = scene.add
      .tileSprite(0, 0, width, texHeight(TextureKeys.frameTop), TextureKeys.frameTop)
      .setOrigin(0, 1)
      .setDepth(depths.tankFront);
    this.addPerspectiveLayer(frame, FRONT_GLASS_Z, 0, surfaceY);

    this.frontGlassGeometry = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(depths.tankFront + 0.05);
    this.createFrontGlassDecor(depths.tankFront + 0.1);

    this.layoutPerspectiveLayers();
    this.drawTankGeometry();

    const resize = () => {
      this.layoutPerspectiveLayers();
      this.drawTankGeometry();
    };
    scene.scale.on(Phaser.Scale.Events.RESIZE, resize);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, resize);
    });
  }

  update(water: number, deltaSeconds: number, robotX: number): void {
    this.elapsed += deltaSeconds;
    const { surfaceY, floorY } = this.zone;
    this.drawTankGeometry();

    const glassAlpha = frontGlassAlpha(robotX, this.zone.width);
    this.frontGlassGeometry.setAlpha(glassAlpha);
    for (const object of this.frontGlassDecor) object.setAlpha(glassAlpha);

    this.murk.setAlpha(murkAlpha(water));
    const rayAlpha = sunrayAlpha(water);
    for (const ray of this.rays) ray.sprite.setAlpha(rayAlpha * ray.pulse.value);
    const causticAlpha = Math.min(1, rayAlpha * CAUSTIC_GAIN);
    for (const { layer, speed } of this.caustics) {
      layer.setAlpha(causticAlpha);
      layer.tilePositionX = Math.round(this.elapsed * speed);
    }
    this.volumeCaustic
      .setAlpha(causticAlpha * VOLUME_CAUSTIC_ALPHA)
      .setTilePosition(Math.round(this.elapsed * CAUSTIC_SPEEDS[0]), 0);
    this.surface.tilePositionX = Math.round(this.elapsed * SURFACE_SPEED);

    for (const school of this.schools) {
      school.x += school.speed * deltaSeconds;
      const margin = school.sprite.width;
      if (school.x > school.span + margin) school.x = -margin;
      else if (school.x < -margin) school.x = school.span + margin;
      this.placePerspectiveObject(
        school.sprite,
        school.z,
        school.x,
        school.y + Math.sin(this.elapsed * 0.6 + school.span) * 3,
      );
    }

    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed * deltaSeconds;
      bubble.phase += deltaSeconds * 3;
      if (bubble.y < surfaceY + 2) {
        bubble.y = floorY - 2;
        bubble.x = this.bubbleX();
      }
      bubble.sprite.setPosition(
        Math.round(bubble.x + Math.sin(bubble.phase) * 1.5),
        Math.round(bubble.y),
      );
    }

    for (const jelly of this.jellies) {
      const t = this.elapsed;
      const x = jelly.x + Math.sin(t * 0.12 + jelly.phase) * 24;
      const y = jelly.y + Math.sin(t * 0.5 + jelly.phase) * 8;
      this.placePerspectiveObject(jelly.sprite, jelly.z, x, y);
      if (jelly.halo) {
        this.placePerspectiveObject(jelly.halo, jelly.z, x, y + 2);
        jelly.halo.setAlpha(0.3 + 0.15 * Math.sin(t * 1.5 + jelly.phase));
      }
    }

    for (const p of this.plankton) {
      p.y -= p.speed * deltaSeconds;
      if (p.y < surfaceY + 10) p.y = floorY;
      p.sprite
        .setPosition(Math.round(p.x + Math.sin(this.elapsed * 0.4 + p.phase) * 5), Math.round(p.y))
        .setAlpha(0.2 + 0.8 * Math.max(0, Math.sin(this.elapsed * 1.7 + p.phase)));
    }

    const visibleSpecks = speckCount(water, SPECK_MAX);
    this.specks.forEach((speck, i) => {
      const visible = i < visibleSpecks;
      speck.sprite.setVisible(visible);
      if (!visible) return;
      speck.y += speck.speed * deltaSeconds;
      speck.phase += deltaSeconds * 0.8;
      if (speck.y > floorY) speck.y = surfaceY + 2;
      speck.sprite.setPosition(
        Math.round(speck.x + Math.sin(speck.phase) * 4),
        Math.round(speck.y),
      );
    });
  }

  private addPerspectiveLayer(
    object: PerspectiveObject,
    z: number,
    worldX: number,
    worldY: number,
  ): void {
    this.perspectiveLayers.push({ object, z, worldX, worldY });
    this.placePerspectiveObject(object, z, worldX, worldY);
  }

  private layoutPerspectiveLayers(): void {
    for (const layer of this.perspectiveLayers) {
      this.placePerspectiveObject(layer.object, layer.z, layer.worldX, layer.worldY);
    }
    for (const school of this.schools) {
      this.placePerspectiveObject(school.sprite, school.z, school.x, school.y);
    }
    for (const jelly of this.jellies) {
      this.placePerspectiveObject(jelly.sprite, jelly.z, jelly.x, jelly.y);
      if (jelly.halo) this.placePerspectiveObject(jelly.halo, jelly.z, jelly.x, jelly.y + 2);
    }
  }

  private placePerspectiveObject(
    object: PerspectiveObject,
    z: number,
    worldX: number,
    worldY: number,
  ): void {
    const placement = layerPlacement(z, this.scene.scale.width, this.scene.scale.height);
    object
      .setScale(placement.scale)
      .setScrollFactor(placement.scrollFactor, placement.scrollFactor)
      .setPosition(
        worldX * placement.scale + placement.offsetX,
        worldY * placement.scale + placement.offsetY,
      );
  }

  private project(worldX: number, worldY: number, z: number): Phaser.Math.Vector2 {
    const { width: viewW, height: viewH } = this.scene.scale;
    const placement = layerPlacement(z, viewW, viewH);
    const camera = this.scene.cameras.main;
    return new Phaser.Math.Vector2(
      worldX * placement.scale + placement.offsetX - camera.scrollX * placement.scrollFactor,
      worldY * placement.scale + placement.offsetY - camera.scrollY * placement.scrollFactor,
    );
  }

  /** Vẽ sàn lùi, kính sau và thành bên theo camera hiện tại. */
  private drawTankGeometry(): void {
    const { width, surfaceY, floorY } = this.zone;
    this.floorGeometry.clear();
    for (let i = FLOOR_BANDS - 1; i >= 0; i--) {
      const nearZ = i / FLOOR_BANDS;
      const farZ = (i + 1) / FLOOR_BANDS;
      const color = mixColor(FLOOR_NEAR_COLOR, FLOOR_FAR_COLOR, (nearZ + farZ) / 2);
      this.floorGeometry
        .fillStyle(color, 0.82)
        .fillPoints(
          [
            this.project(0, floorY, nearZ),
            this.project(width, floorY, nearZ),
            this.project(width, floorY, farZ),
            this.project(0, floorY, farZ),
          ],
          true,
        );
    }

    const left = [
      this.project(0, surfaceY, 0),
      this.project(0, floorY, 0),
      this.project(0, floorY, 1),
      this.project(0, surfaceY, 1),
    ];
    const right = [
      this.project(width, surfaceY, 0),
      this.project(width, floorY, 0),
      this.project(width, floorY, 1),
      this.project(width, surfaceY, 1),
    ];
    const back = [
      this.project(0, surfaceY, 1),
      this.project(width, surfaceY, 1),
      this.project(width, floorY, 1),
      this.project(0, floorY, 1),
    ];
    this.tankGeometry.clear();
    this.tankGeometry.fillStyle(SIDE_GLASS_COLOR, 0.14).fillPoints(left, true);
    this.tankGeometry.fillStyle(SIDE_GLASS_COLOR, 0.14).fillPoints(right, true);
    this.tankGeometry.lineStyle(2, SILICONE_COLOR, 0.38).strokePoints(left, true);
    this.tankGeometry.lineStyle(2, SILICONE_COLOR, 0.38).strokePoints(right, true);
    this.tankGeometry.lineStyle(2, SILICONE_COLOR, 0.28).strokePoints(back, true);

    const frontLeft = [
      this.project(0, surfaceY, FRONT_GLASS_Z),
      this.project(0, floorY, FRONT_GLASS_Z),
    ];
    const frontRight = [
      this.project(width, surfaceY, FRONT_GLASS_Z),
      this.project(width, floorY, FRONT_GLASS_Z),
    ];
    this.frontGlassGeometry.clear();
    this.frontGlassGeometry
      .lineStyle(4, 0x163b48, 0.55)
      .strokePoints(frontLeft)
      .strokePoints(frontRight);
    this.frontGlassGeometry
      .lineStyle(1, 0xc2f1e8, 0.72)
      .strokePoints(frontLeft)
      .strokePoints(frontRight);
  }

  private createFrontGlassDecor(depth: number): void {
    const { width, surfaceY, floorY } = this.zone;
    for (const side of [0, 1] as const) {
      const flip = side === 1;
      const edgeX = flip ? width : 0;
      const inward = flip ? -1 : 1;
      for (let i = 0; i < 2; i++) {
        const streak = this.scene.add
          .image(edgeX + inward * (24 + i * 42), surfaceY + 58 + i * 96, TextureKeys.glassStreak)
          .setOrigin(0.5, 0)
          .setFlipX(flip)
          .setDepth(depth);
        this.frontGlassDecor.push(streak);
        this.addPerspectiveLayer(streak, FRONT_GLASS_Z, streak.x, streak.y);
      }
      for (let i = 0; i < 6; i++) {
        const bubble = this.scene.add
          .image(
            edgeX + inward * this.rng.int(8, 76),
            this.rng.int(surfaceY + 24, floorY - 28),
            TextureKeys.glassBubble,
          )
          .setDepth(depth + 0.01);
        this.frontGlassDecor.push(bubble);
        this.addPerspectiveLayer(bubble, FRONT_GLASS_Z, bubble.x, bubble.y);
      }
      const moss = this.scene.add
        .image(edgeX, floorY, TextureKeys.glassMoss)
        .setOrigin(flip ? 1 : 0, 1)
        .setFlipX(flip)
        .setDepth(depth + 0.02);
      this.frontGlassDecor.push(moss);
      this.addPerspectiveLayer(moss, FRONT_GLASS_Z, edgeX, floorY);
    }
  }

  private bubbleX(): number {
    if (this.rng.chance(0.7)) return this.rng.pick(this.vents) + this.rng.int(-2, 2);
    return this.rng.int(this.zone.wallWidth + 4, this.zone.width - this.zone.wallWidth - 4);
  }

  /**
   * Trồng một hàng cây cỏ thành các rạn dày xen khoảng cát trống (spec 12.4).
   * Cây cao mọc ở giữa rạn, cây thấp ở mép; hai hàng gần không mọc sát trạm.
   */
  private plant(scene: Phaser.Scene, row: ReefRow, depth: number, z: number, tint?: number): void {
    const { width, floorY, wallWidth, station } = this.zone;
    const avoidStation = z < 0.4;
    const avoidFrom = station.x - STATION_CLEARANCE;
    const avoidTo = station.x + station.width + STATION_CLEARANCE;
    const end = width - wallWidth - 12;

    let reefStart = wallWidth + 8 + this.rng.int(0, REEF_GAP[0]);
    while (reefStart < end) {
      const reefWidth = this.rng.int(...REEF_WIDTH);
      const reefEnd = Math.min(end, reefStart + reefWidth);
      const plants: { x: number; plant: PlantKind; tall: boolean }[] = [];
      for (let x = reefStart; x < reefEnd; x += this.rng.int(...row.spacing)) {
        if (avoidStation && x > avoidFrom && x < avoidTo) continue;
        // 0 ở mép rạn, 1 ở giữa rạn.
        const centre = 1 - Math.abs((x - reefStart) / Math.max(1, reefEnd - reefStart) - 0.5) * 2;
        const tall = centre > 0.35 && this.rng.chance(0.4 + centre * 0.5);
        plants.push({ x, plant: pickWeighted(this.rng, tall ? row.tall : row.short), tall });
      }
      // Cây cao vẽ trước để cây thấp ở mép rạn đè lên chân cây cao.
      plants.sort((a, b) => Number(b.tall) - Number(a.tall));
      for (const { x, plant } of plants) {
        // Hàng chơi mọc trên mặt đáy lồi lõm; hàng xa đứng trên sàn phối cảnh phẳng.
        const groundY = z === 0 ? floorAt(this.zone, x) : floorY;
        this.addPlant(scene, plant, x, groundY + 2, depth, z, tint);
      }
      reefStart = reefEnd + this.rng.int(...REEF_GAP);
    }
  }

  private addPlant(
    scene: Phaser.Scene,
    plant: PlantKind,
    worldX: number,
    worldY: number,
    depth: number,
    z: number,
    tint?: number,
  ): void {
    const sprite = scene.add
      .image(worldX, worldY, plant.key)
      .setOrigin(0.5, 1)
      .setFlipX(this.rng.chance(0.5))
      .setDepth(depth);
    if (tint !== undefined) sprite.setTint(tint);
    this.addPerspectiveLayer(sprite, z, worldX, worldY);
    if (plant.sway > 0) {
      sprite.setAngle(-plant.sway);
      scene.tweens.add({
        targets: sprite,
        angle: plant.sway,
        yoyo: true,
        repeat: -1,
        duration: this.rng.int(2600, 4200),
        delay: this.rng.int(0, 1500),
        ease: 'Sine.easeInOut',
      });
    }
  }
}
