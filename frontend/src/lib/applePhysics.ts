/**
 * Apple Design Physics & Feedback Utilities
 *
 * Implements Apple WWDC principles:
 * - Rubber-banding with diminishing returns past boundaries
 * - Exponential decay momentum projection (scroll deceleration)
 * - Calibrated spring presets matching Apple's damping and response
 * - Causality & harmony in multimodal feedback (haptics + subtle audio tick)
 */

/**
 * Rubber-banding function (from WWDC 'Designing Fluid Interfaces').
 * The further past the bound the user pulls, the less the element follows.
 *
 * @param overshoot Distance dragged past boundary in px
 * @param dimension Dimension of the scroll/drag container in px
 * @param constant Apple's resistance constant (default 0.55)
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Momentum projection function (Apple's exponential decay formula).
 * Projects the final resting position of a gesture from its release velocity.
 *
 * @param initialVelocity Gesture release velocity in px/s
 * @param decelerationRate Apple scroll deceleration rate (~0.998 standard, 0.99 snappier)
 */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/**
 * Standard Apple Spring Configurations for `motion/react`.
 *
 * Mapped from Apple's damping ratio & response parameters:
 * - Default: Critically damped (1.0), no overshoot, smooth settle for repositioning.
 * - Snappy: Quick response with negligible bounce for sheets, drawers, toggles.
 * - Momentum: 0.8 damping with subtle overshoot only when gesture carried momentum (flick/throw).
 * - Modal: Graceful scale & fade for dialogs and inspectors.
 */
export const appleSprings = {
  /** Critically damped default — smooth, graceful settle with 0 bounce */
  default: {
    type: 'spring' as const,
    bounce: 0,
    duration: 0.38,
  },
  /** Snappy response for drawers, sheets, and menus */
  snappy: {
    type: 'spring' as const,
    stiffness: 340,
    damping: 30,
    mass: 0.8,
  },
  /** Momentum-driven interaction (only when a throw/flick preceded it) */
  momentum: {
    type: 'spring' as const,
    bounce: 0.18,
    duration: 0.42,
  },
  /** Modal & overlay presentation — anchors to center with zero bounce */
  modal: {
    type: 'spring' as const,
    stiffness: 380,
    damping: 32,
    mass: 0.9,
  },
  /** Physical switch / toggle toggle spring */
  switch: {
    type: 'spring' as const,
    stiffness: 520,
    damping: 34,
    mass: 0.7,
  },
  /** Gentle reveal for cards and message bubbles */
  gentle: {
    type: 'spring' as const,
    bounce: 0,
    duration: 0.45,
  },
};

/**
 * Multimodal Haptic & Tactile Feedback
 * Fires instantaneously with zero latency on pointer-down / meaningful commit.
 * Uses Web Vibration API when available, paired with an ultra-subtle, harmonic audio tick.
 */
class HapticEngine {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Play an ultra-short (3ms) causal physical click sound that harmonizes with touch.
   * Volume is set extremely softly (-28dB) so it mimics a physical device click without distraction.
   */
  private playClickSound(frequency = 1200, gainLevel = 0.015) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.005);

      gain.gain.setValueAtTime(gainLevel, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.005);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.005);
    } catch {
      // Audio autoplay policy or device restriction
    }
  }

  public trigger(type: 'light' | 'medium' | 'selection' | 'success' | 'toggle' = 'light') {
    if (typeof window === 'undefined') return;

    // 1. Hardware vibration if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        switch (type) {
          case 'selection':
          case 'light':
            navigator.vibrate(6);
            break;
          case 'medium':
          case 'toggle':
            navigator.vibrate(12);
            break;
          case 'success':
            navigator.vibrate([10, 40, 15]);
            break;
        }
      } catch {
        // Safe fallback
      }
    }

    // 2. Subtle causal acoustic click
    switch (type) {
      case 'selection':
        this.playClickSound(1600, 0.012);
        break;
      case 'toggle':
        this.playClickSound(1100, 0.02);
        break;
      case 'medium':
        this.playClickSound(900, 0.018);
        break;
      case 'success':
        this.playClickSound(1400, 0.022);
        break;
      case 'light':
      default:
        this.playClickSound(1800, 0.008);
        break;
    }
  }
}

export const haptics = new HapticEngine();
