'use strict';

function isMatch(pattern, object) {
    let equal = true;
    if (typeof pattern == 'string') return pattern == object.type;
    if (typeof pattern == 'object' && typeof object == 'object') {
        for (let patternKey in pattern) {
            if (object[patternKey] == undefined) {
                equal = false;
            } else if (typeof pattern[patternKey] == 'function') {
                equal = equal && pattern[patternKey](object[patternKey]);
            }
            else if (pattern[patternKey] && typeof pattern[patternKey] == 'object') {
                equal = equal && isMatch(pattern[patternKey], object[patternKey]);
            }
            else {
                equal = equal && pattern[patternKey] == object[patternKey];
            }
            if (!equal) return false;
        }
    } else
        return pattern === object;
    return equal;
};


module.exports = {
    isMatch,
};