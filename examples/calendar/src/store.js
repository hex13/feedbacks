import * as Redux from 'redux';
import { withRedux, init, defineEffect } from 'feedbacks';
import * as fx from 'feedbacks/fx';
import { forward, backward, showDetail, addNote } from './actions';
import * as Rx from 'rxjs';
import { map, take } from 'rxjs/operators';

const now = new Date;
const currentDate = { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() }

const getKeyByDate = (params) => {
    return `${params.year}-${params.month}-${params.day}`;
};

const doAsk = defineEffect('ask');
const doLoad = defineEffect('load');
const blueprint = {
    month: init(currentDate.month)
        .on(forward({ target: 'month' }), v => v + 1)
        .on(backward({ target: 'month' }), v => v - 1),

    language: 'iconic',

    year: init(currentDate.year)
        .on(forward({ target: 'year' }), v => v + 1)
        .on(forward({ target: 'year' }), v => v + 1)
        .on(backward({ target: 'year' }), v => v - 1),

    detail: {
        date: init(currentDate)
            .on(showDetail(), (_, { payload }) => payload),
        note: init({text: '....'})
            .on(showDetail(), (_, { payload }) => fx.effect(doLoad(payload)))
    },
        
    notesByDay: init({ a: { text: 'something' } })
        .on(addNote(), (state, { payload }) => {
            return {
                ...state,
                [getKeyByDate(payload)]: {
                    text: 'new item'
                }
            }
        }),
}; 

const delay = (t,v) => {
    return () => new Promise(r => {
        setTimeout(() => {
            r(v);
        }, t)
    })
}

export default function configureStore() {
    
    const store = withRedux(Redux).createEngine(blueprint)
    .onEffect(doLoad(), (dispatch, getState, {payload:date}) => {
        const note = getState().notesByDay[getKeyByDate(date)] || {text: '???'};
        
        return fx.flow([
            {text: '...loading...'},
            delay(500, note),
        ]);
    })
        // .onAction(doAsk(), () => {
        //     alert("ask!");
        // })
    .getStore();

    return store;
}