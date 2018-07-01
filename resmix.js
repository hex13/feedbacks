const MATCH = Symbol();
const EFFECTS = Symbol();

const UPDATE = '@@resmix/update';

exports.reducerFor = (blueprint) => {
    return (state, action) => {
        if (action.type == UPDATE) {
            return {
                ...state,
                [action.payload.name]: action.payload.value
            }
        }
        let updates = {};
        let effects = [];
        Object.keys(blueprint).forEach(k => {
            const pairs = blueprint[k].pairs;

            pairs.forEach(([pattern, reducer]) => {
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
        return { ...state, ...updates, [EFFECTS]: effects};

    };
};

exports.match = (pairs) => {
    return {
        [MATCH]: true,
        pairs,
    }
};

exports.middleware = store => next => action => {
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