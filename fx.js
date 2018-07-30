'use strict';

const EffectRunner = require('./effectRunner');
const EFFECT = Symbol('effect');


function createEffect(data) {
    return {
        [EFFECT]: data
    }
}

function load() {
    // TODO
}

const spawn = (action) => {
    return createEffect({ [EffectRunner.CALL]: ['dispatch', action] });    
};


const mount = (blueprint) => {
    return createEffect({[EffectRunner.CALL]: ['mount', blueprint]});
};

module.exports = {
    createEffect, 
    EFFECT,
    spawn, 
    mount
};


