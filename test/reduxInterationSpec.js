const assert = require('assert');
const Resmix = require('../resmix');

const { createStore } = require('redux');
describe('resmix', () => {
    it('should allow for declare pattern/reducer pairs', () => {
        const INC = 'inc';
        const DEC = 'dec';
        const store = createStore(Resmix.reducerFor({
            counter: Resmix.match([
                [INC, v => v + 1],
                [DEC, v => v - 1],
            ]),
            counterX2: Resmix.match([
                [INC, v => v + 2],
                [DEC, v => v - 2],
            ])
        }), {counter: 0, counterX2: 0});
        assert.deepStrictEqual(store.getState(), {counter: 0, counterX2: 0});
        store.dispatch({type: INC});
        store.dispatch({type: INC});
        assert.deepStrictEqual(store.getState(), {counter: 2, counterX2: 4});
        store.dispatch({type: DEC});
        assert.deepStrictEqual(store.getState(), {counter: 1, counterX2: 2});
    });
});