# Fork Architecture Plan

## Objective

Integrate useful behavior from native Bedrock mods into the Phlodgate add-on only where the public Bedrock Script API can support it, while keeping native-only features explicit and preventing false compatibility claims.

## Current architecture

```text
Bedrock world
    |
    +--> @minecraft/server events and Dimension.getBlock
    |        |
    |        +--> bounded terrain sampler --> TTL cache --> Field Map form
    |        +--> waypoint/settings stores --> radar and HUD
    |
    +--> JSON UI resource pack --> persistent actionbar HUD
    |
    +--> TypeScript build --> BP/scripts/main.js
```

## Implemented Atlas-derived slice

1. Pure terrain classification and fixed-grid rendering live in `src/features/minimap/TerrainMap.ts`.
2. `TerrainSampler.ts` performs top-block sampling on a 9x9 grid using 4-block cells.
3. Terrain regions are position-snapped, dimension-scoped, and cached for 100 ticks.
4. Block break/place events clear the cache.
5. The Field Map shows terrain plus the existing radar and waypoint actions.
6. Pure behavior is covered by focused Vitest tests.

## Compatibility rules

- Native AmethystAPI C++ code, renderer hooks, tessellators, camera matrices, native keyboard hooks, and `LevelListener` callbacks are not dependencies of this add-on.
- Public Script API behavior must degrade safely when a dimension or block is unavailable.
- The add-on may use type-id classification, forms, actionbar text, JSON UI, dynamic properties, and documented server events.
- A native pixel map, exact Atlas map colors, or physical-client rendering cannot be claimed without runtime evidence.

## Release gates

- TypeScript typecheck passes.
- Unit tests pass.
- Build and packaging pass.
- Pack manifests and generated script are inspected before release.
- A real Bedrock client verifies Field Map opening, terrain display, waypoint display, cache refresh after block edits, and all existing HUD controls.
- Security review confirms no new network, command, native, or secret surfaces.

## Next prioritized work

1. Run the physical Bedrock validation matrix for the new Field Map terrain display.
2. Measure Field Map open latency on low-end devices and reduce sampling dimensions if needed.
3. Add an explicit terrain-display setting only if user testing shows the extra grid is too dense.
4. Keep native Atlas renderer integration as a separate AmethystAPI fork, not as behavior-pack source.
