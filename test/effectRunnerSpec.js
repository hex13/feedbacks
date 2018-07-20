'use strict';
const assert = require('assert');
const EffectRunner = require('../effectRunner');
const { of, Observable } = require('rxjs');
const _it = it;

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

    it('run api call', () => {
        const result = [];
        const ctx = {ourContext: true};
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
        }, null, ctx);
        assert.deepStrictEqual(result, [
            ['foo called', undefined],
            ['bar called', ctx, 1, 'abc'],
        ]);

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

    });

});
