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

module.exports = {
    createEffect, 
    EFFECT,
    spawn, 
    mount,
    load,
    effect,
    flow,
};


