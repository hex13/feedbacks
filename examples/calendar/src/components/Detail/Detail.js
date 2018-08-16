import React from 'react';

function Note({ note, removeNote, day, month, year }) {
    return <li>{note.text}#{note.id}<button onClick={() => removeNote({ day, month, year, id: note.id}) }>remove</button></li>
}

export default function Detail({ notes, date: { day, month, year }, actions, notesByDay }) {
    //const note = notesByDay[year + '-' + month + '-' + day] || {text: '???'};
    //const note = {text: '???'}
    return <div>
        <h3>detail of: { year } { month} { day }</h3>
        <button onClick={() => actions.addNote({ day, month, year, text: `${day}-${month}-${year}!!`})}>
            add
        </button>
        {
            notes.map((note, i) => <Note key={i} note={note} removeNote={actions.removeNote} day={day} month={month} year={year} />)
        }
    </div>
};