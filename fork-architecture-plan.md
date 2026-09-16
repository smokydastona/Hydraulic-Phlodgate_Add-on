# Minimap Fork Architecture Plan

## Decision

Phlodgate keeps a public Bedrock Behavior Pack + Resource Pack architecture. The three researched projects
are reference inputs, not code or asset dependencies:

- `renzonox-ux/XaeroLiteMinimap.mcpack` contributes the waypoint-oriented user workflow.
- `Silvaxxxuuuu/minecraft-bedrock-minimap` confirms the TypeScript build/deploy shape and demonstrates static
  texture and font-sheet generation, which cannot carry live world state inside this pack.
- `Halo333X/Simple-Minimap-MCBE` demonstrates the visual result possible with native client graphics and file
  I/O; those APIs are outside `@minecraft/server` and are intentionally not a dependency.

## Current architecture

1. `MinimapMath.ts` owns deterministic radar bearings, cardinal rotation, nearest-marker ordering, and radius filtering.
2. `TerrainMap.ts` owns type-id classification, colored text glyphs, safe companion-vector parsing, and pure grid formatting.
3. `TerrainSampler.ts` owns bounded `Dimension.getBlock` sampling and a dimension/position/scale/width cache.
4. `MinimapHud.ts` composes real 5x5 terrain, radar markers, and nearest destinations into the shared HUD actionbar.
5. `MinimapForms.ts` provides the on-demand 9x9 Field Map and waypoint actions.
6. `HudManager.ts` remains the single actionbar writer, preventing minimap, food, durability, coordinate, and compass features from overwriting each other.

## Fork boundaries

The fork must not add native DLL hooks, client file writes, external processes, network transport, or copied
third-party renderer/assets. Those require a separate client mod with its own distribution and licensing model.

The add-on may extend the current implementation with additional pure block classifications, companion marker
contracts, or bounded sampling policies. Any new runtime surface must remain dimension-scoped, cache-bounded,
exception-safe, and covered by unit tests.

## Release gates

- `npm test` passes all pure logic tests.
- `npm run typecheck` passes against the declared Minecraft API versions.
- `npm run build` produces `BP/scripts/main.js` without bundling runtime modules.
- `npm run package` produces the Behavior Pack, Resource Pack, and add-on archives.
- Every JSON pack file parses successfully and manifests retain unique UUIDs.
- A physical Bedrock client test confirms HUD placement, terrain refresh after block edits, waypoint markers,
  Field Map opening, and all three resource-pack variants.

## Known runtime boundary

The shipped minimap is a truthful sampled terrain/radar HUD, not a native camera-rendered Xaero/Atlas clone.
The public Script API does not expose world render textures, arbitrary screen widgets, player input hooks, or
filesystem access. The implementation therefore prioritizes correct live data, bounded cost, and graceful
unavailability over an unsupported visual claim.
