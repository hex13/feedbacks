'use strict';

const { createStore, applyMiddleware, compose } = require('redux');
const { createFeedbacks } = require('../..');


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
        
});
