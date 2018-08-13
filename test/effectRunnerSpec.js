'use strict';
const assert = require('assert');
const EffectRunner = require('../effectRunner');
const { of, Observable } = require('rxjs');
const Formula = require('../formula');
const _it = it;

const deferChecking = (func) => {
    return new Promise(resolve => {
        setTimeout(() => {
            func();
            resolve();
        }, 20);
    });
};

const Result = (v, path = []) => ({
    value: v,
    path
});

describe('EffectRunner', () => {
    let er, whatHappened;
    const next = (...args) => {
        whatHappened.push(['next', ...args]);
    };

    beforeEach(() => {
        console.log("before each");
        whatHappened = [];
        er = new EffectRunner();
    });

    describe('run api call', () => {
        let result;
        let ctx;
        const cb = (...args) => {
            result.push(["callback called", args])
        };

        beforeEach('', () => {
            result = [];
            ctx = {ourContext: true};
        });

        const runEffects = (er) => {
        }


        xit('should run correct functions and with correct parameters', () => {
            const api = {
                foo(...args) {
                    result.push(['foo called', this, ...args]);
                },
                bar(...args) {
                    assert.strictEqual(this, ctx);
                    result.push(['bar called', this, ...args]);
                }
            };
            const er = new EffectRunner(api);
            er.run({
                [EffectRunner.CALL]: ['foo']
            });
            er.run({
                [EffectRunner.CALL]: ['bar', 1, 'abc']
            }, cb, ctx);
            assert.deepStrictEqual(result, [
                ['foo called', undefined],
                ['bar called', ctx, 1, 'abc'],
            ]);
        })

        it('should not call cb when result of effect is undefined', () => {
            const api = {
                foo() {
                },
            };
            const er = new EffectRunner(api);
            er.run({
                [EffectRunner.CALL]: ['foo']
            }, cb);
            return deferChecking(() => {
                assert.deepStrictEqual(result, []);
            });
 
        });

        it('should call cb with resolved scalar value', () => {
            const api = {
                foo() {
                    return 'Squirrel';
                },
            };
            const er = new EffectRunner(api);
            er.run({
                [EffectRunner.CALL]: ['foo']
            }, cb);

            return deferChecking(() => {
                assert.deepStrictEqual(result, [
                    ['callback called', [Result('Squirrel')]],
                ]);
            });
        });

        it('should call cb with resolved promise value', () => {
            const api = {
                foo() {
                    return Promise.resolve('Chipmunk');
                },
            };
            const er = new EffectRunner(api);
            er.run({
                [EffectRunner.CALL]: ['foo']
            }, cb);

            return deferChecking(() => {
                assert.deepStrictEqual(result, [
                    ['callback called', [Result('Chipmunk')]],
                ]);    
            });
        });

        it('should call cb with recursively resolved value', () => {
            const api = {
                foo() {
                    return {
                        [EffectRunner.CALL]: ['bar']
                    };
                },
                bar() {
                    return Promise.resolve({
                        [EffectRunner.CALL]: ['baz']
                    });
                },
                baz() {
                    return of('abc', 'def', 'ghi');
                }
            };
            const er = new EffectRunner(api);
            er.run({
                [EffectRunner.CALL]: ['foo']
            }, cb);

            return deferChecking(() => {
                assert.deepStrictEqual(result, [
                    ['callback called', [Result('abc')]],
                    ['callback called', [Result('def')]],
                    ['callback called', [Result('ghi')]],
                ]);    
            });
        });



    });

    describe('[scalar as effects]', () => {
        it('should resolve a scalar', () => {
            er.run('some scalar', next);

            return deferChecking(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['next', Result('some scalar')],
                ]);    
            });
        });

        it('should resolve an object', () => {
            er.run({a: 3, b: {c: 4}}, next);

            return deferChecking(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['next', Result({a: 3, b: {c: 4}})],
                ]);    
            });
        });
    });

    describe('[returning result]', () => {
        it('should return a result when a primitive is passed', () => {
            assert.deepStrictEqual(er.run(0, next), Result(0));
            assert.deepStrictEqual(er.run(3, next), Result(3));
            assert.deepStrictEqual(er.run('', next), Result(''));
            assert.deepStrictEqual(er.run('kotek', next), Result('kotek'));
            assert.deepStrictEqual(er.run(false, next), Result(false));
            assert.deepStrictEqual(er.run(true, next), Result(true));
        });    
       
        it('should return a result when an object is passed', () => {
            const Obj = () => ({a: 3, b: {c: 4}});
            assert.deepStrictEqual(er.run(Obj(), next), Result(Obj()));
        });
        it('should return a result when a synchronous function as effect is passed', () => {
            assert.deepStrictEqual(er.run(() => 32, next), Result(32));
        });
        
        it('should not return a result when asynchronous effect is passed', () => {
            assert.deepStrictEqual(er.run(Promise.resolve(1), next), undefined);
        });
        
        it('should return a result when a primitive as a recursive effect is passed', () => {
            const Recursive = (v) => ({
                [EffectRunner.RECURSIVE]: v
            })
            assert.deepStrictEqual(er.run(Recursive(0), next), Result(0));
            assert.deepStrictEqual(er.run(Recursive(3), next), Result(3));
            assert.deepStrictEqual(er.run(Recursive(''), next), Result(''));
            assert.deepStrictEqual(er.run(Recursive('kotek'), next), Result('kotek'));
            assert.deepStrictEqual(er.run(Recursive(false), next), Result(false));
            assert.deepStrictEqual(er.run(Recursive(true), next), Result(true));
        });

        it('should return a result when a fully-resolved flat object as a recursive effect is passed', () => {
            const Recursive = (v) => ({
                [EffectRunner.RECURSIVE]: v
            })
            const Obj = () => ({
                a: 123
            });
            assert.deepStrictEqual(er.run(Recursive(Obj()), next), Result(Obj()));
        });

        // description of this `it` is weird.
        // but it just tests if you can:
        // 1. pass a nested object which contains some effects (but only effects that could be resolved in synchronous way, like plain functions)
        // 2. have completely resolved object
        // This demands recursiveness on the implementation side.
        // look on effectRunner.js:92 in commit 631a9fb6 

        it('should return a result when a nested object as a recursive effect (but resolvable in sync) is passed', () => {

            const Recursive = (v) => ({
                [EffectRunner.RECURSIVE]: v
            })
            const Obj = () => ({
                a: () => ({
                    b: () => 123
                })
            });
            assert.deepStrictEqual(er.run(Recursive(Obj()), next), Result({
                a: {
                    b: 123
                }
            }));
        });
        

        it('should return a result when a fully-resolved nested object as a recursive effect is passed', () => {
            const Recursive = (v) => ({
                [EffectRunner.RECURSIVE]: v
            })
            const Obj = () => ({
                a: {
                    b: 19,
                    c: {
                        d: 10
                    }
                }
            });
            assert.deepStrictEqual(er.run(Recursive(Obj()), next), Result(Obj()));
        });

        it('should return a partial result when a partially-resolved nested object as a recursive effect is passed', () => {
            const Recursive = (v) => ({
                [EffectRunner.RECURSIVE]: v
            })

            const Obj = () => ({
                a: {
                    b: undefined,
                    c: {
                        d: undefined
                    }
                }
            });
            const obj = Obj();
            obj.a.b = Promise.resolve(10);
            obj.a.c.d = Promise.resolve(11);
            assert.deepStrictEqual(er.run(Recursive(obj), next), Result(Obj()));
        });

    });
    

    describe('[formulas as effects]', () => {
        it('should resolve initial state of formula (scalars)', () => {
            er.run(new Formula().init(124), next);
            er.run(new Formula().init('abc'), next);

            assert.deepStrictEqual(whatHappened, [
                ['next', Result(124)],
                ['next', Result('abc')],
            ]);    
        });

        it('should resolve initial state of formula (objects without formulas inside)', () => {
            const Obj = () => ({
                a: 1,
                b: {
                    c: 3
                }
            });
            er.run(new Formula().init(Obj()), next);

            assert.deepStrictEqual(whatHappened, [
                ['next', Result(Obj())],
            ]);    
        });

        it('should resolve initial state of formula (objects with formulas inside)', () => {
            er.run(new Formula().init({
                a: 1,
                b: {
                    c: new Formula().init(3)
                }
            }), next);

            assert.deepStrictEqual(whatHappened, [
                ['next', Result({
                    a: 1,
                    b: {
                        c: 3
                    }
                })],
            ]);    
        });

    });
 
    describe('[promises as effects]', () => {
        it('should resolve a promise', () => {
            er.run(Promise.resolve(42), next);

            return deferChecking(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['next', Result(42)],
                ]);    
            });
        });
    });

    describe('[observables as effects]', () => {
        it('should subscribe to the Observable and invoke the callback for each value', () => {
            er.run(new Observable(observer => {
                observer.next('whatever');
                observer.next('woo');
            }), next);

            assert.deepStrictEqual(whatHappened, [
                ['next', Result('whatever')],
                ['next', Result('woo')],
            ]);    
        });
    });


    describe('[generators as effects]', () => {

        it( '1. should resolve yielded values and pass them back to the generator 2. should emit returned value of generator', () => {
            er.run(function* () {
                const a = yield () => 'hello';
                whatHappened.push(['received', a]);
                const b = yield () => Promise.resolve('world');
                whatHappened.push(['received', b]);
                return Promise.resolve(a + ' ' + b); // wrap in promise to check if returned value is also resolved to scalar
            }, next);

            return deferChecking(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['received', 'hello'],
                    ['received', 'world'],
                    ['next', Result('hello world')],
                ]);    
            });
        });
    });

    describe('[effect tagged as EffectRunner.EFFECT]', () => {
        it('should detect effect', () => {
            const result = er.run({
                [EffectRunner.EFFECT]: 'efekt'
            }, next); 
            assert.deepStrictEqual(whatHappened, [
                ['next', Result('efekt')],
            ]);
        });
    });

    describe('[functions as effects]', () => {
        it('should run the function and given the result is a scalar, should invoke the callback with the exact value', () => {
            const result = er.run(() => {
                whatHappened.push(['effect']);
                return 'whatever';
            }, next); 
            assert.deepStrictEqual(whatHappened, [
                ['effect'],
                ['next', Result('whatever')],
            ]);
        });


        it('should run the function and given the result is a Promise, should invoke the callback with the resolved value', (done) => {
            const result = er.run(() => {
                whatHappened.push(['effect']);
                return Promise.resolve('whatever');
            }, next);
            setTimeout(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['effect'],
                    ['next', Result('whatever')],
                ]);
                done();
            }, 0);
        });

        it('should resolve functions which return falsy values (without undefined)', () => {
            er.run(() => 0, next);
            er.run(() => '', next);
            er.run(() => false, next);
            er.run(() => null, next);

            assert.deepStrictEqual(whatHappened, [
                ['next', Result(0)],
                ['next', Result('')],
                ['next', Result(false)],
                ['next', Result(null)],
            ]);
        });

        it('should run the functions recursively until result', () => {
            const result = er.run(() => () => () => () => 98765, next);

            assert.deepStrictEqual(whatHappened, [
                ['next', Result(98765)],
            ]);
        });

        it('should run the functions recursively until result (with promises)', (done) => {
            const result = er.run(() => () => Promise.resolve(() => Promise.resolve(98765)), next);

            setTimeout(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['next', Result(98765)],
                ]);
                done();
            }, 0);
        });


    });

    describe('[flow]', () => {
        it('resolves flow', () => {
            er.run({
                [EffectRunner.FLOW]: [
                    'Hey',
                    'You!',
                    {name: 'Pink Floyd'},
                    1,
                    0,
                    '',
                    null,
                    () => 123,
                    (v) => v * 2,
                    () => Promise.resolve(456),
                    undefined, 
                    () => () => () => Promise.resolve('Inception'),
                    () => of(10, 20, 30),
                    // TODO. next handle should receive last observable value, not first:
                    // last => last + 1
                ]
            }, next);

            return deferChecking(() => {
                console.log("\n\n\n\n\n", JSON.stringify(whatHappened,0,2));
                assert.deepEqual(whatHappened, [
                    ['next', Result('Hey')],
                    ['next', Result('You!')],
                    ['next', Result({name: 'Pink Floyd'})],
                    ['next', Result(1)],
                    ['next', Result(0)],
                    ['next', Result('')],
                    ['next', Result(null)],
                    ['next', Result(123)],
                    ['next', Result(246)],
                    ['next', Result(456)],
                    ['next', Result(undefined)],
                    ['next', Result('Inception')],
                    ['next', Result(10)],
                    ['next', Result(20)],
                    ['next', Result(30)],
                    // ['next', 31],
                ]);    
            })
        })
       
    });

});
