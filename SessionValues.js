/*
 license: The MIT License, Copyright (c) 2023 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/webextensions-lib-session-values
*/
'use strict';

class SessionValue {
  constructor(initial, serializer, deserializer) {
    this.initial      = initial;
    this.serializer   = serializer;
    this.deserializer = deserializer;
  }
}

class SessionValues {
  constructor(definitions = {}) {
    this.$values = {};
    this.$deserializers = {};
    this.$toBeLoadedKeys = new Set();
    this.$resolveLoaded = new Set();

    if (definitions) {
      for (const [key, definition] of Object.entries(definitions)) {
        if (definition instanceof SessionValue)
          this.$defineItem(key, definition.initial, definition.serializer, definition.deserializer);
        else
          this.$defineItem(key, definition);
      }
      this.$$loaded = this.$loadAll();
    }
  }

  get $loaded() {
    if (this.$toBeLoadedKeys.size <= 0)
      return this.$$loaded || Promise.resolve(new Set());

    const promisedLoaded = new Promise((resolve, _reject) => {
      this.$resolveLoaded.add(resolve);
    });
    return this.$$loaded = this.$$loaded ?
      this.$$loaded.then(() => promisedLoaded) :
      promisedLoaded;
  }

  $defineItem(key, initial, serializer, deserializer) {
    if (initial instanceof Set) {
      if (!serializer)
        serializer = this.$serializeSet;
      if (!deserializer)
        deserializer = this.$deserializeSet;
    }
    else if (initial instanceof Map) {
      if (!serializer)
        serializer = this.$serializeMap;
      if (!deserializer)
        deserializer = this.$deserializeMap;
    }

    this.$values[key] = initial;
    this.$deserializers[key] = deserializer;
    Object.defineProperty(this, key, {
      get: () => this.$values[key],
      set: (value) => {
        this.$values[key] = value;
        const valuesToSave = {};
        valuesToSave[key] = serializer ? serializer(value) : value;
        browser.storage.session.set(valuesToSave);
      },
      enumerable: true,
    });

    this.$toBeLoadedKeys.add(key);
  }

  $serializeSet(value) {
    return [...value];
  }

  $deserializeSet(value) {
    return new Set(value);
  }

  $serializeMap(value) {
    return [...value.entries()];
  }

  $deserializeMap(value) {
    return new Map(value);
  }

  save(...keys) {
    for (const key of keys) {
      this[key] = this[key];
    }
  }

  $tryResolve(loadedKeys) {
    if (this.$resolveLoaded.size <= 0 ||
        this.$toBeLoadedKeys.size > 0)
      return;
    for (const resolver of this.$resolveLoaded) {
      resolver(loadedKeys);
    }
    this.$resolveLoaded.clear();
  }

  async $load(key) {
    if (!(key in this.$values))
      return false;

    const defaults = {};
    defaults[key] = undefined;
    const loadedValues = await browser.storage.session.get(defaults);
    this.$toBeLoadedKeys.delete(key);
    if (!(key in loadedValues))
      return false;

    const value = loadedValues[key];
    const deserializer = this.$deserializers[key];
    this.$values[key] = deserializer ? deserializer(value) : value;
    this.$tryResolve(new Set([key]));
    return true;
  }

  async $loadAll() {
    const keysToLoad = Object.fromEntries([...this.$toBeLoadedKeys].map(key => [key, undefined]));
    this.$toBeLoadedKeys.clear();
    const loadedValues = await browser.storage.session.get(keysToLoad);
    let loadedKeys = new Set();
    for (const [key, value] of Object.entries(loadedValues)) {
      if (value === undefined)
        continue;
      const deserializer = this.$deserializers[key];
      this.$values[key] = deserializer ? deserializer(value) : value;
      loadedKeys.add(key);
    }
    this.$tryResolve(loadedKeys);
    return loadedKeys;
  }
}

