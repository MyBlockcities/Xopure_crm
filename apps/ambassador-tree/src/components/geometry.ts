/** Shared node-card geometry. Kept out of the component so tests can use it. */

export const CARD_WIDTH = 178;
export const CARD_HEIGHT = 40;
export const NODE_SPACING = CARD_HEIGHT + 12;
export const LEVEL_SPACING = CARD_WIDTH + 72;

/** The card is anchored at its left edge, centred on the layout point. */
export const cardRect = (x: number, y: number) => ({
  x,
  y: y - CARD_HEIGHT / 2,
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
});

/** Links leave the right edge of the parent card and enter the left of the child. */
export const linkAnchors = (
  source: { x: number; y: number },
  target: { x: number; y: number },
) => ({
  source: { x: source.x + CARD_WIDTH, y: source.y },
  target: { x: target.x, y: target.y },
});
