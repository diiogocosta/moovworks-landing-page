/**
 * The phrases the headline is answering, struck through under it.
 *
 * Always English, in every locale: they are the vocabulary of AI marketing as it
 * is actually written, so translating them would lose the point.
 *
 * These used to be scattered across the hero as an absolutely positioned field,
 * placed by percentage coordinates. They are now a single row of chips, because a
 * field of small grey words reads as texture rather than as a joke: at that size
 * and that contrast nobody was reading them, so the headline had no visible
 * answer to it.
 *
 * Four, not nine. The list used to run to nine words scattered across the hero;
 * at four they fit two lines on a phone and one or two under the desktop
 * headline, so the joke reads at a glance instead of turning into a word cloud.
 */
export const BUZZWORDS = [
  "unlock the power of AI",
  "10x your workflow",
  "AI-powered everything",
  "secret prompt",
];

/** Delay before the first strike, and the step between them. */
export const STRIKE_START_MS = 420;
export const STRIKE_STEP_MS = 110;
export const STRIKE_DURATION_MS = 380;
