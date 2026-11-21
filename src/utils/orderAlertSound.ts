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

function scheduleChime(ctx: AudioContext): void {
  const now = ctx.currentTime + 0.01;
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
}

/**
 * Plays a warm, crisp multi-tone hospitality chime using the Web Audio API.
 * Safe to invoke without external MP3 assets and resilient when AudioContext starts suspended.
 */
export function playOrderNotificationChime(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => scheduleChime(ctx))
        .catch(() => {});
    } else {
      scheduleChime(ctx);
    }

    return true;
  } catch {
    return false;
  }
}

function scheduleCancellationAlert(ctx: AudioContext): void {
  const now = ctx.currentTime + 0.01;
  // Distinct descending warning double-tone (520Hz -> 310Hz), played twice with a 150ms gap
  const toneDuration = 0.24;
  const gapDuration = 0.15;
  const pulses = [0, toneDuration + gapDuration];

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.85, now);
  masterGain.connect(ctx.destination);

  pulses.forEach((offset) => {
    const startTime = now + offset;
    const endTime = startTime + toneDuration;

    const triOsc = ctx.createOscillator();
    const sawOsc = ctx.createOscillator();
    const sawGain = ctx.createGain();
    const env = ctx.createGain();

    triOsc.type = 'triangle';
    triOsc.frequency.setValueAtTime(520, startTime);
    triOsc.frequency.exponentialRampToValueAtTime(310, endTime - 0.02);

    sawOsc.type = 'sawtooth';
    sawOsc.frequency.setValueAtTime(520, startTime);
    sawOsc.frequency.exponentialRampToValueAtTime(310, endTime - 0.02);

    // Keep sawtooth subtle beneath the triangle wave for an unmistakable warning buzzer timbre
    sawGain.gain.setValueAtTime(0.22, startTime);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(0.28, startTime + 0.015);
    env.gain.setValueAtTime(0.24, endTime - 0.05);
    env.gain.exponentialRampToValueAtTime(0.0008, endTime);

    triOsc.connect(env);
    sawOsc.connect(sawGain);
    sawGain.connect(env);
    env.connect(masterGain);

    triOsc.start(startTime);
    sawOsc.start(startTime);
    triOsc.stop(endTime + 0.02);
    sawOsc.stop(endTime + 0.02);
  });
}

/**
 * Plays a distinct descending warning double-tone (520Hz -> 310Hz x2 with 150ms gap)
 * when a customer cancels an order, clearly distinguishable from the ascending new-order chime.
 */
export function playOrderCancelledAlertSound(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => scheduleCancellationAlert(ctx))
        .catch(() => {});
    } else {
      scheduleCancellationAlert(ctx);
    }

    return true;
  } catch {
    return false;
  }
}
