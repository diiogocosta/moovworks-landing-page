/**
 * The hero's buzzword field.
 *
 * Always English, in every locale — the mockery of AI marketing is the same
 * everywhere. Coordinates are percentages of the field box, so the field can be
 * repositioned without redoing them. Sizes are rem, and the mobile set is
 * hand-placed rather than scaled, because a narrow column needs a different
 * arrangement, not a smaller copy of the same one.
 */
export interface Buzzword {
  text: string;
  /** Desktop anchors, in % of the field. */
  x: number;
  y: number;
  size: number;
  /** Anchors for the reduced five-word field below 768px. Absent = not shown. */
  compact?: { x: number; y: number; size: number };
}

export const BUZZWORDS: Buzzword[] = [
  // The long ones go first: they are the ones dropped on small screens.
  {
    text: "unlock the power of AI",
    x: 21,
    y: 70,
    size: 1.75,
  },
  {
    text: "10x your workflow",
    x: 38,
    y: 5,
    size: 1.35,
  },
  {
    text: "AI-powered everything",
    x: 62,
    y: 0,
    size: 1.15,
  },
  {
    text: "passive income with AI",
    x: 76,
    y: 26,
    size: 1.05,
  },
  {
    text: "game-changing",
    x: 54,
    y: 78,
    size: 2.1,
    compact: { x: 0, y: 78, size: 1 },
  },
  {
    text: "supercharge",
    x: 0,
    y: 6,
    size: 2.5,
    compact: { x: 0, y: 4, size: 1.25 },
  },
  {
    text: "the future is now",
    x: 30,
    y: 32,
    size: 1,
    compact: { x: 52, y: 0, size: 0.8 },
  },
  {
    text: "secret prompt",
    x: 70,
    y: 48,
    size: 1.6,
    compact: { x: 48, y: 66, size: 1.1 },
  },
  {
    text: "revolutionary",
    x: 0,
    y: 60,
    size: 1.25,
    compact: { x: 58, y: 27, size: 0.9 },
  },
];

/** Longer than the field fade-out, so every stroke finishes on screen. */
export const STROKE_CASCADE_START_MS = 550;
export const STROKE_CASCADE_STEP_MS = 85;
export const STROKE_DURATION_MS = 320;
/** The field holds until the last stroke has landed, then clears. */
export const FIELD_CLEAR_DELAY_MS = 1600;
export const FIELD_CLEAR_DURATION_MS = 600;
