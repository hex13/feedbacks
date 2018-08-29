'use strict';

const { createStore, applyMiddleware, compose } = require('redux');
const { createFeedbacks, init } = require('../..');


describe('[blueprints', () => {
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
        const store = createStore(createBlueprint(), createFeedbacks());
        assert.deepStrictEqual(store.getState(), createBlueprint());
    });
    
    it('should allow for create empty object as value of property', () => {
        const store = createStore({
            a: {}
        }, createFeedbacks());
        assert.deepStrictEqual(store.getState(), {a: {}})
    
    });
    
    it('should allow for create empty array as value of property', () => {
        const store = createStore({
            a: []
        }, createFeedbacks());
        assert.deepStrictEqual(store.getState(), {a: [] })
    
    });
    
    
    it('should allow for declare plain objects', () => {
        const createBlueprint = () => ({
            o: {
                a: {
                    b: 2
                }
            }
        });
        const store = createStore(createBlueprint(), createFeedbacks());
        assert.deepStrictEqual(store.getState(), createBlueprint());
    });
        
    describe('init',() => {
        it('should treat first argument as a blueprint', () => {
            const someSymbol = Symbol();
            const store = createStore({
                a: init({
                    b: init(10).on('foo', () => 3)
                })
            }, createFeedbacks());

            assert.deepStrictEqual(store.getState(), {a: {b: 10}})
            
            store.dispatch({type: 'foo'});

            assert.deepStrictEqual(store.getState(), {a: {b: 3}})
        });        

        it('should allow for create empty object as value of property', () => {
            const store = createStore({
                a: init({})
            }, createFeedbacks());
            assert.deepStrictEqual(store.getState(), {a: {}})    
        });
    

    });

});
