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
    return fx.waitFor({type: 'action-for-wait}, mapActionToState);
}

```

