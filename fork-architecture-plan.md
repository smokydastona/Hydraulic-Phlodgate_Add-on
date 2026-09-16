# Add-on Fork Architecture Plan

## Decision

Phlodgate keeps a public Bedrock Behavior Pack + Resource Pack architecture. The linked projects are reference
inputs, not code or asset dependencies:

- `renzonox-ux/XaeroLiteMinimap.mcpack` contributes the waypoint-oriented user workflow.
- `Silvaxxxuuuu/minecraft-bedrock-minimap` confirms the TypeScript build/deploy shape and demonstrates static
  texture and font-sheet generation, which cannot carry live world state inside this pack.
- `Halo333X/Simple-Minimap-MCBE` demonstrates the visual result possible with native client graphics and file
  I/O; those APIs are outside `@minecraft/server` and are intentionally not a dependency.
- `wisp-ts/forms-plus` supplies the validation/retry lifecycle now represented by local `FormRuntime` and
  `FormValidation` modules.
- `TheNINJALLO/endstone-remote-workstations` supplies the capability/permission model now reflected by the
  existing operator gates, machine inspector, quick transfer, and recipe workbench.
- `jsonforge`, `mcbe-ts-ui`, `mcbe-ui-codex`, and `Ore-UI-Types` inform UI schema and version discipline without
  introducing undocumented Ore UI commands or a second UI runtime.
- `LeGend077/json-ui-examples`, `GoldRush-developpement/EasyUIBuilder`, and `depressed-pho/bedrock-ui-tweaks`
  confirm the documented `"modifications"` array (`array_name`/`operation`/`value`) is real and safe for
  appending or relocating vanilla `pause_screen.json`/`inventory_screen.json` controls. None of them, nor
  `mojang/bedrock-samples`, expose a way for a JSON UI button press to invoke `@minecraft/server` script code:
  the Script API has no event for an arbitrary custom UI button click. A button injected into those vanilla
  screens can therefore only be wired to an **existing** vanilla button ID (e.g. `button.menu_settings`), never
  to this add-on's mass-craft, quick-transfer, inspector, or optimization logic. The add-on ships one small,
  genuinely functional shortcut button of that kind (a `pause_screen.json` top-right button that reuses the
  real `button.menu_settings` action and the real `menu.settings` label) and otherwise keeps its actual feature
  surface behind the Hydraulic Control Room and Field Map items, which are real server-initiated
  `ActionFormData`/`ModalFormData` forms rather than vanilla-screen button hacks.
- `Block-Workbench`, `Mods-pemc`, `MCVault`, `Bedrock-Nexus`, `OruuCreations`, and the Calagopus editor establish
  desktop/network/file-system product boundaries that are explicitly excluded from this behavior-pack runtime.
- `BetterBedrockMenus`, `Bedrock-Java-ChibiArtAssets`, `assets-plus`, `MiniX`, `pixel-asset-master-skills`,
  `PixelSRPG-Forge`, `ClawLibrary`, and `pixel-asset-gen` establish the menu/catalog, provenance, and
  deterministic-asset boundaries recorded in `docs/Asset-Compatibility-Report.md`.
- `NezuShin/NMinimap` contributes the portable behavior model for configurable zoom, square/circle presentation,
  bounded map dimensions, marker categories, and cache-aware rendering. Its Java packet-map entities, shaders,
  generated font-image resource pack, commands, permissions, and GPL-3.0 implementation are not portable into
  this public Bedrock Script API pack and were not copied.
- `dmor-me/AA4-Minimap` contributes the portable Atlas-style concepts of layered terrain sampling, player-centered
  orientation, and map markers. Its Java Fabric/Forge renderer, Antique Atlas 4 dependency, chunk meshes, and
  client input hooks are outside this runtime; the local implementation uses typed block sampling, relief, radar,
  waypoints, and companion vectors instead. The source is MIT licensed, but no source or assets were needed.
- `jose190901/simple-minimap` is an MIT Forge add-on that disables unrelated Xaero controls rather than rendering
  a minimap. Its useful boundary is a restrained control surface and explicit smoke-test discipline. It does not
  provide a Bedrock renderer, and this pack does not claim Xaero compatibility or mutate client key mappings.
  The full source, asset, security, and release disposition is recorded in `docs/Minimap-Fork-Compatibility-Report.md`.
- `Brothergaming52/CuriosPaper` contributes named accessory slots, duplicate ring slots, quick equip, effect
  lifecycle, and explicit GUI/API boundaries. Its Paper events, commands, armor-stand models, database, and GPL
  implementation are not portable.
- `DoriosStudios/Dorios-Trinkets` is the closest Bedrock reference for script-driven trinket state, effect hooks,
  and interaction UI. `DoriosStudios/UtilityCraft` and the broader Dorios Studios organization contribute
  namespaced Bedrock pack organization, extension boundaries, and release discipline; their machines, libraries,
  and art are not dependencies.
- `wisp-forest/accessories`, `pajicadvance/accessorify`, and `Majrusz/MajruszsAccessories` contribute the
  data-driven slot predicate, unique-slot, vanilla-item conversion, utility accessory, and equip/unequip
  lifecycle concepts. Their Fabric/Forge/NeoForge APIs, NBT components, mixins, keybinds, and render layers are
  outside the public Bedrock runtime. The complete source, asset, license, security, and release disposition is
  recorded in `docs/Accessory-Compatibility-Report.md`.

## Companion pet research findings

Eight repositories were reviewed as reference input for the bound companion pet feature (a per-player pet that
sits/stays like a vanilla tamed mob and shift-click opens the Hydraulic Control Room):

| Repository | Platform | Applicability |
|---|---|---|
| `Shynixn/PetBlocks` | Bukkit/Paper Java plugin | Not portable: entirely different server platform/API (Bukkit `Entity`/`NBT`/packet layer), no Bedrock Script API equivalent. Reviewed only for the general "per-player bound pet + GUI" concept, which this feature reimplements natively. |
| `TaqdeesHigh/Pets` | Bukkit/Paper Java plugin | Same as above — Java server plugin, not applicable to a Bedrock Behavior Pack. |
| `fish2lab/tlm-codex-pet` | Bukkit/Paper Java plugin | Same as above. |
| `billeyzambie/PracticalPets` | Bukkit/Paper Java plugin | Same as above. |
| `Nocsy-Workshop/mcpets` | Bukkit/Paper Java plugin | Same as above. |
| `CuteMobModels-Team/CuteMobModels-BE` | Bedrock resource pack (fan mob models) | Right platform, but its models/textures are original third-party art assets with their own license terms; not vendored. Confirms custom Bedrock entities are the correct mechanism, which this feature already uses. |
| `kirbycope/Minecraft-Earth-Mobs-Bedrock` | Bedrock resource pack (fan recreation) | Recreates character designs from Mojang's Minecraft Earth; provenance/license of the derived designs is not clear enough to vendor. Not used. |
| `kirbycope/Minecraft-Legends-Mobs-Bedrock` | Bedrock resource pack (fan recreation) | Recreates character designs from Mojang's Minecraft Legends; same provenance concern as above. Not used. |

**None of the five Java plugins are portable in any form**: Bukkit/Paper's `org.bukkit.entity.Entity`,
NBT access, and packet APIs have no counterpart in `@minecraft/server`, and the runtime (a Java server JVM
process) is a different product entirely from a Bedrock Behavior Pack. Their *concepts* (bind a tamed mob to a
player, invulnerable, right-click opens a menu) are exactly what this feature implements, just built from
scratch against the real Bedrock APIs verified in `node_modules/@minecraft/server/index.d.ts` for this project's
pinned `@minecraft/server@2.10.0`.

**The three Bedrock-specific repositories** confirmed custom entity definitions are the right mechanism, but
their actual model/texture assets were not used: fan-made recreations of Mojang's Minecraft Earth/Legends
character designs carry unclear redistribution rights for those specific derived designs, and this project's
asset policy (`docs/Asset-Compatibility-Report.md`) already excludes extracted/mixed-license art. Instead, the
shipped companion entities (`phlodgate:companion_wolf/cat/fox`) reference the **existing vanilla**
wolf/cat/fox geometry, textures, and animation/render controllers by identifier only — the same technique
`mojang/bedrock-samples` itself uses — which needs no new art assets and carries no licensing ambiguity.

**Implementation delivered**: 40 custom, fully neutral, invulnerable, owner-bound companion entities. The
special category contains Wolf, Cat, Fox, Snow Fox, Creaking, Rabbit, Cave Spider, Copper Golem, Zoglin,
Axolotl, and a zombification-immune Baby Piglin; Spider, Sniffer, and Ravager are saddle-free rideable mounts.
The baby-animal category covers every supported ageable animal family: Armadillo, Axolotl, Bee, Camel, Cat,
Chicken, Cow, Donkey, Fox, Goat, Hoglin, Horse, Llama, Mooshroom, Mule, Ocelot, Panda, Pig, Polar Bear, Rabbit,
Sheep, Sniffer, Strider, Turtle, Wolf, and Tadpole. A required categorized first-spawn chooser locks movement
and retries after cancellation/UI-busy errors; it persists completion only after successful spawn and owner
assignment. Shift-click routes to `openHydraulicControlRoom()`; layered invulnerability
(`minecraft:damage_sensor` + `minecraft:fire_immune` + a script-side `entityHurt` cancellation); and an
`entityDie` respawn safety net. The Creaking and Copper Golem entities additionally declare the same
client-synced entity properties (`minecraft:creaking_state`, `minecraft:oxidation_level`, etc.) their reused
vanilla render controllers read, pinned to fixed neutral/unoxidized defaults, since none of those two mobs'
original hostile/statue/chest-transport logic is included. See the README's "Bound companion pet" section for
the full behavior breakdown and `src/features/companion/CompanionPetPlan.ts`/`CompanionPetRuntime.ts` for the
implementation.

## Current architecture

1. `MinimapMath.ts` owns deterministic radar bearings, cardinal rotation, nearest-marker ordering, and radius filtering.
2. `TerrainMap.ts` owns type-id classification, colored text glyphs, safe companion-vector parsing, and pure grid formatting.
3. `TerrainSampler.ts` owns bounded world sampling, a dimension/position/scale/width grid cache, and the
  explored-terrain memory. Two rules keep the map usable:

  - Block edits invalidate **only the cell they changed** (`invalidateTerrainAt`). An earlier revision cleared
    the whole memory on every break/place, which collapsed the map to the currently loaded chunks and was the
    real cause of the "only a few chunks" complaint. `invalidateTerrainCache` remains for dimension-wide resets
    and must not be wired to block events.
  - World reads are budgeted per refresh (`TerrainBudget.ts`). Outside loaded chunks `getTopmostBlock` throws,
    and a full map would raise hundreds of exceptions every refresh on low-end hardware. Cells already in
    memory are free to redraw, so an unexplored map fills in progressively instead of spiking, and a partially
    filled grid uses a short cache TTL so the remaining cells are sampled soon after.
4. `MinimapHud.ts` composes a color-coded 21x21 terrain map at a bounded 1x/2x/4x/8x zoom (16/8/4/2 blocks
  per cell; the default 1x covers a 160-block half-width), with elevation relief and nearest waypoint/companion
  markers in square or circular form.
5. `MinimapForms.ts` provides the on-demand Field Map and waypoint actions.
6. `HudManager.ts` owns two independent channels: plain-token-routed actionbar content for the minimap and
  background-free title/subtitle content for the centered compass above vanilla status bars. The minimap token
  encodes both corner and size (`[PGL:<corner><1|2>]`), so `hud_screen.json` can route the same content into a
  small box or a large one purely by scaling. These are two genuinely separate screen locations: the minimap is
  drawn by a `hud_actionbar_text_factory`-backed control anchored to a screen corner, while the compass stays on
  the title/subtitle channel above the hotbar. Custom food telemetry is not rendered.

  Two JSON UI rules govern this and are enforced by `validate:release`, because violating either fails silently
  in-game while every static check still passes:

  - Operators cannot be applied to the hardcoded `$actionbar_text` variable directly. It must first be copied
    into a normal variable (`"$atext": "$actionbar_text"`) on the same control, and all comparisons must use the
    copy. Comparing the hardcoded variable directly never matches, which is what kept the minimap invisible.
  - `_ui_defs.json` registers only *new* UI files. Vanilla screen overrides such as `hud_screen.json` are merged
    by path automatically; listing one there makes the engine treat it as a separate screen instead of an
    override.

  A control that needs `$actionbar_text` must be produced by a `hud_actionbar_text_factory` and inserted into
  `root_panel` through a `modifications` array - that is the only documented way to receive the variable in a
  control this pack owns.

  Vanilla's own `hud_actionbar_text` is set to `"ignored": true` rather than being hidden by a molang
  expression. Relying on an expression left it rendering, so the minimap appeared twice - once in the corner
  box and once in vanilla's centered box. Because that control is suppressed outright, the pack renders
  unmarked actionbar messages itself in a bottom-centre box, so third-party and vanilla actionbar text is
  preserved. `validate:release` enforces both halves of that contract.

  Every subsystem is registered through a `safeRegister` wrapper in `main.ts`. A throw while the script module
  loads takes the whole behavior pack down with it, which on a console client surfaces as a failure to enter
  the world; isolating each registration degrades one feature instead of the entire add-on.
7. `FormRuntime.ts` owns bounded busy-form retry and terminal error logging; `FormValidation.ts` owns pure response validation.
8. `RecipeRegistry.ts` owns the stable recipe catalog; `RecipeForms.ts` provides category navigation, bounded pages, search, and mass-craft entry points.
9. `MenuCatalog.ts` owns Control Room route metadata, operator visibility, validation, and action-form bounds.
10. `CompanionPetPlan.ts` owns the companion species catalog, interaction-decision logic, and spawn-placement
    math (pure/unit-tested); `CompanionPetRuntime.ts` wires it to spawning, taming, interaction routing,
    damage cancellation, and the death-safety-net respawn.
11. `AccessoryPlan.ts` owns the fixed named-slot catalog, trinket compatibility, persisted-state normalization,
  and effect aggregation; `AccessoryRuntime.ts` owns transactional inventory transfer, quick-equip, bounded
  effect refresh, and dynamic-property persistence; `AccessoryForms.ts` owns the Trinket Cabinet workflow.
12. `LootrPlan.ts` owns pure per-player container-loot decisions: container keying, item-descriptor
  sanitization, open-action resolution, bounded serialization with least-recently-used eviction, and the
  deterministic trinket roll. `LootrRuntime.ts` wires those decisions to real containers.

## Fork boundaries

The fork must not add native DLL hooks, client file writes, external processes, network transport, browser storage,
LevelDB/NBT editing, host `server.properties` access, undocumented Ore UI commands, or copied third-party
renderer/assets. Those require separate products with their own distribution, permissions, and licensing models.

The add-on may extend the current implementation with additional pure block classifications, companion marker
contracts, or bounded sampling policies. Any new runtime surface must remain dimension-scoped, cache-bounded,
exception-safe, and covered by unit tests. The current minimap marker overlay filters invalid, disabled, hidden,
out-of-range, and cross-dimension targets before rendering, and the player marker always wins the center cell.

Accessory additions must use a fixed catalog entry, an explicit compatible slot set, a non-stackable behavior item,
localization in every resource-pack variant, and idempotent effect reconciliation. Accessory state is player-local
dynamic-property JSON; no Java NBT, external database, client keybind, or renderer dependency is allowed.

## Instanced container loot (Lootr-style)

Naturally generated containers are virtualized per player: the first player to open one has its generated
contents captured as an immutable snapshot, and every player thereafter works against their own copy. One
player can no longer empty a structure chest for everyone.

The implementation is bounded and defensive by construction:

- Containers a player placed are recorded through `playerPlaceBlock` and permanently excluded, so ordinary
  storage is never rewritten. Breaking a container releases both records.
- Item descriptors preserve type, count, name, lore, durability damage, and enchantments. Unknown item ids and
  incompatible enchantments are skipped individually rather than discarding a whole container.
- The store is capped at 192 containers and 28000 serialized characters, evicting least recently touched
  entries, because world dynamic properties are size-limited.
- Empty generated containers are never tracked, and every persisted payload is re-sanitized on read, so a
  corrupted or hand-edited property degrades to "untracked" instead of throwing.

Trinkets seed into that same snapshot, which is how accessories appear in the world in standalone mode: on
first open a bounded percentage roll may add one catalog trinket to a free slot. Because the trinket lands in
the snapshot rather than in one player's copy, every player who opens that container has the same chance to
find it. Both the instancing and the trinket roll are operator toggles, with the drop chance exposed as a
0-100 slider in World Settings.

This is not a port of Lootr's Java implementation: Bedrock's Script API exposes no custom container screen, so
the pack swaps the real container's contents at open time rather than rendering a per-player inventory view.

Asset additions must have explicit provenance, a compatible redistribution license, a bounded texture size, and
a validation path. Extracted or mixed-license art is not accepted into the shipped resource packs.

`scripts/generate-minimap-textures.mjs` generates the minimap frames under
`<pack>/textures/ui/phlodgate/minimap/` and never overwrites an existing file, so hand-drawn replacements
survive every rebuild. The 14 entity/waypoint/marker icons in that directory are vendored pixel art from
`tstamborski/pixelart-icons` under CC0-1.0 (public domain), pinned to an upstream commit and recorded per-file
with a SHA-256 in `assets/minimap-icon-provenance.json`; `scripts/vendor-minimap-icons.mjs` re-syncs them into
all three resource-pack variants offline, and only an explicit `--download` run touches the network.
`validate:release` fails if any required art file is missing from any variant, if the recorded license is not
CC0-1.0, if the upstream commit is not a pinned full sha, or if any vendored icon's bytes drift from its
recorded hash.

No per-block tile art ships, and `validate:release` actively rejects any `block_*`/`cave_*` file in that
directory. A fixed tile set can never cover unknown or future blocks, so terrain cell color is instead derived
from the real block type id sampled at that position: substring family rules (every `*_leaves`, `*_log`,
`*_ore`, deepslate/tuff stone variant, ...) plus a stable hashed fallback that gives blocks this build has
never seen a consistent, distinguishable color. Machinery published through the companion vector contract is
deliberately excluded from the map.

Every companion ships an editable model. `scripts/vendor-companion-models.mjs` resolves each species' geometry
in Mojang's official `bedrock-samples` resource pack, copies it into `<pack>/models/entity/phlodgate/` under
`geometry.phlodgate.companion_<species>`, and repoints the client entity at the copy. Bone names are left
untouched, so the reused vanilla animations and render controllers still bind. Both the modern per-entity
format and the legacy 1.8 combined format are supported, since Mojang ships some mobs in each. The script
resolves every mapping before writing anything, so a partial failure cannot leave the packs half-repointed,
and it records the upstream commit, source path, original vanilla identifier, and a SHA-256 per model in
`assets/companion-model-provenance.json`. Only an explicit `--download` run touches the network.
`validate:release` fails if any client entity still points at a bare vanilla `geometry.*` identifier, if a
model file is missing from any variant, or if a model's identifier does not match its species.

## Release gates

- `npm test` passes all pure logic tests.
- `npm run typecheck` passes against the declared Minecraft API versions.
- `npm run build` produces `BP/scripts/main.js` without bundling runtime modules.
- `npm run validate:release` parses every pack JSON file, verifies manifest/module UUID uniqueness and
  engine/API versions, validates UI definition references, requires the compiled script entry point, verifies
  the minimap art set is present in every resource-pack variant, and
  verifies every catalog pet's behavior, client definition, localization, neutral/invulnerable contract, and
  unique texture in all resource-pack variants.
- `npm run package` produces the Behavior Pack, Resource Pack, and add-on archives.
- Accessory release validation confirms all cabinet/trinket item definitions, catalog IDs, non-stackable limits,
  and localization keys across Balanced, Aggressive, and Extreme resource packs.
- Every JSON pack file parses successfully and manifests retain unique UUIDs.
- Forms reject malformed responses and retry transient busy states within bounded limits.
- Recipe catalogs remain usable with companion registrations through category navigation and pagination.
- The Behavior Pack has no hard dependency on one visual-variant UUID; this prevents false missing-dependency
  warnings when Balanced, Aggressive, or Extreme is selected. Script dependencies remain pinned to stable
  `@minecraft/server` 2.10.0 and `@minecraft/server-ui` 2.2.0, with a 26.51 minimum engine.
- A physical Bedrock client test confirms HUD placement, terrain refresh after block edits, waypoint markers,
  square/circle, four-corner and small/large minimap settings, centered compass placement, forced pet
  selection/spawn/naming, sit/mount/shift-click behavior, rideable jump and sneak-to-dismount, custom pet
  textures, and all three resource-pack variants.

JSON UI correctness in particular cannot be proven by the automated gates: they verify structure and the two
rules above, but Bedrock resolves variables and overrides at runtime, so a client check remains mandatory after
any `hud_screen.json` change.

The automated release gates are implemented by `scripts/release-validation.mjs` and run both directly and
before packaging. Physical client/device validation remains a separate release activity because this workspace
does not contain a Bedrock client or BDS runtime.

## Known runtime boundary

The shipped add-on is a truthful Script API enhancement suite: sampled terrain/radar HUD, validated forms,
operator-gated settings, machine/container inspection, quick transfer, and a paginated recipe workbench. It is
not a native camera-rendered Xaero/Atlas clone, a native workstation plugin, a save editor, or a content hub.
The public Script API does not expose world render textures, arbitrary screen widgets, player input hooks, or
filesystem access. The implementation therefore prioritizes correct live data, bounded cost, and graceful
unavailability over an unsupported visual claim.
