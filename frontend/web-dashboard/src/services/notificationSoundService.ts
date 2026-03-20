// src/services/notificationSoundService.ts

import { NotificationSeverity } from '../types/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SoundType = 'alert' | 'info' | 'critical';

interface SoundConfig {
  volume: number;
  loop: boolean;
}

const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  info:     { volume: 0.4,  loop: false },
  alert:    { volume: 0.75, loop: false },
  critical: { volume: 1.0,  loop: false },
};

// ─────────────────────────────────────────────
// Notification Sound Service
// ─────────────────────────────────────────────

class NotificationSoundService {
  private enabled: boolean = true;
  private audioContext: AudioContext | null = null;
  private activeNodes: Set<OscillatorNode> = new Set();   // ← fixed: OscillatorNode

  // ───────────────────────────────────────────
  // Toggle global sound on/off
  // ───────────────────────────────────────────

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ───────────────────────────────────────────
  // Play based on severity
  // ───────────────────────────────────────────

  playForSeverity(severity: NotificationSeverity): void {
    switch (severity) {
      case NotificationSeverity.CRITICAL:
        this.play('critical');
        break;
      case NotificationSeverity.WARNING:
        this.play('alert');
        break;
      case NotificationSeverity.INFO:
      default:
        this.play('info');
    }
  }

  // ───────────────────────────────────────────
  // Play a sound type
  // ───────────────────────────────────────────

  play(type: SoundType = 'alert'): void {
    if (!this.enabled) return;

    if (this._tryPlayTone(type)) return;

    this._tryPlayAudioFile(type);
  }

  // ───────────────────────────────────────────
  // Stop all sounds
  // ───────────────────────────────────────────

  stopAll(): void {
    for (const node of this.activeNodes) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    this.activeNodes.clear();
  }

  // ───────────────────────────────────────────
  // Internal: programmatic tone via Web Audio API
  // ───────────────────────────────────────────

  private _tryPlayTone(type: SoundType): boolean {
    try {
      if (!this.audioContext) {
        this.audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
      }

      const ctx = this.audioContext;
      const config = SOUND_CONFIGS[type];

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const gainNode = ctx.createGain();
      gainNode.gain.value = config.volume;
      gainNode.connect(ctx.destination);

      const tonePatterns = this._getTonePattern(type);

      let offset = 0;
      for (const tone of tonePatterns) {
        const oscillator = ctx.createOscillator();        // OscillatorNode
        oscillator.type = 'sine';
        oscillator.frequency.value = tone.frequency;
        oscillator.connect(gainNode);

        const startTime = ctx.currentTime + offset;
        const endTime   = startTime + tone.duration;

        oscillator.start(startTime);
        oscillator.stop(endTime);

        gainNode.gain.setValueAtTime(config.volume, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

        this.activeNodes.add(oscillator);                 // ← now compatible
        oscillator.onended = () => this.activeNodes.delete(oscillator);

        offset += tone.duration + tone.gap;
      }

      return true;
    } catch {
      return false;
    }
  }

  // ───────────────────────────────────────────
  // Internal: tone frequency/duration patterns
  // ───────────────────────────────────────────

  private _getTonePattern(
    type: SoundType
  ): Array<{ frequency: number; duration: number; gap: number }> {
    switch (type) {
      case 'info':
        return [
          { frequency: 880,  duration: 0.08, gap: 0.04 },
          { frequency: 1100, duration: 0.10, gap: 0 },
        ];

      case 'alert':
        return [
          { frequency: 660,  duration: 0.12, gap: 0.06 },
          { frequency: 880,  duration: 0.12, gap: 0.06 },
          { frequency: 1100, duration: 0.15, gap: 0 },
        ];

      case 'critical':
        return [
          { frequency: 880,  duration: 0.10, gap: 0.05 },
          { frequency: 1320, duration: 0.10, gap: 0.05 },
          { frequency: 880,  duration: 0.10, gap: 0.05 },
          { frequency: 1320, duration: 0.15, gap: 0 },
        ];
    }
  }

  // ───────────────────────────────────────────
  // Internal: fallback to alert.mp3 file
  // ───────────────────────────────────────────

  private _tryPlayAudioFile(type: SoundType): void {
    try {
      if (type === 'info') return;

      const config = SOUND_CONFIGS[type];
      const audio  = new Audio('/src/sounds/alert.mp3');

      audio.volume = config.volume;
      audio.loop   = config.loop;

      audio.play().catch((err) => {
        console.debug('[SoundService] Audio playback blocked:', err);
      });
    } catch (err) {
      console.debug('[SoundService] Audio file fallback failed:', err);
    }
  }

  // ───────────────────────────────────────────
  // Preload (optional call on app mount)
  // ───────────────────────────────────────────

  preload(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
      }
    } catch {
      // Not supported — fallback will handle it
    }
  }
}

// ─────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────

export const notificationSoundService = new NotificationSoundService();
export type { SoundType };