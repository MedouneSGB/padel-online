export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowd: GainNode | null = null;
  private last: Record<string, number> = {};
  muted = false;

  private ensure() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.startCrowd();
  }

  resume() {
    this.ensure();
    void this.ctx?.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
  }

  private gated(kind: string, minMs: number) {
    const now = performance.now();
    if (now - (this.last[kind] ?? 0) < minMs) return false;
    this.last[kind] = now;
    return true;
  }

  private out(): AudioNode | null {
    this.ensure();
    return this.master;
  }

  private env(duration: number, peak: number, attack = 0.01) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(peak, ctx.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    return g;
  }

  hit(power = 0.7) {
    if (!this.gated("hit", 90)) return;
    const dest = this.out();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180 + power * 90, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.12);
    const g = this.env(0.16, 0.18 * power);
    osc.connect(g);
    g.connect(dest);
    const noise = this.noiseBurst(0.07, 0.12 * power, 1200);
    noise.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  bounce() {
    if (!this.gated("bounce", 120)) return;
    const dest = this.out();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
    const g = this.env(0.1, 0.08);
    osc.connect(g);
    g.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  glass() {
    if (!this.gated("glass", 140)) return;
    const dest = this.out();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(980, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.18);
    const g = this.env(0.2, 0.07, 0.005);
    osc.connect(g);
    g.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  net() {
    const dest = this.out();
    if (!dest || !this.ctx) return;
    this.noiseBurst(0.12, 0.1, 900).connect(dest);
  }

  cheer() {
    const dest = this.out();
    if (!dest || !this.ctx || !this.crowd) return;
    const ctx = this.ctx;
    this.crowd.gain.cancelScheduledValues(ctx.currentTime);
    this.crowd.gain.setValueAtTime(this.crowd.gain.value, ctx.currentTime);
    this.crowd.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.15);
    this.crowd.gain.exponentialRampToValueAtTime(0.012, ctx.currentTime + 1.6);
  }

  ui() {
    const dest = this.out();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 740;
    const g = this.env(0.07, 0.05);
    osc.connect(g);
    g.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  whistle() {
    const dest = this.out();
    if (!dest || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(1480, ctx.currentTime);
    const g = this.env(0.22, 0.04, 0.01);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1600;
    osc.connect(bp);
    bp.connect(g);
    g.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  }

  private noiseBurst(duration: number, peak: number, freq: number) {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const g = this.env(duration, peak, 0.005);
    src.connect(filter);
    filter.connect(g);
    src.start();
    return g;
  }

  private startCrowd() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let v = 0;
    for (let i = 0; i < data.length; i++) {
      v = v * 0.98 + (Math.random() * 2 - 1) * 0.02;
      data[i] = v;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 180;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    src.connect(hp);
    hp.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
    this.crowd = g;
  }
}
