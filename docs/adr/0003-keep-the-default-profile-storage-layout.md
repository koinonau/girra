# Keep the default profile storage layout

Girra drops Orca profiles and Orca cloud accounts, but keeps the storage layout they created: state stays in `profiles/local-default/orca-data.json` beneath the user-data directory, found through `orca-profile-index.json`. The code that resolves that path, copies legacy root-level state into it, and prunes session fields by owner stays. Everything that creates, switches, links, transfers or signs in a profile goes.

## Considered Options

1. **Flatten to `orca-data.json` at the user-data root** - deletes about 850 more lines, but rewrites the store's path resolution, browser session partitions and history garbage collection, and makes every upstream fix to those files conflict.
2. **Keep the whole profile system and hide its UI** - leaves 4,000 lines of cloud and transfer code that nothing reaches.

## Consequences

- A `profiles/` directory holding one profile remains on disk, and code still names the active profile. Do not finish removing it.
- Browser session partitions keep their profile-derived names, so cookies survive upgrades between girra builds.
- Artifacts, skill sharing, the cloud relay and mobile push authenticate through Orca cloud sessions, so they leave with sign-in.
