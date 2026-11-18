// Sound, all synthesised with Web Audio (no sound files): a cue for every action and a slow tide of
// music under the nights. It wakes on the first click or key, as browsers require.

const SCALE = [0, 3, 5, 7, 10, 12, 15];

/** The game's sound. play(name) fires a cue; setMuted, toggle and music control the rest. */
export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = 0;
  let beat = 0;
  let mood = 0;
  const last = new Map();

  function wake() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    context = new Context();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
  }

  function tone(frequency, duration, type = 'sine', volume = 0.3, slide = 0, delay = 0, output = master) {
    if (context === null) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise(duration, volume = 0.3, filter = 1200, delay = 0) {
    if (context === null) return;
    const start = context.currentTime + delay;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const band = context.createBiquadFilter();
    band.type = 'lowpass';
    band.frequency.value = filter;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(band).connect(gain).connect(master);
    source.start(start);
  }

  const CUES = {
    shoot: () => tone(880 + Math.random() * 120, 0.06, 'triangle', 0.06, 1.6),
    hit: () => tone(320, 0.05, 'square', 0.04, 0.6),
    kill: () => { noise(0.18, 0.18, 900); tone(220, 0.16, 'sawtooth', 0.05, 0.4); },
    ember: () => tone(1320 + Math.random() * 300, 0.08, 'sine', 0.08, 1.2),
    lantern: () => { tone(110, 0.35, 'sine', 0.35, 0.5); noise(0.2, 0.12, 400); },
    wick: () => { tone(260, 0.3, 'square', 0.12, 0.4); noise(0.25, 0.2, 700); },
    dash: () => noise(0.16, 0.16, 2400),
    flare: () => { noise(0.7, 0.35, 1800); tone(180, 0.8, 'sawtooth', 0.12, 3); tone(540, 0.6, 'sine', 0.15, 2); },
    glob: () => tone(150, 0.12, 'sine', 0.06, 1.8),
    boss: () => { tone(55, 1.6, 'sawtooth', 0.22, 0.8); tone(82, 1.6, 'sawtooth', 0.15, 0.8, 0.2); },
    bossDown: () => { noise(1.2, 0.4, 900); [0, 4, 7, 12].forEach((step, index) => tone(262 * 2 ** (step / 12), 0.9, 'triangle', 0.14, 1, index * 0.12)); },
    night: () => [0, 7, 12].forEach((step, index) => tone(196 * 2 ** (step / 12), 1.1, 'sine', 0.16, 1, index * 0.18)),
    clear: () => [0, 4, 7, 11, 14].forEach((step, index) => tone(330 * 2 ** (step / 12), 0.7, 'triangle', 0.12, 1, index * 0.09)),
    choose: () => { tone(660, 0.2, 'triangle', 0.14, 1.5); tone(990, 0.25, 'sine', 0.1, 1, 0.08); },
    over: () => [12, 7, 3, 0].forEach((step, index) => tone(220 * 2 ** (step / 12), 0.8, 'sine', 0.16, 0.98, index * 0.28)),
    dawn: () => [0, 4, 7, 12, 16, 19, 24].forEach((step, index) => tone(262 * 2 ** (step / 12), 1.4, 'triangle', 0.13, 1, index * 0.14)),
    click: () => tone(520, 0.08, 'triangle', 0.1, 1.2),
  };

  /** Play cue `name`; rapid repeats of the same cue are thinned so a crowd never deafens. */
  function play(name) {
    if (context === null || muted) return;
    const now = context.currentTime;
    if ((last.get(name) ?? -1) > now - 0.035) return;
    last.set(name, now);
    CUES[name]?.();
  }

  function scheduleMusic() {
    if (context === null || muted) return;
    const root = mood > 0.5 ? 98 : 110;
    const step = SCALE[(beat * 5 + (beat >> 3)) % SCALE.length];
    tone(root * 2 * 2 ** (step / 12), 0.9, 'sine', 0.09, 1, 0, musicGain);
    if (beat % 8 === 0) tone(root / 2, 3.4, 'triangle', 0.12, 1, 0, musicGain);
    if (mood > 0 && beat % 2 === 1) tone(root * 4 * 2 ** (SCALE[(beat * 3) % SCALE.length] / 12), 0.3, 'triangle', 0.03 * mood, 1, 0, musicGain);
    beat += 1;
  }

  return {
    wake,
    play,
    /** 0 is the calm of the title, 1 the thick of a night: the music quickens with it. */
    setMood(value) {
      mood = value;
    },
    startMusic() {
      if (musicTimer) return;
      musicTimer = window.setInterval(scheduleMusic, 430);
    },
    toggle() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
