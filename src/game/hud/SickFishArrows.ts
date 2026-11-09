import Phaser from 'phaser';
import type { Fish } from '../../core/sim/fish';
import type { World } from '../../core/world';
import { edgePoint, type Rect } from './edgeArrow';
import { HUD_TOP_RESERVED } from './layout';

const ARROW_COLOR = 0xe04f5f;
const OUTLINE_COLOR = 0xffffff;
/** Khoảng cách từ mép màn hình tới tâm mũi tên. */
const INSET = 14;
/** Đầu mũi tên cách tâm (phía trước) và đuôi cách tâm (phía sau), px. */
const TIP = 9;
const TAIL = 5;
const HALF_WIDTH = 6;
const OUTLINE = 2;

/** Mũi tên đỏ ở mép màn hình chỉ hướng tới cá ốm đang ở ngoài khung hình (P2-08). */
export class SickFishArrows {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    /** Đổi vị trí cá sang toạ độ màn hình (do scene game cung cấp). */
    private readonly toScreen: (fish: Fish) => { x: number; y: number },
  ) {
    this.graphics = scene.add.graphics();
  }

  draw(width: number, height: number): void {
    const g = this.graphics.clear();
    const view = new Phaser.Geom.Rectangle(0, 0, width, height);
    const area: Rect = {
      x: INSET,
      y: HUD_TOP_RESERVED + INSET,
      width: width - INSET * 2,
      height: height - HUD_TOP_RESERVED - INSET * 2,
    };

    for (const fish of this.world.fish) {
      if (fish.leaving || this.world.moodOf(fish) !== 'sick') continue;
      const at = this.toScreen(fish);
      if (view.contains(at.x, at.y)) continue;

      const { x, y, angle } = edgePoint(area, at.x, at.y);
      this.triangle(g, x, y, angle, OUTLINE, OUTLINE_COLOR);
      this.triangle(g, x, y, angle, 0, ARROW_COLOR);
    }
  }

  /** Tam giác nhọn về hướng `angle`; `grow` nới đều các cạnh để làm viền. */
  private triangle(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    angle: number,
    grow: number,
    color: number,
  ): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tip = TIP + grow * 1.5;
    const tail = TAIL + grow;
    const half = HALF_WIDTH + grow;
    const baseX = x - cos * tail;
    const baseY = y - sin * tail;
    g.fillStyle(color).fillTriangle(
      Math.round(x + cos * tip),
      Math.round(y + sin * tip),
      Math.round(baseX - sin * half),
      Math.round(baseY + cos * half),
      Math.round(baseX + sin * half),
      Math.round(baseY - cos * half),
    );
  }
}
