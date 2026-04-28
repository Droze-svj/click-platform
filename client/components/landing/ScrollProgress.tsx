'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Slim scroll-progress bar pinned to the top of the page. Spring-eased so
 * it doesn't jitter on rapid scroll. Decorative — aria-hidden.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className="fixed top-0 left-0 right-0 h-[2px] z-[60] bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 motion-reduce:hidden"
    />
  );
}
