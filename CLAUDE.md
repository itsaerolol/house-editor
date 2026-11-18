# Farmhouse Editor

Browser-based 3D house and furniture editor. Starter house is a moody modern farmhouse on three floors.
Installable PWA. Works offline. Everything saves on the device.

Stack: React 19, TypeScript, Vite 8, three.js, React Three Fiber, Drei, Zustand, Immer, Vitest.
Build output is one `dist/index.html` (vite-plugin-singlefile) plus PWA files from `public/`.

## Commands

- `npm run dev` : dev server
- `npm run typecheck` : must stay clean
- `npm test` : Vitest, 33 tests, must pass
- `npm run build` : writes `dist/`
- Before finishing any change: typecheck, test, build.

## Working style

- Replies: minimal words, short sentences, no em dashes.
- Apple HIG first, bubblyui motion second (springs, interruptible, Reduce Motion fades only).
- Every furniture item, material and opening is built from a reference image. Keep detail high.
- Never remove or re-add UI the owner declined. Build exactly what was asked.
- Touch users first: 44 pt targets, no precision gestures, nothing overwhelming on screen.

## Units and coordinates

- World is meters, Y up. Front of the house faces -Z.
- Starter design coordinates are feet: `x = -u * 0.3048`, `z = v * 0.3048`.
- Levels: L0 basement, L1 main, L2 upper. Walls are centre-line with a thickness.

## Layout

- `src/model/` pure data and rules: `types.ts`, `serialize.ts` (parse/validate/save format), `starter.ts`, `catalog/` (furniture as pure `Part[]` data), `materials.ts`, `exteriorStyles.ts`, `arch.ts`, `site.ts`, `physics.ts`.
- `src/store/` Zustand store (`store.ts`), history, `library.ts` (IndexedDB houses), `projects.ts` (Home actions), `files.ts` (share sheet or download).
- `src/render/` geometry and textures: `builders.ts` (walls, slabs, roofs), `texgen.ts` (procedural 1024 px textures), `workerPool.ts` + `build.worker.ts` (off-thread builds), `materials.ts` (three materials, rug and floor depth bias), `openings.ts`, `furnitureGeometry.ts`.
- `src/viewport/` scene: `Scene.tsx`, `Architecture.tsx`, `Interaction.tsx` (pointer and touch), `Walkthrough.tsx`, `SkyDome.tsx`, `timeOfDay.ts`, `renderBus.ts`.
- `src/ui/` HUD: `GameHud.tsx` (dock, camera, build/decorate bars, settings), `Home.tsx`, `Inspector.tsx`, `TouchWalk.tsx`, `WalkHud.tsx`, `MaterialPicker.tsx`, `device.ts` (touch and compact queries).
- `public/` manifest, `sw.js` (bump `CACHE` when shipping), icons.
- `scripts/` Playwright harnesses (see below). `docs/detail-log.md` logs each pass.

## Rules that are easy to break

- Catalog items are data only. Parts merge per material slot. Vertex colours carry tints.
- Heavy work never runs on the main thread: textures, furniture, openings go through the worker pool and land through `landBatched`.
- Canvas uses `frameloop="demand"` (walk is `always`). After changing the scene outside React, call `requestRender()` or `markShadowsDirty()`.
- Shadows are baked and only redrawn when the dirty flag is set.
- Texture cache key is a hash of `texgen.ts` + `textures.ts` (`__TEX_HASH__`). Editing painters invalidates the cache on purpose.
- Roofs sit on the outer wall faces (`wallReach` in `builders.ts`). Gable panels are flush with the wall. Do not move roofs back to centre lines.
- Rugs use their own material with a stronger depth bias than floors, plus a tiny per-rug lift. Perspective near plane is 0.3, walk 0.1.
- 3D, Iso and Walk share one world (sky, haze, grass to the horizon). Flat views use a solid backdrop.
- Houses live in IndexedDB (`library.ts`). localStorage only holds a quick working copy for launch. Autosave runs through `startAutosave`; use `markPristine` when loading a project so it is not counted as an edit.
- Import always creates a new house id. Never overwrite by id.
- Walk mode: mouse uses pointer lock, touch uses the thumbstick (`walkTouch.ts`). Controls cards auto close after 8 s.
- Touch gestures: tap selects, one finger orbits, two fingers pinch and pan, selected furniture drags, two-finger twist rotates, double tap empty ground frames the house.
- Safe areas come from CSS vars `--sat --sab --sal --sar`. Keep controls inside them.

## Testing and screenshots

Headless Chrome with SwiftShader is slow. The full house takes about 100 s to finish building. Use `?q=low` to force low quality at startup.

- `scripts/ensure_vite.sh` starts vite on port 5199.
- `scripts/app.py "name|js|wait_ms" ...` desktop screenshots (env `Q=low|medium|high`).
- `scripts/mob.py WxH "name|js|wait_ms" ...` touch emulation.
- `scripts/home_flow.py` end-to-end Home screen flow.
- `scripts/thumbs.py` regenerates `src/ui/thumbs.ts`. `scripts/chips.py` regenerates `src/ui/swatches.ts`.
- `window.__store` and `window.__three` are exposed for checks.
- Click `.hero-actions .go` first to close the Home screen before capturing.

## Shipping

- Artifact host (claude.ai): no downloads, may block service workers. Publishing needs explicit approval each time.
- Vercel (or any static host): deploy the `dist/` folder. This gives full-screen PWA with no header and offline caching.
- iOS: install from Safari with Share, Add to Home Screen. Standalone mode is not available in the EU.
- Bump `CACHE` in `public/sw.js` for every release.
