const MATCH = Symbol('match');
const EFFECTS = Symbol('effects');
const OBSERVABLES = Symbol('observables');


const UPDATE = '@@resmix/update';
const INIT = '@@resmix/init';
const symbolObservable = require('symbol-observable').default;

exports.reducerFor = (blueprint) => {
    return (state = initialState, action) => {
        if (action.type == UPDATE) {
            return {
                ...state,
                [action.payload.name]: action.payload.value
            }
        }
        let updates = {};
        let effects = [];
        let observables = {};
        Object.keys(blueprint).forEach(k => {
            const value = blueprint[k];
            const toObservable = value[symbolObservable];
            if (action.type == INIT && toObservable) {
                const observable = toObservable.call(value);
                observables[k] = observable;
                return;
            }
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

        return { ...state, ...updates, [EFFECTS]: effects, [OBSERVABLES]: observables};
    };
};

exports.match = (pairs) => {
    return {
        [MATCH]: true,
        pairs,
    }
};

exports.middleware = store => next => {
    next({type: INIT});
    const state = store.getState();
    const observables = state[OBSERVABLES];
    if (observables) {
        Object.keys(observables).forEach(k => {
            observables[k].subscribe(value => {
                next({type: UPDATE, payload: {
                    name: k,
                    value,
                }});
            })
        })
    }

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
}