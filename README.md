# Cache

[![Npm package version](https://shields.io/npm/v/@zimtsui/cache)](https://www.npmjs.com/package/@zimtsui/cache)

Handle caching of asynchronous data with ease.

## Usage

```ts
import { Cache } from '@zimtsui/cache';

declare function writeDataToCache(key: string, value: string): Promise<void>;
declare function readDataFromCache(key: string): Promise<string>;
declare function generateData(key: string): Promise<string>;

const cache = Cache.create<string, string>();

export async function getData(key: string): Promise<string> {
    return cache(
        key,
        () => readDataFromCache(key),
        value => writeDataToCache(key, value),
        () => generateData(key)
    );
}
```
