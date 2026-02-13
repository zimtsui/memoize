# Memoize

[![Npm package version](https://shields.io/npm/v/@zimtsui/memoize)](https://www.npmjs.com/package/@zimtsui/memoize)

Handle caching of asynchronous data with ease.

## Usage

```ts
import { Memoize } from '@zimtsui/memoize';

declare function readDataFromCache(key: string): Promise<[value: string, version: number]>;
declare function writeDataToCache(key: string, value: string, version: number): Promise<void>;
declare function getSourceVersion(key: string): Promise<number>;
declare function generateDataFromSource(key: string): Promise<[value: string, version: number]>;

const memoize = Memoize.create<string, string, number>();

export default function (key: string, signal?: AbortSignal): Promise<string> {
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
