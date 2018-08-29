'use strict';
const Redux = require('redux');
const { createStore } = Redux;
const { Observable, interval, Subscription, of } = require('rxjs');
const { withRedux, init, createFeedbacks, defineEffect } = require('../..');
const fx = require('../../fx');

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
                assert.deepStrictEqual(yield fx.select(), {foo: 0, bar: ''});
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

describe('[effects - functions]', () => {
    it('function should receive `next` and `current` arguments', () => {
        const store = createStore({
            foo: init(10)
                .on('someAction', () => (next, current) => {
                    next(current() + 15);
                    assert.strictEqual(store.getState().foo, 25);
                    assert.strictEqual(current(), 25);
                    
                    next(current() + 15);
                    assert.strictEqual(store.getState().foo, 40);
                    assert.strictEqual(current(), 40);
                })
        }, createFeedbacks());
        assert.deepStrictEqual(store.getState(), {foo: 10});
        store.dispatch({type: 'someAction'});
        assert.deepStrictEqual(store.getState(), {foo: 40});
        
    });

    it('function should receive `fx` argument with effects API', (done) => {
        const whatHappened = [];
        const store = createStore({
            foo: init(10)
                .on('someAction', () => async (next, current, fx) => {
                    whatHappened.push(['func 1', fx && typeof fx == 'object' && 'ok' || fx]);
                    const action = await fx.waitFor('otherAction');
                    console.log("!!!!!!#")
                    whatHappened.push(['func 2', action]);
                })
        }, createFeedbacks());
       assert.deepStrictEqual(store.getState(), {foo: 10});
       store.dispatch({type: 'someAction'});
       store.dispatch({type: 'aa'});
       store.dispatch({type: 'otherAction'});
       setTimeout(() => {
            assert.deepStrictEqual(whatHappened, [
                ['func 1', 'ok'],
                ['func 2', {type: 'otherAction'}],
            ]);
            done();
       }, 0);
        
    });
});

describe('[effects - observables]', () => {
    let store;
    let subscriptionCount = 0;
    beforeEach(() => {
        const blueprint = {
            animal: init('cat')
                .on([
                    ['changeAnimal', () => new Observable(observer => {
                        observer.next('dog')
                        subscriptionCount++;
                    })]
                ])
        };
        subscriptionCount = 0;
        store = createStore(blueprint, createFeedbacks());
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

describe('[cancelling effects', () => {
    it('should cancel observable when other observable is assigned to the same property', () => {
        let n = 0;
        const nexts = [];
        const observables = [0, 1, 2].map(n => new Observable(observer => {
            observer.next('o ' + n)
            nexts.push((v) => observer.next(v));
        }));
        let lastN = 0;
        const engine = withRedux(Redux).createEngine({
            foo: {
                bar: init(0)
                    .on('nextObservable', () => observables[lastN++])
            }
        });
        const store = engine.getStore();

        assert.deepStrictEqual(store.getState(), {foo: { bar: 0 }});
        assert.deepStrictEqual(engine.getOngoingEffects(), []);

        store.dispatch({type: 'nextObservable'});

        assert.deepStrictEqual(store.getState(), {foo: { bar: 'o 0' }});
        assert.deepStrictEqual(engine.getOngoingEffects().length, 1);
        assert.deepStrictEqual(engine.getOngoingEffects()[0].path, ['foo', 'bar']);
        assert.deepStrictEqual(engine.getOngoingEffects()[0].kind, 'observable');

        store.dispatch({type: 'nextObservable'});
        nexts[0]('should be cancelled!')

        assert.deepStrictEqual(store.getState(), {foo: { bar: 'o 1'}});
        assert.deepStrictEqual(engine.getOngoingEffects().length, 1);

    });

    it('should cancel generator when other generator is assigned to the same property', (done) => {
        const whatHappened = [];
        let c = 0;
        let nexts = [];
        const engine = withRedux(Redux).createEngine({
            foo: {
                bar: init(0).on('foo', () => {
                    const n = c++;
                    return function *() {
                        yield new Promise((resolve) => {
                            nexts[n] = resolve;
                        });
                        whatHappened.push(['gen' + n])
                    }
                })
            }
        });
        const store = engine.getStore();
        const inspector = engine;

        assert.deepStrictEqual(store.getState(), {foo: { bar: 0 }});
        let ongoingEffects;

        ongoingEffects = inspector.getOngoingEffects();
        assert.deepStrictEqual(ongoingEffects, []);

        store.dispatch({type: 'foo'});
        
        ongoingEffects = inspector.getOngoingEffects();
        assert.deepStrictEqual(ongoingEffects.length, 1);
        assert.deepStrictEqual(ongoingEffects[0].path, ['foo', 'bar']);
        assert.deepStrictEqual(ongoingEffects[0].kind, 'generator');
        
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(inspector.getOngoingEffects().length, 1);
        nexts[0]();
        nexts[1]();
        setTimeout(() => {
            nexts[1]();
            assert.deepStrictEqual(whatHappened, [
                ['gen1']
            ]);

            done();
        }, 0);
    });

})


// fx helpers

describe('[fx.cancel', () => {
    it('should cancel a generator', (done) => {
        const whatHappened = [];
        const store = createStore({
            counter: init(100)
                .on('foo', () => {
                    return function* () {
                        whatHappened.push(['generator entered']);
                        yield fx.cancel();
                        whatHappened.push(['should not gonna happen']);
                    }
                })
        }, createFeedbacks());
        assert.deepStrictEqual(store.getState(), {counter: 100});
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {counter: 100});
        setTimeout(() => {
            assert.deepStrictEqual(whatHappened, [
                ['generator entered'],
            ]);
            done();
        }, 0);
    })
});


describe('[computed values - fx.compute]', () => {
    xit('should run computed only once if there are no dependencies', () => {
        let c = 0;
        let whatHappened = [];
        const store = withRedux(Redux).createEngine({
            a: init('?')
                .on('foo', () => {
                    return fx.compute({'type': 'plum'})
                }),
        })
        .onEffect({type: 'plum'}, () => {
            whatHappened.push(['gen'])
            return c++;
        })
        .getStore();
        assert.deepStrictEqual(store.getState(), {a: '?'});
        store.dispatch({type: 'aaaaaaa'});
        assert.deepStrictEqual(store.getState(), {a: '?'});
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {a: 0});
        store.dispatch({type: 'qwerty'});
        assert.deepStrictEqual(store.getState(), {a: 0});
        store.dispatch({type: 'asdfq'});
        assert.deepStrictEqual(store.getState(), {a: 0});
        assert.deepStrictEqual(whatHappened, [['gen']]);
    });

    it('should run computed effect only if dependencies change', () => {
        let c = 0;
        const whatHappened = [];
        const store = withRedux(Redux).createEngine({
            whatever: init(0).on('neutralAction', state => state + 1),
            a: init('?')
                .on('foo', () => {
                    return fx.compute({type: 'plum'});
                }),
            b: init(24)
                .on('incB', state => state + 1),
            c: init(10)
                .on('incC', state => state + 1),
        })
        .onEffect({type: 'plum'}, function* () {
            whatHappened.push('gen');
            const b = yield fx.select('b');
            const c = yield fx.select('c');
            yield fx.next(b + c);
        })
        .getStore();
        assert.deepStrictEqual(store.getState(), {a: '?', b: 24, c: 10, whatever: 0});
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {a: 34, b: 24, c: 10, whatever: 0});

        store.dispatch({type: 'neutralAction'});
        assert.deepStrictEqual(whatHappened, ['gen']);

        store.dispatch({type: 'incB'});
        assert.deepStrictEqual(whatHappened, ['gen', 'gen']);
        assert.deepStrictEqual(store.getState(), {a: 35, b: 25, c: 10, whatever: 1});

        store.dispatch({type: 'incC'});
        assert.deepStrictEqual(whatHappened, ['gen', 'gen', 'gen']);
        assert.deepStrictEqual(store.getState(), {a: 36, b: 25, c: 11, whatever: 1});

    });

    // it fixes bug when sync-resolved recomputation was triggered twice in middleware:
    // 1. when callback was fired
    // 2. after middleware was processing an action
    it('should compute only once if effect can be resolved synchronously', (done) => {
        let c = 0;
        const whatHappened = [];
        const store = withRedux(Redux).createEngine({
            a: init(0)
                .on('foo', (state) => {
                    return () => state + 1
                }),
            derived: init(0)
                .on({type: 'init'}, () => fx.compute({type: 'doCompute'}))
        })
            .onEffect({type: 'doCompute'}, function* () {
                whatHappened.push(['doCompute'])
                return yield fx.select('a');
            })
            .getStore();

        store.dispatch({type: 'init'});
        store.dispatch({type: 'foo'});

        assert.deepStrictEqual(whatHappened, [
            ['doCompute'],
            ['doCompute']
        ]);
        done();
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
                return (yield fx.select()).a * 2;
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

describe('[fx.waitFor]', () => {
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


describe('[time effects]', () => {
    it('fx.delay should call setTimeout', (done) => {
        const sT = global.setTimeout;
        let whatHappened = [];
        global.setTimeout = (func, time) => {
            whatHappened.push(['setTimeout', time])
            func();
        };
        const store = createStore({
            a: init('foo')
                .on('breakfast', () => {
                    return fx.delay(100, 'kanapka');
                })
        }, createFeedbacks());
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

describe('[fx.effect]', () => {
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
            const state = yield fx.select();
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
});

describe('[fx.flow]', () => {
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
            valueFromNext = yield fx.next(0);
            whatHappened.push(['emitted', valueFromNext]);
            whatHappened.push(['store', store.getState()]);
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
            ['emitted', 0],
            ['store', {counter: 0}],
            ['emitted', 200],
            ['store', {counter: 200}],
            ['emitted', 300],
            ['store', {counter: 300}],

        ]);
    });

    it('should mount observable (not assigning it) and cancel running function', (done) => {
        const whatHappened = [];
        const observable = new Observable(observer => {
            whatHappened.push(['observable subscribed']);
            observer.next(10);
        });
        const store = createStore({
            counter: init(100)
                .on('foo', () => {
                    return function* () {
                        whatHappened.push(['generator entered']);
                        yield fx.next(observable);
                        whatHappened.push(['should not gonna happen']);
                        yield fx.next('some value from cancelled generator');
                        return 'returned value from cancelled generator';
                    }
                })
        }, createFeedbacks());
        assert.deepStrictEqual(store.getState(), {counter: 100});
        store.dispatch({type: 'foo'});
        assert.deepStrictEqual(store.getState(), {counter: 10});
        setTimeout(() => {
            assert.deepStrictEqual(whatHappened, [
                ['generator entered'],
                ['observable subscribed']
            ]);
            done();
        }, 0);
    });
});

describe('[fx.select]', () => {
    let engine;
    let whatHappened;
    beforeEach(() => {
        whatHappened = [];
        engine = withRedux(Redux).createEngine({ someValue: 'selected value' });
        assert.deepStrictEqual(engine.getStore().getState(), { someValue: 'selected value' });
    });
    it('should return state root when called without arguments', () => {
        engine.runEffect(function*() {
            const state = yield fx.select();
            whatHappened.push(['received', state]);
        });
        assert.deepStrictEqual(whatHappened, [
            ['received', { someValue: 'selected value'}]
        ]);
    });
    it('should return a property when called with a path', () => {
        engine.runEffect(() => {
            return function*() {
                const selected = yield fx.select(['someValue']);
                whatHappened.push(['received', selected]);
            };
        });
        assert.deepStrictEqual(whatHappened, [
            ['received', 'selected value']
        ]);
    });

});
