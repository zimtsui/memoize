# Memoize

[![Npm package version](https://shields.io/npm/v/@zimtsui/memoize)](https://www.npmjs.com/package/@zimtsui/memoize)

Handle caching of asynchronous data with ease.

## Usage

```ts
import { Memoize } from '@zimtsui/memoize';

export type Key = string;
export type Value = string;
export type Version = number;
declare function readDataFromCache(key: Key): Promise<[Value, Version]>;
declare function writeDataToCache(key: Key, value: Value, version: Version): Promise<void>;
declare function getSourceVersion(key: Key): Promise<Version>;
declare function generateDataFromSource(key: Key): Promise<[Value, Version]>;

const memoize = Memoize.create<Key, Value, Version>();

export default function (key: Key, signal?: AbortSignal): Promise<[Value, Version]> {
    return memoize(
        key,
        () => readDataFromCache(key),
        (value, version) => writeDataToCache(key, value, version),
        () => getSourceVersion(key),
        () => generateDataFromSource(key),
        signal,
    );
}
```
