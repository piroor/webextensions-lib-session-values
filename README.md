# webextensions-lib-session-values

A helper class for event pages to store temporary values while the session.

This deppends on the `storage.session` WebExtensions API which is supported by Firefox 115 and later.

## Usage

```javascript
// First, you need to create an instance.
const gValues = new SessionValues({
  // And you need to define value slots with their initial values.
  // Any JSONarizable values, Set and Map are available as initial values.
  openingTabs: [],
  anyWindowHasFocus: true,
  lastCreatedAt: 0,
  trackedWindows: new Set(),

  // It automatically serialize/deserialize the value, if they are simple values.
  // Complex values like nested Map need to be serialize/deserialize by your hand,
  // for example:
  initialTabIdsInWindow: new SessionValue(
    // the initial value
    new Map(),
    // serializer
    value => [...value.entries()].map(([key, value]) => [key, [...value]]),
    // deserializer
    value => new Map(value.map(([key, value]) => [key, new Set(value)]))
  ),
});

// Values are loaded from the session storage automatically just after the
// instance is created.
// The instance has a property "$loaded" which is a promise resolved when
// all values are loaded by the "loadAll()".
browser.tabs.onCreated.addListener(async tab => {
  await gValues.$loaded;
  // Operations based on loaded session values are placed here.
  ...
});

window.addEventListener('DOMContentLoaded', async () => {
  // The promise is resolved with a Set containing keys loaded from the session storage.
  const loadedKeys = await gValues.$loaded;

  // If there is any loaded key, it means that you are now resumed, so you may skip
  // some initialization processes.
  if (loadedKeys.size > 0)
    return;

  // Otherwise you need to do regular initialization processes.
  ...
});


// When you set a new value to the slot, it automatically serialize and save
// the value to the session storage.
gValues.lastCreatedAt = Date.now();

// When you directly modify the value, it won't be serialized and saved automatically.
// Thus you need to call "save" manually.
gValues.trackedWindows.add(window.id);
gValues.save();

// Calling "save" without arguments will save all possible dirty values:
// Array, Object, Set or Map which might be modified directly.
// If you hope only modified values are saved, specify keys to save like as:
gValues.openingTabs.add(tab.id);
gValues.trackedWindows.add(window.id);
gValues.save('openingTabs', 'trackedWindows');
```
