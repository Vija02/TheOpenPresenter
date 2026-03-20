# Agent Guidelines for Plugin Development

This document contains important debugging information and patterns specific to plugin development that developers and LLMs should be aware of.

## Critical: Valtio-Yjs and Undefined Values

### The Problem

**valtio-yjs integration does NOT support `undefined` values.** This is expected behavior but can cause extremely confusing bugs that are hard to diagnose.

### Symptoms

When `undefined` is accidentally assigned to a valtio-yjs state:

- **Infinite recursion**: Pushing an item into an array may cause that item to be added recursively, infinitely
- **Silent data corruption**: The state may become corrupted without obvious errors
- **Unexpected sync behavior**: Changes may not propagate correctly across clients

### How Valtio State Looks in Plugins

Valtio mutable state is accessed via hooks that typically start with `mutable...`:

```typescript
const mutableSceneData = pluginApi.scene.useValtioData();
const mutableRendererData = pluginApi.renderer.useValtioData();

// Then used like:
mutableSceneData.pluginData.videoBackgrounds.push(newVideo);
mutableRendererData.activeVideoBackgroundId = null;
```

See `lyrics-presenter/view/Remote/VideoBackgroundSection.tsx:45` for a real example.

### The Rule

**NEVER assign `undefined` to any valtio-yjs state. Use `null` instead.**

```typescript
// BAD - will cause weird bugs
mutableData.someField = undefined;
mutableData.items.push({ name: "test", value: undefined });

// GOOD - use null explicitly
mutableData.someField = null;
mutableData.items.push({ name: "test", value: null });
```

### Common Sources of Undefined

1. **Optional chaining without defaults**:

   ```typescript
   // BAD - could be undefined
   const value = someObject?.property;
   mutableData.field = value;

   // GOOD - provide null fallback
   mutableData.field = someObject?.property ?? null;
   ```

2. **Object properties that may not exist**:

   ```typescript
   // BAD
   mutableData.items.push({
     id: item.id,
     thumbnail: item.thumbnail, // might be undefined!
   });

   // GOOD
   mutableData.items.push({
     id: item.id,
     thumbnail: item.thumbnail ?? null,
   });
   ```

3. **Function return values**:

   ```typescript
   // BAD - find() returns undefined if not found
   mutableData.selected = items.find((x) => x.id === id);

   // GOOD
   mutableData.selected = items.find((x) => x.id === id) ?? null;
   ```

4. **Destructuring with missing properties**:

   ```typescript
   // BAD
   const { optionalProp } = someObject;
   mutableData.prop = optionalProp;

   // GOOD
   const { optionalProp = null } = someObject;
   mutableData.prop = optionalProp;
   ```

### Debugging Tips

If you see:

- Infinite loops when modifying state
- Arrays growing unexpectedly
- State not syncing properly

**First check**: Are any `undefined` values being assigned to valtio state?

### Related Patterns

- Plugin data mutations typically happen in `view/Remote/*.tsx` files
- Scene data: `pluginApi.scene.useValtioData()`
- Renderer data: `pluginApi.renderer.useValtioData()`
