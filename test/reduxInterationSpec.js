const assert = require('assert');
const Resmix = require('../resmix');

require('symbol-observable');
const { createStore, applyMiddleware } = require('redux');
const { Observable, interval, Subscription, of } = require('rxjs');
const { take } = require('rxjs/operators');
const testing = require('rxjs/testing');


describe('[resmix]', () => {
    it('should allow for declare plain values', () => {
        const someSymbol = Symbol();
        const createBlueprint = () => ({
            i: 10,
            z: 0,
            t: 'text',
            ok: true,
            notOk: false,
            u: undefined,
            n: null,
            s: someSymbol,
        });
        const resmix = Resmix.Resmix(createBlueprint());
        const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
        assert.deepStrictEqual(store.getState(), createBlueprint());
    });

    it('should allow for declare plain objects', () => {
        const someSymbol = Symbol();
        const createBlueprint = () => ({
            o: {
                a: {
                    b: 2
                }
            }
        });
        const resmix = Resmix.Resmix(createBlueprint());
        const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
        assert.deepStrictEqual(store.getState(), createBlueprint());

    });

    it('should allow for declare pattern/reducer pairs', () => {
        const INC = 'inc';
        const DEC = 'dec';
        const blueprint = {
            counter: Resmix.match([
                [INC, v => v + 1],
                [DEC, v => v - 1],
            ]),
            counterX2: Resmix.match([
                [INC, v => v + 2],
                [DEC, v => v - 2],
            ])
        };
        const resmix = Resmix.Resmix(blueprint);
        const store = createStore(resmix.reducer, {counter: 0, counterX2: 0});
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
            const blueprint = {
                future: Resmix.match([
                    ['fetch', (state, action) => () => promise]
                ])
            };
            const resmix = Resmix.Resmix(blueprint);
            store = createStore(resmix.reducer, {future: null}, applyMiddleware(resmix.middleware));
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

    describe('[observables]', () => {
        let store;
        let subscriptionCount;;
        beforeEach(() => {
            const blueprint = {
                a: new Observable(observer => {
                    observer.next(100);
                    subscriptionCount++;
                }),
            };
            const resmix = Resmix.Resmix(blueprint);
            subscriptionCount = 0;
            store = createStore(resmix.reducer, {a: null}, applyMiddleware(resmix.middleware));
        });

        it('should resolve observable', () => {
            store.dispatch({type: 'foo'});
            assert.deepStrictEqual(store.getState(), {
                a: 100
            });            
        });

        it('should subscribe once', () => {
            assert.strictEqual(subscriptionCount, 1);
            store.dispatch({type: 'foo'});
            assert.strictEqual(subscriptionCount, 1);
        });
    });

});
