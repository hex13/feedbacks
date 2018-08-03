'use strict';

const symbolObservable = require('symbol-observable').default;

const nop = () => {};

class EffectRunner {
    constructor(api) {
        this.api = api;
    }
    // TODO make run recursive
    run(effect, cb, ctx, params = []) {
        if (!cb) cb = nop;
        if (!effect) {
            // if (effect !== undefined)
                cb(effect);
        } else if (effect[EffectRunner.FLOW]) {
            const flow = effect[EffectRunner.FLOW];
            let last = Promise.resolve();
            flow.forEach(item => {
                last = last.then((value) => {
                    return new Promise(resolve => {
                        this.run(item, (v)=> {
                            cb(v);
                            resolve(v)
                        }, null, [value]);
                    });
                });

            })
        } else if (effect[EffectRunner.CALL]) {
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
            effect[symbolObservable]().subscribe({
                next: (v) => {
                    console.log("$I$$I$I$I O OOOO", v)
                    cb(v);
                },
                complete: () => {
                    
                }
            });
        } else if (typeof effect == 'function') {
            const result = effect(...params);
            if (result) {
                if (typeof result.then == 'function') {
                    result.then(cb);
                } else {
                    this.run(result, cb);
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
EffectRunner.FLOW = Symbol('EffectRunner/FLOW');

module.exports = EffectRunner;
