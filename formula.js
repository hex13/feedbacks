'use strict';

const { isMatch } = require('./matching');

class Formula {
    constructor(recipe) {
        if (recipe) {
            Object.assign(this, recipe);
        }
    }
    init(value) {
        const recipe = new Formula(this);
        recipe.initialState = value;
        recipe.hasInitialState = true;
        return recipe;
    }
    // return new Recipe object with given pattern and data
    on(...args) {
        return this.match(...args);
    }
    match(...args) {
        const recipe = new Formula(this);
        recipe.hasMatchPairs = true;

        if (args.length == 2) {
            recipe.pairs = (recipe.pairs || []).concat([args]);
        } else {
            const pairs = args[0];
            recipe.pairs = pairs;
        }
        return recipe;
    }
    // executes pattern-matching and runs callback
    doMatch(action, onMatch) {
        let matched = false;
        const pairs = this.pairs;
        
        if (pairs) for (let i = 0; i < pairs.length; i++) {
            let [pattern, reducer] = pairs[i];
            if (matched)
                return;
            let equal = isMatch(pattern, action);
            if (equal) {
                onMatch(reducer);
                matched = true;
            }
        }

        function search(node) {
            if (node instanceof Formula) {
                node.doMatch(action, onMatch);
                return;
            }
            if (!isPlainValue(node)) for (let k in node) {
                search(node[k])
            }
        }
        if (this.hasInitialState) {
         //   search(this.initialState)
        }
    }
    itemsLike(itemBlueprint, mapActionToKey) {
        const recipe = new Formula(this);
        recipe.itemBlueprint = itemBlueprint;
        recipe.mapActionToKey = mapActionToKey;
        return recipe;
    }
};

module.exports = Formula;