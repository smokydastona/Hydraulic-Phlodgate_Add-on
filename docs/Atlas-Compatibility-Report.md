# Atlas Compatibility and Implementation Report

## Scope

This report compares `AmethystAPI/Atlas` at the supplied archive/repository state with this Bedrock Behavior Pack + Resource Pack project. Atlas targets Minecraft Bedrock `1.21.0.3` through the native AmethystAPI C++ modding platform. This project targets the public `@minecraft/server` Script API and JSON UI.

## Atlas source disposition

| Atlas surface | Purpose | Add-on disposition |
|---|---|---|
| `src/minimap/Minimap.cpp` | Native minimap lifecycle, texture loading, clipping, mesh rendering, player marker, dimension reset | Behavior preserved where Script API permits; native renderer cannot be ported |
| `src/minimap/Minimap.hpp` | `LevelListener`, chunk mesh cache, deferred chunk work, render settings | Converted to a bounded runtime terrain cache; no native listener or mesh type exists |
| `GetColor` and `countBlockNeighbors` | Top-block lookup, map-color lookup, height shading | Replaced with deterministic type-id terrain glyph classification; map-color API is unavailable |
| `TessellateChunkMesh` | 16x16 sampling and greedy quad meshing | Not applicable to forms/actionbar; sampling is represented as a fixed text grid |
| `Render` | UI clipping, camera transforms, mesh/material rendering, border and player icon | Not available through `@minecraft/server`; existing JSON UI actionbar remains the supported HUD surface |
| `onBlockChanged`, `onChunkLoaded`, `onSubChunkLoaded`, `onChunkUnloaded` | Cache invalidation and deferred rebuild | Block break/place events invalidate the Script API terrain cache |
| `mRenderDistance`, `mMaxChunksToGeneratePerFrame` | Work and memory bounds | Replaced with a 9x9 grid, 4-block sampling cells, and a 100-tick TTL cache |
| README `+`/`-` controls | Runtime zoom | No custom keyboard hook exists; existing player radius setting remains the supported control |
| `data/packs/RP/textures/ui/*` | Native minimap border and position icon | Not copied; these assets have no usable rendering surface in the Script API |
| `data/packs/RP/textures/*_texture.ts` | Native resource-pack texture metadata | Not required by the text-grid implementation |
| `xmake.lua`, `mod.json`, `src/dllmain.*` | Amethyst native module build/bootstrap | Incompatible with the add-on build and intentionally not imported |

## Implemented behavior

- `TerrainMap.ts` provides pure terrain glyph classification, fixed-grid formatting, center-marker rendering, and cache-key normalization.
- `TerrainSampler.ts` samples the highest non-air block through `Dimension.getBlock`, catches unloaded/unsupported access at the caller boundary, and caches snapped terrain regions for 100 ticks.
- `MinimapForms.ts` adds the terrain grid to the existing Field Map while retaining waypoint bearings and actions.
- `main.ts` invalidates cached terrain after player block-break and block-place events.
- `TerrainMap.test.ts` covers water/lava/vegetation/solid/air classification, centered rendering, and cache-key snapping.

## Compatibility result

The implementation is complete for the public Script API surface: it adds the strongest truthful Atlas-derived terrain feature available in this project without native hooks, copied code, or unsupported claims. It is not a native pixel minimap and cannot reproduce Atlas's map colors, greedy mesh renderer, arbitrary zoom keys, camera clipping, or chunk listener fidelity from a behavior pack alone.

## Verification

- `npm run typecheck`: passed.
- `npm test`: passed, 14 files and 107 tests.
- `npm run build`: passed.
- `npm run package`: passed.
- Physical Minecraft client rendering and device-matrix verification require a Bedrock runtime and are not executable in this workspace.

## Security and performance notes

The sampler performs bounded reads only when the Field Map is opened, never accepts user-provided paths or commands, and isolates runtime block-read failures. The cache key is dimension-scoped and position-snapped; block changes clear the cache to prevent stale terrain display. The implementation does not introduce network access, native code, secrets, or new dependencies.
