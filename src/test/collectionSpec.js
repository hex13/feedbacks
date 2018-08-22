'use strict';

const Collection = require('../collection');
const { expect } = require('chai');

describe('Collection', () => {
    describe('adding items', () => {
        let originalCollection;
        let latestCollection;
        beforeEach(() => {
            originalCollection = new Collection();
            latestCollection = originalCollection
                .add({ kind: 'dress', color: 'red' })
                .add({ kind: 't-shirt', color: 'red' })
        });
        it('instanceof', () => {
            expect(originalCollection).instanceof(Collection);
            expect(latestCollection).instanceof(Collection);
        });
        it('count', () => {
            expect(originalCollection.count).to.equal(0);
            expect(latestCollection.count).to.equal(2);
        });
        it('should allow for retrieving added item', () => {
            expect(originalCollection.find({ kind: 't-shirt'})).to.equal(undefined);
            expect(latestCollection.find({ kind: 't-shirt'}, 1)).to.deep.equal({
                kind: 't-shirt',
                color: 'red',
            });
        });    
    })

    describe('removing items', () => {
        let originalCollection;
        let latestCollection;
        beforeEach(() => {
            originalCollection = new Collection()
                .add({ kind: 'dress', color: 'brown' })
                .add({ kind: 'shoes', color: 'brown' })
                .add({ kind: 'jeans', color: 'blue' });
            latestCollection = originalCollection.remove({ kind: 'shoes' });

        });
        it('instanceof', () => {
            expect(originalCollection).instanceof(Collection);
            expect(latestCollection).instanceof(Collection);
        });
        it('count', () => {
            expect(originalCollection.count).to.equal(3);
            expect(latestCollection.count).to.equal(2);
        });
        it('shouldn\'t find removed item', () => {
            expect(originalCollection.find({ kind: 'shoes'})).to.deep.equal({
                kind: 'shoes',
                color: 'brown'
            });
            expect(latestCollection.find({ kind: 'shoes'})).to.equal(undefined);
        });    
    });

    describe('updating items', () => {    
        let originalCollection;
        let latestCollection;
        beforeEach(() => {
            originalCollection = new Collection()
                .add({ kind: 'dress', color: 'brown' })
                .add({ kind: 'shoes', color: 'brown' })
                .add({ kind: 'jeans', color: 'blue' });
            latestCollection = originalCollection.update({ kind: 'shoes'}, { color: 'black' });

        });
        it('instanceof', () => {
            expect(originalCollection).instanceof(Collection);
            expect(latestCollection).instanceof(Collection);
        });
        it('count', () => {
            expect(originalCollection.count).to.equal(3);
            expect(latestCollection.count).to.equal(3);
        });
        it('shouldn\'t find updated item', () => {
            expect(originalCollection.find({ kind: 'shoes'})).to.deep.equal({
                kind: 'shoes',
                color: 'brown'
            });
            expect(latestCollection.find({ kind: 'shoes'})).to.deep.equal({
                kind: 'shoes',
                color: 'black'
            });
        });    
    });

    describe('finding items', () => {
        it('findAll', () => {
            const collection = new Collection()
                .add({ kind: 'dress', color: 'blue'})
                .add({ kind: 'dress', color: 'green'})
                .add({ kind: 'jeans', color: 'blue'})
                .add({ kind: 'shoes', color: 'white'})
                .add({ kind: 'dress', color: 'white'})
                .add({ kind: 'hat', color: 'white'})
                .add({ kind: 't-shirt', color: 'black'});

            expect(collection.findAll({ kind: 'dress'})).to.deep.equal([
                { kind: 'dress', color: 'blue'},
                { kind: 'dress', color: 'green'},
                { kind: 'dress', color: 'white'},
            ]);

            expect(collection.findAll({ kind: 'not existing'})).to.deep.equal([]);

        });
    });

})