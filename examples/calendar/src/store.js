import * as Redux from 'redux';
import { withRedux, init, createEngine } from 'feedbacks';
import * as fx from 'feedbacks/fx';
import { forward, backward, showDetail, addNote } from './actions';

const now = new Date;

const getKeyByDate = (params) => {
    return `${params.year}-${params.month}-${params.day}`;
};

const blueprint = {
    month: init(1)
        .on(forward({ target: 'month' }), v => v + 1)
        .on(backward({ target: 'month' }), v => v - 1),

    language: 'iconic',

    year: init(2018)
        .on(forward({ target: 'year' }), v => v + 1)
        .on(forward({ target: 'year' }), v => v + 1)
        .on(backward({ target: 'year' }), v => v - 1),

    detail: {
        date: init({ day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() })
            .on(showDetail(), (_, { payload }) => payload),
        note: init({text: '....'})
            .on(showDetail(), (_, { payload }) => fx.load(payload))
    },
        
    notesByDay: init({ a: { text: 'something' } })
        .on(addNote(), (state, { payload }) => {
            return {
                ...state,
                [getKeyByDate(payload)]: {
                    text: 'new item'
                }
            }
        })
}; 

export default function configureStore() {
    
    const engine = createEngine(blueprint);

    engine.loader((params, state) => {
        const note = state.notesByDay[getKeyByDate(params)];
        return note || {text: '[not found]'};
    });

    return Redux.createStore(engine.reducer, Redux.applyMiddleware(
        engine.middleware
    ));
}
