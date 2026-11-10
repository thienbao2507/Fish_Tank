import type Phaser from 'phaser';
import { getSoundDirector } from './audio/SoundDirector';
import { SceneKeys } from './scenes/keys';

export type PlayArea = 'room' | 'tank';

let lastPlayArea: PlayArea = 'room';

export function enterTank(scene: Phaser.Scene): void {
  lastPlayArea = 'tank';
  getSoundDirector(scene).setArea('tank');
  if (scene.scene.isSleeping(SceneKeys.Game)) {
    scene.scene.wake(SceneKeys.Game);
    scene.scene.wake(SceneKeys.UI);
  } else {
    scene.scene.launch(SceneKeys.Game);
  }
  scene.scene.sleep(SceneKeys.Room);
}

export function enterRoom(scene: Phaser.Scene): void {
  lastPlayArea = 'room';
  getSoundDirector(scene).setArea('room');
  scene.scene.sleep(SceneKeys.Game);
  scene.scene.wake(SceneKeys.Room);
  scene.scene.sleep(SceneKeys.UI);
}

export function getLastPlayArea(): PlayArea {
  return lastPlayArea;
}

/** Mở overlay pause sau khi dừng đúng scene gameplay hiện tại. */
export function openPauseMenu(scene: Phaser.Scene, area: PlayArea): void {
  if (scene.scene.isActive(SceneKeys.Pause)) return;
  lastPlayArea = area;
  const sound = getSoundDirector(scene);
  sound.play('pause');
  sound.suspend('pause');
  scene.scene.launch(SceneKeys.Pause, { area });
  if (area === 'room') {
    scene.scene.pause(SceneKeys.Room);
  } else {
    scene.scene.pause(SceneKeys.Game);
    scene.scene.pause(SceneKeys.UI);
  }
}

/** Bắt đầu ván đầu tiên hoặc đánh thức đúng khu đã rời để về màn tiêu đề. */
export function startOrResumeGame(scene: Phaser.Scene): void {
  getSoundDirector(scene).setArea(lastPlayArea);
  if (lastPlayArea === 'tank') {
    if (scene.scene.isSleeping(SceneKeys.Game)) {
      scene.scene.wake(SceneKeys.Game);
      scene.scene.wake(SceneKeys.UI);
    } else if (scene.scene.isPaused(SceneKeys.Game)) {
      scene.scene.resume(SceneKeys.Game);
      scene.scene.resume(SceneKeys.UI);
    } else if (!scene.scene.isActive(SceneKeys.Game)) {
      scene.scene.launch(SceneKeys.Game);
    }
    scene.scene.stop(SceneKeys.Menu);
    return;
  }

  if (scene.scene.isSleeping(SceneKeys.Room)) {
    scene.scene.wake(SceneKeys.Room);
    scene.scene.stop(SceneKeys.Menu);
  } else if (scene.scene.isPaused(SceneKeys.Room)) {
    scene.scene.resume(SceneKeys.Room);
    scene.scene.stop(SceneKeys.Menu);
  } else if (scene.scene.isActive(SceneKeys.Room)) {
    scene.scene.stop(SceneKeys.Menu);
  } else {
    scene.scene.start(SceneKeys.Room);
  }
}
