import * as THREE from 'three';
import type { TimeOfDay } from '../model/types';

/** Everything that changes with the time of day, in one place. Front of the house faces -Z. */
export interface Atmosphere {
  label: string;
  /** sun (or moon) elevation and azimuth from +Z, radians */
  elev: number;
  az: number;
  /** painted sky: zenith, mid, horizon, sun glow and clouds */
  sky: { top: string; mid: string; horizon: string; sun: string; glow: number; disc: number; clouds: number; cloudLit: string; cloudShade: string };
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  ambient: number;
  env: number;
  /** interior room lights and lamp glow */
  interior: number;
  lampGlow: number;
  /** warm light behind window glass */
  windowGlow: number;
  foliageGlow: number;
  exposure: number;
  fog: string;
  /** solid background for flat, plan and iso views */
  flatBg: string;
  stars: boolean;
}

const deg = (d: number) => (d * Math.PI) / 180;

export const ATMOSPHERES: Record<TimeOfDay, Atmosphere> = {
  dawn: {
    label: 'Dawn',
    elev: deg(5),
    az: Math.PI - 1.15,
    sky: { top: '#34416e', mid: '#9c8fb6', horizon: '#f6bb8e', sun: '#ffd6a6', glow: 0.9, disc: 1, clouds: 0.45, cloudLit: '#ffd3b4', cloudShade: '#7f708e' },
    sunColor: '#ffb98a',
    sunIntensity: 1.7,
    hemiSky: '#a9b6dc',
    hemiGround: '#4a3c34',
    hemi: 0.55,
    ambient: 0.12,
    env: 0.6,
    interior: 0.7,
    lampGlow: 1,
    windowGlow: 0.12,
    foliageGlow: 0.6,
    exposure: 0.95,
    fog: '#f6bb8e',
    flatBg: '#3a3442',
    stars: false,
  },
  day: {
    label: 'Daylight',
    elev: deg(48),
    az: Math.PI + 0.65,
    sky: { top: '#3b7ad2', mid: '#80b6ea', horizon: '#dbeaf5', sun: '#fff7e0', glow: 0.35, disc: 1, clouds: 0.6, cloudLit: '#ffffff', cloudShade: '#b4c3d6' },
    sunColor: '#fff4e2',
    sunIntensity: 3.1,
    hemiSky: '#c4d6f0',
    hemiGround: '#5a4a38',
    hemi: 0.9,
    ambient: 0.15,
    env: 1,
    interior: 0.35,
    lampGlow: 0.7,
    windowGlow: 0,
    foliageGlow: 1,
    exposure: 0.9,
    fog: '#d6e8f4',
    flatBg: '#323945',
    stars: false,
  },
  dusk: {
    label: 'Dusk',
    elev: deg(3),
    az: Math.PI + 1.2,
    sky: { top: '#1c2150', mid: '#7a4d78', horizon: '#f79a62', sun: '#ffb46e', glow: 0.8, disc: 1, clouds: 0.4, cloudLit: '#ffa274', cloudShade: '#48324e' },
    sunColor: '#ff9459',
    sunIntensity: 1.4,
    hemiSky: '#8d8fc2',
    hemiGround: '#3a2c28',
    hemi: 0.45,
    ambient: 0.12,
    env: 0.5,
    interior: 1.3,
    lampGlow: 1.5,
    windowGlow: 0.35,
    foliageGlow: 0.5,
    exposure: 1,
    fog: '#ff9958',
    flatBg: '#2f2a38',
    stars: false,
  },
  night: {
    label: 'Night',
    elev: deg(38),
    az: Math.PI - 0.5,
    sky: { top: '#03050b', mid: '#0b1426', horizon: '#1c2740', sun: '#eef2ff', glow: 0.12, disc: 0.6, clouds: 0.18, cloudLit: '#2c3856', cloudShade: '#0c1220' },
    sunColor: '#9fb6ff',
    sunIntensity: 0.75,
    hemiSky: '#3a4c7c',
    hemiGround: '#15161c',
    hemi: 0.5,
    ambient: 0.06,
    env: 0.12,
    interior: 2.4,
    lampGlow: 2.6,
    windowGlow: 0.8,
    foliageGlow: 0.15,
    exposure: 1.25,
    fog: '#1c2740',
    flatBg: '#141822',
    stars: true,
  },
};

export function sunDirection(a: Atmosphere): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(a.elev) * Math.sin(a.az), Math.sin(a.elev), Math.cos(a.elev) * Math.cos(a.az));
}
