import { fromJS, Map, type FromJS } from 'immutable';
import { Tracer } from '@zimtsui/typelog/tracer';

const tracer = Tracer.create('@zimtsui/memoize');


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

    export function create<key, value, version>(
        handle: (e: unknown) => void = () => {},
    ): Memoize<key, value, version> {
        let map = Map<FromJS<key>, Promise<[value, version]>>();
        return async function (rawKey, readCache, writeCache, getSourceVersion, generateFromSource, signal) {
            const promise = (async (): Promise<[value, version]> => {
                const key = fromJS(rawKey);
                const sourceVersion = await getSourceVersion();
                try {
                    const [cacheValue, cacheVersion] = await readCache();
                    if (cacheVersion < sourceVersion) throw Memoize.CACHE_OUTDATED;
                    return [cacheValue, cacheVersion];
                } catch (e) {
                    if (e === Memoize.CACHE_MISS || e === Memoize.CACHE_OUTDATED) {} else throw e;
                    try {
                        return await tracer.activateAsync('cache blocked', async () => {
                            for (let generating = map.get(key); generating; generating = map.get(key)) {
                                const [value, version] = await generating;
                                if (version >= sourceVersion) return [value, version];
                            }
                            throw Memoize.CACHE_OUTDATED;
                        });
                    } catch (e) {
                        if (e === Memoize.CACHE_OUTDATED) {} else throw e;
                        const generating = generateFromSource()
                            .then(([value, version]) => writeCache(value, version).then(() => [value, version]))
                            .finally(() => map = map.delete(key));
                        map = map.set(key, generating);
                        return await generating;
                    }
                }
            })();
            promise.catch(handle);
            return await Memoize.wait(promise, signal);
        };
    }

    export const CACHE_MISS = Symbol();
    export const CACHE_OUTDATED = Symbol();
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
