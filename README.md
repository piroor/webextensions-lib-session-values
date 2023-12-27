# webextensions-lib-session-values

A helper class for event pages to store temporary values while the session.

This deppends on the `storage.session` WebExtensions API which is supported by Firefox 115 and later.

## Usage

```javascript
const gValues = new SessionValues();
gValues.defineItem('openingTabs', []);
gValues.defineItem('trackedWindows', new Set(),
  // serializer: convert the value to a JSONarizable
  value => [...value],
  // deserializer: convert a JSONarizable value to the raw value
  value => new Set(value));
gValues.defineItem('initialTabIdsInWindow', new Map(),
  value => [...value.entries()].map(([key, value]) => [key, value && [...value]]),
  value => new Map(initialTabIdsInWindow.map(([key, value]) => [key, new Set(value)])));

await gValues.loadAll();
```
