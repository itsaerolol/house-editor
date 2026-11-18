/** Shared, non-reactive pointer arbitration between the tool layer and the camera controls. */
export const input: { claimed: boolean; placeAtCenter: ((catalogId: string) => boolean) | null } = { claimed: false, placeAtCenter: null };
