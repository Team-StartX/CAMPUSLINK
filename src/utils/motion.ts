// Short, interruptible transitions for direct user interactions.
export const interactionTransition = {
  type: 'tween' as const,
  duration: 0.18,
  ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
};

export const interactionSpring = {
  type: 'spring' as const,
  stiffness: 700,
  damping: 40,
  mass: 0.6,
};
