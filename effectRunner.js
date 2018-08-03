'use strict';

const symbolObservable = require('symbol-observable').default;

const nop = () => {};

class EffectRunner {
    constructor(api) {
        this.api = api;
    }
    // TODO make run recursive
    run(effect, cb, ctx) {
        if (!cb) cb = nop;
        if (effect[EffectRunner.CALL]) {
            const [method, ...args] = effect[EffectRunner.CALL];
            const handle = this.api[method];
            if (handle) {
                const callResult  = handle.apply(ctx, args);
                if (callResult !== undefined) {
                    this.run(callResult, cb);
                }
            }
            else throw new Error(`EffectRunner: couldn't find method '${method}'`);
        } else if (typeof effect[symbolObservable] == 'function') {
            effect[symbolObservable]().subscribe(cb);
        } else if (typeof effect == 'function') {
            const result = effect();
            if (result) {
                if (typeof result.then == 'function') {
                    result.then(cb);
                } else {
                    cb(result);
                }
            }

        } else if (typeof effect.then == 'function') {
            effect.then(v => {
                this.run(v, cb);
            });

        } else {
            cb(effect)
        }
    }
}

EffectRunner.CALL = Symbol('EffectRunner/CALL');

module.exports = EffectRunner;
