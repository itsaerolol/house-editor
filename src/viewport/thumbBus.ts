/** Set by the canvas: returns a small JPEG data URL of the current view, or null when the view is not worth a card picture. */
export const thumbBus: { grab: (() => string | null) | null } = { grab: null };
