import * as Redux from 'redux';
import { withRedux, init } from 'feedbacks';
import { forward, backward, showDetail, addNote } from './actions';


export default function configureStore() {
    const now = new Date;
    return withRedux(Redux).createStore({
        month: init(1)
            .on(forward({ target: 'month' }), v => v + 1)
            .on(backward({ target: 'month' }), v => v - 1),

        language: 'iconic',

        year: init(2018)
            .on(forward({ target: 'year' }), v => v + 1)
            .on(forward({ target: 'year' }), v => v + 1)
            .on(backward({ target: 'year' }), v => v - 1),

        detail: init({ day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() })
            .on(showDetail(), (_, { payload }) => payload),
            
        notesByDay: init({ a: { text: 'something' } })
            .on(addNote(), (state, { payload }) => {
                return {
                    ...state,
                    [`${payload.year}-${payload.month}-${payload.day}`]: {
                        text: 'new item'
                    }
                }
            })
    });
}
