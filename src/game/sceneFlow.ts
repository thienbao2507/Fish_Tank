import type Phaser from 'phaser';
import { SceneKeys } from './scenes/keys';

export function enterTank(scene: Phaser.Scene): void {
  if (scene.scene.isSleeping(SceneKeys.Game)) {
    scene.scene.wake(SceneKeys.Game);
    scene.scene.wake(SceneKeys.UI);
  } else {
    scene.scene.launch(SceneKeys.Game);
  }
  scene.scene.sleep(SceneKeys.Room);
}

export function enterRoom(scene: Phaser.Scene): void {
  scene.scene.sleep(SceneKeys.Game);
  scene.scene.wake(SceneKeys.Room);
  scene.scene.sleep(SceneKeys.UI);
}
