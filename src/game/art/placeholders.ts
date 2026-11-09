import type Phaser from 'phaser';
import type { ArtManifest, ShapePart, TextureDef } from '../../core/content/schemas';
import { hexToNumber, mixHex } from './color';

type ShapesDef = Extract<TextureDef, { kind: 'shapes' }>;
type GradientDef = Extract<TextureDef, { kind: 'verticalGradient' }>;

/** Xếp hàng nạp các texture là ảnh thật (gọi trong preload()). */
export function queueImageTextures(load: Phaser.Loader.LoaderPlugin, art: ArtManifest): void {
  for (const [key, def] of Object.entries(art.textures)) {
    if (def.kind === 'image') {
      load.image(key, def.file);
    } else if (def.kind === 'spritesheet') {
      load.spritesheet(key, def.file, {
        frameWidth: def.frameWidth,
        frameHeight: def.frameHeight,
      });
    }
  }
}

/** Vẽ các texture placeholder (gọi trong create(), sau khi ảnh thật đã nạp xong). */
export function createPlaceholderTextures(scene: Phaser.Scene, art: ArtManifest): void {
  for (const [key, def] of Object.entries(art.textures)) {
    if (def.kind === 'shapes') {
      drawShapes(scene, key, def);
    } else if (def.kind === 'verticalGradient') {
      drawGradient(scene, key, def);
    }
  }
}

export function assertTexturesExist(scene: Phaser.Scene, keys: readonly string[]): void {
  const missing = keys.filter((key) => !scene.textures.exists(key));
  if (missing.length > 0) {
    throw new Error(`Thiếu texture trong src/data/art.json: ${missing.join(', ')}`);
  }
}

// Lưu ý pixel art: chỉ `rect` ở toạ độ nguyên là sắc cạnh; circle/roundRect/ellipse bị khử răng cưa.
function drawShapes(scene: Phaser.Scene, key: string, def: ShapesDef): void {
  const graphics = scene.add.graphics();
  for (const part of def.parts) {
    drawPart(graphics, part);
  }
  graphics.generateTexture(key, def.width, def.height);
  graphics.destroy();
}

function drawPart(graphics: Phaser.GameObjects.Graphics, part: ShapePart): void {
  graphics.fillStyle(hexToNumber(part.color), part.alpha ?? 1);
  switch (part.shape) {
    case 'rect':
      graphics.fillRect(part.x, part.y, part.w, part.h);
      break;
    case 'roundRect':
      graphics.fillRoundedRect(part.x, part.y, part.w, part.h, part.r);
      break;
    case 'circle':
      graphics.fillCircle(part.x, part.y, part.r);
      break;
    case 'ellipse':
      graphics.fillEllipse(part.x, part.y, part.w, part.h);
      break;
  }
}

// Graphics.fillGradientStyle không đi vào generateTexture (giới hạn Canvas API) → vẽ bằng canvas 2D.
function drawGradient(scene: Phaser.Scene, key: string, def: GradientDef): void {
  const texture = scene.textures.createCanvas(key, def.width, def.height);
  if (!texture) {
    throw new Error(`Không tạo được texture "${key}"`);
  }
  const context = texture.getContext();

  if (def.steps === undefined) {
    const gradient = context.createLinearGradient(0, 0, 0, def.height);
    gradient.addColorStop(0, def.from);
    gradient.addColorStop(1, def.to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, def.width, def.height);
  } else {
    // Dải màu rời, ranh giới ở toạ độ nguyên → hợp với pixel art.
    for (let i = 0; i < def.steps; i++) {
      const top = Math.round((i * def.height) / def.steps);
      const bottom = Math.round(((i + 1) * def.height) / def.steps);
      context.fillStyle = mixHex(def.from, def.to, i / (def.steps - 1));
      context.fillRect(0, top, def.width, bottom - top);
    }
  }

  texture.refresh();
}
