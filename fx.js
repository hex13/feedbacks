'use strict';

const EffectRunner = require('./effectRunner');
const EFFECT = Symbol('effect');


function createEffect(data) {
    return {
        [EFFECT]: data
    }
}

const spawn = (action) => {
    return createEffect({ [EffectRunner.CALL]: ['dispatch', action] });    
};


const mount = (blueprint) => {
    return createEffect({[EffectRunner.CALL]: ['mount', blueprint]});
};

const load = (params) => {
    return createEffect({[EffectRunner.CALL]: ['load', params]});
};

module.exports = {
    createEffect, 
    EFFECT,
    spawn, 
    mount,
    load,
};


