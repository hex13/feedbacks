'use strict';

const EffectRunner = require('./effectRunner');
const EFFECT = EffectRunner.EFFECT;


function createEffect(data) {
    return {
        [EFFECT]: data
    }
}

const spawn = (action) => {
    return createEffect({ [EffectRunner.CALL]: ['spawn', action] });
};


const dispatch = (action) => {
    return createEffect({ [EffectRunner.CALL]: ['dispatch', action] });
};

const getState = (path) => {
    return createEffect({ [EffectRunner.CALL]: ['getState', path] });
};

const mount = (blueprint) => {
    return createEffect({[EffectRunner.CALL]: ['mount', blueprint]});
};

const load = (params) => {
    return createEffect({[EffectRunner.CALL]: ['load', params]});
};

const effect = (params) => {
    return createEffect({[EffectRunner.CALL]: ['effect', params]});
};

const delay = (ms, value) => {
    return createEffect({[EffectRunner.CALL]: ['delay', ms, value]});
};

const flow = (list) => {
    return createEffect({[EffectRunner.FLOW]: list});
};

const waitFor = (actionPattern, mapper) => {
    return createEffect({[EffectRunner.WAIT_FOR]: { pattern: actionPattern, mapper }});
};

const addItem = (item) => {
    return createEffect({[EffectRunner.CALL]: ['addItem', item]});
};

const removeItem = (item) => {
    return createEffect({[EffectRunner.CALL]: ['removeItem', item]});
};

const random = (item) => {
    return createEffect({[EffectRunner.CALL]: ['random', item]});
};

const current = () => {
    return createEffect({[EffectRunner.CALL]: ['current']});
};

const next = (value) => {
    return createEffect({[EffectRunner.CALL]: ['next', value]});
};

const compute = (params) => {
    return createEffect({
        [EFFECT]: {[EffectRunner.CALL]: ['effect', params]},
        permanent: true,
    });
};

const select = (path) => {
    if (typeof path == 'function') {
        throw new TypeError('Feedbacks: You have to pass an array or string to fx.select. You passed a function or class')
    }
    return createEffect({ [EffectRunner.CALL]: ['select', path] });
};


module.exports = {
    createEffect, 
    EFFECT,
    spawn, 
    mount,
    load,
    effect,
    flow,
    waitFor,
    addItem,
    removeItem,
    random,
    compute,
    dispatch,
    getState,
    delay,
    current,
    next,
    select
};


