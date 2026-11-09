import type Phaser from 'phaser';
import type { FishRules } from '../../core/content/schemas';
import { t } from '../../core/i18n';
import { nearestLane } from '../../core/sim/lanes';
import type { World } from '../../core/world';
import { TextureKeys } from '../art/keys';
import { HUD_MARGIN, HUD_ROW_1, HUD_ROW_2, TEXT_OFFSET_Y } from './layout';
import { addPixelText, COIN_COLOR, TEXT_COLOR, WARNING_COLOR } from './text';

const BAR_WIDTH = 50;
const BAR_HEIGHT = 10;
const ICON_GAP = 4;
/** Độ sạch nước hiển thị sau ô khoang, cùng hàng 2 (P2-01: tạm thời). */
const WATER_X = HUD_MARGIN + 64;

/** Màu % nước: bình thường / làm cá buồn (vàng) / làm cá mất máu (đỏ). */
function waterColor(percent: number, rules: FishRules): string {
  if (percent < rules.dirtyWaterBelow) return WARNING_COLOR;
  if (percent < rules.sadWaterBelow) return COIN_COLOR;
  return TEXT_COLOR;
}

const BAR_FRAME = 0x0b1d2e;
const BAR_EMPTY = 0x1b2a41;
const BAR_HIGH = 0x6fe08a;
const BAR_MID = 0xf2c94c;
const BAR_LOW = 0xe04f5f;
const LANE_DOT = 0x36516e;
const LANE_DOT_ACTIVE = 0xe6f1ff;

function batteryColor(ratio: number): number {
  if (ratio > 0.5) return BAR_HIGH;
  if (ratio > 0.2) return BAR_MID;
  return BAR_LOW;
}

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

/** Thông số mép trên: pin + khoang (trái), xu + ngọc (phải). Chỉ vẽ lại khi giá trị đổi. */
export class Hud {
  private readonly batteryBar: Phaser.GameObjects.Graphics;
  private readonly chargingText: Phaser.GameObjects.Text;
  private readonly cargoText: Phaser.GameObjects.Text;
  private readonly waterText: Phaser.GameObjects.Text;
  private readonly coinIcon: Phaser.GameObjects.Image;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly pearlIcon: Phaser.GameObjects.Image;
  private readonly pearlText: Phaser.GameObjects.Text;
  private readonly laneDots: Phaser.GameObjects.Graphics;
  private laneDotsX = 0;
  private laneDotsY = 0;
  private width = 0;
  private shown = {
    batteryPixels: -1,
    charging: false,
    used: -1,
    water: -1,
    coins: -1,
    pearls: -1,
    lane: -1,
  };

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    private readonly fishRules: FishRules,
  ) {
    this.batteryBar = scene.add.graphics();
    this.chargingText = addPixelText(
      scene,
      HUD_MARGIN + BAR_WIDTH + 6,
      HUD_ROW_1 + TEXT_OFFSET_Y - 1,
      t('hud.charging'),
    ).setVisible(false);

    scene.add.image(HUD_MARGIN, HUD_ROW_2, TextureKeys.iconCargo).setOrigin(0);
    this.cargoText = addPixelText(scene, HUD_MARGIN + 10 + ICON_GAP, HUD_ROW_2 + TEXT_OFFSET_Y, '');
    scene.add.image(WATER_X, HUD_ROW_2, TextureKeys.iconWater).setOrigin(0);
    this.waterText = addPixelText(scene, WATER_X + 6 + ICON_GAP, HUD_ROW_2 + TEXT_OFFSET_Y, '');

    this.coinIcon = scene.add.image(0, HUD_ROW_1, TextureKeys.iconCoin).setOrigin(0);
    this.coinText = addPixelText(scene, 0, HUD_ROW_1 + TEXT_OFFSET_Y, '').setOrigin(1, 0);
    this.pearlIcon = scene.add.image(0, HUD_ROW_2, TextureKeys.iconPearl).setOrigin(0);
    this.pearlText = addPixelText(scene, 0, HUD_ROW_2 + TEXT_OFFSET_Y, '').setOrigin(1, 0);
    this.laneDots = scene.add.graphics();
  }

  /** Gọi khi chiều rộng màn hình đổi: các thông số bên phải bám mép phải. */
  layout(width: number): void {
    this.width = width;
    this.placeRight(this.coinText, this.coinIcon);
    this.placeRight(this.pearlText, this.pearlIcon);
  }

  /** Đặt tâm cụm ba chấm làn cạnh các nút đổi làn. */
  layoutLaneIndicator(x: number, y: number): void {
    this.laneDotsX = x;
    this.laneDotsY = y;
    this.drawLaneDots(this.shown.lane < 0 ? nearestLane(this.world.robot.z) : this.shown.lane);
  }

  refresh(): void {
    const { robot, wallet } = this.world;

    const lane = nearestLane(robot.z);
    if (lane !== this.shown.lane) {
      this.shown.lane = lane;
      this.drawLaneDots(lane);
    }

    const batteryPixels = Math.round((BAR_WIDTH - 4) * robot.battery.ratio);
    if (batteryPixels !== this.shown.batteryPixels) {
      this.shown.batteryPixels = batteryPixels;
      this.drawBattery(batteryPixels, robot.battery.ratio);
    }

    const charging = this.world.isCharging;
    if (charging !== this.shown.charging) {
      this.shown.charging = charging;
      this.chargingText.setVisible(charging);
    }

    const { used, capacity, free } = robot.cargo;
    if (used !== this.shown.used) {
      this.shown.used = used;
      this.cargoText
        .setText(t('hud.cargo', { used, capacity }))
        .setColor(free === 0 ? WARNING_COLOR : TEXT_COLOR);
    }

    const coins = wallet.get('coins');
    if (coins !== this.shown.coins) {
      this.shown.coins = coins;
      this.coinText.setText(formatNumber(coins));
      this.placeRight(this.coinText, this.coinIcon);
    }

    const water = Math.round(this.world.water);
    if (water !== this.shown.water) {
      this.shown.water = water;
      this.waterText
        .setText(t('hud.water', { percent: water }))
        .setColor(waterColor(water, this.fishRules));
    }

    const pearls = wallet.get('pearls');
    if (pearls !== this.shown.pearls) {
      this.shown.pearls = pearls;
      this.pearlText.setText(formatNumber(pearls));
      this.placeRight(this.pearlText, this.pearlIcon);
    }
  }

  private placeRight(text: Phaser.GameObjects.Text, icon: Phaser.GameObjects.Image): void {
    const right = this.width - HUD_MARGIN;
    text.setX(right);
    icon.setX(Math.round(right - text.width - ICON_GAP - icon.width));
  }

  private drawBattery(fillPixels: number, ratio: number): void {
    const g = this.batteryBar.clear();
    const x = HUD_MARGIN;
    const y = HUD_ROW_1;
    g.fillStyle(BAR_FRAME).fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);
    g.fillRect(x + BAR_WIDTH, y + 3, 2, BAR_HEIGHT - 6); // núm pin
    g.fillStyle(BAR_EMPTY).fillRect(x + 2, y + 2, BAR_WIDTH - 4, BAR_HEIGHT - 4);
    if (fillPixels > 0) {
      g.fillStyle(batteryColor(ratio)).fillRect(x + 2, y + 2, fillPixels, BAR_HEIGHT - 4);
    }
  }

  private drawLaneDots(activeLane: number): void {
    const g = this.laneDots.clear();
    for (let lane = 0; lane < 3; lane++) {
      g.fillStyle(lane === activeLane ? LANE_DOT_ACTIVE : LANE_DOT);
      g.fillCircle(this.laneDotsX, this.laneDotsY + (1 - lane) * 6, 2);
    }
  }
}
