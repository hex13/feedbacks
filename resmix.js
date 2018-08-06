'use strict';
const DEBUG = false;
const debug = console.log.bind(console);

const EFFECTS = Symbol('effects');

const BLUEPRINT = Symbol('blueprint');

const UPDATE = '@@resmix/update';
const UPDATE_ROOT = '@@resmix/updateRoot';
const UPDATE_BLUEPRINT = '@@resmix/updateBlueprint';
const OPEN_CHANNEL = '@@resmix/openChannel';
const symbolObservable = require('symbol-observable').default;
const { get, set } = require('transmutable/get-set');
const { MUTATION } = require('transmutable/symbols');
const { applyPatch } = require('transmutable/transform');
const { isMatch } = require('./matching');
const EffectRunner = require('./effectRunner');
const fx = require('./fx');
const { createEffect, EFFECT, spawn } = fx;
const nop = ()=>{};

const raw = value => ({
    [MUTATION]: {
        value
    }
});

const effectHandlers = {
    spawn(dispatch, getState, action) {
        action.meta = {owner: this.path};
        dispatch(action);
    },
    mount(dispatch, getState, blueprint) {
        const { path } = this;
        dispatch({
            type: UPDATE_BLUEPRINT,
            payload: {
                path,
                blueprint
            }
        });
        const { initialState } = resolveInitialState(blueprint);
        if (initialState != undefined) dispatch({
            type: UPDATE,
            payload: {
                name: path,
                value: initialState,
            }
        })
    },
    load(dispatch, getState, params) {
        return this.loader(params, getState());
    },
    effect(dispatch, getState, effect) {
        const pairs =  this.customEffectHandlers;
        for (let i = 0; i < pairs.length; i++) {
            const [pattern, run] = pairs[i];

            if (isMatch(pattern, effect)) {
                return run(dispatch, getState, effect);
            }
        }
    }
};



class State {
    constructor(state, trees) {
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
    if (result[EFFECT]) {
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
            smartState = new State(state);
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

            if (field instanceof Recipe) {
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

class Recipe {
    constructor(recipe) {
        if (recipe) {
            Object.assign(this, recipe);
        }
    }
    init(value) {
        const recipe = new Recipe(this);
        recipe.initialState = value;
        recipe.hasInitialState = true;
        return recipe;
    }
    // return new Recipe object with given pattern and data
    on(...args) {
        return this.match(...args);
    }
    match(...args) {
        const recipe = new Recipe(this);
        recipe.hasMatchPairs = true;

        if (args.length == 2) {
            recipe.pairs = (recipe.pairs || []).concat([args]);
        } else {
            const pairs = args[0];
            recipe.pairs = pairs;
        }
        return recipe;
    }
    // executes pattern-matching and runs callback
    doMatch(action, onMatch) {
        let matched = false;
        const pairs = this.pairs;
        
        if (pairs) for (let i = 0; i < pairs.length; i++) {
            let [pattern, reducer] = pairs[i];
            if (matched)
                return;
            let equal = isMatch(pattern, action);
            if (equal) {
                onMatch(reducer);
                matched = true;
            }
        } else console.log("####^", this);

        function search(node) {
            if (node instanceof Recipe) {
                node.doMatch(action, onMatch);
                return;
            }
            if (!isPlainValue(node)) for (let k in node) {
                search(node[k])
            }
        }
        if (this.hasInitialState) {
         //   search(this.initialState)
        }
    }
    itemsLike(itemBlueprint, mapActionToKey) {
        const recipe = new Recipe(this);
        recipe.itemBlueprint = itemBlueprint;
        recipe.mapActionToKey = mapActionToKey;
        return recipe;
    }
};

exports.match = (...args) => {
    return new Recipe().match(...args);
};

exports.on = (...args) => {
    return new Recipe().match(...args);
};


exports.init = (value) => {
    return new Recipe().init(value);
};


exports.Resmix = (blueprint, { loader } = {} ) => {
    const channels = {};

    let _store;
    let customEffectHandlers = [];
    const middleware = store => next => {
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
        const update = (path, value) => {
            if (!(path instanceof Array)) {
                path = [path];
            }
            next({type: UPDATE, payload: {
                name: path, value
            }});
        };

        next({
            type: UPDATE_BLUEPRINT,
            payload: {
                blueprint
            }
        });

        const { initialState, observables } = resolveInitialState(blueprint);
        next({type: UPDATE_ROOT, payload: initialState});

        observables.forEach(({observable, path}) => {
            observable.subscribe(value => {
                update(path, value);
            });
        })

        
    
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
                        const updateProperty = update.bind(null, path);
                        effectRunner.run(node[EFFECT], updateProperty, { path, loader, customEffectHandlers });
                    } else {
                        for (let k in node) {
                            visitNode(node[k], path.concat(k));
                        }
                    }
                }
                visitNode(effectPatch, []);

            }
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
        }
    }
};

function isPlainValue(desc) {
    const t = typeof desc;
    return !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
}

function resolveInitialState(blueprint) {
    const observables = [];
    const visitProperty = (desc, setValue, path = []) => {
        const t = typeof desc;
        const isPlainValue = !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
        if (isPlainValue) {
            setValue(desc);
            return;
        }
        if (desc instanceof Recipe) {
            if (desc.hasInitialState)
                setValue(resolveInitialState(desc.initialState).initialState);
            return;
        }
        const toObservable = desc && desc[symbolObservable];

        if (toObservable) {
            const observable = toObservable.call(desc);
            // observable.subscribe(value => {
            //     setValue(value);
            // });
            observables.push({
                path,
                observable
            })
            return;
        }
        if (desc && typeof desc == 'object') {

            let computedCurrentObjectValue = {};
            Object.keys(desc).forEach(function goDeeper(k) {
                visitProperty(desc[k], (v) => {
                    computedCurrentObjectValue[k] = v;
                }, path.concat(k));
            });
            setValue(computedCurrentObjectValue);
            return;
        }
    };
    let initialState;
    visitProperty(blueprint, (v) => {
        initialState = v;
    });

    return { initialState, observables } ;
}


exports.OPEN_CHANNEL = OPEN_CHANNEL;

// TODO remove indirections 
// now there are 5 ways to create an engine. This is serious WTF

exports.createEngine = (blueprint, ...rest) => {
    const finalBlueprint = (
        typeof blueprint == 'function'? 
        blueprint({
            init: exports.init
        }) : blueprint
    );
    return exports.Resmix(finalBlueprint, ...rest);
}

function createEngine(Redux, blueprint, ...rest) {
    const engine = exports.createEngine(blueprint, ...rest);
    const store = Redux.createStore(engine.reducer, Redux.applyMiddleware(engine.middleware));
    store.dispatch({type: '@@feedbacks/store', payload: store});
    return engine;

}

exports.withRedux = (Redux) => ({
    createStore(blueprint) {
        const engine = createEngine(Redux, blueprint);
        return engine.getStore();
    },
    createEngine: createEngine.bind(null, Redux)
});

const creators = require('./creators.js');
exports.defineAction = creators.defineAction;
exports.defineEffect = creators.defineEffect;