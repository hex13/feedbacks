'use strict';

const assert = require('assert');
const Resmix = require('../resmix');

require('symbol-observable');
const { createStore, applyMiddleware, compose } = require('redux');
const thunk = require('redux-thunk').default;
const Redux = require('redux');
const { Observable, interval, Subscription, of } = require('rxjs');
const { take } = require('rxjs/operators');
const testing = require('rxjs/testing');
const { createEngine, withRedux, init, defineEffect, defineAction, feedbacksEnhancer } = require('..');

const fx = require('../fx');

const prepareStore = (blueprint) => {
    return createStore(blueprint, feedbacksEnhancer)

    // return withRedux(Redux).createStore(blueprint);

    // const resmix = createEngine(blueprint);
    // const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
    // return store;
};

const prepareEngine = (blueprint) => {
    const engine = withRedux(Redux).createEngine(blueprint);
    const store = engine.getStore();
    return { store, engine };
};

global.assert = assert;


describe('[experiments :) ]', () => {
    let store;

    it('experiment: enhancer', () => {
        let initialState;
        const reducer = (state = initialState, action) => {
            switch (action.type) {
                case 'inc': return state + 1;
                case 'dec': return state - 1;
            }
            return state;
        };
        console.log("THUNK", thunk)
        const enhancer = (createStore) => {

            return (initial) => {
                initialState = initial;
                return createStore(reducer);
            }
        }
        
        const store = createStore(10, compose(
            enhancer,
            applyMiddleware(thunk),
        ));
        console.log(store);
        for (let i = 0; i < 3; i++)
            store.dispatch({type: 'inc'});
        assert.deepStrictEqual(store.getState(), 13);
        store.dispatch(dispatch => {
            dispatch({type: 'dec'})
        });
        assert.deepStrictEqual(store.getState(), 12);
    });

});


describe('[creating store (smoke test)]', () => {
    let store;
    beforeEach(() => {
        store = withRedux(Redux).createEngine().getStore();
    });

    it('should be possible to call getState', () => {
        store.getState();
    });

    it('should be possible to call dispatch', () => {
        store.dispatch({type: 'not very important'});
    });
});

describe('[creating store via enhancer (smoke test)]', () => {
    let store;
    beforeEach(() => {
        store = createStore({
            a: init(130).on('foo', state => state - 100)
        }, feedbacksEnhancer);
    });

    it('should be possible to call getState', () => {
        assert.deepStrictEqual(store.getState(), {a: 130});
    });

    it('should be possible to call dispatch and state should chnge', () => {
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {a: 30});
    });
});



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
        const store = prepareStore(createBlueprint());
        assert.deepStrictEqual(store.getState(), createBlueprint());
    });

    it('should allow for create empty object as value of property', () => {
        const store = prepareStore({
            a: {}
        });
        assert.deepStrictEqual(store.getState(), {a: {}})

    });

    it('should allow for create array as value of property', () => {
        const store = prepareStore({
            a: []
        });
        assert.deepStrictEqual(store.getState(), {a: [] })

    });

    // it('should allow for declare Recipe with primitive as initial state', () => {
    //     const someSymbol = Symbol();
    //     const resmix = Resmix.Resmix(Resmix.init(10));
    //     const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
    //     assert.deepStrictEqual(store.getState(), 10)
    // });

    // it('should allow for declare Recipe with blueprint as initial state', () => {
    //     const someSymbol = Symbol();
    //     const resmix = Resmix.Resmix(Resmix.init({
    //         a: 10,
    //         b: Resmix.init(20)
    //     }));
    //     const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
    //     assert.deepStrictEqual(store.getState(), {a: 10, b: 20})
    // });

    describe('init',() => {
        it('should treat first argument as a blueprint', () => {
            const someSymbol = Symbol();
            const store = prepareStore({
                a: init({
                    b: init(10).on('foo', () => 3)
                })
            });

            assert.deepStrictEqual(store.getState(), {a: {b: 10}})
            
            store.dispatch({type: 'foo'});

            assert.deepStrictEqual(store.getState(), {a: {b: 3}})
        });        

        it('should allow for create empty object as value of property', () => {
            const store = prepareStore({
                a: init({})
            });
            assert.deepStrictEqual(store.getState(), {a: {}})    
        });
    

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
        const store = prepareStore(createBlueprint());
        assert.deepStrictEqual(store.getState(), createBlueprint());
    });


    xit('should allow for declare observables in init', (done) => {
        const someSymbol = Symbol();
        const createBlueprint = () => ({
            a: init(of(10))
        });
        const resmix = Resmix.Resmix(createBlueprint());
        const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));

        setTimeout(() => {
            assert.deepStrictEqual(store.getState(), {a: 10});
            done();
        }, 0);
        
    });

    it('should allow reducers for returning null. Then null should be assigned to property', () => {
        const store = withRedux(Redux).createEngine({
            foo: init(2)
                .on('someAction', () => null)
        }).getStore();

        assert.deepStrictEqual(store.getState(), {foo: 2});
        store.dispatch({type: 'someAction'});
        assert.deepStrictEqual(store.getState(), {foo: null});
    });

    it('should allow reducers for returning undefined. Then value of property should remain the same', () => {
        const store = withRedux(Redux).createEngine({
            foo: init(2)
                .on('someAction', () => undefined)
        }).getStore();

        assert.deepStrictEqual(store.getState(), {foo: 2});
        store.dispatch({type: 'someAction'});
        assert.deepStrictEqual(store.getState(), {foo: 2});
    });

    it('should allow reducers for returning objects', () => {
        const someSymbol = Symbol();
        const createBlueprint = () => (
            {
                user: Resmix.init({name: '', city: '', planet: 'Earth'})
                    .match('changeUser', (value, action) => Object.assign({}, value, action.payload))
                    .match('clear', (value, action) => ({foo: true}))
            }
        );
        const store = prepareStore(createBlueprint());
        assert.deepStrictEqual(store.getState(), {
            user: {
                name: '', 
                city: '',
                planet: 'Earth'
            }
        });
        store.dispatch({type: 'changeUser', payload: {name: 'John', city: 'London'}})
        assert.deepStrictEqual(store.getState(), {
            user: {
                name: 'John', 
                city: 'London',
                planet: 'Earth'
            }
        });
        store.dispatch({type: 'clear'})        
        assert.deepStrictEqual(store.getState(), {
            user: {
                foo: true
            }
        });

    });

    it('should allow reducers for returning arrays', () => {
        const arr = [10, 20, 30];
        const store = prepareStore({
            a: init(arr)
                .on('foo', state => state.concat(40))
        });
        assert.deepStrictEqual(store.getState(), {a: [10, 20, 30] })
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {a: [10, 20, 30, 40] })
    });

    xit('should allow arrays to contain formulas', () => {
        const arr = [10, 20, 30];
        const store = prepareStore({
            a: [10, 20, init(30)],
            b: [6, 5, {foo: init(4)}]
        });
        assert.deepStrictEqual(store.getState(), {
            a: [10, 20, 30],
            b: [6, 5, {foo: 4}] 
        })
    });

    it('should allow for declare deep matchings', (done) => {
        const createBlueprint = () => ({
            user: {
                season: Resmix.init(1).match('nextSeason', value => value + 1),
                name: Resmix.init('Jack').match([
                    ['changeName', (value, action) => action.name]
                ]),
                from: {
                    city: Resmix.init('Los Angeles').match([
                        ['changeCity', (value, action) => () => Promise.resolve(action.name)],
                        ['fly', (value, action) => of('Island')]
                    ]),
                    country: 'USA'
                }
            }
        });
        const resmix = createEngine(createBlueprint());
        const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));

       assert.deepStrictEqual(store.getState(), {
            user: {
                season: 1,
                name: 'Jack',
                from: {
                    city: 'Los Angeles',
                    country: 'USA'
                }
            },

        });
        store.dispatch({type: 'changeName', name: 'John'});
        store.dispatch({type: 'changeCity', name: 'Tustin'});
        setTimeout(() => {
            assert.deepStrictEqual(store.getState(), {
                user: {
                    season: 1,                    
                    name: 'John',
                    from: {
                        city: 'Tustin',
                        country: 'USA'
                    }
                }
            }); 
            store.dispatch({type: 'fly'});
            setTimeout(() => {
                assert.deepStrictEqual(store.getState(), {
                    user: {
                        season: 1,                        
                        name: 'John',
                        from: {
                            city: 'Island',
                            country: 'USA'
                        }
                    }
                });     

                store.dispatch({ type: 'nextSeason'});

                assert.deepStrictEqual(store.getState(), {
                    user: {
                        season: 2,                        
                        name: 'John',
                        from: {
                            city: 'Island',
                            country: 'USA'
                        }
                    }
                });     

                done();
            }, 10)
            
        }, 10);
    });
    
    it('should allow for change blueprint (single recipe) ', () => {
        const store = prepareStore({
            foo: {
                counter: Resmix.init(0)
                    .match('foo', (value, action) => {
                        return fx.mount(
                            Resmix.on('inc', (value, action) => value + action.payload)
                        )
                    })
            },
        });
        const initialState = {
            foo: { counter: 0 }, 
        };

        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), {
            foo: { counter: 10},
        });

    });


    it('should allow for change blueprint (single recipe, with init) ', () => {
        const store = prepareStore({
            foo: {
                counter: Resmix.init(0)
                    .match('foo', (value, action) => {
                        return fx.mount(
                            Resmix.init(100).match('inc', (value, action) => value + action.payload)
                        )
                    })
            },
        });
        const initialState = {
            foo: { counter: 0 }, 
        };

        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {
            foo: { counter: 100 }
        });
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), {
            foo: { counter: 110},
        });
    });

    xit('should allow for change blueprint (mounting Promise) ', (done) => {    
        const store = prepareStore({
            foo: init(0).match('foo', () => () => fx.mount(Promise.resolve(1234)))
        });
        const initialState = {
            foo: 0
        };

        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'foo'});
        setTimeout(() => {
            assert.deepStrictEqual(store.getState(), {
                foo: 1234
            });    
            done();
        }, 10);

    });

    
    it('should allow for change blueprint (object with recipes) ', () => {    
        const store = prepareStore({
            foo: {
                counter: Resmix.init({value: 0})
                    .match('foo', (value, action) => {
                        return fx.mount({
                            value: Resmix.init(0).match('inc', (value, action) => value + action.payload)
                        })
                    })
            },
        });
        const initialState = {
            foo: { counter: {value: 0} }, 
        };

        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), {
            foo: { counter: {value: 10}},
        });

    });

    it('should allow for change blueprint (object with recipes, with init) ', () => {    
        const store = prepareStore({
            foo: {
                counter: Resmix.init({value: 0})
                    .match('foo', (value, action) => {
                        return fx.mount({
                            value: Resmix.init(100).match('inc', (value, action) => value + action.payload)
                        })
                    })
            },
        });
        const initialState = {
            foo: { counter: {value: 0} }, 
        };

        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), initialState);
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {
            foo: { counter: { value: 100 } }
        });
        store.dispatch({type: 'inc', payload: 10});
        assert.deepStrictEqual(store.getState(), {
            foo: { counter: {value: 110}},
        });

    });

    it('should allow for declaring shape of items and dispatch actions only to selected item', () => {
        const store = prepareStore({
            collection: init({
                item: {
                    text: 'foo'
                },
                secondItem: {
                    text: 'bar'
                }
            }).itemsLike({
                text: init('').on('change', value => value + '!')
            }, action => action.key)
        });

        assert.deepStrictEqual(store.getState(), {
            collection: {
                item: {
                    text: 'foo'
                },
                secondItem: {
                    text: 'bar'
                }
            }
        });
        store.dispatch({type: 'change', key: 'item'});

        assert.deepStrictEqual(store.getState(), {
            collection: {
                item: {
                    text: 'foo!'
                },
                secondItem: {
                    text: 'bar'
                }
            }
        });

    });


    describe('init', () => {

        it('should allow for use chaining: first init(), then match()', () => {
            const store = prepareStore({
                a: Resmix.init(10)
                    .match([
                        ['inc', a => a + 1],
                        ['dec', a => a - 1],
                    ])
            });
            assert.deepStrictEqual(store.getState(), {a:10});
            store.dispatch({type: 'inc'});
            assert.deepStrictEqual(store.getState(), {a:11});
            store.dispatch({type: 'dec'});
            assert.deepStrictEqual(store.getState(), {a:10});
        });

        it('should allow for use chaining: first match(), then init()', () => {
            const store = prepareStore({
                a: Resmix
                    .match([
                        ['inc', a => a + 1],
                        ['dec', a => a - 1],
                    ])
                    .init(10)
            });
            assert.deepStrictEqual(store.getState(), {a:10});
            store.dispatch({type: 'inc'});
            assert.deepStrictEqual(store.getState(), {a:11});
            store.dispatch({type: 'dec'});
            assert.deepStrictEqual(store.getState(), {a:10});
        });

    })

    it('should allow for declare pattern/reducer pairs', () => {
        const INC = 'inc';
        const DEC = 'dec';
        const blueprint = {
            counter: Resmix.init(0).on([
                [INC, v => v + 1],
                [INC, v => 'second match should have not effect'],
                [DEC, v => v - 1],
            ]),
            counterX2: Resmix
                .init(0)
                .on(INC, v => v + 2)
                .on(DEC, v => v - 2)
        };
        const store = prepareStore(blueprint);

        assert.deepStrictEqual(store.getState(), {counter: 0, counterX2: 0});
        store.dispatch({type: INC});
        store.dispatch({type: INC});
        assert.deepStrictEqual(store.getState(), {counter: 2, counterX2: 4});
        store.dispatch({type: DEC});
        assert.deepStrictEqual(store.getState(), {counter: 1, counterX2: 2});
    });

    // TODO maybe action patterns should be tested separately, without Redux
    it('should allow for declare pattern/reducer pairs with object patterns', () => {
        const INC = 'inc';
        const DEC = 'dec';
        const blueprint = {
            counter: Resmix.init(0).on([
                [{type: INC, amount: {
                    name: 'dozen'
                }}, v => v + 12],
                [{type: INC, double: true}, v => v + 2],
                [{type: INC, amount: (v) => v > 100 }, (v, a) => 'too much'],
                [{type: INC, amount: () => true}, (v, a) => v + a.amount],
                [{type: INC}, v => v + 1],
                [{type: DEC}, v => v - 1],
            ]),
        };
        const store = prepareStore(blueprint);
        assert.deepStrictEqual(store.getState(), {counter: 0});
        store.dispatch({type: INC});
        assert.deepStrictEqual(store.getState(), {counter: 1});
        store.dispatch({type: INC, double: true});
        assert.deepStrictEqual(store.getState(), {counter: 3});
        store.dispatch({type: INC, amount: 10});
        assert.deepStrictEqual(store.getState(), {counter: 13});
        store.dispatch({type: INC, amount: {name: 'dozen'}});
        assert.deepStrictEqual(store.getState(), {counter: 25});
        store.dispatch({type: INC, amount: 101});
        assert.deepStrictEqual(store.getState(), {counter: 'too much'});
    });

    // TODO maybe action patterns should be tested separately, without Redux 
    it('should match nested matching action pattern', () => {
        const FOO = 'foo';
        const blueprint = {
            counter: Resmix.init(0).on([
                [{type: FOO, a: {
                    b: 'bear',
                    c: {
                        d: 123
                    }
                }}, (v, a) => -2],
            ]),
        };
        const store = prepareStore(blueprint);
        assert.deepStrictEqual(store.getState(), {counter: 0});
        store.dispatch({
            type: FOO, 
            a: {
                b: 'bear',
                c: {
                    d: 123
                }
            }
        });
        assert.deepStrictEqual(store.getState(), {counter: -2});
    });

    // TODO maybe action patterns should be tested separately, without Redux 
    it('should not match non matching nested action pattern', () => {
        const FOO = 'foo';
        const blueprint = {
            counter: Resmix.init(0).on([
                [{type: FOO, a: {
                    b: 'bear',
                    c: {
                        d: 123
                    }
                }}, (v, a) => -2],
            ]),
        };
        const store = prepareStore(blueprint);
        assert.deepStrictEqual(store.getState(), {counter: 0});
        store.dispatch({type: FOO, a:{b: 'dog'}});
        assert.deepStrictEqual(store.getState(), {counter: 0});
        store.dispatch({type: FOO, a: {
            b: 'bear',
            c: {
                d: 9999
            }
        }});
        assert.deepStrictEqual(store.getState(), {counter: 0});
    });


    describe('[effects]', () => {
        let store;

        let promise = Promise.resolve(124);
        beforeEach(() => {
            const blueprint = {
                future: Resmix.init(null).on([
                    ['fetch', (state, action) => () => promise]
                ])
            };
            store = prepareStore(blueprint);

        });

        it('should init to the correct state', () => {
            assert.deepStrictEqual(store.getState(), {future: null});
        });

        it('when reducer returns a function, engine should not assign it to the property', () => {
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


    describe('[effects - observables]', () => {
        let store;
        let subscriptionCount = 0;
        beforeEach(() => {
            const blueprint = {
                animal: Resmix.init('cat')
                    .match([
                        ['changeAnimal', () => new Observable(observer => {
                            observer.next('dog')
                            subscriptionCount++;
                        })]
                    ])
            };
            subscriptionCount = 0;
            store = prepareStore(blueprint);
        });

        it('should resolve observable returned by reducer', () => {
            store.dispatch({type: 'changeAnimal'});
            assert.strictEqual(store.getState().animal, 'dog');
        });

        it('should subscribe once', () => {
            store.dispatch({type: 'changeAnimal'});
            assert.strictEqual(subscriptionCount, 1);
        });

    });

    describe('[effect - load]', () => {
        it('should load via provided loader', () => {
            //const 

            const store = withRedux(Redux).createEngine({ 
                a: {
                    b: init(123).on('loadThis', () => fx.load('someResource'))
                }
            }, {
                loader: (params, state) => {
                    whatHappened.push(['loader', params, state])
                    return 456;
                }
            }).getStore();

            const whatHappened = [];

            assert.deepStrictEqual(store.getState(), {a: {b: 123}});

            store.dispatch({ type: 'loadThis' });
            assert.deepStrictEqual(store.getState(), {a: {b: 456}});
            assert.deepStrictEqual(whatHappened, [
               ['loader', 'someResource', {
                   a: {
                       b: 123
                   }
               }] 
            ]);

        });

        it('should run matching effect handler', () => {
            const store = withRedux(Redux).createEngine({ 
                a: {
                    b: init(123).on('loadThis', () => fx.effect({type: 'someEffect', params: 'blah'})),
                    c: init(100).on('inc', (state, action) => state + action.payload)
                }
            })
            .onEffect({type: 'abc'}, () => 'aaaaa')
            .onEffect({type: 'someEffect'}, function *(effect)  {
                assert.deepStrictEqual(effect, {type: 'someEffect', params: 'blah'});
                const state = yield fx.getState();
                assert.deepStrictEqual(state, {
                    a: {
                        b: 123,
                        c: 100
                    }
                });
                yield fx.dispatch({type: 'inc', payload: 20});
                return 'here comes';
            })
            .onEffect({type: 'otherEffect'}, () => 'something else')
            .getStore();

            store.dispatch({ type: 'loadThis' });

            assert.deepStrictEqual(store.getState(), {
                a: {b: 'here comes', c: 120}
            });
        });

    })

    describe('[dispatching effects]', () => {
        let store;
        const doSomething = defineEffect('doSomething');
        let whatHappened;
        beforeEach(() => {
            whatHappened = [];
            store = withRedux(Redux).createEngine({
                foo: init(0)
                    .on(doSomething(), () => 'wrong 1')
                    .on({type: 'doSomething'}, () => 'wrong 2'),
                bar: init('').on({type: 'bar'}, state => state + 'good')
            })
                .onEffect(doSomething(), function* (effect) {
                    assert.deepStrictEqual(yield fx.getState(), {foo: 0, bar: ''});
                    assert.deepStrictEqual(effect, doSomething());
                    yield fx.dispatch({type: 'bar'});
                    whatHappened.push('effect');
                })
                .getStore();

            assert.deepStrictEqual(store.getState(), {foo: 0, bar: ''});
            store.dispatch(doSomething());
        });


        it('should not trigger action reducer', () => {
            assert.strictEqual(store.getState().foo, 0);
        });

        it('should trigger effect handler', () => {
            assert.deepStrictEqual(whatHappened, [
                'effect'
            ]);
        });

        it('should pass `dispatch` function which can dispatch an action', () => {
            assert.deepStrictEqual(store.getState().bar, 'good')
        });
    });

    describe('[flow]', () => {
        it('should run flow from effect handler', (done) => {
            const store = withRedux(Redux).createEngine({ 
                a: {
                    b: init(123).on('loadThis', () => fx.effect({type: 'someEffect'}))
                }
            })
            .onEffect({type: 'someEffect'}, (effect) => {
                return fx.flow([
                    10,
                    x => x * 10, 
                    x => x + 1
                ]);
            })
            .getStore();

            assert.deepStrictEqual(store.getState(), {
                a: {b: 123}
            });
        
            store.dispatch({ type: 'loadThis' });
    
            setTimeout(() => {
                assert.deepStrictEqual(store.getState(), {
                    a: {b: 101}
                });
                done();
            }, 0)
        });

        it('should run flow from action', (done) => {
            const store = withRedux(Redux).createEngine({ 
                a: {
                    b: init(123).on('loadThis', () => fx.flow([
                        10,
                        x => x * 10, 
                        x => x + 1
                    ]))
                }
            })
            .getStore();

            assert.deepStrictEqual(store.getState(), {
                a: {b: 123}
            });
    
            store.dispatch({ type: 'loadThis' });
    
            setTimeout(() => {
                assert.deepStrictEqual(store.getState(), {
                    a: {b: 101}
                });
                done();
            }, 0)
        });
        
    
    });



    describe('[waitFor]', () => {
        it('should wait for action and then resolved using mapper', () => {
            const store = withRedux(Redux).createEngine({
                a: init(0).on('doSomething', () => (
                    // wrap in Promise to check if recursive effect resolving is performed
                    fx.waitFor({type: 'wow'}, action => Promise.resolve(action.payload))
                ))
            }).getStore();
            store.dispatch({type: 'doSomething'});

            return Promise.resolve().then(() => {
                assert.strictEqual(store.getState().a, 0);

                store.dispatch({type: 'doNothing'});
            }).then(() => {
                assert.strictEqual(store.getState().a, 0);

                store.dispatch({type: 'wow', payload: 1234});
                store.dispatch({type: 'wow', payload: 'only first should count'});

            }).then(() => {
                assert.strictEqual(store.getState().a, 1234);
            });

        });
    });

    describe('[observables]', () => {
        let store;
        let subscriptionCount;;
        beforeEach(() => {
            const blueprint = {
                deep: {
                    a: new Observable(observer => {
                        observer.next(100);
                        subscriptionCount++;
                        setTimeout(() => {
                            observer.next(of(123));
                        }, 200);
                    }),    
                }
            };
            subscriptionCount = 0;
            store = prepareStore(blueprint);
        });

        it('should resolve observable', (done) => {
            store.dispatch({type: 'foo'});
            setTimeout(() => {
                assert.deepStrictEqual(store.getState(), {
                    deep: {a: 100}
                });                
                done();
            }, 30)
        });

        it('should resolve asynchronous updates from observable', (done) => {
            store.dispatch({type: 'foo'});
            setTimeout(() => {
                assert.deepStrictEqual(store.getState(), {
                    deep: {a: 123}
                });                
                done();
            }, 250);
        });

        it('should subscribe once', () => {
            assert.strictEqual(subscriptionCount, 1);
            store.dispatch({type: 'foo'});
            assert.strictEqual(subscriptionCount, 1);
        });
    });

    describe('[spawning]', () => {
        let store, engine;
        beforeEach(() => {
            ({ store, engine } = prepareEngine({
                someFoo: Resmix.init(0).match([
                    ['foo', function (state, action) {
                        return fx.spawn({type: 'bar'});
                    }]
                ]),
                deep: {
                    someBar: Resmix.init(100).match([
                        ['bar', function* (state, action) {
                            yield 'something yielded';
                            return state + 10;
                        }]
                    ]),    
                },
                guard: 'the same'
            }));
        });

        it('should spawn action', () => {
            store.dispatch({type: 'foo'});
            store.dispatch({type: 'some other action'});
            assert.deepStrictEqual(store.getState(), {
                someFoo: 'something yielded', 
                deep: {
                    someBar: 110, 
                },
                guard: 'the same'
            });

        });
    });

    describe('[generators as reducers]', () => {
        let store, engine;
        beforeEach(() => {
            ({ store, engine } = prepareEngine({
                counter: Resmix.init(0).on([
                    ['gen', function* (v) {
                        yield 'not a right value';
                        return v + 100;
                    }]
                ])
            }));
        });

        it('should detect generator and assign correctly returned value (not yielded one)', () => {
            store.dispatch({type: 'gen'});
            assert.deepStrictEqual(store.getState(), {counter: 100});
        });
    });


    describe('[channels]', () => {
        let store, engine;
        beforeEach(() => {
            ({ store, engine } = prepareEngine({
                someFoo: 9,
                someBar: 8
            }));
        });

        it('should create channel', () => {
            store.dispatch({
                type: Resmix.OPEN_CHANNEL,
                payload: {
                    id: 'foo',
                    property: 'someFoo'
                }
            })
            assert.strictEqual(typeof engine.channels.foo, 'function')
            engine.channels.foo(1248);
            assert.deepStrictEqual(store.getState(), {
                someFoo: 1248,
                someBar: 8
            })
        });
    });
});

describe('[immutability]', () => {
    it('should keep immutability', () => {
        const foo = {a: 123};
        const store = prepareStore({
            foo: {
                a: init(123).on('foo', v => 456)
            },
            deep: {
                foo,
                a: init(0)
                    .on('inc', v => v + 1)
            }
        });

        const state1 = store.getState();
        assert.deepStrictEqual(state1.foo, {a: 123});

        store.dispatch({type: 'foo'})
        const state2 = store.getState();
        assert.deepStrictEqual(state1.foo, {a: 123});
        assert.deepStrictEqual(state2.foo, {a: 456});
    });
});


describe('[namespaced actions]', () => {
    it('should allow for dispatching namespaced actions', () => {
        const foo = {a: 123};
        const store = prepareStore({
            foo: Resmix.init(0).match('inc', v => v + 1),
            bar: Resmix.init(0).match('inc', v => v + 10),
            deep: {
                deeper: {
                    baz: Resmix.init(0).match('inc', v => v + 100),
                    qux: Resmix.init(0).match('inc', v => v + 1000)
                }
            }
        });

        assert.deepStrictEqual(store.getState(), {foo: 0, bar: 0, deep: {deeper: {baz: 0, qux: 0}} });
        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['foo']
                }
            }
        })
        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 0, deep: {deeper: {baz: 0, qux: 0}} });
        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['bar']
                }
            }
        })
        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 10, deep: {deeper: {baz: 0, qux: 0}} });
        
        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['deep']
                }
            }
        });

        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 10, deep: {deeper: {baz: 100, qux: 1000}} });

        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['deep', 'deeper', 'baz']
                }
            }
        });

        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 10, deep: {deeper:{baz: 200, qux: 1000}} });

    });
});

describe('[collection effects]', () => {
    it('should add item to array', () => {
        const store = prepareStore({
            todos: init([])
                .on('addTodo', (_, action) => {
                    return fx.addItem({text: action.payload});
                })
        });
        assert.deepStrictEqual(store.getState(), {todos: []});
        store.dispatch({type: 'addTodo', payload: 'Hello world!'});
        store.dispatch({type: 'addTodo', payload: 'Wlazł kotek na płotek.'});
        assert.deepStrictEqual(store.getState(), {
            todos: [
               {text: 'Hello world!'},
               {text: 'Wlazł kotek na płotek.'},
            ]
        });
    });

    it('should remove item from array', () => {
        const createInitialTodos = () => ([
            {text: 'zero'},
            {text: 'one'},
            {text: 'two'},
            {text: 'three'},
            {text: 'four'},
        ]);

        const store = prepareStore({
            todos: init(createInitialTodos())
                .on('removeTodo', (_, action) => {
                    return fx.removeItem(action.payload);
                })
        });
        assert.deepStrictEqual(store.getState(), {todos: createInitialTodos()});
        store.dispatch({type: 'removeTodo', payload: 1});
        assert.deepStrictEqual(store.getState(), {
            todos: [
                {text: 'zero'},
                {text: 'two'},
                {text: 'three'},
                {text: 'four'},    
            ]
        });
    });
    
});

describe('[random effects]', () => {
    it('fx.random should generate a number )', () => {
        const store = prepareStore({
            a: init('foo')
                .on('foo', () => {
                    return fx.random({min: 0, max: 10});
                })
        });
        assert.deepStrictEqual(store.getState(), {a: 'foo'});
        store.dispatch({type: 'foo'});
        assert.strictEqual(typeof store.getState().a, 'number');
    });
});

describe('[fx.current]', () => {
    it('should resolve to current prop value', () => {
        const whatHappened = [];
        const store = withRedux(Redux).createEngine({
            counter: init(100)
                .on('foo', () => {
                    return fx.effect({type: 'foo'})
                })
                .on('inc', (state) => state + 1)
        })
        .onEffect('foo', function* () {
            whatHappened.push(['yielded', yield fx.current()]);
            return yield fx.current();
        })
        .getStore();
        assert.deepStrictEqual(store.getState(), {counter: 100});

        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(whatHappened, [
            ['yielded', 100]
        ]);

        store.dispatch({type: 'inc'});
        assert.deepStrictEqual(store.getState(), {counter: 101});

        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(whatHappened, [
            ['yielded', 100],
            ['yielded', 101]
        ]);        
    });
});

describe('[fx.next]', () => {
    it('should trigger next update', () => {
        const whatHappened = [];
        const store = withRedux(Redux).createEngine({
            counter: init(100)
                .on('foo', () => {
                    return fx.effect({type: 'foo'})
                })
        })
        .onEffect('foo', function* () {
            whatHappened.push(['generator entered']);
            let valueFromNext;
            valueFromNext = yield fx.next(200);
            whatHappened.push(['emitted', valueFromNext]);
            whatHappened.push(['store', store.getState()]);
            valueFromNext = yield fx.next(300);
            whatHappened.push(['emitted', valueFromNext]);
            whatHappened.push(['store', store.getState()]);
        })
        .getStore();

        assert.deepStrictEqual(store.getState(), {counter: 100});
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {counter: 300});
        assert.deepStrictEqual(whatHappened, [
            ['generator entered'],
            ['emitted', 200],
            ['store', {counter: 200}],
            ['emitted', 300],
            ['store', {counter: 300}],

        ]);
    });
});
    
describe('[time effects]', () => {
    it('fx.delay should call setTimeout', (done) => {
        const sT = global.setTimeout;
        let whatHappened = [];
        global.setTimeout = (func, time) => {
            whatHappened.push(['setTimeout', time])
            func();
        };
        const store = prepareStore({
            a: init('foo')
                .on('breakfast', () => {
                    return fx.delay(100, 'kanapka');
                })
        });
        assert.deepStrictEqual(store.getState(), {a: 'foo'});
        store.dispatch({type: 'breakfast'});
        assert.deepStrictEqual(whatHappened, [
            ['setTimeout', 100]
        ]);
        sT(() => {
            assert.deepStrictEqual(store.getState(), {a: 'kanapka'});
            done();
        }, 0);
        global.setTimeout = sT;
    });
});

describe('[computed values - fx.compute]', () => {
    it('should update property after each action', () => {
        let c = 0;
        const store = withRedux(Redux).createEngine({
            a: init('?')
                .on('foo', () => {
                    return fx.compute({'type': 'plum'})
                }),
        })
        .onEffect({type: 'plum'}, () => {
            return c++;
        })
        .getStore();
        assert.deepStrictEqual(store.getState(), {a: '?'});
        store.dispatch({type: 'aaaaaaa'});
        assert.deepStrictEqual(store.getState(), {a: '?'});
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {a: 0});
        store.dispatch({type: 'qwerty'});
        assert.deepStrictEqual(store.getState(), {a: 1});
        store.dispatch({type: 'asdfq'});
        assert.deepStrictEqual(store.getState(), {a: 2});
    });

    it('should update computed property after each asynchronous change', (done) => {
        let c = 0;
        const store = withRedux(Redux).createEngine({
            a: init(0)
                .on('foo', (state) => {
                    return () => Promise.resolve(state + 10);
                }),
            derived: init(0)
                .on({type: 'init'}, () => fx.compute({type: 'doCompute'}))
        })
            .onEffect({type: 'doCompute'}, function* () {
                return (yield fx.getState()).a * 2;
            })
            .getStore();

        assert.deepStrictEqual(store.getState(), {a: 0, derived: 0});

        store.dispatch({type: 'init'});

        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {a: 0, derived: 0});
        setTimeout(() => {
            assert.deepStrictEqual(store.getState(), {a: 10, derived: 20});
            done();
        }, 0);


    });

    it('should remove previous effects', () => {
        let c = 0;
        const whatHappened = [];
        const store = withRedux(Redux).createEngine({
            a: init('?')
                .on('foo', (state, action) => {
                    return fx.compute({'type': action.payload})
                }),
        })
        .onEffect({type: 'plum'}, () => {
            whatHappened.push('plum');
        })
        .onEffect({type: 'cherry'}, () => {
            whatHappened.push('cherry');
        })
        .onEffect({type: 'strawberry'}, () => {
            whatHappened.push('strawberry');
        })
        .getStore();
        assert.deepStrictEqual(store.getState(), {a: '?'});
        store.dispatch({type: 'foo', payload: 'plum'});
        assert.deepStrictEqual(whatHappened, [
            'plum'
        ]);
        store.dispatch({type: 'foo', payload: 'cherry'});
        assert.deepStrictEqual(whatHappened, [
            'plum',
            'cherry'
        ]);

        store.dispatch({type: 'foo', payload: 'strawberry'});
        assert.deepStrictEqual(whatHappened, [
            'plum',
            'cherry',
            'strawberry',
        ]);
    });

});