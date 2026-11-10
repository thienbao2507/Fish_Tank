import Phaser from 'phaser';
import { TextureKeys } from '../art/keys';
import {
  assertTexturesExist,
  createPlaceholderTextures,
  queueImageTextures,
} from '../art/placeholders';
import { installMusicPlayer } from '../audio/MusicPlayer';
import { installSoundDirector, queueSoundAssets } from '../audio/SoundDirector';
import { getContext } from '../context';
import { SceneKeys } from './keys';

/** Nạp ảnh thật (bản ghi `image`) và vẽ texture placeholder (các bản ghi còn lại) từ art.json. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    const { content } = getContext(this);
    queueImageTextures(this.load, content.art);
    queueSoundAssets(this.load, content.sounds);
  }

  create(): void {
    const context = getContext(this);
    createPlaceholderTextures(this, context.content.art);
    assertTexturesExist(this, Object.values(TextureKeys));
    installSoundDirector(this, {
      sounds: context.content.sounds,
      bus: context.bus,
      world: context.world,
    });
    installMusicPlayer(this, context.content.music);
    this.scene.start(SceneKeys.Menu);
  }
}
