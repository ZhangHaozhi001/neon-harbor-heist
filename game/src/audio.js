// All sound is synthesised with WebAudio — there are no audio files. A small
// engine hum whose pitch follows speed, a two-tone siren while wanted, and
// one-shot blips for gunfire, pickups and mission stings. M toggles mute.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    return true;
  }

  function blip(freqA, freqB, seconds, type, volume) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), ctx.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.02);
  }

  function noise(seconds, volume) {
    if (!ensure()) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.start();
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Called every frame: engine pitch from speed ratio, siren while wanted. */
    update(dt, speedRatio, wanted, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio) * 130, ctx.currentTime, 0.08);
      if (wanted > 0) {
        sirenTimer -= dt;
        if (sirenTimer <= 0) {
          sirenTimer = 0.42;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setValueAtTime(sirenHigh ? 880 : 660, ctx.currentTime);
        }
        sirenGain.gain.setTargetAtTime(0.018, ctx.currentTime, 0.1);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    },
    shot() { noise(0.09, 0.35); blip(220, 60, 0.08, 'square', 0.12); },
    dryFire() { blip(900, 700, 0.04, 'square', 0.06); },
    reload() { blip(300, 500, 0.09, 'square', 0.1); },
    crash(strength) { noise(0.16, Math.min(0.5, 0.15 + strength * 0.3)); },
    pickup() { blip(660, 990, 0.12, 'sine', 0.18); },
    sting() { blip(523, 523, 0.12, 'sine', 0.16); setTimeout(() => blip(784, 784, 0.2, 'sine', 0.16), 110); },
    fail() { blip(330, 165, 0.35, 'sawtooth', 0.14); },
    door() { blip(180, 120, 0.07, 'square', 0.1); },
    alarm() { blip(1200, 1200, 0.1, 'square', 0.1); },
  };
}
