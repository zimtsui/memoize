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
        signal?: AbortSignal,
    ): Promise<value>;
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

    export function create<key, value, version>(
        log: (e: unknown) => void = () => {},
    ): Memoize<key, value, version> {
        let map = Map<FromJS<key>, Promise<[value, version]>>();
        return async function cache(rawKey, readCache, writeCache, getSourceVersion, generateFromSource, signal) {
            const key = fromJS(rawKey);
            if (signal?.aborted) throw signal?.reason;
            const sourceVersion = await getSourceVersion();
            try {
                if (signal?.aborted) throw signal?.reason;
                const [cacheValue, cacheVersion] = await readCache();
                if (signal?.aborted) throw signal?.reason;
                if (cacheVersion < sourceVersion) throw new Memoize.CacheOutdated();
                return cacheValue;
            } catch (e) {
                if (e instanceof Memoize.CacheMiss || e instanceof Memoize.CacheOutdated) {} else throw e;
                for (let generating = map.get(key); generating; generating = map.get(key)) {
                    const [value, version] = await Memoize.wait(generating, signal);
                    if (version >= sourceVersion) return value;
                }
                const generating = generateFromSource()
                    .then(([value, version]) => writeCache(value, version).then(() => [value, version]))
                    .finally(() => map = map.delete(key));
                generating.catch(log);
                map = map.set(key, generating);
                return await Memoize.wait(generating, signal).then(([value]) => value);
            }
        };
    }
    export class CacheMiss extends Error {}
    export class CacheOutdated extends Error {}
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
