

export async function wait<x>(promise: Promise<x>, signal?: AbortSignal, handle?: (e: unknown) => void): Promise<x> {
    if (signal?.aborted) throw signal?.reason;
    const ac = new AbortController();
    try {
        return await new Promise<x>(
            (resolve, reject) => {
                signal?.addEventListener('abort', () => reject(signal?.reason), { signal: ac.signal });
                promise.then(resolve, e => {
                    handle?.(e);
                    reject(e);
                });
            },
        );
    } finally {
        ac.abort();
    }
}
