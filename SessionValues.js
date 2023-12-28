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

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#copying_methods_and_mutating_methods
const ARRAY_CHANGE_METHODS = new Set([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
]);
const SET_CHANGE_METHODS = new Set([
  'add',
  'clear',
  'delete',
]);
const MAP_CHANGE_METHODS = new Set([
  'clear',
  'delete',
  'set',
]);

class SessionValues {
  constructor(definitions = {}, { autoSave } = {}) {
    this.$values = {};
    this.$deserializers = {};
    this.$toBeLoadedKeys = new Set();
    this.$resolveLoaded = new Set();
    this.$autoSave = autoSave !== false;

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

    this.$values[key] = this.$autoSave ?
      this.$createProxyIfNecessary(initial, key) :
      initial;
    this.$deserializers[key] = deserializer;
    Object.defineProperty(this, key, {
      get: () => this.$values[key],
      set: (value) => {
        this.$values[key] = this.$autoSave ?
          this.$createProxyIfNecessary(value, key) :
          value;
        const valuesToSave = {};
        valuesToSave[key] = serializer ? serializer(value) : value;
        browser.storage.session.set(JSON.parse(JSON.stringify(valuesToSave)));
      },
      enumerable: true,
    });

    this.$toBeLoadedKeys.add(key);
  }

  $createProxyIfNecessary(value, key) {
    if (this.$isObject(value) ||
        Array.isArray(value))
      return this.$deepProxy(value, key);

    if (value instanceof Set ||
        value instanceof Map)
      return this.$proxySetOrMap(value, relatedKey);

    return value;
  }

  $isObject(value) {
    return value && typeof value == 'object';
  }

  // based on https://medium.com/@johanncynic/two-way-to-detect-data-change-on-javascript-835fb45b405d
  $deepProxy(object, relatedKey) {
    const mapStore = {};
    const NO_PROXY = Symbol('no proxy');
    let arrayChanging = false;
    return new Proxy(object, {
      get: (target, prop, receiver) => {
        if (prop in mapStore &&
            mapStore[prop] !== NO_PROXY)
          return mapStore[prop];

        const value = Reflect.get(target, prop, receiver);
        if (Array.isArray(target) &&
            ARRAY_CHANGE_METHODS.has(prop)) {
          return (...args) => {
            arrayChanging = true;
            const result = value.bind(receiver)(...args);
            arrayChanging = false;
            this.save(relatedKey);
            return result;
          };
        }
        if (mapStore[prop] === NO_PROXY)
          return value;

        if (this.$isObject(value) ||
            Array.isArray(value)) {
          const proxyValue = mapStore[prop] || this.$deepProxy(value, relatedKey);
          return mapStore[prop] = proxyValue;
        }
        if (value instanceof Set ||
            value instanceof Map) {
          const proxyValue = mapStore[prop] || this.$proxySetOrMap(value, relatedKey);
          return mapStore[prop] = proxyValue;
        }
        mapStore[prop] = NO_PROXY;
        return value;
      },

      set: (target, prop, value, receiver) => {
        const newValue = (this.$isObject(value) || Array.isArray(value)) ?
          this.$deepProxy(value, relatedKey) :
          (value instanceof Set || value instanceof Map) ?
            this.$proxySetOrMap(value, relatedKey) :
            value;
        const result = Reflect.set(target, prop, newValue, receiver);
        mapStore[prop] = NO_PROXY;
        if (!arrayChanging)
          this.save(relatedKey);
        return result;
      },

      deleteProperty: (target, prop) => {
        const result = Reflect.deleteProperty(target, prop);
        delete mapStore[prop];
        if (!arrayChanging)
          this.save(relatedKey);
        return result;
      },
    });
  }

  // https://stackoverflow.com/questions/43236329/why-is-proxy-to-a-map-object-in-es2015-not-working
  $proxySetOrMap(object, relatedKey) {
    const mapStore = {};
    const CHANGE_METHODS = object instanceof Set ?
      SET_CHANGE_METHODS :
      MAP_CHANGE_METHODS;
    return new Proxy(object, {
      get: (target, name) => {
        const result = Reflect.get(target, name);
        if (typeof result !== 'function')
          return result;

        const bound = mapStore[name] || result.bind(target);
        if (mapStore[name] ||
            !CHANGE_METHODS.has(name))
          return mapStore[name] = bound;

        return mapStore[name] = (...args) => {
          const result = bound(...args);
          this.save(key);
          return result;
        };
      },
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
    const deserializedValue = deserializer ? deserializer(value) : value;
    this.$values[key] = this.$autoSave ?
      this.$createProxyIfNecessary(deserializedValue, key) :
      deserializedValue;
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
      const deserializedValue = deserializer ? deserializer(value) : value;
      this.$values[key] = this.$autoSave ?
        this.$createProxyIfNecessary(deserializedValue, key) :
        value;
      loadedKeys.add(key);
    }
    this.$tryResolve(loadedKeys);
    return loadedKeys;
  }
}

