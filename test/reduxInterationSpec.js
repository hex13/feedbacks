const assert = require('assert');
const Resmix = require('../resmix');

const { createStore, applyMiddleware } = require('redux');

describe('[resmix]', () => {
    it('should allow for declare pattern/reducer pairs', () => {
        const INC = 'inc';
        const DEC = 'dec';
        const store = createStore(Resmix.reducerFor({
            counter: Resmix.match([
                [INC, v => v + 1],
                [DEC, v => v - 1],
            ]),
            counterX2: Resmix.match([
                [INC, v => v + 2],
                [DEC, v => v - 2],
            ])
        }), {counter: 0, counterX2: 0});
        assert.deepStrictEqual(store.getState(), {counter: 0, counterX2: 0});
        store.dispatch({type: INC});
        store.dispatch({type: INC});
        assert.deepStrictEqual(store.getState(), {counter: 2, counterX2: 4});
        store.dispatch({type: DEC});
        assert.deepStrictEqual(store.getState(), {counter: 1, counterX2: 2});
    });

    describe('[effects]', () => {
        let store;

        let promise = Promise.resolve(124);
        beforeEach(() => {
            store = createStore(Resmix.reducerFor({
                future: Resmix.match([
                    ['fetch', (state, action) => () => promise]
                ])
            }), {future: null}, applyMiddleware(Resmix.middleware));
        });

        it('should init to the correct state', () => {
            assert.deepStrictEqual(store.getState(), {future: null});
        });

        it('when reducer returns a function, it should not assign it to the property', () => {
            store.dispatch({type: 'fetch'});
            assert.deepStrictEqual(store.getState(), {future: null});
        });

        it('should allow for returning effect, i.e. function that returns a promise. And value of that promise should be put in the property', 
            () => {
                store.dispatch({type: 'fetch'});
                return promise.then(value => {
                    assert.deepStrictEqual(store.getState(), {future: 124});
                });
        });

    });



});
