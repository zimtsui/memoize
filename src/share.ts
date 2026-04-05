import { fromJS, FromJS, Map } from 'immutable';



export class FutureShareMap<k, v> {
    protected map = Map<FromJS<k>, Promise<v>>();

    public wait(k: k): Promise<v> | null {
        const key = fromJS(k);
        const promise = this.map.get(key);
        return promise ?? null;
    }

    public lazy(k: k, f: () => Promise<v>): Promise<v> {
        const key = fromJS(k);
        let promise = this.map.get(key);
        if (promise) return promise;
        promise = f().finally(() => this.map = this.map.delete(key));
        this.map = this.map.set(key, promise);
        return promise;
    }
}


export class FutureShare<x> {
    protected fsm = new FutureShareMap<null, x>();

    public wait(): PromiseLike<x> | null {
        return this.fsm.wait(null);
    }

    public lazy(f: () => Promise<x>): Promise<x> {
        return this.fsm.lazy(null, f);
    }
}
