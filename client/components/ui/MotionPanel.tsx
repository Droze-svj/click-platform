'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Reusable Framer Motion panel: declarative enter/exit with scale and opacity.
 * Use for collapsible sections, dropdowns, or modal-like blocks.
 */
interface MotionPanelProps {
  children: React.ReactNode
  isOpen: boolean
  className?: string
  /** Initial state (e.g. collapsed). */
  initial?: { scale?: number; opacity?: number; y?: number }
  /** Open state. */
  animate?: { scale?: number; opacity?: number; y?: number }
  /** Exit state. */
  exit?: { scale?: number; opacity?: number; y?: number }
  transition?: { duration?: number; ease?: any }
}

const defaultTransition = { duration: 0.3, ease: 'easeOut' }

export function MotionPanel({
  children,
  isOpen,
  className = '',
  initial = { scale: 0.98, opacity: 0 },
  animate = { scale: 1, opacity: 1 },
  exit = { scale: 0.98, opacity: 0 },
  transition = defaultTransition,
}: MotionPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={initial}
          animate={animate}
          exit={exit}
          transition={transition}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Wrapper for a single element with scale-in animation (e.g. initial={{ scale: 0 }} animate={{ scale: 1 }}).
 */
interface MotionScaleInProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
}

export function MotionScaleIn({
  children,
  className = '',
  delay = 0,
  duration = 0.3,
}: MotionScaleInProps) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: (staggerDelay: number) => ({
    opacity: 1,
    transition: { staggerChildren: staggerDelay, delayChildren: 0.1 },
  }),
  exit: { opacity: 0, transition: { staggerChildren: 0.03, staggerDirection: -1 } },
}

const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

/**
 * List container with staggered children (e.g. compound cards). Wrap items in motion.li or use as wrapper.
 */
interface MotionListProps {
  children: React.ReactNode
  className?: string
  /** Delay between each child (seconds). */
  staggerChildren?: number
}

export function MotionList({
  children,
  className = '',
  staggerChildren = 0.05,
}: MotionListProps) {
  return (
    <motion.div
      variants={listContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      custom={staggerChildren}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Single list item for use inside MotionList (uses shared variants). */
export function MotionListItem({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div variants={listItemVariants} className={className}>
      {children}
    </motion.div>
  )
}
