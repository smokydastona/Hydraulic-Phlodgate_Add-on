# Minimap Fork Compatibility and Implementation Report

## Scope

This report records the forensic review of:

- `NezuShin/NMinimap` (GPL-3.0, Java/Paper/Folia/Spigot server plugin with a generated client resource pack)
- `dmor-me/AA4-Minimap` (MIT, Java Fabric/Forge Antique Atlas 4 add-on)
- `jose190901/simple-minimap` (MIT, Forge 1.20.1 add-on named `xaeros_clear`; it does not render a minimap)

The target remains a public Minecraft Bedrock Behavior Pack + Resource Pack using the pinned
`@minecraft/server@2.10.0` and `@minecraft/server-ui@2.2.0` APIs. Research was used to identify portable
behavior and boundaries. No source code, Java classes, shaders, JARs, generated resource packs, or third-party
textures from these repositories were copied into the release.

## Repository findings

| Source | Useful behavior | Bedrock disposition |
|---|---|---|
| NMinimap | Round/square presentation, configurable map scale, side selection, bounded map size, asynchronous work, custom markers, player/mob radar, cache statistics, and explicit permission gates | Implemented the portable subset: square/circle mode already existed; bounded 1x/2x/4x/8x zoom now controls 16/8/4/2 blocks per sampled cell; four-corner placement and waypoint/companion marker routing are retained. Java packet map entities, core shaders, invisible item frames, async chunk rendering, PlaceholderAPI, commands, and permission nodes are not available in the public Script API. GPL code/assets were not copied. |
| AA4-Minimap | Atlas-style terrain sampling, map layers, marker concepts, player-centered orientation, and a separate full map workflow | Implemented the truthful subset: bounded type-id terrain classification, elevation relief, player center marker, waypoint/companion overlays, radar bearings, dimension filtering, cache invalidation, and the Field Map form. Java/Fabric/Forge rendering, atlas texture maps, chunk mesh generation, camera transforms, and client input hooks are not portable. |
| simple-minimap | Clear control surface, preserving only the useful map actions while hiding unrelated Xaero controls; explicit compatibility and smoke-test documentation | Applied as a product-boundary rule: Phlodgate exposes real server-initiated forms and only documented HUD channels. It does not claim Xaero compatibility, intercept key mappings, mutate client options, or ship Xaero dependencies. |

## Implemented behavior

### Zoom and sampling

`PlayerSettings.minimapScale` is a bounded `1 | 2 | 4 | 8` zoom multiplier. The HUD keeps the existing
17x17 text grid and maps those values to 16, 8, 4, and 2 blocks per cell. The default remains 16 blocks per
cell, preserving the previous approximately 128-block half-width while allowing progressively finer local
terrain detail. Invalid persisted values fall back to the default. The pure `cellSizeForMinimapScale` helper is
unit tested.

Sampling remains dimension-scoped, exception-safe, and bounded. Unloaded columns fall back to remembered cells;
cache entries expire; and block edits invalidate sampled state. No filesystem, network, command, or user-provided
path is involved in sampling.

### Markers and radar

Waypoints and valid companion vectors are projected into the sampled terrain grid using world X/Z positions.
Markers are filtered by dimension, enabled state, hidden machine/item categories, range, and the player's radius
setting before rendering. The player marker always wins at the center cell. The existing radar strip continues to
provide rotating cardinal directions and nearest destination labels, with deterministic distance ordering.

### UI and settings

The existing native ActionFormData/ModalFormData workflow remains the only custom interaction surface. The new
zoom control is part of Player Settings. The minimap continues to support square/circle shape, four corners, and
small/large HUD sizes through the complete JSON UI replacement contract validated by `release-validation.mjs`.

## Asset and licensing review

No asset from the three repositories was suitable or necessary for this runtime:

- NMinimap's map/marker pipeline depends on a generated font-image/resource-pack format and shader-side pixel
  metadata, not Bedrock JSON UI text routing. Its GPL-3.0 license also makes unplanned asset/code extraction
  inappropriate for this pack's existing asset policy.
- AA4's atlas rendering assets and Java client integration are tied to Antique Atlas 4 and are not a live
  Bedrock resource-pack contract.
- `simple-minimap` intentionally does not include a standalone minimap renderer or map textures.

The shipped minimap art remains the separately documented, pinned CC0-1.0 icon set. `validate:release` checks
provenance, hashes, pack presence, JSON definitions, manifest UUID/version integrity, and the compiled script.

## Security review

- No external input is interpreted as code, a command, a path, a URL, or a resource-pack reference.
- Companion vector JSON is parsed defensively and rejects invalid, disabled, non-finite, hidden, and out-of-range
  entries before HUD use.
- Settings are selected from fixed enumerations; zoom and sampling bounds are enforced before world reads.
- Waypoint and marker rendering is player-local and dimension-aware; no cross-player or cross-dimension data is
  introduced by this change.
- No native hooks, client file writes, network transport, browser storage, LevelDB/NBT access, or secrets were
  added.

## Performance review

The HUD still performs one cached, bounded 17x17 sample per refresh region. Zoom changes the world area represented
by that fixed grid rather than increasing the number of cells. Marker lookup is bounded by the existing waypoint
limit and eight companion targets. The terrain cache and remembered-cell store remain bounded, and pure formatting
logic is unit tested without a Bedrock runtime.

## Verification evidence

- `npm test`: passed, 19 files and 144 tests.
- `npm run typecheck`: passed against the declared Minecraft API types.
- `npm run build`: passed and generated `BP/scripts/main.js`.
- `npm run validate:release`: passed all four pack manifests, JSON/UI definitions, provenance checks, companion
  contracts, and required build output.
- Physical Bedrock rendering and controller/device matrix testing still require a Bedrock client or BDS runtime;
  this workspace cannot execute that external runtime.

## Release conclusion

The portable minimap behaviors from the three references are implemented and integrated. Native Java client
renderers, shader pipelines, packet entities, custom keyboard hooks, and Xaero/Antique Atlas dependencies are
explicitly excluded because they cannot execute inside this add-on's public Bedrock runtime. The result is a
truthful, bounded, production-packaged Script API minimap rather than an unsupported native-renderer claim.
