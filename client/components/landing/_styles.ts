/**
 * Shared visual constants for landing-page sections. Keeps the surfaces
 * cohesive without having to plumb a theme provider through every component.
 */

export const glass =
  'backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl';

export const glassDeep =
  'backdrop-blur-3xl bg-white/[0.025] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.5)]';

export const sectionPadding = 'py-24 px-6';

export const fadeUpInView = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
};
