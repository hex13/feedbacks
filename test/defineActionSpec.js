'use strict';

const { defineAction } = require('..');
const { expect } = require('chai');

describe('action creator created via defineAction()', () => {
    let createAction;
    beforeEach(() => {
        createAction = defineAction('foo');
    });
    it('when calling without parameters should return an object with the correct type (and without other fields)', () => {
        const action = createAction();
        expect(action).to.deep.equal({
            type: 'foo'
        });
    });

    it('when calling with parameter should return an object with the correct type and payload', () => {
        const action = createAction({bar: 3});
        expect(action).to.deep.equal({
            type: 'foo',
            payload: {
                bar: 3
            },
        });
    });

    it('when calling with falsy but not-undefined parameter should still return an object with the correct type and payload', () => {
        let action;
        action = createAction(0);
        expect(action).to.deep.equal({
            type: 'foo',
            payload: 0
        });

        action = createAction(false);
        expect(action).to.deep.equal({
            type: 'foo',
            payload: false
        });

        action = createAction('');
        expect(action).to.deep.equal({
            type: 'foo',
            payload: ''
        });

        action = createAction(null);
        expect(action).to.deep.equal({
            type: 'foo',
            payload: null
        });
    });
});


