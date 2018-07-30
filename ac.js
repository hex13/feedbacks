'use strict';

const ac = type => {
    return payload => {
        if (payload !== undefined)
            return { type, payload }
        return { type }
    }
};

module.exports = ac;
