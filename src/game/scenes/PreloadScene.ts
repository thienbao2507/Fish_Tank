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
    const query = new URLSearchParams(window.location.search);
    const isoScene = query.get('iso') === '1' ? SceneKeys.IsoPrototype : SceneKeys.Game;
    this.scene.start(query.get('room') === '1' ? SceneKeys.Room : isoScene);
  }
}
