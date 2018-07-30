import React from 'react';

import Calendar from './Calendar';
import Detail from './Detail';

import { connect } from './common';

function App({ notesByDay }) {
    return <div>
        <Calendar />
        <Detail />
        <h4>notesByDay</h4>
        <div>
            {
                Object.keys(notesByDay).map(k => {
                    return <div>
                        { k } : { notesByDay[k].text }
                    </div>
                })
            }
        </div>
    </div>;
}

export default connect(state => state)(App);
