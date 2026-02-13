import { fromJS, Map, type FromJS } from 'immutable';


/**
 * @template key Plain object
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
        return async function cache(key, readCache, writeCache, getSourceVersion, generateFromSource, signal) {
            if (signal?.aborted) throw signal?.reason;
            const sourceVersion = await getSourceVersion();
            try {
                if (signal?.aborted) throw signal?.reason;
                const [cacheValue, cacheVersion] = await readCache();
                if (signal?.aborted) throw signal?.reason;
                if (cacheVersion < sourceVersion) throw new Memoize.Outdated();
                return cacheValue;
            } catch (e) {
                if (e instanceof Memoize.Miss || e instanceof Memoize.Outdated) {} else throw e;
                for (let generating = map.get(fromJS(key)); generating; generating = map.get(fromJS(key))) {
                    const [value, version] = await Memoize.wait(generating, signal);
                    if (version >= sourceVersion) return value;
                }
                const generating = generateFromSource()
                    .then(([value, version]) => writeCache(value, version).then(() => [value, version]))
                    .finally(() => map = map.delete(fromJS(key)));
                generating.catch(log);
                map = map.set(fromJS(key), generating);
                return await Memoize.wait(generating, signal).then(([value]) => value);
            }
        };
    }
    export class Miss extends Error {}
    export class Outdated extends Error {}
    export interface GetSourceVersion<version> {
        (): Promise<version>;
    }
    export interface ReadCache<value, version> {
        /**
         * @throws {@link Cache.Miss}
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
