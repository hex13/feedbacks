Feedbacks - reactive blueprints for your Redux apps
===

No more wiring manually your actions, reducers, thunks etc. 
Just create an object which will represent both the initial and future states of your application and pass it to the Feedbacks engine.

(Note that it's an early version, if you stumble upon some problems, feel free to file an issue:
https://github.com/hex13/feedbacks/issues )


Feedbacks will:
---
- match actions automatically (powerful DSL with pattern matching capabilities)
- resolve promises and observables and feed it back to given property in the state


Let's see some examples:
---


Counter (increments automatically each 1000 milliseconds):
---

```javascript
import Rx from 'rxjs'; // optional. You don't need Rx.js to use Feedbacks
import { createStore, applyMiddleware } from 'redux';
import { createEngine } from 'feedbacks';

const engine = createEngine(() => ({
    counter: Rx.interval(1000)
}));
const store = createStore(engine.reducer, applyMiddleware(engine.middleware));

```

Counter (can be incremented / decremented):
---
```javascript
// ...
const engine = createEngine(({ init }) => ({
    counter: init(0)
        .match('increment', value => value + 1)
        .match('decrement', value => value - 1)
}));
// ...
```

Fetching resources
---

```javascript
// ...
const fetchData = (url) => fetch(url).then(r => r.json());

const engine = createEngine(({ init }) => init({
    todos: init([])
        .match('fetchTodos', () => () => fetchData('todos.json'))
        .match('addTodo', (value, action) => value.concat(action.payload))        
});
// ...
```
Two gotchas:
- because Promise are eager you shouldn't return just Promise from reducer. You should wrap it in additional function (like in example above) to keep reducer pure.
- the good practice is separate low level API infrastructure from business logic. So don't put `fetch`, `axios`, `firebase` API etc. directly to reducers to avoid coupling them with external APIs. It's better to make some wrapper/service which will isolate application logic from data fetching details.

But why? (what is the problem this library addresses)
---

1. Well, they say that Redux is functional but in reality so many Redux projects has ton of imperative code in thunks or in action creators. Dispatch status, call API, dispatch another status, dispatch result of fetching... There are tons of indirections of control flow (running thunks -> waiting for promise -> dispatching -> handling action in reducers...). It's very procedural, imperative. You write HOW instead of WHAT. Feedbacks allow you for more declarative approach.

2. Logic in Redux projects is often spreaded in completely different places in projects (thunks, action creators, reducers...). Off course in any bigger project it's convenient to split into smaller files but the problem with many Redux projects is that they are split by type (reducers, actions, thunks...) instead of by feature/functionality/domain entity (e.g. `todos`, `user`). This way one functionality is spreaded in different files. Projects become hard to understand. Even smaller ones.

3. Need for support asynchronous somethings (e.g. Promises or Observables). Very known problem. Feedbacks just tackle this problem in a functional reactive way. It allows each property to "listen" to the promises/observables and "react" by changing its value appropriately. <br><br> 
Imagine what if Redux allowed for putting observables or promises into state, and if it was completely transparent for consumers of Redux state? Feedbacks are something like this (although notice that technically none of observables/promises etc. would go to the Redux state directly. They would be just intercepted by Feedbacks and then resolved value would be applied to the given property).  [But what if you want write reducer that affects more than one property?](#Reducers-that-affect-more-than-one-property).

4. both switch/cases and "objects with reducers as methods" are somewhat primitive version of pattern matching (they allow match just by type of action). Having a better pattern matching could help in Redux projects to be more expressive and concise.

Pattern Matching
---
Feedback allow you also for making some advanced pattern matching. You've seen string based patterns in examples above. But this is not the end. Look something like this:

```javascript
// ...
{
    foo: init(0)
        .match({
            type: 'response',
            payload: {
                status: value => value >= 400 && value < 500
            }
        }, (value, action) => action.payload.content)
}
// ...
```

Reducers that affect more than one property
---
Just connect reducer to the upper property (e.g. to `user`, not to `user.location.city`)

TODO: describe more precisely, give an example

Philosophy of side-effects
---

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
    todos: match('FETCH_TODOS', (state, action) => () => someAsyncApi())
}
```

this way in one line of code you express:
1. what should be target property of state change (`todos`)
2. which action you want to handle (`FETCH_TODOS` but you're not limited to just matching by type. Read more about [advanced pattern matching](#Pattern-Matching))
3. how value will change including asynchronous changes via observables or function-wrapped promises. You could also spawn another action (and reducer of the next action could send values back to previous property by using `yield` statement). TODO: example

Showing spinners
---

What about data-fetching-status and all this science of when to show spinner and when to hide it?

Well, in current version of Feedbacks there is no one and only recommended way to do it. Though you could achieve this e.g. by doing this:

```javascript
// TODO write example 
```

But it up to you. Something may also change when React suspense will come to play (assuming you use React). Though Feedbacks are not dependent of React and they shoudn't be coupled with React-only features. So in future versions there will be probably the idiomatic "Feedbacky" way to make this (maybe alternative to so called createFetcher/simple-cache-provider from future React? Or extension to it?)

But Feedbacks is not even correct word...
---

Maybe. But who cares? 

And this is Doge: https://en.wikipedia.org/wiki/Doge_(meme)


Additional reading
---

Redux documentation: https://redux.js.org/

