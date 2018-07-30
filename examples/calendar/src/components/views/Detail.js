import React from 'react';

export default function Detail({ detail: { day, month, year }, actions, notesByDay }) {
    const note = notesByDay[year + '-' + month + '-' + day] || {text: '???'};
    return <div>
        <h3>detail of: { year } { month} { day }</h3>
        <button onClick={() => actions.addNote({ day, month, year, text: `${day}-${month}-${year}!!`})}>
            add
        </button>
        {
            note.text
        }
    </div>
};