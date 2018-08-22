const Formula = require('./formula');
const symbolObservable = require('symbol-observable').default;

module.exports = function resolveInitialState(blueprint) {
    const observables = [];
    const visitProperty = (desc, setValue, path = []) => {
        const t = typeof desc;
        const isPlainValue = !desc || t == 'number' || t == 'string' || t == 'boolean' || t == 'symbol';
        if (isPlainValue) {
            setValue(desc);
            return;
        }
        if (desc instanceof Formula) {
            if (desc.hasInitialState)
                setValue(resolveInitialState(desc.initialState).initialState);
            return;
        }
        const toObservable = desc && desc[symbolObservable];

        if (toObservable) {
            const observable = toObservable.call(desc);
            observables.push({
                path,
                observable
            })
            return;
        }
        if (desc && typeof desc == 'object') {
            if (
                Array.isArray(desc)
                || desc.__raw
            ) {
                setValue(desc);
                return
            }
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


