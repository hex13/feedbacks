'use strict';

// it's ActionCreatorDefinerCreator ;)
const ACDC = metaFixture => type => {
    return payload => {
        let action;
        if (payload !== undefined)
            action = { type, payload }
        else 
            action = { type };
        if (metaFixture) action.meta = {feedbacks: metaFixture};
        return action;
    }
};

const defineAction =  ACDC();
const defineEffect = ACDC({ isEffect: true });

module.exports = {
    defineAction,
    defineEffect,
};
