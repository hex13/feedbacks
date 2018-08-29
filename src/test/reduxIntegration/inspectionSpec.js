'use strict';
const { createStore, applyMiddleware, compose } = require('redux');
const { init, createFeedbacks } = require('../..');
const fx = require('../../fx');
const { UPDATE } = require('../../constants');

describe('[inspection]', () => {
    it('', (done) => {
        const actions = [];
        let shouldRecordActions = false;
        const store = createStore({
            foo: {
                bar: init(123)
                    .on('sth', () => () => Promise.resolve(1234)),
                baz: init(0)
                    .on('computeSomething', () => fx.effect({type: 'doComputeSomething'})),
            }
        }, compose(
            createFeedbacks({
                effects: [
                    ['doComputeSomething', () => 'tree']
                ]
            }),
            createStore => {
                return (...args) => {
                    const store = createStore(...args);
                    const dispatch = store.dispatch.bind(store);
                    store.dispatch = (action) => {
                        if (shouldRecordActions) {
                            actions.push(action);
                        }

                        return dispatch(action);
                    };
                    return store;
                }
            },

        ));
        shouldRecordActions = true;
        store.dispatch({type: 'sth'});
        store.dispatch({type: 'computeSomething'});
        setTimeout(() => {
            const updateActions = actions.filter(a => a.type == UPDATE);
            assert.deepStrictEqual(store.getState(), {foo: {bar: 1234, baz: 'tree'}});
            assert.deepStrictEqual(actions, [
                {type: 'sth'},
                {type: 'computeSomething'},
                {
                    type: UPDATE,
                    meta: {
                        cause: {
                            type: 'computeSomething'
                        }
                    },
                    payload: {
                        name: ['foo', 'baz'],
                        value: 'tree'
                    }
                },
                {
                    type: UPDATE,
                    payload: {
                        name: ['foo', 'bar'],
                        value: 1234,
                    },
                    meta: {
                        cause: {
                            type: 'sth'
                        }
                    }
                },
            ]);
            done();
        }, 0);


    });
});

