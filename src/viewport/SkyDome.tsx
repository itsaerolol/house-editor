import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { terrainHeight } from '../model/site';
import { getThreeMaterial } from '../render/materials';
import { useStore } from '../store/store';
import { ATMOSPHERES, sunDirection, type Atmosphere } from './timeOfDay';

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunC; uniform vec3 sunDir;
uniform float glow; uniform float disc; uniform float clouds; uniform vec3 cLit; uniform vec3 cShade;
varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h < 0.0 ? hor : (h < 0.22 ? mix(hor, mid, smoothstep(0.0, 0.22, h)) : mix(mid, top, smoothstep(0.22, 0.85, h)));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  // wide warm glow around the sun, tighter halo, crisp disc
  c += sunC * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6) * glow;
  c = mix(c, sunC * 1.2, smoothstep(0.99955, 0.99975, s) * disc);
  // clouds on a dome above: sheared fbm, lit on the sun side
  if (h > 0.0 && clouds > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.6;
    float n = fbm(uv + vec2(3.1, 7.7));
    float m = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.18, h) * clouds;
    float lit = clamp(0.55 + 0.45 * dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), normalize(vec3(sunDir.x, 0.0, sunDir.z) + 1e-4)), 0.0, 1.0);
    vec3 cc = mix(cShade, cLit, lit * smoothstep(0.5, 0.85, n));
    c = mix(c, cc, m);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

/** Painted sky dome: gradient, sun or moon with glow, soft clouds; stars at night. Follows the camera, never fogged or tone mapped. */
function SkyPaint({ a, dir }: { a: Atmosphere; dir: THREE.Vector3 }) {
  const g = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: {
          top: { value: new THREE.Color() },
          mid: { value: new THREE.Color() },
          hor: { value: new THREE.Color() },
          sunC: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3() },
          glow: { value: 0 },
          disc: { value: 0 },
          clouds: { value: 0 },
          cLit: { value: new THREE.Color() },
          cShade: { value: new THREE.Color() },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
      }),
    [],
  );
  useEffect(() => {
    const u = mat.uniforms;
    const k = a.sky;
    u.top.value.set(k.top);
    u.mid.value.set(k.mid);
    u.hor.value.set(k.horizon);
    u.sunC.value.set(k.sun);
    u.sunDir.value.copy(dir);
    u.glow.value = k.glow;
    u.disc.value = k.disc;
    u.clouds.value = k.clouds;
    u.cLit.value.set(k.cloudLit);
    u.cShade.value.set(k.cloudShade);
  }, [a, dir, mat]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => g.current?.position.copy(camera.position));
  return (
    <group ref={g}>
      <mesh material={mat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[480, 48, 24]} />
      </mesh>
      {a.stars && <Stars radius={300} depth={80} count={4000} factor={5} saturation={0.1} fade speed={0} />}
    </group>
  );
}

/** Grass that carries on past the site to the horizon, so the house never sits on a floating island. */
function OuterGround() {
  const project = useStore((s) => s.hist.project);
  const mats = project.materials;
  const geo = useMemo(() => {
    const s = project.site;
    const far = [-900, -450, -220, -110, -60, -30];
    const O = 0.4;
    const xs = [...far.map((v) => s.minX + v), s.minX + O, s.maxX - O, ...far.map((v) => s.maxX - v).reverse()];
    const zs: number[] = [...far.map((v) => s.minZ + v)];
    zs.push(s.minZ + O);
    for (let z = s.minZ + 1; z < s.maxZ - 1; z += 1) zs.push(z);
    zs.push(s.maxZ - O, ...far.map((v) => s.maxZ - v).reverse());
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const W = xs.length;
    for (const z of zs)
      for (const x of xs) {
        pos.push(x, terrainHeight(project, x, Math.min(s.maxZ, Math.max(s.minZ, z))), z);
        uv.push(x, z);
      }
    for (let j = 0; j < zs.length - 1; j++)
      for (let i = 0; i < W - 1; i++) {
        const cx = (xs[i] + xs[i + 1]) / 2;
        const cz = (zs[j] + zs[j + 1]) / 2;
        if (cx > s.minX + O && cx < s.maxX - O && cz > s.minZ + O && cz < s.maxZ - O) continue;
        const a = j * W + i;
        idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [project.site, project.levels]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  const def = mats[project.site.groundMaterialId];
  const mat = useMemo(() => {
    if (!def) return null;
    const m = (getThreeMaterial(def) as THREE.MeshStandardMaterial).clone();
    m.polygonOffset = true;
    m.polygonOffsetFactor = 2;
    m.polygonOffsetUnits = 2;
    return m;
  }, [def]);
  if (!mat) return null;
  return <mesh geometry={geo} material={mat} receiveShadow />;
}

/** Sky, fog and the ground beyond the site. In 3D, isometric and walk; flat views keep a solid tinted backdrop. */
export function SkyDome() {
  const view = useStore((s) => s.hist.project.view);
  const showSite = view.showSite;
  const a = ATMOSPHERES[view.timeOfDay ?? 'day'];
  const dir = useMemo(() => sunDirection(a), [a]);
  const { scene, gl } = useThree();
  // the 3D views (perspective, isometric, walk) share one world: painted sky, haze and grass to the horizon
  const persp = view.mode === 'persp' || view.mode === 'walk' || view.mode === 'iso';
  useEffect(() => {
    gl.toneMappingExposure = a.exposure;
    if (persp) {
      scene.background = null;
      scene.fog = new THREE.Fog(a.fog, 140, 900);
    } else {
      scene.background = new THREE.Color(a.flatBg);
      scene.fog = null;
    }
    return () => {
      scene.fog = null;
    };
  }, [a, persp, scene, gl]);
  if (!persp) return null;
  return (
    <>
      <SkyPaint a={a} dir={dir} />
      {showSite && <OuterGround />}
    </>
  );
}
