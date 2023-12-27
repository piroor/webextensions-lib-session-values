/*
 license: The MIT License, Copyright (c) 2023 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/webextensions-lib-session-values
*/
'use strict';

class SessionValues {
  constructor() {
    this.$values = {};
    this.$deserializers = {};
  }

  defineItem(key, initial, serializer, deserializer) {
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

  async load(key) {
    if (!(key in this.$values))
      return false;

    const defaults = {};
    defaults[key] = undefined;
    const loadedValues = await browser.storage.session.get(defaults);
    if (!(key in loadedValues))
      return false;

    this.$values[key] = this.$deserializers[key](loadedValues[key]);
    return true;
  }

  async loadAll() {
    const loadedValues = await browser.storage.session.get(null);
    let loadedKeys = new Set();
    for (const [key, value] of Object.entries(loadedValues)) {
      if (!(key in this.$values))
        continue;
      this.$values[key] = this.$deserializers[key](value);
      loadedKeys.add(key);
    }
    return loadedKeys;
  }
}

