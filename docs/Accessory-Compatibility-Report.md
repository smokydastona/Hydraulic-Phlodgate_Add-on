# Accessory and Trinket Compatibility Report

## Scope

This report records the review of the requested references against Phlodgate's public Minecraft Bedrock
Behavior Pack + Resource Pack runtime:

- `Brothergaming52/CuriosPaper` (Paper/Spigot Java plugin)
- `DoriosStudios/Dorios-Trinkets` (Bedrock add-on)
- `DoriosStudios/UtilityCraft` and the `DoriosStudios` organization (Bedrock add-on ecosystem and extension patterns)
- `wisp-forest/accessories` (Fabric/NeoForge Java accessory API)
- `pajicadvance/accessorify` (Fabric/NeoForge Java accessory-content mod, archived)
- `Majrusz/MajruszsAccessories` (Fabric/Forge/NeoForge Java accessory mod)

No Java source, JAR, renderer, model, or third-party texture was copied. The implementation uses only the
pinned Bedrock Script API and local pack assets/contracts.

## Findings and disposition

| Source | Useful behavior | Compatibility decision |
|---|---|---|
| CuriosPaper | Named slot types, multiple ring slots, quick equip, effect/attribute lifecycle, persistent death policy, GUI inventory, and explicit developer API concepts | Implemented named slots, two ring slots, quick-equip from the selected hotbar slot, idempotent effect refresh, persisted dynamic-property state, and a validated cabinet form. Java plugin commands, Paper events, armor-stand models, databases, Geyser mappings, and server-side permissions are not Bedrock APIs. |
| Dorios-Trinkets | Bedrock-native trinket catalog, scroll/selection UI, before-hurt combat handling, lava-walking gameplay effects, and script-driven item state | Used as the closest runtime reference for Bedrock item definitions, script event wiring, and effect lifecycle. The shipped catalog uses original local names and vanilla icon identifiers; no repository art or code was copied. |
| UtilityCraft | Bedrock project organization, data-driven item/block definitions, shared library patterns, tests, extension packs, and release discipline | Applied the local-pack organization and validation mindset. UtilityCraft machines, energy/fluid systems, extensions, and project-specific assets are not dependencies of this add-on. |
| DoriosStudios organization | Related Bedrock projects demonstrate reusable add-on boundaries, extension packs, and namespaced content | Reviewed for ecosystem compatibility only. No remote dependency, shared library, or organization asset is required. |
| Accessories | Data-driven slot predicates, unique slots, compatibility with Curios/Trinkets concepts, equip/unequip callbacks, and recalculated effects | Implemented the portable contract as a pure local catalog/state module. Java mixins, NBT accessory components, rendering layers, and loader dependencies are excluded. |
| Accessorify | Slot modes, vanilla-item conversion, compass/clock/recovery information, elytra/totem/spyglass/lantern/ender chest/shulker/arrow use cases, and configurable unique slots | Implemented the safe subset first: fixed named slots and curated effect trinkets. Client keybinds, dynamic-light hooks, accessory API dependencies, and Java inventory widgets are unavailable in Bedrock. |
| Majrusz's Accessories | Cross-loader special accessories, pocket/slot multiplicity, and behavior-oriented utility items | Applied the behavior-first approach. Its Java loader/library dependencies and original assets are not portable or needed. |

## Delivered implementation

### Slots

The Trinket Cabinet exposes ten physical slots across the nine reference categories:

- Head
- Necklace
- Back
- Body
- Belt
- Hands
- Bracelet
- Ring 1
- Ring 2
- Charm

Slot membership is explicit in `src/features/accessories/AccessoryPlan.ts`. A malformed persisted entry,
unknown item, incompatible slot, or duplicate occupied slot is discarded during normalization.

### Shipped trinkets

The Behavior Pack contains seven non-stackable, namespaced trinket items:

- `phlodgate:speed_ring`: Speed I, Ring 1 or Ring 2
- `phlodgate:water_necklace`: Water Breathing, Necklace
- `phlodgate:feather_charm`: Slow Falling, Back or Charm
- `phlodgate:fire_charm`: Fire Resistance, Charm
- `phlodgate:night_amulet`: Night Vision, Head or Necklace
- `phlodgate:vitality_bracelet`: Resistance I, Bracelet
- `phlodgate:haste_gloves`: Haste I, Hands

`phlodgate:trinket_cabinet` is a non-stackable access item. All item names are localized in all three resource-pack
variants and use existing vanilla icon identifiers, so no third-party art is redistributed.

### Lifecycle and safety

- The cabinet is available from the Control Room and as a starter item.
- Using a trinket in hand quick-equips it into the first compatible empty slot.
- The cabinet form allows slot selection, compatible inventory selection, and unequip.
- Equip removes exactly one inventory item only after the next state is valid; failures restore the original stack.
- Unequip returns the item to inventory or drops the returned item at the player's feet if inventory is full.
- Effects are refreshed for 45 ticks every 20 ticks. This keeps the effect source bounded and lets removed effects
  expire naturally without forcibly deleting an unrelated effect that a player received elsewhere.
- Effect aggregation deduplicates effect types and keeps the strongest configured amplifier.
- No commands, paths, URLs, dynamic code, network data, or user-controlled item identifiers are executed.

## Asset and license review

The Java projects use loader-specific rendering layers, model data, or bundled assets. CuriosPaper is GPL-3.0;
Accessories and Accessorify are MIT; Majrusz's Accessories and its library are loader-bound projects; Dorios'
Bedrock projects have their own pack assets and repository-specific terms. None of those assets are required for a
truthful Script API implementation, so none were copied. The release uses local display names and existing vanilla
icon texture keys only. This avoids mixed-license art, texture collisions, and unverified redistribution rights.

## Security and performance review

- Dynamic-property JSON is normalized against a fixed catalog and fixed slot IDs before use.
- Inventory mutation is bounded to one stack entry per action and includes rollback/drop handling.
- Effects are a fixed seven-item catalog with a bounded refresh interval; no unbounded per-player list is created.
- The cabinet is player-local; no player can read or mutate another player's state through the form.
- There is no authentication boundary because this is a local player feature, but world/item use remains inside the
  current Bedrock player event source.
- No native code, filesystem access, browser storage, LevelDB/NBT editing, network transport, secrets, or new npm
  runtime dependency was added.

## Verification

- Accessory plan tests cover slot compatibility, duplicate prevention, effect aggregation, malformed-state recovery,
  and unequip behavior.
- Full test, typecheck, build, package, and release-validation gates are required before publishing.
- Physical Bedrock client/BDS testing remains necessary for touch/controller form selection, item icon resolution,
  effect refresh behavior, respawn persistence, and each resource-pack variant. The workspace has no Bedrock runtime.

## Release conclusion

The portable accessory/trinket feature surface requested by the references is implemented as a bounded native
Bedrock add-on feature. Java-only APIs, client keybind hooks, loader mixins, NBT components, model render layers,
Geyser mappings, and external assets are explicitly excluded because they cannot execute or be redistributed safely
inside this project.
