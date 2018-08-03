'use strict';
const assert = require('assert');
const EffectRunner = require('../effectRunner');
const { of, Observable } = require('rxjs');
const _it = it;

const deferChecking = (func) => {
    return new Promise(resolve => {
        setTimeout(() => {
            func();
            resolve();
        }, 20);
    });
};


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


        it('should run correct functions and with correct parameters', () => {
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
                    ['callback called', ['Squirrel']],
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
                    ['callback called', ['Chipmunk']],
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
                    ['callback called', ['abc']],
                    ['callback called', ['def']],
                    ['callback called', ['ghi']],
                ]);    
            });
        });



    });

    describe('[scalar as effects]', () => {
        it('should resolve a scalar', () => {
            er.run('some scalar', next);

            return deferChecking(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['next', 'some scalar'],
                ]);    
            });
        });
    });
 
    describe('[promises as effects]', () => {
        it('should resolve a promise', () => {
            er.run(Promise.resolve(42), next);

            return deferChecking(() => {
                assert.deepStrictEqual(whatHappened, [
                    ['next', 42],
                ]);    
            });
        });
    });

    describe('[observables as effects]', () => {
        it('should subscribe to the Observable and invoke the callback for each value', () => {
            er.run(new Observable(observer => {
                observer.next('whatever');
            }), next);

            assert.deepStrictEqual(whatHappened, [
                ['next', 'whatever'],
            ]);    
        });
    });

    describe('[effect tagged as EffectRunner.EFFECT]', () => {
        it('should detect effect', () => {
            const result = er.run({
                [EffectRunner.EFFECT]: 'efekt'
            }, next); 
            assert.deepStrictEqual(whatHappened, [
                ['next', 'efekt'],
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
                ['next', 'whatever'],
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
                    ['next', 'whatever'],
                ]);
                done();
            }, 0);
        });

        it('should run the functions recursively until result', () => {
            const result = er.run(() => () => () => () => 98765, next);
            
            assert.deepStrictEqual(whatHappened, [
                ['next', 98765],
            ]);
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
                    ['next', 'Hey'],
                    ['next', 'You!'],
                    ['next', {name: 'Pink Floyd'}],
                    ['next', 1],
                    ['next', 0],
                    ['next', ''],
                    ['next', null],
                    ['next', 123],
                    ['next', 246],
                    ['next', 456],
                    ['next', undefined],
                    ['next', 'Inception'],
                    ['next', 10],
                    ['next', 20],
                    ['next', 30],
                    // ['next', 31],
                ]);    
            })
        })
       
    });

});
