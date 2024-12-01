import { Howl } from "howler";

const silent = 0;

export class HowlerPlayer {
  public sounds: Map<string, Howl>;
  public currentTrack: string | null;

  public targetVolume: number = 1;

  // We use this to keep track of the extra sounds needed to loop the sounds early
  public backupSounds: Map<string, Howl>;
  // Keep track of the timeout so that we can clear them
  public loopTimeout: NodeJS.Timeout[] = [];

  constructor() {
    this.sounds = new Map();
    this.backupSounds = new Map();
    this.currentTrack = null;
  }

  // TODO: Make this stream rather than loading the entire file first
  loadTrack(id: string, url: string) {
    if (this.sounds.has(id)) return;

    // Handle looping early.
    // Note:
    // - This relies on the duration of the sound. So if we seek, this won't work, need to handle separately
    // - Overlap time is currently hardcoded, might want to pull it from parameter
    const earlyLoopHandler = (s: Howl) => {
      if (this.currentTrack === id) {
        this.loopTimeout.push(
          setTimeout(
            () => {
              let newSound: Howl;
              if (this.backupSounds.has(id)) {
                newSound = this.backupSounds.get(id)!;
              } else {
                newSound = new Howl({
                  src: [url],
                  html5: false,
                  loop: false,
                  preload: true,
                });
                newSound.on("play", () => {
                  earlyLoopHandler(newSound);
                });
              }
              this.backupSounds.set(id, s);
              this.sounds.set(id, newSound);

              this.play(id);
            },
            (s.duration() - s.seek()) * 1000 - 5000,
          ),
        );
      }
    };

    const sound = new Howl({
      src: [url],
      html5: false,
      loop: false,
      preload: true,
    });
    sound.on("play", () => {
      earlyLoopHandler(sound);
    });
    this.sounds.set(id, sound);
  }

  play(id: string) {
    this.clearLoopQueue();

    const sound = this.sounds.get(id);
    if (sound) {
      sound.volume(this.targetVolume);
      sound.play();

      this.currentTrack = id;
    }
  }

  crossFade(fromId: string, toId: string, duration = 1000) {
    this.clearLoopQueue();

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
    }
  }

  stop(id: string, duration = 1000) {
    this.clearLoopQueue();

    const sound = this.sounds.get(id);
    if (sound) {
      this.currentTrack = null;
      this.smoothFade(sound, sound.volume(), silent, duration);
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

  clearLoopQueue() {
    if (this.loopTimeout.length > 0) {
      for (const timeout of this.loopTimeout) {
        clearTimeout(timeout);
      }
      this.loopTimeout = [];
    }
  }
}
