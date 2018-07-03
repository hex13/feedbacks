const MATCH = Symbol('match');
const EFFECTS = Symbol('effects');
const OBSERVABLES = Symbol('observables');


const UPDATE = '@@resmix/update';
const symbolObservable = require('symbol-observable').default;

const reducerFor = (blueprint) => {
    return (state, action) => {
        if (action.type == UPDATE) {
            return Object.assign({}, state, {
                [action.payload.name]: action.payload.value
            });
        }
        let updates = {};
        let effects = [];
        let observables = {};
        Object.keys(blueprint).forEach(k => {
            const value = blueprint[k];
            const pairs = value && value.pairs;

            pairs && pairs.forEach(([pattern, reducer]) => {
                if (pattern == action.type) {
                    const result = reducer(state[k], action);
                    if (typeof result == 'function') {
                        effects.push([k, result]);
                    } else {
                        updates[k] = result;
                    }
                }
            });
        });

        return Object.assign(
            {}, 
            state, updates,
            {[EFFECTS]: effects, [OBSERVABLES]: observables}
        );
    };
};

exports.match = (pairs) => {
    return {
        [MATCH]: true,
        pairs,
    }
};

exports.Resmix = (blueprint) => {
    const middleware = store => next => {
        if (!store || !store.getState) {
            throw new Error(`Resmix: middleware hasn't received a store. Ensure to use applyMiddleware during passing middleware to createStore`);
        }
        const update = (name, value) => {
            next({type: UPDATE, payload: {
                name, value
            }});
        };
        Object.keys(blueprint).forEach(k => {
            const desc = blueprint[k];
            const t = typeof desc;
            const isPlainValue = !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
            if (isPlainValue) {
                update(k, desc);
                return;
            }
            const toObservable = desc[symbolObservable];
            if (!toObservable) return;
            const observable = toObservable.call(desc);
            observable.subscribe(value => {
                next({type: UPDATE, payload: {
                    name: k,
                    value,
                }});
            })
        });

    
        return action => {
            next(action);
            const state = store.getState();
            const effects = state[EFFECTS];
            if (effects) {
                effects.forEach(([k, run]) => {
                    Promise.resolve(run()).then(value => {
                        next({type: UPDATE, payload: {
                            name: k,
                            value,
                        }});
                    })
                })
            }
        }    
    };
    return {
        middleware,
        reducer: reducerFor(blueprint),
    }
};

