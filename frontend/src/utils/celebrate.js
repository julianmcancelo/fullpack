import confetti from 'canvas-confetti';

/**
 * Dispara confetti solo si el usuario no pidió movimiento reducido.
 * Respeta `@media (prefers-reduced-motion: reduce)` para que la
 * celebración no genere animación en quienes la desactivaron.
 */
export function celebrate(options) {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }
  try {
    confetti(options);
  } catch {
    /* Decorativo: nunca debe romper la UI. */
  }
}
