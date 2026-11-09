import Phaser from 'phaser';
import { TextureKeys } from '../art/keys';
import {
  assertTexturesExist,
  createPlaceholderTextures,
  queueImageTextures,
} from '../art/placeholders';
import { getContext } from '../context';
import { SceneKeys } from './keys';

/** Nạp ảnh thật (bản ghi `image`) và vẽ texture placeholder (các bản ghi còn lại) từ art.json. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    queueImageTextures(this.load, getContext(this).content.art);
  }

  create(): void {
    createPlaceholderTextures(this, getContext(this).content.art);
    assertTexturesExist(this, Object.values(TextureKeys));
    const isoMode = new URLSearchParams(window.location.search).get('iso') === '1';
    this.scene.start(isoMode ? SceneKeys.IsoPrototype : SceneKeys.Game);
  }
}
