fx
====

Helpers for side-effects. 
You can return a side-effect from your reducer e.g.

```javascript
import * as fx from 'feedbacks/fx';

// ... 
function reducer() {
    const mapActionToState = (action) {
        return action.payload;
    };
    return fx.waitFor({type: 'action-for-wait'}, mapActionToState);
}

```

defineAction
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

defineEffect
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


