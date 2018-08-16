'use strict';

const { defineEffect } = require('..');
const { expect } = require('chai');

const meta = {
    feedbacks: {
        isEffect: true
    }
};

describe('effect creator created via defineEffect()', () => {
    let createEffect;
    beforeEach(() => {
        createEffect = defineEffect('foo');
    });
    it('when calling without parameters should return an object with the correct type (and without other fields)', () => {
        const action = createEffect();
        expect(action).to.deep.equal({
            type: 'foo',
            meta,
        });
    });

    it('when calling with parameter should return an object with the correct type and payload', () => {
        const action = createEffect({bar: 3});
        expect(action).to.deep.equal({
            type: 'foo',
            payload: {
                bar: 3
            },
            meta,
        });
    });

    it('when calling with falsy but not-undefined parameter should still return an object with the correct type and payload', () => {
        let action;
        action = createEffect(0);
        expect(action).to.deep.equal({
            type: 'foo',
            payload: 0,
            meta,
        });

        action = createEffect(false);
        expect(action).to.deep.equal({
            type: 'foo',
            payload: false,
            meta,
        });

        action = createEffect('');
        expect(action).to.deep.equal({
            type: 'foo',
            payload: '',
            meta,
        });

        action = createEffect(null);
        expect(action).to.deep.equal({
            type: 'foo',
            payload: null,
            meta,
        });
    });
});


