Blueprints
====

What are blueprints? Well, if you use Redux you probably are familiar with concept of "initial state" i.e. object which represents how the store state will look in the beginning. Blueprints take this idea further and not only represent **initial** state, but also all future states of your application. This means you can match specific actions (look at`.on` from Formulas) into specific properties of the state and associate them with specific reducer.

This effectively would slice your state into individual properties with own property matchers and own reducers. Something similar to nested `combineReducers` but with pattern-matching. 

example of blueprint: 

```javascript
const blueprint = {
    foo: {
        bar: init(10) // initial state of property foo.bar
            .on({type: 'increment'} /*pattern matching */ , (state, action) => {
                return state + 1;
            })
            .on({type: 'decrement'}, (state, action) => {
                return state - 1;
            })
    },
}
```

You then pass such blueprint to `createEngine` function.

Initialization
====

 1. create engine,
 2. (optional) assign effect handlers 
 3. get store

example:
```javascript
import { withRedux } from 'feedbacks';
import * as fx from 'feedbacks/fx';

const someEffect = createEffect('someEffect');
const someOtherEffect = createEffect('someOtherEffect');

const store = withRedux(Redux).createEngine(blueprint)
    // effect handlers are responsible for performing side-effects (e.g. AJAX calls)
    .onEffect(someEffect(), function* (effect) {
        return fetch(effect.payload.url).then(r => r.json()); 
    })
    // you can yield effects to be resolved:
    .onEffect(someOtherEffect(), function* (effect) {
        const state = yield fx.getState();
        const answer = yield () => Promise.resolve(42);
        return state.foo.bar + state.baz + answer; // perform some calculations
    })
    .getStore();
```

Formulas - init() and .on()
====

Let's start with `init()` function which return a Formula object.

import: 
```javascript
import { init } from 'feedbacks';
```

It serves as a helper for initializing properties in blueprints. E.g.

```javascript
const blueprint = {
    foo: init(10)
}
```

Notice that `init` alone would not be so useful because you could write above using shorthand: 
```javascript
const blueprint = {
    foo: 10
}
```

Real power of `init` lies in something different though. It's supposed to be used as just first part of method chain (so called fluent-interface, similar to what you have in jQuery).

```javascript
const blueprint = {
    foo: init(10) // initialize to 10
        .on({type: 'someAction'}, reducerA)  // pattern-matching for action
        .on({type: 'someOtherAction'}, reducerB)  // pattern-matching for action 
}
```

How does it work? 
- `init(10)` returns a `Formula` object, i.e. some abstract object which contains "formula" for making a property.
- calling `.on({type: 'someAction', reducerA}` takes an existing formula and returns a new formula with additional information about pattern-matching
- calling `.on({type: 'someOtherAction'}, reducerB)` takes an existing formula once more and returns a new formula with additional information about pattern-matching.

So finally we'll have a formula with three pieces information in it.
1. initial state = 10
2. when action of type `"someAction"` arrives, run reducerA
2. when action of type `"someOtherAction"` arrives, run reducerB

These are inner workings though. From perspective of using Feedbacks you just need feel a grasp of how to create these "formula chains". It goes like this:

```javascript
const blueprint = {
    someProperty: init(......)
        .on(.......)
        .on(......)
        .on(......)
        .on(......)
}

```
Notice that this would allow for get rid of switch-case statements. Even more because pattern-matching in `on` is far more powerful. You can match deep in actions:

```javascript
const blueprint = {
    someProperty: init(0)
        .on({
            type: 'loadData',
            payload: {
                status: value => value >= 400 && value <= 499
            }
        }, reducerClientError)
        .on({
            type: 'loadData',
            payload: {
                status: 200
            }
        }, reducerOk)

}
```

to make this process even cleaner you could use action creators:

```javascript

const blueprint = {
    someProperty: init(0)
        .on(loadData({ status: value >= 400 && value <= 499 }), reducerClientError)
        .on(loadData({ status: 200 }), reducerOk)

}
```

But your **action creators should be pure functions**. You don't want to trigger any side effects during initializing your blueprints!

`Feedbacks` has already `defineAction` helper built-in and you can use it to define your action creator just in one line of code.

defineAction(type)
====

import:
```javascript
import { defineAction } from 'feedbacks';
```

`defineAction` returns an action creator, i.e. function you call to create an action.
Action creator is FSA-complaint. Created action will have a `payload` property set to whatever you pass as an argument.


example:
```javascript
const addTodo = defineAction('addTodo');
store.dispatch(addTodo(payload));

// in blueprint declarations:

on(addTodo(), someReducer)

```

defineEffect(type)
====
```javascript
import { defineEffect } from 'feedbacks';
```

`defineEffect` returns an effect creator, i.e. function you call to create an effect.
Created effect will have a `payload` property set to whatever you pass as an argument and `isEffect` property set to true.

example:
```javascript
const doSomething = defineEffect('doSomething');

// you can dispatch effects
store.dispatch(doSomething(effectPayload)); 

function reducer() {
    // as well as returning them from reducers
    return fx.effect(doSomething(effectPayload));
}

// or intercept them: 

createEngine(blueprint).onEffect(doSomething, () => {
    return Promise.resolve('result of effect');
})

```





fx
====

Helpers for side-effects. 
You can return a side-effect from your reducer e.g.

import:
```javascript
import * as fx from 'feedbacks/fx';
```


fx.effect(effectObject)
----
It runs an effect.

```javascript
const doSomething = createEffect('doSomething');
function reducer() {
    return fx.effect(doSomething());
}
```

This effect can be then handled in effect handler (via `engine.onEffect`)

fx.getState()
---
Get the root state of store. 


fx.waitFor(actionPattern, mapper)
----
It allows for waiting for actions. 
```javascript
function reducer() {
    const mapActionToState = (action) {
        return action.payload;
    };
    return fx.waitFor({type: 'action-for-wait'}, mapActionToState);
}
```


