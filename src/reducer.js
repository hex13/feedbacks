'use strict';

const DEBUG = false;
const symbolObservable = require('symbol-observable').default;
const { UPDATE_BLUEPRINT, UPDATE, UPDATE_ROOT, EFFECTS } = require('./constants');
const { applyPatch } = require('transmutable/lib/transform');
const BLUEPRINT = Symbol('blueprint');
const { get, set } = require('transmutable/lib/get-set');
const { MUTATION } = require('transmutable/lib/symbols');
const Formula = require('./formula');
const { createEffect, EFFECT, spawn } = require('./fx');

// const { Graph } = require('transmutable/src/normalization/graph');
// console.log(Graph);
const raw = value => ({
    [MUTATION]: {
        value
    }
});


class State {
    constructor(state, normalized) {
        this._state = state;
        this._trees = {updates:{}, effects:{}};
    }
    getCursor() {
        return new Cursor(this, this._trees, this._state, []);
    }
    commit() {
        const newState = applyPatch(this._state || {}, this._trees.updates);
        newState[EFFECTS] = this._trees.effects;
        newState[SMART_STATE] = this;
        this._newState = newState;

        return newState;
    }
    set(path, value) {
        if (!path.length) {
            this._state = Object.assign({}, {
                [SMART_STATE]: this._state[SMART_STATE],
                [BLUEPRINT]: this._state[BLUEPRINT]
            }, value);
        } else 
            set(this._trees.updates, path, {
                [MUTATION]: {
                    value
                }
            });
    }
    clean() {
        return new State(this._newState);
    }
}

function Cursor(smartState, metadata, state, path = []) {
    return {
        get() {
            return get(state, path);
        },
        set(value) {
            return smartState.set(path, value);
        },

        // getMetadata(kind) {
        //     return get(metadata[kind], path);
        // },
        setMetadata(kind, value) {
            set(metadata[kind], path, value);
        },
        select(k) {
            return new Cursor(smartState, metadata, state, path.concat(k));
        },
    }
}

function mapReducerResultToEffectOrUpdate(result, causingAction) {
    const output = {};
    if (result === undefined) {
        // this is for preventing running code in `else` blocks
        // `undefined` in Feedbacks means: don't change a property value
        // so nothing more to do
    } else if (result === null) {
        output.update = raw(result);
    } else if (result[EFFECT]) {
        output.effect = result;
    } else if (typeof result == 'function'
        || (result && typeof result[symbolObservable] == 'function')
    )
    {
        output.effect = createEffect(result);
    } else if (typeof result.next == 'function') {
        let yielded, lastYielded;
        do {
            lastYielded = yielded;
            yielded = result.next();
        } while (!yielded.done);
        if (causingAction.meta && causingAction.meta.owner) {
            output.effect = spawn({
                type: UPDATE,
                payload: {
                    name: [].concat(causingAction.meta.owner), value: lastYielded.value
                },
            });
        }
        output.update = raw(yielded.value);
    } else {
        output.update = raw(result);
    }
    return output;
}

const SMART_STATE = Symbol('SmartState');
const reducerFor = () => {
    return (state, action) => {
        if (DEBUG) debug('action', action);
        let smartState;
        if (state && state[SMART_STATE]) {
            smartState = state[SMART_STATE].clean();
        } else {
            smartState = new State(state, false);
        }
        let isSpecialAction = true;
        if (action.type == UPDATE_BLUEPRINT) {
            const finalPath = action.payload.path? [BLUEPRINT].concat(action.payload.path) : [BLUEPRINT];
            smartState.set(finalPath, action.payload.blueprint);
            return smartState.commit();
        }
        else if (action.type == UPDATE) {
            smartState.set(action.payload.name, action.payload.value);
        }
        else if (action.type == UPDATE_ROOT) {
            smartState.set([], action.payload);
            return smartState.commit();
        } else isSpecialAction = false;
        
        
        const blueprint = state && state[BLUEPRINT]? state[BLUEPRINT] : {}; 

        const checkMatchAndHandleAction = (parent, k, cursor) => {
            const field = k? parent[k] : parent;

            if (field instanceof Formula) {
                field.doMatch(action, (reducer) => {

                    const reducerResult = reducer(cursor.get(), action);
                    const output = mapReducerResultToEffectOrUpdate(reducerResult, action)
                    if (output.update) {
                        cursor.set(output.update[MUTATION].value);
                    }

                    if (output.effect) cursor.setMetadata('effects', output.effect);
                });
                if (field.itemBlueprint) {
                    const itemKey = field.mapActionToKey(action);
                    checkMatchAndHandleAction(field, 'itemBlueprint', cursor && cursor.select(itemKey));
                }
                if (field.initialState && typeof field.initialState == 'object') {

                    for (let key in field.initialState) {
                        checkMatchAndHandleAction(field.initialState, key, cursor && cursor.select(key));
                    }
    
                }
            } else {
                if (field && !field[symbolObservable] && typeof field == 'object') {
                    for (let key in field) {
                        checkMatchAndHandleAction(field, key, cursor && cursor.select(key));
                    }
                }
            }
        };

        const cursor = smartState.getCursor();
        if (!isSpecialAction) {
            if (state && action.meta && action.meta.feedbacks && action.meta.feedbacks.path) {
                const path = action.meta.feedbacks.path;
                const key = path[path.length - 1];
                checkMatchAndHandleAction(get(blueprint, path.slice(0, -1)), key, cursor.select(path));
            } else if (state) {
                checkMatchAndHandleAction(blueprint, '', cursor);
            }
    
        }

        const newState = smartState.commit();
        return newState;
    };
};

module.exports = {
    reducerFor,
}