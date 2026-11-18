# Farmhouse Editor

Browser-based architecture and furniture editor with a furnished starter house: a dark, cozy modern farmhouse, three stories (walkout basement, main, upper) with a split 2-car and 1-car garage, about 4,900 sq ft conditioned.

Stack: React + TypeScript + Vite, Three.js through React Three Fiber and Drei, Zustand, Immer patches for history, Vitest.

## Setup

```
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # dist/index.html, one self-contained file
```

## Architecture

One serializable project model drives every view. No Three.js objects live in the model.

```
src/model/     pure TypeScript, no React, no Three
  types.ts       Project, Level, Wall, Opening, Slab, Room, Stair, Roof, FurnitureInstance, ViewSettings, SiteSettings
  arch.ts        wall segmentation around openings (real voids, no CSG), cut sections
  validate.ts    opening and wall validation (fit, overlap, headroom, level bounds)
  serialize.ts   versioned JSON export, validated import with readable errors
  physics.ts     walkthrough world: wall and furniture blocks, floor/stair/terrain support, stepper
  starter.ts     the furnished house, authored in feet and inches
  catalog.ts     ~60 furniture items, parametric, dimension-aware
src/store/     Zustand store, Immer patch history (command-based undo/redo), autosave
src/render/    model to geometry: MeshBuilder, wall/roof/stair/opening builders, procedural textures
src/viewport/  R3F scene: Architecture, Overlays, Interaction (tools), Walkthrough, camera rigs, export
src/ui/        toolbar, left panel, inspector, status bar, dialogs, shortcuts
tests/         Vitest
```

Key decisions:

- Coordinates are Y-up meters. Design coordinates are feet: `x = -u * 0.3048`, `z = v * 0.3048`. The front of the house faces -Z.
- Walls are boxes split around openings. Doors and windows are real voids and are validated against wall length, height, level bounds and overlap.
- Undo/redo stores Immer patches. A new edit clears redo. Pointer gestures (drag, resize, rotate) merge into one step through a gesture key, so a drag is always one undo.
- Autosave writes to `localStorage` 600 ms after a change. The status bar shows saved/unsaved.
- Quality (High/Medium/Low) switches shadows, ambient occlusion, tone mapping and per-room lights.

## Controls

| Action | Input |
|---|---|
| Views | Toolbar: Front, Back, Left, Right, Top, Bottom (flat orthographic), Iso (+ FL, FR, BL, BR corners), 3D (perspective), Plan, Walk. Keys 1 to 9 |
| Pan / zoom | Right-drag or middle-drag pans, wheel zooms, left-drag orbits in Iso and 3D |
| Select | Click. Hierarchy tab also selects |
| Move | Drag a selected item. Alt disables snapping |
| Resize | Drag an orange corner handle. Green handle sets height |
| Rotate | Drag the blue ring, or Q / E, or R. Step set in the left panel |
| Place furniture | Furniture tab, click an item, click to place. R rotates, Shift keeps placing, Esc cancels |
| Draw walls | Wall tool, click points. Ends snap to wall ends. Shift locks the axis. Esc or right-click finishes |
| Doors and windows | Door or Window tool, hover a wall, click. Red preview means invalid, the status bar says why |
| Edit a wall | Select it. Drag the end handles, or drag the wall body |
| Duplicate / delete / lock / hide | Ctrl+D, Delete, inspector buttons, Hierarchy tab icons |
| Undo / redo | Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y |
| Walkthrough | Walk button, click the view. WASD move, mouse look, Shift run, Space jump, E open or close the door ahead, R reset position, Esc release the mouse |
| Floor plan | Plan button. Upper levels and roof are hidden, the level below shows as a ghost, cut height is adjustable |

## Implemented, partial, not implemented

Implemented and exercised:

- All six flat orthographic views with labels, grid and axes toggles. True isometric with four corner presets and orbit. Perspective view.
- Per-level floor plan with ghost lower level, room labels, wall dimensions, cut height.
- Walkthrough with pointer lock, WASD, Shift, Space, R, Esc. Wall, closed-door, window and furniture collision. Stairs (U-shaped with landing) climbable, floor support on every level, exterior exploration over terrain.
- Visibility controls: level selector, roof, ceilings, furniture, site, labels, dimensions, isolate level, cutaway.
- Selection, hover outline, hierarchy, inspector, move, resize, rotate, duplicate, delete, lock, hide, material changes.
- Placement preview, Esc cancel, snapping (grid, rotation, wall ends).
- Wall drawing, wall endpoint and body dragging, hosted doors and windows with validation and drag along the wall.
- Level elevation edits with optional shift of levels above.
- Undo/redo, autosave with status, versioned JSON export, validated import with error list, reset with confirmation, PNG export at 1x to 3x.

Partial:

- Wall tool does not auto-split a wall when a new wall ends mid-span, and does not auto-create rooms or slabs for a closed loop.
- Furniture resize is box-based (corners and height). Items rebuild from their parametric parts, but there is no per-axis edge handle.
- Opening drag works along one wall. Moving an opening to another wall means delete and re-add.
- Bottom view is dark: it shows the underside of the terrain.
- High quality is heavy on weak GPUs. Medium and Low are the fallback.
- Room labels overlap in the smallest rooms in plan.

Not implemented:

- Multi-select and group transforms.
- Roof editing by drawing. Roofs are edited through inspector fields only.
- Stair drawing tool. The starter stair is editable through the inspector.
- Import of external formats (glTF, DXF, IFC).
- Touch input and mobile layout.

## Verification

Run by machine (Vitest, 29 tests, all passing):

- Starter project integrity and area range.
- Opening fit, overlap and void validation.
- Serialization round trip, version and error handling.
- Undo/redo, coalescing, redo cleared on new edit, no-op commits.
- Gesture coalescing: a long drag is a single undo step.
- Walkthrough physics: ground support, closed door blocks, open door admits, furniture collision, falling to a floor, stair climb from main to upper floor.

Checked by hand in headless Chrome (software GL) with screenshots, not automated assertions:

- Rendering of all six flat views, four isometric corners, plan, cutaway, perspective.
- Real mouse events: click select, drag move, undo/redo, wall draw, window placement preview and placement, furniture placement preview and placement, Esc cancel.
- Walkthrough camera at the front walk, the foyer and the great room.

Not verified: pointer lock itself (needs a real browser window), on-device GPU performance at High, Safari and Firefox.

## Next three engineering priorities

1. Wall topology: split walls at T-junctions, auto-create room polygons and slabs from closed loops, and re-validate hosted openings when a wall changes.
2. Multi-select with group move, rotate, duplicate and delete, plus alignment guides.
3. Performance: instance repeated furniture, merge static architecture per level, and profile High quality on a real GPU.
