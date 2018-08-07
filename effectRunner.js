'use strict';

const { isMatch } = require('./matching');
const symbolObservable = require('symbol-observable').default;

const nop = () => {};

class EffectRunner {
    constructor(api) {
        this.api = api;
        this.waitingList = [];
    }
    run(effect, cb, ctx = {path: []}, params = []) {
        // console.log("run", effect, params)
        const emitValue = (v) => {
            cb({value: v, path: ctx.path});
        };
        if (!cb) cb = nop;
        if (!effect) {
            // if (effect !== undefined)
            emitValue(effect);
        } else if (effect[EffectRunner.WAIT_FOR]) {
            const { pattern, mapper } = effect[EffectRunner.WAIT_FOR];
            this.waitingList.push({ pattern, resolve: cb, mapper, path: ctx.path });
        } else if (effect[EffectRunner.EFFECT]) {
            this.run(effect[EffectRunner.EFFECT], cb, ctx, params);
        } else if (effect.$$iterator) {
            const iter = effect.$$iterator;
            let lastResult;
            const iterate = () => {
                let iterResult = iter.next();
                if (!iterResult.done) {
                    this.run(iterResult.value, (result) => {
                        cb(result);
                        lastResult = result;
                        iterate();
                    }, ctx, [lastResult && lastResult.value]);
                }
            };
            iterate();
        } else if (effect[EffectRunner.FLOW]) {
            const flow = effect[EffectRunner.FLOW];
            const iter = flow[Symbol.iterator]();
            this.run({$$iterator: iter}, cb, ctx);
        } else if (effect[EffectRunner.CALL]) {
            const [method, ...args] = effect[EffectRunner.CALL];
            const handle = typeof method == 'function'? method : this.api[method];
            if (handle) {
                const callResult  = handle.apply(ctx, args);
                if (callResult !== undefined) {
                    this.run(callResult, cb, ctx);
                }
            }
            else throw new Error(`EffectRunner: couldn't find method '${method}'`);
        } else if (typeof effect[symbolObservable] == 'function') {
            effect[symbolObservable]().subscribe({
                next: (v) => {
                    this.run(v, cb, ctx)
                },
                complete: () => {
                    
                }
            });
        } else if (typeof effect == 'function') {
            this.run(effect(...params), cb, ctx);
        } else if (typeof effect.then == 'function') {
            effect.then(v => {
                this.run(v, cb, ctx);
            });

        } else {
            emitValue(effect)
        }
    }
    notify(action) {
        const items = this.waitingList;

        for (let i = items.length - 1; i >= 0; i--) {
            const { pattern, resolve, mapper, path } = items[i];
            if (isMatch(pattern, action)) {
                items.splice(i, 1);
                this.run(mapper(action), resolve, { path });
            }
        }

    }
}

EffectRunner.CALL = Symbol('EffectRunner/CALL');
EffectRunner.WAIT_FOR = Symbol('EffectRunner/WAIT_FOR');
EffectRunner.FLOW = Symbol('EffectRunner/FLOW');
EffectRunner.EFFECT = Symbol('effect');

module.exports = EffectRunner;
