// Web Audio API synthesized chime for incoming orders — zero external audio file dependencies.

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

export function unlockAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  } catch {
    // Ignore autoplay unlock errors
  }
}

/**
 * Plays a warm, crisp multi-tone hospitality chime using the Web Audio API.
 * Safe to invoke without external MP3 assets.
 */
export function playOrderNotificationChime(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    // Ascending major arpeggio bell chime (C5 -> E5 -> G5 -> C6)
    const notes = [
      { freq: 523.25, start: 0.0, duration: 0.28, gain: 0.22 },
      { freq: 659.25, start: 0.12, duration: 0.3, gain: 0.22 },
      { freq: 783.99, start: 0.24, duration: 0.34, gain: 0.24 },
      { freq: 1046.5, start: 0.38, duration: 0.55, gain: 0.26 },
    ];

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, now);
    masterGain.connect(ctx.destination);

    notes.forEach(({ freq, start, duration, gain }) => {
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      harmonic.type = 'triangle';
      harmonic.frequency.setValueAtTime(freq * 2, now + start);

      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.18, now + start);

      env.gain.setValueAtTime(0.0001, now + start);
      env.gain.linearRampToValueAtTime(gain, now + start + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0008, now + start + duration);

      osc.connect(env);
      harmonic.connect(harmonicGain);
      harmonicGain.connect(env);
      env.connect(masterGain);

      osc.start(now + start);
      harmonic.start(now + start);
      osc.stop(now + start + duration + 0.03);
      harmonic.stop(now + start + duration + 0.03);
    });

    return true;
  } catch {
    return false;
  }
}
