'use strict';

const EFFECTS = Symbol('effects');
const EFFECT = Symbol('effect');
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

function Cursor(trees, path = [], root) {
    if (!root) root = trees;
    return {
        // get() { return trees; },
        set(treeName, value) {
            trees[treeName][k];
        },
        setMetadata(kind, value) {
            set(root[kind], path, value);
            //
            //trees[kind] = 
        },
        select(k) {
            const newTrees = {};
            for (let name in trees) {
                const tree = trees[name];
                newTrees[name] = tree[k] || (tree[k] = {});
            }
            return new Cursor(newTrees, path.concat(k), root);
        },
        // path: () => [path, trees, root]
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
        if (action.type == UPDATE_BLUEPRINT) {

            // function resolveBlueprint(blueprint) {
            //     if (isPlainValue(blueprint)) return blueprint;
            //     const o = {};
            //     if (blueprint instanceof Recipe) {
            //         if (blueprint.initialState && typeof initialState == 'object') {
            //             blueprint.initialState = resolveBlueprint(blueprint.initialState);
            //         }
            //         return blueprint;
            //     }
            //     for (let k in blueprint) {
            //         o[k] = resolveBlueprint(blueprint[k]);
            //     }
            //     return o; 
            //     if (blueprint.hasInitialState) {
            //     } else {

            //     }
            // }
            //const blueprint = resolveBlueprint(action.payload.blueprint);
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

        const checkMatchAndHandleAction = (parent, k, state, cursor) => {
            const field = parent[k];

            if (field instanceof Recipe) {
                field.doMatch(action, (reducer) => {

                    const reducerResult = reducer(state && state[k], action);
                    const output = mapReducerResultToEffectOrUpdate(reducerResult, action)
                    cursor.setMetadata('updates', output.update);
                    if (output.effect) cursor.setMetadata('effects', output.effect);
                });
                if (field.initialState && typeof field.initialState == 'object') {

                    for (let key in field.initialState) {

                        checkMatchAndHandleAction(field.initialState, key, state && state[k] && state[k][key], cursor && cursor.select(key));
                    }
    
                }
            } else {
                if (field && !field[symbolObservable] && typeof field == 'object') {
                    for (let key in field) {
                        checkMatchAndHandleAction(field, key, state && state[k], cursor && cursor.select(key));
                    }
                }
            }
        };


        const cursor = new Cursor({updates, effects});
        if (state && action.meta && action.meta.feedbacks && action.meta.feedbacks.path) {
            const path = action.meta.feedbacks.path;
            const key = path[path.length - 1];
            const p = path.slice(0, -1);
            
            let namespacedUpdates = get(updates, p);
            if (!namespacedUpdates) {
                set(updates, p, {});
                namespacedUpdates = get(updates, p);
            }
            const cursor = new Cursor({updates: namespacedUpdates, effects});
            checkMatchAndHandleAction(get(blueprint, path.slice(0, -1)), key, get(state, p), cursor.select(key));
        } else  if (state) for (let key in blueprint) {
            checkMatchAndHandleAction(blueprint, key, state, cursor.select(key));
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

function isPlainValue(desc) {
    const t = typeof desc;
    return !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
}

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
                setValue(resolveInitialState(desc.initialState));
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

const spawn = exports.spawn = (action) => {
    return {[EFFECT]: { [EffectRunner.CALL]: ['dispatch', action] }};    
};


exports.mount = (blueprint) => {
    return createEffect({[EffectRunner.CALL]: ['mount', blueprint]});
};