import { Howl } from "howler";

const silent = 0.01;

export class HowlerPlayer {
  public sounds: Map<string, Howl>;
  public currentTrack: string | null;

  public targetVolume: number = 1;

  constructor() {
    this.sounds = new Map();
    this.currentTrack = null;
  }

  loadTrack(id: string, url: string) {
    if (this.sounds.has(id)) return;

    const sound = new Howl({
      src: [url],
      html5: true,
      loop: true,
      preload: true,
    });
    this.sounds.set(id, sound);
  }

  play(id: string) {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.volume(this.targetVolume);
      sound.play();
      this.currentTrack = id;
    }
  }

  crossFade(fromId: string, toId: string, duration = 1000) {
    const fromSound = this.sounds.get(fromId);
    const toSound = this.sounds.get(toId);

    if (fromSound && toSound) {
      // Start new track at volume 0
      toSound.volume(silent);
      toSound.play();

      // Fade out current track
      this.smoothFade(fromSound, fromSound.volume(), silent, duration);

      // Fade in new track
      setTimeout(() => {
        this.smoothFade(toSound, silent, this.targetVolume, duration);
      }, 10);

      // Update current track
      this.currentTrack = toId;

      // Stop the old track after fade
      setTimeout(() => {
        fromSound.stop();
      }, duration);
    }
  }

  stop(id: string, duration = 1000) {
    const sound = this.sounds.get(id);
    if (sound) {
      this.currentTrack = null;
      this.smoothFade(sound, sound.volume(), silent, duration);
      setTimeout(() => {
        sound.stop();
      }, duration);
    }
  }

  smoothFade(sound: Howl, from: number, to: number, duration: number) {
    const startTime = performance.now();
    const diff = to - from;

    function update() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easing function for smoother transition
      const eased = 0.5 * (1 - Math.cos(progress * Math.PI));
      const newVolume = from + diff * eased;

      sound.volume(newVolume);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else if (to === 0) {
        sound.stop();
      }
    }

    requestAnimationFrame(update);
  }

  setVolume(id: string, volume: number) {
    const sound = this.sounds.get(id);
    if (sound) {
      sound.volume(volume);
    }
  }
}
