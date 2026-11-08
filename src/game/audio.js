export class JungleAudio {
  constructor(enabled = true) { this.enabled = enabled; this.context = null; }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { this.context = null; }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) this.unlock();
    if (this.master) this.master.gain.setTargetAtTime(enabled ? 0.16 : 0, this.context.currentTime, 0.03);
  }

  tone(frequency, endFrequency, duration, type = 'sine', volume = 0.4, delay = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(this.master);
    oscillator.start(start); oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  coin() { this.tone(1046, 1568, 0.12, 'sine', 0.32); this.tone(1568, 2093, 0.13, 'sine', 0.2, 0.055); }
  jump() { this.tone(220, 560, 0.16, 'sine', 0.3); }
  move() { this.tone(260, 180, 0.065, 'sine', 0.12); }
  hit() { this.tone(130, 35, 0.28, 'triangle', 0.65); this.tone(85, 40, 0.32, 'sine', 0.4); }
  start() { [523, 659, 784, 1046].forEach((note, i) => this.tone(note, note, 0.17, 'sine', 0.28, i * 0.085)); }
}
