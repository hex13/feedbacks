const MATCH = Symbol();

exports.reducerFor = (blueprint) => {
    return (state, action) => {
        let updates = {};
        Object.keys(blueprint).forEach(k => {
            const pairs = blueprint[k].pairs;

            pairs.forEach(([pattern, reducer]) => {
                if (pattern == action.type) {
                    updates[k] = reducer(state[k], action);
                }
            });
        });
        return { ...state, ...updates};

    };
};

exports.match = (pairs) => {
    return {
        [MATCH]: true,
        pairs,
    }
};