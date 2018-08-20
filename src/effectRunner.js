'use strict';

const { isMatch } = require('./matching');
const symbolObservable = require('symbol-observable').default;
const Formula = require('./formula');
const { set } = require('transmutable/lib/get-set');

const nop = () => {};

const isObject = v => v && typeof v == 'object';

const isPlainObject = v => (
    isObject(v) 
    && typeof v.then != 'function'
    && !(v instanceof Formula)
    && !v[symbolObservable]
)

const isGenerator = v => v && typeof v.next == 'function';

const isObservable = v => v && typeof v[symbolObservable] == 'function';

const isVoidValue = v => v === undefined;

class EffectRunner {
    constructor(api) {
        this.api = api;
        this.waitingList = [];
    }
    run(effect, cb, ctx = {path: []}, params = []) {
        // console.log("run", effect, params)
        let result;
        const emitValue = (v, path = ctx.path) => {

            result = {value: v, path };
            cb(result);
            return result;
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
        } else if (isGenerator(effect)) {
            let cancelled = false;
            const iterate = (lastResult) => {
                if (cancelled) return;
                let iterResult = effect.next(lastResult && lastResult.value);
                if (!iterResult.done) {
                    this.run(iterResult.value, iterate, ctx, [lastResult && lastResult.value]);
                } else {
                    if (!isVoidValue(iterResult.value))
                        this.run(iterResult.value, cb, ctx)
                }
            };
            iterate();
            return {
                cancel() {
                    cancelled = true;
                },
                kind: 'generator'
            }
        } else if (effect.$$iterator) {
            const iter = effect.$$iterator;
            const iterate = (lastResult) => {
                let iterResult = iter.next();
                if (!iterResult.done) {
                    this.run(iterResult.value, (result) => {
                        cb(result);
                        iterate(result);
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
            const subscription = effect[symbolObservable]().subscribe({
                next: (v) => {
                    this.run(v, cb, ctx)
                },
                complete: () => {
                    
                }
            });
            return {
                cancel() {
                    subscription.unsubscribe();
                },
                kind: 'observable'
            }
        } else if (typeof effect == 'function') {
            return this.run(effect(...params), cb, ctx);
        } else if (typeof effect.then == 'function') {
            effect.then(v => {
                this.run(v, cb, ctx);
            });
        } else if (typeof effect == 'object' && EffectRunner.RECURSIVE in effect) {
            const obj = effect[EffectRunner.RECURSIVE];
            
    
            if (!isObject(obj))
                return this.run(obj, cb, ctx);  

                const resultTree = {};

            const visit = (effectNode, path) => {
                let handled = false;
                const resolvingResult = this.run(effectNode, v => {
                    if (isObservable(effectNode)) {
                        setTimeout(() => {
                            cb(v);
                        }, 0);   
                    }
                }, { path });
                const value = resolvingResult && resolvingResult.value;

                if (isPlainObject(value)) {
                    for (let k in value) {
                        visit(value[k], path.concat(k));
                    }
                } else {
                    const val = resolvingResult && resolvingResult.value;
                    set(resultTree, path, val);
                }
            };
            visit(obj, []);

            return emitValue(resultTree);

        } else if (effect instanceof Formula) {

            const result = this.run({[EffectRunner.RECURSIVE]: effect.initialState}, cb);
            return result;            
        } else {
            emitValue(effect)
        }
        return result;
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
EffectRunner.RECURSIVE = Symbol('EffectRunner/RECURSIVE');


module.exports = EffectRunner;
