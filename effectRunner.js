'use strict';

const { isMatch } = require('./matching');
const symbolObservable = require('symbol-observable').default;

const nop = () => {};

class EffectRunner {
    constructor(api) {
        this.api = api;
        this.waitingList = [];
    }
    // TODO make run recursive
    run(effect, cb, ctx, params = []) {
        if (!cb) cb = nop;
        if (!effect) {
            // if (effect !== undefined)
                cb(effect);
        } else if (effect[EffectRunner.WAIT_FOR]) {
            const { pattern, mapper } = effect[EffectRunner.WAIT_FOR];
            this.waitingList.push({ pattern, resolve: cb, mapper });
        } else if (effect[EffectRunner.EFFECT]) {
            this.run(effect[EffectRunner.EFFECT], cb, ctx, params);
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
    notify(action) {
        const items = this.waitingList;

        for (let i = items.length - 1; i >= 0; i--) {
            const { pattern, resolve, mapper } = items[i];
            if (isMatch(pattern, action)) {
                items.splice(i, 1);
                this.run(mapper(action), resolve);
            }
        }

    }
}

EffectRunner.CALL = Symbol('EffectRunner/CALL');
EffectRunner.WAIT_FOR = Symbol('EffectRunner/WAIT_FOR');
EffectRunner.FLOW = Symbol('EffectRunner/FLOW');
EffectRunner.EFFECT = Symbol('effect');

module.exports = EffectRunner;
