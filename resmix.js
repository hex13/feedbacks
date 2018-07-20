'use strict';

const EFFECTS = Symbol('effects');
const SPAWN = Symbol('spawn');
const EFFECT = Symbol('effect');
const MOUNT = Symbol('mount');
const VALUE = Symbol('value');
const BLUEPRINT = Symbol('blueprint');


const UPDATE = '@@resmix/update';
const UPDATE_ROOT = '@@resmix/updateRoot';
const UPDATE_BLUEPRINT = '@@resmix/updateBlueprint';
const OPEN_CHANNEL = '@@resmix/openChannel';
const symbolObservable = require('symbol-observable').default;
const { get, set } = require('transmutable/get-set');
const { MUTATION } = require('transmutable/symbols');
const { applyPatch } = require('transmutable/transform');
const R = require('ramda');
const EffectRunner = require('./effectRunner');
const nop = ()=>{};

const raw = value => ({
    [MUTATION]: {
        value
    }
});

function runPropertyReducer(reducer, state, action) {
    const output = {};
    const result = reducer(state, action);
    if (result[EFFECT]) {
        output.effect = result;
    } else if (typeof result == 'function'
        || (result && typeof result[symbolObservable] == 'function')
    )
    {
        output.effect = {[EFFECT]: result};
    } else if (result[MOUNT]) {
        output.effect =  createEffect({[EffectRunner.CALL]: ['mount', result.value]});
    } else if (result[SPAWN]) {
        output.effect = {[EFFECT]: { [EffectRunner.CALL]: ['dispatch', result.action] }};
    } else if (typeof result.next == 'function') {
        let yielded, lastYielded;
        do {
            lastYielded = yielded;
            yielded = result.next();
        } while (!yielded.done);
        if (action.meta && action.meta.owner) {
            output.effect = {[EFFECT]: { [EffectRunner.CALL]: ['dispatch', {
                    type: UPDATE,
                    payload: {
                        name: [].concat(action.meta.owner), value: lastYielded.value
                    },
                }] }};

        }
        output.update = raw(yielded.value);
    } else {
        output.update = raw(result);
    }
    return output;
}

const reducerFor = () => {
    return (state, action) => {
        if (action.type == UPDATE_BLUEPRINT) {
            if (action.payload.path) {
                return R.assocPath([BLUEPRINT].concat(action.payload.path), action.payload.blueprint, state);    
            }
            return R.assocPath([BLUEPRINT], action.payload.blueprint, state);
        }
        if (action.type == UPDATE) {
            const copy = R.assocPath(action.payload.name, action.payload.value, state);
            copy[BLUEPRINT] = state[BLUEPRINT];
            return copy;
        }
        if (action.type == UPDATE_ROOT) {
            return Object.assign({}, state, action.payload);
        }
        let updates = {};
        let effects = {};
        const blueprint = state && state[BLUEPRINT]? state[BLUEPRINT] : {}; 

        const checkMatchAndHandleAction = (parent, k, updates, path, state, effects) => {

            const field = parent[k];

            if (field instanceof Recipe) {
                field.doMatch(action, (reducer) => {
                    const output = runPropertyReducer(reducer, state[k], action)
                    updates[k] = output.update;
                    if (output.effect) effects[k] = output.effect;
                });
            } else {
                if (field && !field[symbolObservable] && typeof field == 'object') {
                    const deeperUpdates = updates[k] || (updates[k] = {});
                    const deeperEffects = effects[k] || (effects[k] = {});
                    for (let key in field) {
                        checkMatchAndHandleAction(field, key, deeperUpdates, path.concat(key), state && state[k], deeperEffects);
                    }
                }
            }
        };
        if (state && action.meta && action.meta.feedbacks && action.meta.feedbacks.path) {
            const path = action.meta.feedbacks.path;
            const key = path[path.length - 1];
            const p = path.slice(0, -1);
            
            let namespacedUpdates = get(updates, p);
            if (!namespacedUpdates) {
                set(updates, p, {});
                namespacedUpdates = get(updates, p);
            }
            checkMatchAndHandleAction(get(blueprint, path.slice(0, -1)), key, namespacedUpdates, [key], get(state, p), effects);
        } else  if (state) for (let key in blueprint) {
            checkMatchAndHandleAction(blueprint, key, updates, [key], state, effects);
        }

        const newState = applyPatch(state || {}, updates);
        newState[EFFECTS] = effects;
        newState[BLUEPRINT] = blueprint;
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
    // executes pattern-matching and run callback
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
        } else console.log("####", this)
    }
};

exports.match = (...args) => {
    return new Recipe().match(...args);
};

exports.init = (value) => {
    return new Recipe().init(value);
};


exports.Resmix = (blueprint) => {
    const channels = {};
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
                const initialState = resolveInitialState(blueprint);
                if (initialState != undefined) store.dispatch({
                    type: UPDATE,
                    payload: {
                        name: path,
                        value: initialState,
                    }
                })
            },
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

        const initialState = resolveInitialState(blueprint);
        next({type: UPDATE_ROOT, payload: initialState})
    
        return action => {
            if (action.type == OPEN_CHANNEL) {
                channels[action.payload.id] = (value) => {
                    update(action.payload.property, value);
                }
            }
            next(action);
            const state = store.getState();
            const effects = state[EFFECTS];
            //console.log('jakie efekt\n\n\n', effects);
            if (effects) {
                const effectPatch = effects;
                // effects.forEach(({ result, path}) => {
                //     set(effectPatch, path, {[EFFECT]: result});
                // });

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
                //console.log('effectPatch', effectPatch);
            }
        }    
    };
    return {
        middleware,
        reducer: reducerFor(),
        channels,
    }
};


function resolveInitialState(blueprint) {
    const visitProperty = (desc, setValue) => {
        const t = typeof desc;
        const isPlainValue = !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
        if (isPlainValue) {
            setValue(desc);
            return;
        }
        if (desc instanceof Recipe) {
            if (desc.hasInitialState)
                setValue(desc.initialState);
            return;
        }
        const toObservable = desc && desc[symbolObservable];

        if (toObservable) {
            const observable = toObservable.call(desc);
            observable.subscribe(value => {
                setValue(value);
            });
            return;
        }
        if (desc && typeof desc == 'object') {
            let computedCurrentObjectValue = undefined;
            Object.keys(desc).forEach(function goDeeper(k) {
                visitProperty(desc[k], (v) => {
                    computedCurrentObjectValue = computedCurrentObjectValue === undefined? {} :computedCurrentObjectValue;
                    computedCurrentObjectValue[k] = v;
                });
            });
            setValue(computedCurrentObjectValue);
            return;
        }
    };
    let initialState;
    visitProperty(blueprint, (v) => {
        initialState = v;
    });

    return initialState;
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

function createEffect(data) {
    return {
        [EFFECT]: data
    }
}

exports.spawn = (action) => {
    return {
        [SPAWN]: true,
        action
    }
};


exports.mount = (blueprint) => {
    return {
        [MOUNT]: true,
        value: blueprint
    }
};