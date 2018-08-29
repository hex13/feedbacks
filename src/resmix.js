'use strict';
const debug = console.log.bind(console);

const creators = require('./creators.js');

const { UPDATE_BLUEPRINT, UPDATE, UPDATE_ROOT, EFFECTS } = require('./constants');
const OPEN_CHANNEL = '@@feedbacks/openChannel';
const { get, set } = require('transmutable/lib/get-set');

const EffectRunner = require('./effectRunner');
const Formula = require('./formula');
const fx = require('./fx');
const { EFFECT } = fx;
const resolveInitialState = require('./resolveInitialState');
const nop = ()=>{};

// we can't just join('.') because properties with dots "."  in keys would be confused with nesting
// e.g. ["foo.bar", "baz"] vs. ["foo", "bar", "baz"]
const SEP = '.$SEP$' + Math.random() + '##';
const samePaths = (a, b) => {
    return a.join(SEP) === b.join(SEP);
}

const effectHandlers = require('./effectHandlers');

const { reducerFor } = require('./reducer');


exports.on = (...args) => {
    return new Formula().on(...args);
};


exports.init = (value) => {
    return new Formula().init(value);
};


function createEngine(blueprint, opts = {} ) {
    const channels = {};
    const ongoingEffects = [];

    let _store;
    let customEffectHandlers = [];
    let _effectRunner;

    const createContext = (params) => {
        const ctx = {
            customEffectHandlers,
        };
        for (let k in params) {
            ctx[k] = params[k];
        }
        return ctx;
    };
    const middleware = store => next => {
        let permanentEffects = [];
        let afterUpdatePerforming = false;
        let effectProcessing = false;
        let lastState;
        function performAfterUpdate() {
                if (effectProcessing) return;
                const state = store.getState();
                if (afterUpdatePerforming) return;
                afterUpdatePerforming = true;
                permanentEffects.forEach(({ effect, path, cause, context }) => {

                    if (context.deps) {
                        let isChange = false;
                        for (let i = 0; i < context.deps.length; i++) {
                            const depPath = context.deps[i];
                            if (get(lastState, depPath) !== get(state, depPath)) {
                                isChange = true;
                                break;
                            }
                        }
                        if (!isChange) return;
                    }
                    effectRunner.run(effect, (result) => {
                        update(result.path, result.value, false, {cause: {type: cause.type}})
                    }, context);
                });
                afterUpdatePerforming = false;
        }

        _store = store;

        const finalEffectHandlers = {};
        for (let k in effectHandlers) {
            finalEffectHandlers[k] = function (...args) {
                return effectHandlers[k].call(this, store.dispatch, store.getState, ...args);
            };
        }

        const effectRunner = new EffectRunner(finalEffectHandlers);
        _effectRunner = effectRunner;
        if (!store || !store.getState) {
            throw new Error(`Resmix: middleware hasn't received a store. Ensure to use applyMiddleware during passing middleware to createStore`);
        }
        const update = (path, value, shouldPerformAfterUpdate = true, meta) => {
            if (value === undefined) return;
            if (!(path instanceof Array)) {
                path = [path];
            }

            effectRunner.run(value, ({ value }) => {
                const action = {type: UPDATE,
                    payload: {
                        name: path, value,
                    },
                };
                action.meta = meta;
                next(action);
            });

            if (shouldPerformAfterUpdate) performAfterUpdate();
        };

        next({
            type: UPDATE_BLUEPRINT,
            payload: {
                blueprint
            }
        });

        const { initialState, observables } = resolveInitialState(blueprint, effectRunner);
        
        const blueprintResult = effectRunner.run({[EffectRunner.RECURSIVE]: blueprint}, (result) => {
            //if (result.path.length)
                update(result.path, result.value, undefined, {cause:{ type:'initialization'}});
        });
        // console.log("A======", result1.value);
        // console.log("B======", initialState);
        //require('assert').deepEqual(result1.value, initialState);

        
        next({type: UPDATE_ROOT, payload: initialState});

        
        return action => {
            lastState = store.getState();
            effectRunner.notify(action);

            if (action.meta && action.meta.feedbacks && action.meta.feedbacks.isEffect) {
                effectRunner.run(fx.effect(action), null, createContext());
                return;
            }
            if (action.type == '@@feedbacks/store') {
                _store = action.payload;
                return;
            }
            if (action.type == OPEN_CHANNEL) {
                channels[action.payload.id] = (value) => {
                    update(action.payload.property, value);
                }
            }
            next(action);
            const state = store.getState();
            const effects = state[EFFECTS];

            effectProcessing = true;
            if (effects) {
                const effectPatch = effects;
                function visitNode(node, path) {
                    if (node[EFFECT]) {
                        const effect = node[EFFECT];
                        if (effect[EFFECT] && effect.permanent) {
                            permanentEffects = permanentEffects.filter(({path: ePath}) => path.join('.') != ePath.join('.') );
                            permanentEffects.push({
                                path, effect: effect[EFFECT], cause: action, context: createContext({ path, update })
                            })
                            return;
                        }

                        for (let i = ongoingEffects.length - 1; i >= 0; i--) {
                            const eff = ongoingEffects[i];

                            if (samePaths(eff.path, path)) {
                                eff.cancel && eff.cancel();
                                ongoingEffects.splice(i, 1);
                            }
                        }
                        const meta = {
                            cause: {
                                type: action.type
                            }
                        }
                        const updateAt = v => update(path, v, undefined, meta);

                        const ongoingEffect = effectRunner.run(effect[EFFECT] || effect, (result) => {
                            update(result.path, result.value, undefined, meta)
                        }, createContext({ 
                            path, 
                            update, 
                            next: updateAt,
                            params: [
                                updateAt, 
                                () => get(store.getState(), path),
                                {
                                    waitFor(pattern) {
                                        return new Promise(resolve => {

                                            effectRunner.run(fx.waitFor(pattern,x=>x), (result) => {
                                                resolve(result.value);
                                            })    
                                          
                                        })
                                    }
                                }
                            ]
                        }));
                        if (ongoingEffect) {
                            ongoingEffects.push(Object.assign({ id: Math.random(), path}, ongoingEffect));
                        }
                    } else {
                        for (let k in node) {
                            visitNode(node[k], path.concat(k));
                        }
                    }
                }
                visitNode(effectPatch, []);

            }
            effectProcessing = false;
            performAfterUpdate();

        }    
    }
    return {
        middleware,
        reducer: reducerFor(),
        channels,
        getStore() {
            return _store;
        },
        onEffect(pattern, runEffect) {
            customEffectHandlers.push([pattern, runEffect]);
            return this;
        },
        getOngoingEffects() {
            return ongoingEffects;
        },
        runEffect(...args) {
            return _effectRunner.run(...args);
        }
    }
};

function isPlainValue(desc) {
    const t = typeof desc;
    return !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
}

exports.OPEN_CHANNEL = OPEN_CHANNEL;

exports.createEngine = createEngine;

exports.withRedux = (Redux) => ({
    createEngine(blueprint, ...rest) {
        const engine = createEngine(blueprint, ...rest);
        const store = Redux.createStore(engine.reducer, Redux.applyMiddleware(engine.middleware));
        store.dispatch({type: '@@feedbacks/store', payload: store});
        return engine;    
    }
});

exports.defineAction = creators.defineAction;
exports.defineEffect = creators.defineEffect;


exports.createFeedbacks = (params = {}) => (createStore) => {
    function _createStore(blueprint) {
        const engine = createEngine(blueprint);
        const store = createStore(engine.reducer);
        if (params.effects) {
            params.effects.forEach(([pattern, handler]) => {
                engine.onEffect(pattern, handler);
            })
        }

        return Object.assign({}, store, {
            dispatch: engine.middleware(store)(store.dispatch),
            engine,
        });
    };
    return _createStore;
};

exports.Collection = require('./collection');