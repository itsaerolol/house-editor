import type { Selection } from '../model/types';

/** Shared state between the on-screen walk controls (DOM) and the first-person controller (canvas). */
export const walkTouch = {
  /** joystick, -1..1: x right, y down (screen) */
  jx: 0,
  jy: 0,
  /** look deltas waiting to be applied, in radians */
  look: { yaw: 0, pitch: 0 },
  jump: false,
  /** set by the controller: what is under a screen point */
  pickAt: null as ((clientX: number, clientY: number) => Selection | null) | null,
  /** set by the controller: open or close the door in reach */
  toggleDoor: null as (() => void) | null,
};
