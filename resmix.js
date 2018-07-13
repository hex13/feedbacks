const EFFECTS = Symbol('effects');
const OBSERVABLES = Symbol('observables');
const SPAWN = Symbol('spawn');
const ACTIONS = Symbol('actions');

const UPDATE = '@@resmix/update';
const UPDATE_ROOT = '@@resmix/updateRoot';
const OPEN_CHANNEL = '@@resmix/openChannel';
const symbolObservable = require('symbol-observable').default;


const reducerFor = (blueprint) => {
    return (state, action) => {
        if (action.type == UPDATE) {
            return Object.assign({}, state, {
                [action.payload.name]: action.payload.value
            });
        }
        if (action.type == UPDATE_ROOT) {
            return Object.assign({}, state, action.payload);
        }
        let updates = {};
        let effects = [];
        let observables = {};
        const actions = [];

        const checkMatchAndHandleAction = (parent, k, updates) => {
            const value = parent[k];
            const pairs = value && value.pairs;
            let matched = false;
            pairs && pairs.forEach(([pattern, reducer]) => {
                if (matched)
                    return;
                if (typeof pattern == 'string')
                    pattern = { type: pattern };
                let equal = actionMatchesPattern(pattern, action);
                if (equal) {
                    const result = reducer(state[k], action);
                    if (typeof result == 'function'
                        || (result && typeof result[symbolObservable] == 'function')) {
                        effects.push([k, result]);
                    }
                    else if (result[SPAWN]) {
                        actions.push({ action: result.action, owner: k });
                    }
                    else if (typeof result.next == 'function') {
                        let yielded, lastYielded;
                        do {
                            lastYielded = yielded;
                            yielded = result.next();
                        } while (!yielded.done);
                        if (action.meta && action.meta.owner) {
                            updates[action.meta.owner] = lastYielded.value;
                        }
                        updates[k] = yielded.value;
                    }
                    else {
                        updates[k] = result;
                    }
                    matched = true;
                }
            });
            if (value && !(value instanceof Recipe) && !value[symbolObservable] && typeof value == 'object') {
                const deeperUpdates = updates[k] || (updates[k] = {});
                for (let key in value) {
                    checkMatchAndHandleAction(value, key, deeperUpdates);
                }
            }
        };

        for (let key in blueprint) {
            checkMatchAndHandleAction(blueprint, key, updates);
        }

        const returnedState = Object.assign({}, state, {[EFFECTS]: effects, [OBSERVABLES]: observables, [ACTIONS]: actions});

        function merge(target, updates) {
            for (let k in updates) {
                const patch = updates[k];
                if (patch && typeof patch == 'object') {
                    merge(target[k] || (target[k] = {}), patch);
                } else
                    target[k] = patch;
            }
        }
        merge(returnedState, updates);
        return returnedState;
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
    match(pairs) {
        const recipe = new Recipe(this);
        recipe.hasMatchPairs = true;
        recipe.pairs = pairs;
        return recipe;
    }
};

exports.match = (pairs) => {
    return new Recipe().match(pairs);
};

exports.init = (value) => {
    return new Recipe().init(value);
};


exports.Resmix = (blueprint) => {
    const channels = {};
    const middleware = store => next => {
        if (!store || !store.getState) {
            throw new Error(`Resmix: middleware hasn't received a store. Ensure to use applyMiddleware during passing middleware to createStore`);
        }
        const update = (name, value) => {
            next({type: UPDATE, payload: {
                name, value
            }});
        };

        const visitProperty = (blueprint, k, setValue) => {
            const desc = blueprint[k];
            const t = typeof desc;
            const isPlainValue = !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
            if (desc instanceof Recipe) {
                if (desc.hasInitialState)
                    setValue(desc.initialState);
                return;
            }
            if (isPlainValue) {
                setValue(desc);
                return;
            }
            const toObservable = desc[symbolObservable];
            const isMatchObject = desc.hasMatchPairs;
            if (toObservable) {
                const observable = toObservable.call(desc);
                observable.subscribe(value => {
                    setValue(value);
                });
                return;
            }
            if (desc && typeof desc == 'object') {
                const computedCurrentObjectValue = {};
                Object.keys(desc).forEach(function goDeeper(k) {
                    visitProperty(desc, k, (v) => {
                        computedCurrentObjectValue[k] = v;
                    }); 
                });
                setValue(computedCurrentObjectValue);
                return; 
            }
        };

        const initialState = {};
        Object.keys(blueprint).forEach(k => {
            visitProperty(blueprint, k, (v) => {
                initialState[k] = v;
            });
        });
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
            if (effects) {
                effects.forEach(([k, result]) => {
                    const updateProperty = update.bind(null, k);
                    if (typeof result[symbolObservable] == 'function') {
                        result[symbolObservable]().subscribe(updateProperty);
                    } else {
                        Promise.resolve(result()).then(updateProperty);
                    }
                })
            }
            const actions = state[ACTIONS];
            if (actions) {
                actions.forEach(({action, owner}) => {
                    action.meta = {owner};
                    next(action);
                });
            }
        }    
    };
    return {
        middleware,
        reducer: reducerFor(blueprint),
        channels,
    }
};


function actionMatchesPattern(pattern, action) {
    let equal = true;
    if (typeof pattern == 'object' && typeof action == 'object') {
        Object.keys(pattern).forEach(patternKey => {
            // TODO optimize. forEach is sub-optimal because it goes on even after we know that there is no match.
            if (action[patternKey] == undefined) {
                equal = false;
                return;
            }
            if (typeof pattern[patternKey] == 'function') {
                equal = equal && pattern[patternKey](action[patternKey]);
            }
            else if (pattern[patternKey] && typeof pattern[patternKey] == 'object') {
                equal = equal && actionMatchesPattern(pattern[patternKey], action[patternKey]);
            }
            else {
                equal = equal && pattern[patternKey] == action[patternKey];
            }
        });
    } else
        return pattern === action;
    return equal;
};

exports.OPEN_CHANNEL = OPEN_CHANNEL;

exports.spawn = (action) => {
    return {
        [SPAWN]: true,
        action
    }
}