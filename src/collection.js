'use strict';

const { isMatch } = require('./matching');

class Collection {
    constructor(data) {
        this._data = data || [];
        this.__raw = true;
    }
    add(item) {
        return new Collection(this._data.concat(item));
    }
    remove(params) {
        return this.update(params, null)
    }
    find(params) {
        return this._data.find(item => {
            return isMatch(params, item);
        });
    }
    findAll(params) {
        return this._data.filter(item => {
            return isMatch(params, item);
        })
    }
    update(params, updates) {
        const idx = this._data.findIndex(item => {
            return isMatch(params, item);
        });
        if (idx != -1) {
            const original = this._data[idx];
            const firstSlice = this._data.slice(0, idx);
            const lastSlice = this._data.slice(idx + 1, this._data.length)

            return new Collection(
                firstSlice.concat(
                    ...(updates === null? [lastSlice] : [Object.assign({}, original, updates), lastSlice])
                )

            );    
        }
    }
    get count() {
        return this._data.length;
    }
};

module.exports = Collection;