# webextensions-lib-session-values

A helper class for event pages to store temporary values while the session.

This deppends on the `storage.session` WebExtensions API which is supported by Firefox 115 and later.

## Usage

```javascript
// First, you need to create an instance.
const gValues = new SessionValues();

// And you need to define value slots.
// "defineItem()" requires two args: the key and the initial value.
// Any JSONarizable values, Set and Map are available as initial values.
gValues.defineItem('openingTabs', []);
gValues.defineItem('anyWindowHasFocus', true);
gValues.defineItem('lastCreatedAt', 0);
gValues.defineItem('trackedWindows', new Set());

// It automatically serialize/deserialize the value, if they are simple values.
// Complex values like nested Map need to be serialize/deserialize by your hand,
// for example:
gValues.defineItem('initialTabIdsInWindow', new Map(), // the values are Set.
  // serializer
  value => [...value.entries()].map(([key, value]) => [key, [...value]]),
  // deserializer
  value => new Map(value.map(([key, value]) => [key, new Set(value)])));

// You need to load values from the session storage.
const loadedKeys = await gValues.loadAll();
// The returned value is a set of loaded keys.
// The size will be 0 if it is the startup.


// When you set a new value to the slot, it automatically serialize and save
// the value to the session storage.
gValues.lastCreatedAt = Date.now();

// When you directly modify the value, it won't be serialized and saved automatically.
// Thus you need to call "save" manually for the key.
gValues.trackedWindows.add(window.id);
gValues.save('trackedWindows');

// The method "save" accepts multiple keys like as:
gValues.openingTabs.add(tab.id);
gValues.trackedWindows.add(window.id);
gValues.save('openingTabs', 'trackedWindows');
```
