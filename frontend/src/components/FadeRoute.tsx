/**
 * FadeRoute — wraps a routed page in a brief opacity fade-in (200ms).
 * Replaces the abrupt hard-cut between Landing / Workspace / Sign-in.
 */

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export function FadeRoute({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: 'opacity' }}
    >
      {children}
    </motion.div>
  );
}