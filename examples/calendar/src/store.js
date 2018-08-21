import React from 'react';
import * as Redux from 'redux';
import { withRedux, init, defineEffect, createFeedbacks } from 'feedbacks';
import { createDevTools } from 'redux-devtools';
import LogMonitor from '@hex13/redux-devtools-log-monitor';
import DockMonitor from 'redux-devtools-dock-monitor';
import * as fx from 'feedbacks/fx';
import { forward, backward, showDetail, addNote, removeNote, changeTheme, changeThemeOk, updateNote } from './actions';
import * as Rx from 'rxjs';
import { map, take } from 'rxjs/operators';

const now = new Date;
const currentDate = { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() }

const getKeyByDate = (params) => {
    if (!params) return;
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
            return function* () {
                const current = yield fx.current();
                const notes = current[key] || [];
                return {
                    ...current,
                    [key]: notes.concat({
                        text: 'new item',
                        id: Math.random()
                    })
                }
            }
        })
        .on(removeNote(), (state, { payload }) => {      
            const key = getKeyByDate(payload);  
            const notes = state[key] || [];
            return {
                ...state,
                [key]: notes.filter(note => note.id !== payload.id),
            };
        })
        .on(updateNote(), (state, { payload}) => {
            const key = getKeyByDate(payload);  
            const notes = state[key] || [];
            return {
                ...state,
                [key]: notes.map(note => {
                    if (note.id == payload.id) {
                        return { ...note, text: payload.text};
                    }
                    return note;
                }),
            };
        }),
    themeDialog: init({visible: false})
        .on(changeTheme(), () => {
            return function* () {
                yield fx.next({visible: true});
                yield fx.waitFor(changeThemeOk(), x => x);
                yield fx.next({visible: false});
            }
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

export const DevTools = createDevTools(<DockMonitor defaultIsVisible={true}>
    <LogMonitor 
        toggleVisibilityKey="ctrl-h"
        theme="tomorrow"
    />
</DockMonitor>);

export function configureStore() {
    
    // const engine = withRedux(Redux).createEngine(blueprint).onEffect(doComputeNotes(), function* ({payload:date}) {
    //     const notes = (yield fx.getState()).notesByDay[getKeyByDate(date)] || [{text: '???'}];
        
    //     return notes;
    // });
    const store = Redux.createStore(blueprint, Redux.compose(
        createFeedbacks(),
        DevTools.instrument(), 
    ));
    //const store  = engine.getStore();

    store.engine.onEffect(doComputeNotes(), function* ({payload:date}) {
            const notesByDay = yield fx.getState('notesByDay');
            const notes = notesByDay[getKeyByDate(date)] || [{text: '???'}];
            
            return notes;
        });

    return store;
};

