'use strict';

const { isMatch } = require('./matching');
const { get } = require('transmutable/get-set');
const { UPDATE, UPDATE_BLUEPRINT } = require('./constants');
const resolveInitialState = require('./resolveInitialState');


module.exports = {
    spawn(dispatch, getState, action) {
        action.meta = {owner: this.path};
        dispatch(action);
    },
    dispatch(dispatch, getState, action) {
        dispatch(action);
        return true;
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
                return run(effect);
            }
        }
    },
    addItem(dispatch, getState, item) {
        const state = get(getState(), this.path);
        return state.concat(item);
    },
    removeItem(dispatch, getState, index) {
        const state = get(getState(), this.path);
        return state.slice(0, index).concat(state.slice(index + 1));
    },
    random(dispatch, getState, {min, max}) {
        const range = max - min;
        return Math.random() * range + min;
    },
    getState(dispatch, getState, selector) {
        return getState();
    },
    delay(dispatch, getState, ms, value) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(value)
            }, ms)
        });
    },
    current(dispatch, getState) {
        const curr = get(getState(), this.path);
        return curr;
    },
    next(dispatch, getState, value) {
        dispatch({
            type: UPDATE,
            payload: {
                name: this.path,
                value: value
            }
        })
        return true;
    }
};