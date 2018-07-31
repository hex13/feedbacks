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

const EffectRunner = require('./effectRunner');
const { createEffect, EFFECT, spawn } = require('./fx');
const nop = ()=>{};

const raw = value => ({
    [MUTATION]: {
        value
    }
});

class State {
    constructor(state, trees) {
        this._state = state;
        this._trees = trees;
    }
    getCursor() {
        return new Cursor(this._trees, this._state, []);
    }
    commit() {
        const newState = applyPatch(this._state || {}, this._trees.updates);
        newState[EFFECTS] = this._trees.effects;
        return newState;
    }
    set(path, value) {
        set(this._trees.updates, path, {
            [MUTATION]: {
                value
            }
        });
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

const reducerFor = () => {
    return (state, action) => {
        if (DEBUG) debug('action', action);
        let updates = {};
        let effects = {};
        const smartState = new State(state, {updates, effects});
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
            return Object.assign({}, state, action.payload);
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
                const p = path.slice(0, -1);
                
                let namespacedUpdates = get(updates, p);
                if (!namespacedUpdates) {
                    set(updates, p, {});
                    namespacedUpdates = get(updates, p);
                }
                const cursor = new Cursor({updates: namespacedUpdates, effects}, get(state, p), []);
                checkMatchAndHandleAction(get(blueprint, path.slice(0, -1)), key, cursor.select(key));
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
            let equal = actionMatchesPattern(pattern, action);
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


exports.Resmix = (blueprint) => {
    const channels = {};
    let loader;
    const middleware = store => next => {
        const effectRunner = new EffectRunner({
            dispatch(action) {
                action.meta = {owner: this.path};
                store.dispatch(action);
            },
            mount(blueprint) {
                const { path } = this;
                store.dispatch({
                    type: UPDATE_BLUEPRINT,
                    payload: {
                        path,
                        blueprint
                    }
                });
                const { initialState } = resolveInitialState(blueprint);
                if (initialState != undefined) store.dispatch({
                    type: UPDATE,
                    payload: {
                        name: path,
                        value: initialState,
                    }
                })
            },
            load(params) {
                return loader(params, store.getState());
            }
        });
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
                        effectRunner.run(node[EFFECT], updateProperty, { path });
                    } else {
                        for (let k in node) {
                            visitNode(node[k], path.concat(k));
                        }
                    }
                }
                visitNode(effectPatch, []);

            }
        }    
    };
    return {
        middleware,
        reducer: reducerFor(),
        channels,
        loader(doLoad) {
            loader = doLoad;
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

function actionMatchesPattern(pattern, action) {
    let equal = true;
    if (typeof pattern == 'string') return pattern == action.type;
    if (typeof pattern == 'object' && typeof action == 'object') {
        for (let patternKey in pattern) {
        //Object.keys(pattern).forEach(patternKey => {
            // TODO optimize. forEach is sub-optimal because it goes on even after we know that there is no match.
            if (action[patternKey] == undefined) {
                equal = false;
            } else if (typeof pattern[patternKey] == 'function') {
                equal = equal && pattern[patternKey](action[patternKey]);
            }
            else if (pattern[patternKey] && typeof pattern[patternKey] == 'object') {
                equal = equal && actionMatchesPattern(pattern[patternKey], action[patternKey]);
            }
            else {
                equal = equal && pattern[patternKey] == action[patternKey];
            }
            if (!equal) return false;
        }
    } else
        return pattern === action;
    return equal;
};

exports.OPEN_CHANNEL = OPEN_CHANNEL;

exports.createEngine = (blueprint) => {
    const finalBlueprint = (
        typeof blueprint == 'function'? 
        blueprint({
            init: exports.init
        }) : blueprint
    );
    return exports.Resmix(finalBlueprint);
}


exports.withRedux = (Redux) => ({
    createStore(blueprint) {
        const engine = exports.createEngine(blueprint);
        return Redux.createStore(engine.reducer, Redux.applyMiddleware(engine.middleware))
    }
});

exports.ac = require('./ac');