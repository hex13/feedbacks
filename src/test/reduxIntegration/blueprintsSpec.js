'use strict';

const { createStore, applyMiddleware, compose } = require('redux');
const { createFeedbacks, init } = require('../..');

/*
    Here are tests that check if a Redux state built from blueprints is correct 
    and if blueprints allow for prescribing dynamic behavior (such as pattern-matching for actions)
*/

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

    describe('[init - various]',() => {
        describe('[init the root state]', () => {
            let store;
            beforeEach(() => {
                const blueprint = init({
                    a: 'kotek',
                    b: {
                        c: 123
                    }
                }).on('foo', (state, action) => {
                    return action.payload;
                });
                store = createStore(blueprint, createFeedbacks());                
            });
            it('should allow for init the root state', () => {
                assert.deepStrictEqual(store.getState(), {
                    a: 'kotek', b: {c: 123}
                });
            });    
            it('should allow for pattern-matching actions via .on', () => {
                store.dispatch({type: 'foo', payload: {a: 2}});
                assert.deepStrictEqual(store.getState(), {
                    a: 2
                })       
            });    
        });
        
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
    
        xit('should allow for declaring services and it should preserve chaining', () => {
            const blueprint = init({
                    a: init(1).on('foo', () => ({bar: 123})), b: {c: 3}
                })
                .service({type: 'someService'}, () => {

                })
                .on('foo', () => ({bar: 123}));
            const store = createStore(blueprint, createFeedbacks());
            store.dispatch({type: 'foo'})
            assert.deepStrictEqual(store.getState(), {a: 1, b: {c: 3}});
        });

    });

});
