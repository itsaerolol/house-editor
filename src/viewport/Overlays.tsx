import { Grid, Html } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { polygonArea, polygonCentroid } from '../model/geometry2d';
import { wallLength, wallVec } from '../model/arch';
import { formatArea, formatLength } from '../model/units';
import { useStore } from '../store/store';
import { computeVisibility } from './visibility';

export function Overlays() {
  const project = useStore((s) => s.hist.project);
  const v = project.view;
  const vis = useMemo(() => computeVisibility(project), [project.view, project.levels, project.levelOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = project.levels[v.activeLevelId];
  const gy = (active?.elevation ?? 0) + 0.02;
  const showLabels = v.showLabels && (['plan', 'top'].includes(v.mode) || v.cutaway || v.isolateActive || v.levelFilter !== 'all');
  const flatSide = ['front', 'back', 'left', 'right'].includes(v.mode);

  const labels = useMemo(() => {
    if (!showLabels || flatSide) return [];
    return Object.values(project.rooms)
      .filter((r) => r.levelId === v.activeLevelId && vis.level[r.levelId] === 'full' && r.kind !== 'stair')
      .map((r) => {
        const c = polygonCentroid(r.outline);
        return { id: r.id, x: c.x, z: c.z, y: project.levels[r.levelId].elevation + 0.08, name: r.name, area: formatArea(Math.abs(polygonArea(r.outline)), v.units) };
      });
  }, [project.rooms, project.levels, vis, showLabels, flatSide, v.activeLevelId, v.units]);

  const dims = useMemo(() => {
    if (!v.showDimensions || !['plan', 'top'].includes(v.mode)) return [];
    return Object.values(project.walls)
      .filter((w) => w.levelId === v.activeLevelId && w.kind !== 'rail' && wallLength(w) > 1.2 && vis.level[w.levelId] === 'full' && !w.hidden)
      .map((w) => {
        const { nx, nz } = wallVec(w);
        const off = w.thickness / 2 + 0.28;
        const side = w.kind === 'exterior' ? -1 : 1;
        return {
          id: w.id,
          x: (w.start.x + w.end.x) / 2 + nx * off * side,
          z: (w.start.z + w.end.z) / 2 + nz * off * side,
          y: (project.levels[w.levelId]?.elevation ?? 0) + 1.6,
          text: formatLength(wallLength(w), v.units),
        };
      });
  }, [project.walls, project.levels, vis, v.showDimensions, v.mode, v.activeLevelId, v.units]);

  return (
    <group>
      {v.showGrid && !flatSide && v.mode !== 'walk' && (
        <Grid
          position={[0, gy, 0]}
          args={[10, 10]}
          cellSize={v.gridSpacing * (v.units === 'imperial' ? 1 : 1)}
          cellThickness={0.35}
          cellColor="#566074"
          sectionSize={v.gridSpacing * 5}
          sectionThickness={1.1}
          sectionColor="#8f9bb0"
          fadeDistance={v.mode === 'plan' || v.mode === 'top' ? 140 : 70}
          fadeStrength={1.4}
          infiniteGrid
          side={THREE.DoubleSide}
        />
      )}
      {v.showGrid && flatSide && <ElevationGrid mode={v.mode} spacing={v.gridSpacing} />}
      {v.showAxes && <Axes />}
      {labels.map((l) => (
        <Html key={l.id} position={[l.x, l.y, l.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="room-label">
            <b>{l.name}</b>
            <span>{l.area}</span>
          </div>
        </Html>
      ))}
      {dims.map((d) => (
        <Html key={d.id} position={[d.x, d.y, d.z]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div className="dim-label">{d.text}</div>
        </Html>
      ))}
    </group>
  );
}

/** Vertical gridlines for the four flat elevations, drawn behind the house. */
function ElevationGrid({ mode, spacing }: { mode: string; spacing: number }) {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const R = 70;
    const step = spacing * 5;
    for (let a = -R; a <= R; a += step) {
      for (let y = -4; y <= 16; y += 0) {
        break;
      }
      if (mode === 'front' || mode === 'back') {
        pts.push(a, -4, mode === 'front' ? 40 : -40, a, 16, mode === 'front' ? 40 : -40);
      } else {
        pts.push(mode === 'left' ? -40 : 40, -4, a, mode === 'left' ? -40 : 40, 16, a);
      }
    }
    for (let y = -4; y <= 16; y += step) {
      if (mode === 'front' || mode === 'back') pts.push(-R, y, mode === 'front' ? 40 : -40, R, y, mode === 'front' ? 40 : -40);
      else pts.push(mode === 'left' ? -40 : 40, y, -R, mode === 'left' ? -40 : 40, y, R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [mode, spacing]);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#5a6577" transparent opacity={0.45} />
    </lineSegments>
  );
}

function Axes() {
  return (
    <group position={[0, 0.05, 0]}>
      <axesHelper args={[6]} />
      <Html position={[6.4, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <span className="axis-label x">+X</span>
      </Html>
      <Html position={[0, 6.4, 0]} center style={{ pointerEvents: 'none' }}>
        <span className="axis-label y">+Y</span>
      </Html>
      <Html position={[0, 0, 6.4]} center style={{ pointerEvents: 'none' }}>
        <span className="axis-label z">+Z</span>
      </Html>
    </group>
  );
}
