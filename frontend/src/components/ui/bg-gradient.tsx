/**
 * BgGradient — Animated gradient background component.
 *
 * Inspired by:
 *   - 21st.dev/@reuno-ui/components/bg-gredient
 *   - Replit's warm, ambient home screen aesthetic
 *
 * Uses pure CSS radial gradients with animated motion via @keyframes,
 * creating warm orbs that drift slowly across the viewport.
 *
 * Zero external dependencies — pure React + CSS.
 */

import { cn } from '../../lib/utils';

interface BgGradientProps {
  /** Additional CSS classes for the outer container. */
  className?: string;
  /**
   * Intensity of the gradient. Controls the opacity of the orbs.
   * @default "medium"
   */
  intensity?: 'subtle' | 'medium' | 'vivid';
}

export function BgGradient({ className, intensity = 'medium' }: BgGradientProps) {
  const opacityMap = {
    subtle: 'opacity-30 dark:opacity-20',
    medium: 'opacity-50 dark:opacity-35',
    vivid: 'opacity-70 dark:opacity-50',
  };

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 overflow-hidden',
        opacityMap[intensity],
        className
      )}
      aria-hidden="true"
    >
      {/* Primary warm orb — large, slow drift from top-left */}
      <div
        className="bg-gradient-orb bg-gradient-orb--primary"
        style={{
          position: 'absolute',
          width: '60vmax',
          height: '60vmax',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(251,146,60,0.5) 0%, rgba(251,146,60,0.15) 40%, transparent 70%)',
          top: '-20%',
          left: '-15%',
          animation: 'bgOrbDrift1 18s ease-in-out infinite alternate',
          filter: 'blur(80px)',
        }}
      />

      {/* Secondary warm orb — amber/rose, drifts from center-right */}
      <div
        className="bg-gradient-orb bg-gradient-orb--secondary"
        style={{
          position: 'absolute',
          width: '50vmax',
          height: '50vmax',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(244,63,94,0.35) 0%, rgba(251,113,133,0.12) 45%, transparent 70%)',
          top: '10%',
          right: '-20%',
          animation: 'bgOrbDrift2 22s ease-in-out infinite alternate',
          filter: 'blur(90px)',
        }}
      />

      {/* Tertiary orb — deep amber warmth, bottom center */}
      <div
        className="bg-gradient-orb bg-gradient-orb--tertiary"
        style={{
          position: 'absolute',
          width: '55vmax',
          height: '55vmax',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(217,119,6,0.3) 0%, rgba(245,158,11,0.1) 50%, transparent 70%)',
          bottom: '-25%',
          left: '20%',
          animation: 'bgOrbDrift3 25s ease-in-out infinite alternate',
          filter: 'blur(100px)',
        }}
      />

      {/* Accent orb — small, vivid orange highlight */}
      <div
        className="bg-gradient-orb bg-gradient-orb--accent"
        style={{
          position: 'absolute',
          width: '30vmax',
          height: '30vmax',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(249,115,22,0.45) 0%, rgba(249,115,22,0.08) 50%, transparent 70%)',
          top: '40%',
          left: '35%',
          animation: 'bgOrbDrift4 15s ease-in-out infinite alternate',
          filter: 'blur(60px)',
        }}
      />

      {/* Dark mode overlay — subtle noise/grain texture via CSS */}
      <div
        className="hidden dark:block absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, transparent 0%, rgba(9,9,11,0.6) 70%)',
        }}
      />
    </div>
  );
}

export default BgGradient;
