// Every sound in Emberlight is synthesised with WebAudio: no audio files, no
// network, nothing to load. Each sound is a short oscillator (or two) with an
// envelope, so the game stays a handful of static files.
export function createAudio() {
  let context = null;
  let muted = false;

  /** Browsers only let audio start after a gesture; call this from one. */
  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      context = new AC();
    } catch {
      context = null;
    }
  }

  /** One tone: an oscillator that slides in pitch and fades out. */
  function tone(startFreq, endFreq, seconds, type, gainValue, delay = 0) {
    if (context === null || muted) return;
    const now = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + seconds);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain).connect(context.destination);
    osc.start(now);
    osc.stop(now + seconds + 0.05);
  }

  /** A short burst of filtered noise, for hits and the nova. */
  function noise(seconds, gainValue, delay = 0) {
    if (context === null || muted) return;
    const now = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      return muted;
    },
    /** A pickup blip; the pitch climbs a pentatonic ladder with the combo. */
    pickup(combo) {
      const ladder = [0, 3, 5, 7, 10, 12, 15, 17];
      const semis = ladder[Math.min(Math.max(combo, 1), 8) - 1];
      const base = 523 * Math.pow(2, semis / 12);
      tone(base, base * 1.6, 0.12, 'sine', 0.16);
      tone(base * 2, base * 2.4, 0.08, 'triangle', 0.05);
    },
    /** A golden ember: a bright two-note chime. */
    golden() {
      tone(1047, 1568, 0.18, 'sine', 0.14);
      tone(1568, 2093, 0.22, 'triangle', 0.08, 0.08);
    },
    /** A hit: a low thud plus noise. */
    hit() {
      tone(180, 55, 0.22, 'sawtooth', 0.2);
      noise(0.18, 0.22);
    },
    /** A shield absorbing a hit: a soft metallic ping. */
    shieldBlock() {
      tone(880, 660, 0.14, 'triangle', 0.14);
      tone(1320, 990, 0.1, 'sine', 0.06);
    },
    /** A level-up: a quick rising arpeggio. */
    levelUp() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, freq, 0.14, 'triangle', 0.12, i * 0.07));
    },
    /** A nova: a bright sweep up and out. */
    nova() {
      tone(220, 1760, 0.5, 'sine', 0.14);
      noise(0.4, 0.1);
    },
    /** A power-up collected: two warm notes. */
    powerUp() {
      tone(660, 660, 0.1, 'triangle', 0.12);
      tone(990, 990, 0.16, 'triangle', 0.12, 0.09);
    },
    /** Game over: three descending notes. */
    gameOver() {
      [392, 311, 233].forEach((freq, i) => tone(freq, freq * 0.94, 0.32, 'sine', 0.14, i * 0.22));
    },
    /** A UI click on start or restart. */
    click() {
      tone(700, 900, 0.06, 'sine', 0.1);
    },
  };
}
