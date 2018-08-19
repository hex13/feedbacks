'use strict';
const DEBUG = false;
const debug = console.log.bind(console);

const EFFECTS = Symbol('effects');
const creators = require('./creators.js');
const BLUEPRINT = Symbol('blueprint');
const UPDATE_ROOT = '@@resmix/updateRoot';
const { UPDATE_BLUEPRINT, UPDATE } = require('./constants');
const OPEN_CHANNEL = '@@resmix/openChannel';
const symbolObservable = require('symbol-observable').default;
const { get, set } = require('transmutable/get-set');
const { MUTATION } = require('transmutable/symbols');
const { applyPatch } = require('transmutable/transform');
const EffectRunner = require('./effectRunner');
const Formula = require('./formula');
const fx = require('./fx');
const { createEffect, EFFECT, spawn } = fx;
const resolveInitialState = require('./resolveInitialState');
const nop = ()=>{};
// const { Graph } = require('transmutable/src/normalization/graph');
// console.log(Graph);
const raw = value => ({
    [MUTATION]: {
        value
    }
});

// we can't just join('.') because properties with dots "."  in keys would be confused with nesting
// e.g. ["foo.bar", "baz"] vs. ["foo", "bar", "baz"]
const SEP = '.$SEP$' + Math.random() + '##';
const samePaths = (a, b) => {
    return a.join(SEP) === b.join(SEP);
}

const effectHandlers = require('./effectHandlers');


class State {
    constructor(state, normalized) {
        this._state = state;
        this._trees = {updates:{}, effects:{}};
    }
    getCursor() {
        return new Cursor(this._trees, this._state, []);
    }
    commit() {
        const newState = applyPatch(this._state || {}, this._trees.updates);
        newState[EFFECTS] = this._trees.effects;
        newState[SMART_STATE] = this;
        this._newState = newState;

        return newState;
    }
    set(path, value) {
        if (!path.length) {
            this._state = Object.assign({}, this._state, value);
        } else 
            set(this._trees.updates, path, {
                [MUTATION]: {
                    value
                }
            });
    }
    clean() {
        return new State(this._newState);
    }
}

function Cursor(metadata, state, path = []) {
    return {
        get() {
            return get(state, path);
        },
        // set(value) {
        //     set(state, path, value);
        // },
        // getMetadata(kind) {
        //     return get(metadata[kind], path);
        // },
        setMetadata(kind, value) {
            set(metadata[kind], path, value);
        },
        select(k) {
            return new Cursor(metadata, state, path.concat(k));
        },
    }
}

function mapReducerResultToEffectOrUpdate(result, causingAction) {
    const output = {};
    if (result === undefined) {
        // this is for preventing running code in `else` blocks
        // `undefined` in Feedbacks means: don't change a property value
        // so nothing more to do
    } else if (result === null) {
        output.update = raw(result);
    } else if (result[EFFECT]) {
        output.effect = result;
    } else if (typeof result == 'function'
        || (result && typeof result[symbolObservable] == 'function')
    )
    {
        output.effect = createEffect(result);
    } else if (typeof result.next == 'function') {
        let yielded, lastYielded;
        do {
            lastYielded = yielded;
            yielded = result.next();
        } while (!yielded.done);
        if (causingAction.meta && causingAction.meta.owner) {
            output.effect = spawn({
                type: UPDATE,
                payload: {
                    name: [].concat(causingAction.meta.owner), value: lastYielded.value
                },
            });
        }
        output.update = raw(yielded.value);
    } else {
        output.update = raw(result);
    }
    return output;
}

const SMART_STATE = Symbol('SmartState');
const reducerFor = () => {
    return (state, action) => {
        if (DEBUG) debug('action', action);
        let smartState;
        if (state && state[SMART_STATE]) {
            smartState = state[SMART_STATE].clean();
        } else {
            smartState = new State(state, false);
        }
        let isSpecialAction = true;
        if (action.type == UPDATE_BLUEPRINT) {
            const finalPath = action.payload.path? [BLUEPRINT].concat(action.payload.path) : [BLUEPRINT];
            smartState.set(finalPath, action.payload.blueprint);
            return smartState.commit();
        }
        else if (action.type == UPDATE) {
            smartState.set(action.payload.name, action.payload.value);
        }
        else if (action.type == UPDATE_ROOT) {
            smartState.set([], action.payload);
            return smartState.commit();
        } else isSpecialAction = false;
        
        
        const blueprint = state && state[BLUEPRINT]? state[BLUEPRINT] : {}; 

        const checkMatchAndHandleAction = (parent, k, cursor) => {
            const field = parent[k];

            if (field instanceof Formula) {
                field.doMatch(action, (reducer) => {

                    const reducerResult = reducer(cursor.get(), action);
                    const output = mapReducerResultToEffectOrUpdate(reducerResult, action)
                    cursor.setMetadata('updates', output.update);
                    if (output.effect) cursor.setMetadata('effects', output.effect);
                });
                if (field.itemBlueprint) {
                    const itemKey = field.mapActionToKey(action);
                    checkMatchAndHandleAction(field, 'itemBlueprint', cursor && cursor.select(itemKey));
                }
                if (field.initialState && typeof field.initialState == 'object') {

                    for (let key in field.initialState) {
                        checkMatchAndHandleAction(field.initialState, key, cursor && cursor.select(key));
                    }
    
                }
            } else {
                if (field && !field[symbolObservable] && typeof field == 'object') {
                    for (let key in field) {
                        checkMatchAndHandleAction(field, key, cursor && cursor.select(key));
                    }
                }
            }
        };

        const cursor = smartState.getCursor();
        if (!isSpecialAction) {
            if (state && action.meta && action.meta.feedbacks && action.meta.feedbacks.path) {
                const path = action.meta.feedbacks.path;
                const key = path[path.length - 1];
                checkMatchAndHandleAction(get(blueprint, path.slice(0, -1)), key, cursor.select(path));
            } else  if (state) for (let key in blueprint) {
                checkMatchAndHandleAction(blueprint, key, cursor.select(key));
            }
    
        }

        const newState = smartState.commit();
        return newState;
    };
};


exports.match = (...args) => {
    return new Formula().match(...args);
};

exports.on = (...args) => {
    return new Formula().match(...args);
};


exports.init = (value) => {
    return new Formula().init(value);
};


function createEngine(blueprint, { loader } = {} ) {
    const channels = {};
    const ongoingEffects = [];

    let _store;
    let customEffectHandlers = [];
    const middleware = store => next => {
        let permanentEffects = [];
        let afterUpdatePerforming = 0;
        function performAfterUpdate() {
                permanentEffects.forEach(({ effect, path}) => {
                    effectRunner.run(effect, (result) => {
                        update(result.path, result.value, false)
                    }, { path, loader, customEffectHandlers });
                });
        }

        _store = store;

        const finalEffectHandlers = {};
        for (let k in effectHandlers) {
            finalEffectHandlers[k] = function (...args) {
                return effectHandlers[k].call(this, store.dispatch, store.getState, ...args);
            };
        }

        const effectRunner = new EffectRunner(finalEffectHandlers);
        if (!store || !store.getState) {
            throw new Error(`Resmix: middleware hasn't received a store. Ensure to use applyMiddleware during passing middleware to createStore`);
        }
        const update = (path, value, shouldPerformAfterUpdate = true) => {
            if (!(path instanceof Array)) {
                path = [path];
            }
            next({type: UPDATE, payload: {
                name: path, value
            }});
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
                update(result.path, result.value);
        });
        // console.log("A======", result1.value);
        // console.log("B======", initialState);
        //require('assert').deepEqual(result1.value, initialState);

        
        next({type: UPDATE_ROOT, payload: initialState});

        
        return action => {
            effectRunner.notify(action);

            if (action.meta && action.meta.feedbacks && action.meta.feedbacks.isEffect) {
                effectRunner.run(fx.effect(action), null, { loader, customEffectHandlers });
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

            if (effects) {
                const effectPatch = effects;
                function visitNode(node, path) {
                    if (node[EFFECT]) {
                        const effect = node[EFFECT];
                        if (effect[EFFECT] && effect.permanent) {
                            permanentEffects = permanentEffects.filter(({path: ePath}) => path.join('.') != ePath.join('.') );
                            permanentEffects.push({
                                path, effect: effect[EFFECT]
                            })
                            return;
                        }

                        for (let i = ongoingEffects.length - 1; i >= 0; i--) {
                            const eff = ongoingEffects[i];

                            if (samePaths(eff.path, path)) {
                                eff.cancel();
                                ongoingEffects.splice(i, 1);
                            }
                        }
                        const ongoingEffect = effectRunner.run(effect[EFFECT] || effect, (result) => {
                            update(result.path, result.value)
                        }, { path, loader, customEffectHandlers });
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
            performAfterUpdate();

        }    
    }
    return {
        middleware,
        reducer: reducerFor(),
        channels,
        loader(doLoad) {
            loader = doLoad;
        },
        getStore() {
            return _store;
        },
        onEffect(pattern, runEffect) {
            customEffectHandlers.push([pattern, runEffect]);
            return this;
        },
        getOngoingEffects() {
            return ongoingEffects;
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


exports.feedbacksEnhancer = (createStore) => {
    return (blueprint) => {
        const engine = createEngine(blueprint);
        const store = createStore(engine.reducer);

        return Object.assign({}, store, {
            dispatch: engine.middleware(store)(store.dispatch)
        });
    };
}