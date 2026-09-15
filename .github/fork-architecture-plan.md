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
    |        +--> bounded optimization scans --> protection classifier --> audit/action
    |        +--> spatial item buckets --> capped merge plan --> entity replacement
    |
    +--> JSON UI resource pack --> persistent actionbar HUD
    |        |
    |        +--> root_panel badge --> actionbar-gated HUD identity/layout
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

## Implemented optimization reference slice

1. `ItemMergePlan.ts` replaces quadratic item-pair scanning with neighboring spatial buckets.
2. Complete stacks are never consumed when they would exceed the configured merge cap.
3. `ItemMerge.ts` applies planned groups through the existing runtime safety/logging boundary.
4. `OptimizationEngine.ts` computes nearest-player distances using squared comparisons and one final
    square root, preserving protection and removal semantics.
5. `Optimization-Compatibility-Report.md` records the source disposition, license boundaries, and
    runtime non-claims for MCBE-Tweaks, JaylyDev/ScriptAPI, and LeviOptimize.

## Implemented BedrockTools and JSON UI slice

1. `CoordinatesMath.ts` formats stable XYZ and dimension output without runtime imports.
2. `CoordinatesHud.ts` exposes coordinates through the same composed actionbar pipeline as minimap,
    compass, food, and durability sections.
3. Player Settings persists a `coordinatesHudEnabled` toggle with schema version 4 default merging.
4. All resource-pack variants add a namespaced `phlodgate_hud_badge` through `root_panel` insertion,
    using the documented actionbar visibility binding and a non-overlapping layout offset.
5. BedrockTools native C++ hooks, keyboard state, UI offsets, and renderer code remain reference-only.
6. `@bedrock-core/ui` remains reference-only because its decoder render pack and beta runtime are not
    required for this add-on's current JSON UI/actionbar architecture.

## Compatibility rules

- Native AmethystAPI C++ code, renderer hooks, tessellators, camera matrices, native keyboard hooks, and `LevelListener` callbacks are not dependencies of this add-on.
- Public Script API behavior must degrade safely when a dimension or block is unavailable.
- The add-on may use type-id classification, forms, actionbar text, JSON UI, dynamic properties, and documented server events.
- A native pixel map, exact Atlas map colors, or physical-client rendering cannot be claimed without runtime evidence.
- A JSX decoder runtime, arbitrary JSON UI data channel, or native keyboard hook cannot be claimed from
    the current Script API/resource-pack boundary.
- Native LeviLamina hooks, BDS ECS instrumentation, GPU settings, shader replacement, and options-file
    mutation cannot be claimed from a standard behavior pack.

## Release gates

- TypeScript typecheck passes.
- Unit tests pass.
- Build and packaging pass.
- Pack manifests and generated script are inspected before release.
- A real Bedrock client verifies Field Map opening, terrain display, waypoint display, cache refresh after block edits, and all existing HUD controls.
- Security review confirms no new network, command, native, or secret surfaces.
- JSON UI parses successfully for every pack variant and manifest.
- Spatial merge tests, protection tests, and runtime typecheck pass.

## Next prioritized work

1. Run the physical Bedrock validation matrix for the new Field Map terrain display.
2. Measure Field Map open latency on low-end devices and reduce sampling dimensions if needed.
3. Add an explicit terrain-display setting only if user testing shows the extra grid is too dense.
4. Keep native Atlas renderer integration as a separate AmethystAPI fork, not as behavior-pack source.
5. Keep BedrockTools and bedrock-core/ui as documented reference sources unless the add-on deliberately
    adopts their separate native/runtime distribution model.
6. Use `docs/Optimization-Compatibility-Report.md` as the source-of-truth disposition for the three
    optimization references; do not copy GPL/native implementation code into the add-on.
