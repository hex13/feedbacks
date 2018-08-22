import React from 'react';
import * as Redux from 'redux';
import { init, defineEffect, createFeedbacks, Collection } from 'feedbacks';
import { createDevTools } from 'redux-devtools';
import LogMonitor from '@hex13/redux-devtools-log-monitor';
import DockMonitor from 'redux-devtools-dock-monitor';
import * as fx from 'feedbacks/fx';
import { forward, backward, showDetail, addNote, removeNote, changeTheme, changeThemeOk, updateNote } from './actions';

const now = new Date;
const currentDate = { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() }

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

    notesByDay: init(new Collection)
        .on(addNote(), (state, { payload }) => 
            // we wrap this is in effect because of Math.random() which is not pure
            () => state.add({
                ...payload,
                text: 'kotki!',
                id: Math.random()
            }))
        .on(removeNote(), (state, { payload }) => state.remove(payload))
        .on(updateNote(), (state, { payload }) => state.update(payload, payload)),
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
    
    const store = Redux.createStore(blueprint, Redux.compose(
        createFeedbacks(),
        DevTools.instrument(), 
    ));

    store.engine.onEffect(doComputeNotes(), function* ({payload:date}) {
            const notesByDay = yield fx.select('notesByDay');
            return  notesByDay.findAll(date);
        });

    return store;
};

