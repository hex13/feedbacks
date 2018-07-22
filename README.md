Feedbacks - reactive blueprints for your Redux apps
===

*(Note that it's an early version, if you stumble upon some problems, feel free to file an issue:
https://github.com/hex13/feedbacks/issues )*

No more wiring manually your actions, reducers, thunks etc. 

Just create a "blueprint" which will define a shape of state and define how it should react on incoming actions (pattern-matching: action -> reducer). 

You can hook into individual properties even in deep in the state (and wire up a property to the reducer via pattern-matching mechanism)

Reducers in Feedbacks can return both normal values and side-effects. And side-effects represent future value(s) of given property. 

Observables and promises are auto-resolved, and owner property is auto-updated.


Feedbacks will:
---
- match actions automatically (powerful DSL with pattern matching capabilities)
- allow for working on individual properties 
- resolve promises and observables and feed it back to given property in the state
- give you a nice reactive state tree instead of just ugly shapeless state


# Let's see some examples:

## Counter (increments automatically each 1000 milliseconds):

```javascript
import { withRedux } from 'feedbacks';
import * as Redux from 'redux';
import Rx from 'rxjs'; 

const store = withRedux(Redux).createStore({
    // Feedbacks will subscribe to the Observable and auto-update property:
    counter: Rx.interval(1000) 
});
```
Notice that you don't need Rx (or any kind of Observables to use Feedbacks. This is just one of use cases)

## Counter (can be incremented / decremented):


```javascript
// ...
const store = withRedux(Redux).createStore({
    counter: init(0)
        .on('increment', value => value + 1)
        .on('decrement', value => value - 1)
});
// ...
```

Fetching resources
---


```javascript
// ...
const fetchData = (url) => fetch(url).then(r => r.json());

const store = withRedux(Redux).createStore({
    todos: init([])
        .on('fetchTodos', () => () => fetchData('todos.json'))
        .on('addTodo', (value, action) => value.concat(action.payload))        
});
// ...
```
Two gotchas:
- Don't return directly a Promise from the reducer. You should wrap it in additional function (like in example above) to keep reducer pure.
- The good practice is separate low level API infrastructure from business logic. So don't put `fetch`, `axios`, `firebase` API etc. directly to reducers to avoid coupling them with external APIs. It's better to make some wrapper/service which will isolate application logic from data fetching details.

# Power of declarativeness


## Traditional Redux:

You first think about actions, when to dispatch them (e.g. in thunks), how reducer should change state upon this action:

"I will spawn some side-effects (e.g. API call) then I will dispatch `FOO` action. I will write reducer which will react to `FOO` action by changing property `foo` in store.

So basically **half of your code is imperative/procedural**, only second half (in reducers) is declarative/functional. This raises some problems (for example boilerplate in your imperative thunks, or proliferation of helper actions which will act only as [DTO](https://en.wikipedia.org/wiki/Data_transfer_object) between imperative side of your app (e.g. thunks) and declarative reducers).

## Feedbacks:

You first think about shape of your state how the state will change because of actions:

"I have `foo` property in my store and I can describe on which actions `foo` will react and how its value will be changing"

Changes can be **immediate**, e.g.
```javascript
(value, action) => value + action.amount
(value, action) => 42
```
or **deferred** e.g.
```javascript
(value, action) => () => Promise.resolve(42)
(value, action) => Rx.interval(1000)
(value, action) => () => somePromiseBasedAPI()
```

This allows you for conciseness (especially that Feedbacks comes with the nice DSL).

# Pattern Matching

Feedbacks allow you also for making some advanced pattern matching. You've seen string based patterns in examples above. But this is not the end. Look something like this:

```javascript
// ...
{
    foo: init(0)
        .on({
            type: 'response',
            payload: {
                status: value => value >= 400 && value < 500
            }
        }, (value, action) => action.payload.content)
}
// ...
```

# Philosophy of side-effects

Feedbacks address the fact so called "side-effects" are often merely a way to get some data and put it back in some property of the Redux state. Consider this code, written traditionally:


```javascript 
const fetchTodos = () => {
    return dispatch => {
        someAsyncApi().then(data => {
            dispatch({type: 'TODOS_FETCHED', todos: data})
        })
    }
};

const reducer = (state, action) => {
    switch (action.type) {
        case 'TODOS_FETCHED':
            return {
                ...state,
                todos: action.todos
            }
    }
}
```

There is a problem with that.

There is a ton of indirection and logic is put all over the project (in the example above we have half of logic in thunk - when we fetch data, the other half in reducer when we apply data to the given property in the state).

In Feedbacks library you are encouraged to write more direct code. Let's rewrite previous example to Feedbacks: 
```javascript
{
    todos: on('FETCH_TODOS', (state, action) => () => someAsyncApi())
}
```

this way in one line of code you express:
1. what should be target property of state change (`todos`)
2. which action you want to handle (`FETCH_TODOS` but you're not limited to just matching by type. Read more about [advanced pattern matching](#Pattern-Matching))
3. how value will change including asynchronous changes via observables or function-wrapped promises. You could also spawn another action (and reducer of the next action could send values back to previous property by using `yield` statement). TODO: example


# Tips & Tricks

## Changing more than one property during action:

You can do it in either way:

1. match on all properties you want to change:

```javascript
{
    user: {
        name: init('')
            .on('changeUser', (value, action) => action.payload.name),
        city: init('')
            .on('changeUser', (value, action) => action.payload.city),
    },
}
```
2. match action at the upper property:

```javascript
{
    user: init({name: '', city: ''})
        .on('changeUser', (value, action) => action.payload)
}
```

Whatever will make more sense to what you want to achieve.


## Showing spinners:

What about data-fetching-status and all this science of when to show a spinner and when to hide it?

Well, in current version of Feedbacks there is no one and only recommended way to do it. Though you could achieve this e.g. by doing this:

```javascript
// TODO write example 
```

But it up to you. Something may also change when React suspense will come to play (assuming you use React). Though Feedbacks are not dependent of React and they shoudn't be coupled with React-only features. So in future versions there will be probably the idiomatic "Feedbacky" way to make this (maybe alternative to so called createFetcher/simple-cache-provider from future React? Or extension to it?)

# Glossary (TODO):

* blueprint
* immediate vs. deferred values
* pattern-matching
* mounting


# But Feedbacks is not even correct word...

Maybe. But who cares? 

And this is Doge: https://en.wikipedia.org/wiki/Doge_(meme)


# Additional reading

Redux documentation: https://redux.js.org/

