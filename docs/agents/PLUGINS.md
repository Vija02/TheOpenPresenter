# Agent Guidelines for Plugin Development

## Debugging References

When encountering these issues, read the corresponding file:

| Issue                                                                                                                                                                                            | Read                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Infinite loops when modifying valtio state, arrays growing unexpectedly, or state not syncing. **Note: `undefined` is not supported in valtio-yjs, use `null` instead.**                         | [.agent/valtio-yjs-undefined.md](.agent/valtio-yjs-undefined.md) |
| Adding a plugin migration or any persistent table. Cloud sync enumerates entities by hand, so new tables do not sync until the sync code is edited. Existing plugin tables are already affected. | [CLOUD-SYNC.md](CLOUD-SYNC.md)                                   |
