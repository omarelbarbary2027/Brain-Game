// Procedural Web Audio API Synthesizer for tactile puzzle feedback
// Zero external audio files required; respects mute state and browser autoplay rules.

const PENTATONIC_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66,// D6
  1318.51,// E6
  1567.98 // G6
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  public setMuted(mute: boolean) {
    this.muted = mute;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    peakGain = 0.08,
    delaySec = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playTileStep(stepIndex: number) {
    const freq = PENTATONIC_HZ[stepIndex % PENTATONIC_HZ.length];
    this.playTone(freq, 0.16, 'triangle', 0.075);
  }

  public playFlashCue(stepIndex = 0) {
    const freq = PENTATONIC_HZ[stepIndex % 5] * 0.75;
    this.playTone(freq, 0.09, 'sine', 0.04);
  }

  public playTick() {
    this.playTone(620, 0.055, 'sine', 0.035);
  }

  public playUrgentTick() {
    this.playTone(880, 0.045, 'triangle', 0.03);
  }

  public playSuccess(combo = 1) {
    const baseIdx = Math.min(combo - 1, PENTATONIC_HZ.length - 1);
    const freq = PENTATONIC_HZ[Math.max(0, baseIdx)];
    this.playTone(freq, 0.14, 'triangle', 0.08);
  }

  public playMiss() {
    this.playTone(175, 0.19, 'sawtooth', 0.055);
    this.playTone(145, 0.22, 'triangle', 0.06, 0.04);
  }

  public playHint() {
    this.playTone(698.46, 0.12, 'sine', 0.05);
    this.playTone(880.0, 0.16, 'sine', 0.05, 0.06);
  }

  public playRuleShift() {
    this.playTone(523.25, 0.11, 'triangle', 0.055);
    this.playTone(659.25, 0.12, 'triangle', 0.055, 0.07);
    this.playTone(783.99, 0.16, 'triangle', 0.06, 0.14);
  }

  public playStageClear() {
    this.playTone(523.25, 0.22, 'triangle', 0.07, 0);
    this.playTone(659.25, 0.24, 'triangle', 0.07, 0.07);
    this.playTone(783.99, 0.34, 'triangle', 0.08, 0.14);
    this.playTone(1046.5, 0.42, 'sine', 0.06, 0.21);
  }
}

export const sound = new SoundEngine();
