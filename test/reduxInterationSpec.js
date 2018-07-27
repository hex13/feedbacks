'use strict';

const assert = require('assert');
const Resmix = require('../resmix');

require('symbol-observable');
const { createStore, applyMiddleware } = require('redux');
const Redux = require('redux');
const { Observable, interval, Subscription, of } = require('rxjs');
const { take } = require('rxjs/operators');
const testing = require('rxjs/testing');
const { createEngine, withRedux, init } = require('..');

const prepareStore = (blueprint) => {
    return withRedux(Redux).createStore(blueprint);
    const resmix = createEngine(blueprint);
    const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
    return store;
};

const prepareEngine = (blueprint) => {
    const resmix = Resmix.Resmix(blueprint);
    const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
    return { store, engine: resmix };
};

global.assert = assert;

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

    it('should allow for create empty object as value of property', () => {
        const store = prepareStore({
            a: {}
        });
        assert.deepStrictEqual(store.getState(), {a: {}})

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
            const resmix = Resmix.Resmix({
                a: Resmix.init({
                    b: Resmix.init(10).on('foo', () => 3)
                })
            });
            const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
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
        const resmix = Resmix.Resmix(createBlueprint());
        const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
        assert.deepStrictEqual(store.getState(), createBlueprint());
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
        const resmix = createEngine(a => createBlueprint(a));
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
                        return Resmix.mount(
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
                        return Resmix.mount(
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
            foo: init(0).match('foo', () => () => Resmix.mount(Promise.resolve(1234)))
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
                        return Resmix.mount({
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
                        return Resmix.mount({
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
        const blueprint = ({ init }) => ({
            a: init(2)
        });

        beforeEach(() => {
        });

        it('should allow for define initial state by using init()', () => {
            const store = prepareStore(blueprint);
            assert.deepStrictEqual(store.getState(), {a:2});
        });

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
            counter: Resmix.match([
                [INC, v => v + 1],
                [INC, v => 'second match should have not effect'],
                [DEC, v => v - 1],
            ]),
            counterX2: Resmix
                .match(INC, v => v + 2)
                .match(DEC, v => v - 2)
        };
        const resmix = Resmix.Resmix(blueprint);
        const store = createStore(resmix.reducer, {counter: 0, counterX2: 0}, applyMiddleware(resmix.middleware));
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
            counter: Resmix.match([
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
        const resmix = Resmix.Resmix(blueprint);
        const store = createStore(resmix.reducer, {counter: 0}, applyMiddleware(resmix.middleware));
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
            counter: Resmix.match([
                [{type: FOO, a: {
                    b: 'bear',
                    c: {
                        d: 123
                    }
                }}, (v, a) => -2],
            ]),
        };
        const resmix = Resmix.Resmix(blueprint);
        const store = createStore(resmix.reducer, {counter: 0}, applyMiddleware(resmix.middleware));
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
            counter: Resmix.match([
                [{type: FOO, a: {
                    b: 'bear',
                    c: {
                        d: 123
                    }
                }}, (v, a) => -2],
            ]),
        };
        const resmix = Resmix.Resmix(blueprint);
        const store = createStore(resmix.reducer, {counter: 0}, applyMiddleware(resmix.middleware));
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

    describe('[spawning]', () => {
        let store, engine;
        beforeEach(() => {
            ({ store, engine } = prepareEngine({
                someFoo: Resmix.init(0).match([
                    ['foo', function (state, action) {
                        return Resmix.spawn({type: 'bar'});
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

    describe('[generators]', () => {
        let store, engine;
        beforeEach(() => {
            ({ store, engine } = prepareEngine({
                counter: Resmix.init(0).match([
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
        const store = prepareStore(({init}) => ({
            foo: {
                a: Resmix.init(123).match('foo', v => 456)
            },
            deep: {
                foo,
                a: init(0)
                    .match('inc', v => v + 1)
            }
        }));

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
                baz: Resmix.init(0).match('inc', v => v + 100),
                qux: Resmix.init(0).match('inc', v => v + 1000)
            }
        });

        assert.deepStrictEqual(store.getState(), {foo: 0, bar: 0, deep: {baz: 0, qux: 0} });
        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['foo']
                }
            }
        })
        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 0, deep: {baz: 0, qux: 0} });
        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['bar']
                }
            }
        })
        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 10, deep: {baz: 0, qux: 0} });
        
        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['deep']
                }
            }
        });

        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 10, deep: {baz: 100, qux: 1000} });

        store.dispatch({
            type: 'inc',
            meta: {
                feedbacks: {
                    path: ['deep', 'baz']
                }
            }
        });

        assert.deepStrictEqual(store.getState(), {foo: 1, bar: 10, deep: {baz: 200, qux: 1000} });

    });
});