const assert = require('assert');
const Resmix = require('../resmix');

require('symbol-observable');
const { createStore, applyMiddleware } = require('redux');
const { Observable, interval, Subscription, of } = require('rxjs');
const { take } = require('rxjs/operators');
const testing = require('rxjs/testing');

const prepareStore = (blueprint) => {
    const resmix = Resmix.Resmix(blueprint);
    const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
    return store;
};

const prepareEngine = (blueprint) => {
    const resmix = Resmix.Resmix(blueprint);
    const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));
    return { store, engine: resmix };
};


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

    it('should allow for declare deep matchings', (done) => {
        const createBlueprint = () => ({
            user: {
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
        const resmix = Resmix.Resmix(createBlueprint());
        const store = createStore(resmix.reducer, applyMiddleware(resmix.middleware));

       assert.deepStrictEqual(store.getState(), {
            user: {
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

    describe('init', () => {
        const blueprint = {
            a: Resmix.init(2)
        }

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
        const store = createStore(resmix.reducer, {counter: 0});
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
        const store = createStore(resmix.reducer, {counter: 0});
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
        const store = createStore(resmix.reducer, {counter: 0});
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
                someBar: Resmix.init(100).match([
                    ['bar', function* (state, action) {
                        yield 'something yielded';
                        return state + 10;
                    }]
                ]),
                guard: 'the same'
            }));
        });

        it('should spawn action', () => {
            store.dispatch({type: 'foo'});
            assert.deepStrictEqual(store.getState(), {someFoo: 'something yielded', someBar: 110, guard: 'the same'});
        });

        it('should spawn once, clean after each action', () => {
            store.dispatch({type: 'foo'});
            store.dispatch({type: 'some other action'});
            store.dispatch({type: 'yet another action'});
            assert.deepStrictEqual(store.getState(), {someFoo: 'something yielded', someBar: 110, guard: 'the same'});
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
