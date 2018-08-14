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


const mount = (blueprint) => {
    return createEffect({[EffectRunner.CALL]: ['mount', blueprint]});
};

const load = (params) => {
    return createEffect({[EffectRunner.CALL]: ['load', params]});
};

const effect = (params) => {
    return createEffect({[EffectRunner.CALL]: ['effect', params]});
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

const compute = (params) => {
    return createEffect({
        [EFFECT]: {[EffectRunner.CALL]: ['effect', params]},
        permanent: true,
    });
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
};


