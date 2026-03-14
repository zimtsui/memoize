import { fromJS, Map, type FromJS } from 'immutable';


/**
 * @template key Plain value
 */
export interface Memoize<key, value, version> {
    (
        key: key,
        readCache: Memoize.ReadCache<value, version>,
        writeCache: Memoize.WriteCache<value, version>,
        getSourceVersion: Memoize.GetSourceVersion<version>,
        generateFromSource: Memoize.GenerateFromSource<value, version>,
    ): Promise<[value, version]>;
}

export namespace Memoize {
    export function wait<x>(promise: Promise<x>, signal?: AbortSignal): Promise<x> {
        if (signal?.aborted) throw signal?.reason;
        const ac = new AbortController();
        return new Promise<x>((resolve, reject) => {
            signal?.addEventListener('abort', () => reject(signal?.reason), { signal: ac.signal });
            promise.then(resolve, reject);
        }).finally(() => ac.abort());
    }

    export function create<key, value, version>(): Memoize<key, value, version> {
        let map = Map<FromJS<key>, Promise<[value, version]>>();
        return async function (rawKey, readCache, writeCache, getSourceVersion, generateFromSource) {
            const key = fromJS(rawKey);
            const sourceVersion = await getSourceVersion();
            try {
                const [cacheValue, cacheVersion] = await readCache();
                if (cacheVersion < sourceVersion) throw new CacheOutdated();
                return [cacheValue, cacheVersion];
            } catch (e) {
                if (e instanceof Memoize.CacheMiss || e instanceof CacheOutdated) {} else throw e;
                try {
                    for (let generating = map.get(key); generating; generating = map.get(key)) {
                        const [value, version] = await generating;
                        if (version >= sourceVersion) return [value, version];
                    }
                    throw new CacheOutdated();
                } catch (e) {
                    if (e instanceof CacheOutdated) {} else throw e;
                    const generating = generateFromSource()
                        .then(([value, version]) => writeCache(value, version).then(() => [value, version]))
                        .finally(() => map = map.delete(key));
                    map = map.set(key, generating);
                    return await generating;
                }
            }
        };
    }

    export class CacheMiss {}
    class CacheOutdated {}
    export interface GetSourceVersion<version> {
        (): Promise<version>;
    }
    export interface ReadCache<value, version> {
        /**
         * @throws {@link Memoize.CacheMiss}
         */
        (): Promise<[value, version]>;
    }
    export interface WriteCache<value, version> {
        (value: value, version: version): Promise<void>;
    }
    export interface GenerateFromSource<value, version> {
        (): Promise<[value, version]>;
    }
}
