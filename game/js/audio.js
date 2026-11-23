// Dustline — synthesized WebAudio: engine hum, siren, blips, gunshot.
// Everything is guarded so the game runs fine with no audio at all
// (headless screenshots, muted tab, no user gesture yet).
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engine: null,
    engineGain: null,
    siren: null,
    sirenGain: null,
    sirenOn: false,
  };

  audio.ensure = function () {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      // Engine: low sawtooth through a gain node.
      audio.engine = audio.ctx.createOscillator();
      audio.engine.type = 'sawtooth';
      audio.engine.frequency.value = 55;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engine.connect(audio.engineGain);
      audio.engineGain.connect(audio.ctx.destination);
      audio.engine.start();
      // Siren: two-tone triangle, toggled by an LFO-ish interval in setSiren.
      audio.siren = audio.ctx.createOscillator();
      audio.siren.type = 'triangle';
      audio.siren.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.siren.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.ctx.destination);
      audio.siren.start();
      audio.siren._t = 0;
    } catch (e) {
      audio.ctx = null;
    }
  };

  audio.setEngine = function (speed01) {
    if (!audio.ctx || audio.muted) return;
    try {
      audio.engine.frequency.value = 50 + speed01 * 90;
      audio.engineGain.gain.value = 0.02 + speed01 * 0.03;
    } catch (e) {}
  };

  audio.setSiren = function (on, time) {
    if (!audio.ctx) return;
    audio.sirenOn = on;
    try {
      if (on && !audio.muted) {
        audio.siren.frequency.value = Math.sin(time * 6) > 0 ? 820 : 620;
        audio.sirenGain.gain.value = 0.025;
      } else {
        audio.sirenGain.gain.value = 0;
      }
    } catch (e) {}
  };

  audio.blip = function (freq, dur) {
    if (!audio.ctx || audio.muted) return;
    try {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq || 660;
      g.gain.value = 0.06;
      o.connect(g);
      g.connect(audio.ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + (dur || 0.12));
      o.stop(audio.ctx.currentTime + (dur || 0.12));
    } catch (e) {}
  };

  audio.shot = function () {
    if (!audio.ctx || audio.muted) return;
    try {
      const len = audio.ctx.sampleRate * 0.09;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const g = audio.ctx.createGain();
      g.gain.value = 0.18;
      src.connect(g);
      g.connect(audio.ctx.destination);
      src.start();
    } catch (e) {}
  };

  audio.crash = function () {
    if (!audio.ctx || audio.muted) return;
    try {
      const len = audio.ctx.sampleRate * 0.16;
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.7;
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const g = audio.ctx.createGain();
      g.gain.value = 0.22;
      src.connect(g);
      g.connect(audio.ctx.destination);
      src.start();
    } catch (e) {}
  };

  audio.setMuted = function (m) {
    audio.muted = m;
    if (!audio.ctx) return;
    try {
      if (audio.engineGain) audio.engineGain.gain.value = 0;
      if (audio.sirenGain) audio.sirenGain.gain.value = 0;
    } catch (e) {}
  };

  return audio;
}
