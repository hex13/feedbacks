import * as Redux from 'redux';
import { withRedux, init, defineEffect } from 'feedbacks';
import * as fx from 'feedbacks/fx';
import { forward, backward, showDetail, addNote, removeNote, changeTheme, changeThemeOk } from './actions';
import * as Rx from 'rxjs';
import { map, take } from 'rxjs/operators';

const now = new Date;
const currentDate = { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() }

const getKeyByDate = (params) => {
    return `${params.year}-${params.month}-${params.day}`;
};

const doAsk = defineEffect('ask');
const doComputeNotes = defineEffect('load');
const themes = ['theme-light', 'theme-dark'];

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
        notes: init([{text: '....'}])
            .on(showDetail(), (_, { payload }) => fx.compute(doComputeNotes(payload)))
    },

    notesByDay: init({})
        .on(addNote(), (state, { payload }) => {
            const key = getKeyByDate(payload);
            const notes = state[key] || [];
            return fx.flow([
                delay(200, state), // simulate network delay
                {
                    ...state,
                    [key]: notes.concat({
                        text: 'new item',
                        id: Math.random()
                    })
                }
            ]);
        })
        .on(removeNote(), (state, { payload }) => {      
            const key = getKeyByDate(payload);  
            const notes = state[key] || [];
            return {
                ...state,
                [key]: notes.filter(x => x.id !== payload.id),
            };
        }),
    themeDialog: init({visible: false})
        .on(changeTheme(), () => {
            return fx.flow([
                {visible: true},
                fx.waitFor(changeThemeOk(), x => x),
                {visible: false},
            ]);
        }),
    theme: init({idx: 0, name: themes[0]})
        .on(changeThemeOk(), (state, action) => {
            return {idx:0, name: action.payload};
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
    .onEffect(doComputeNotes(), function* ({payload:date}) {
        const notes = (yield fx.getState()).notesByDay[getKeyByDate(date)] || [{text: '???'}];
        
        return notes;
    })
    .getStore();
    store.dispatch({type: 'ask'});
    return store;
}
