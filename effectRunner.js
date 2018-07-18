'use strict';

const symbolObservable = require('symbol-observable').default;


class EffectRunner {
    constructor(api) {
        this.api = api;
    }
    // TODO make run recursive
    run(effect, cb) {
        if (effect[EffectRunner.CALL]) {
            const [method, ...args] = effect[EffectRunner.CALL];
            const handle = this.api[method];
            if (handle)
                handle(...args);
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

        }
    }
}

EffectRunner.CALL = Symbol('EffectRunner/CALL');

module.exports = EffectRunner;
