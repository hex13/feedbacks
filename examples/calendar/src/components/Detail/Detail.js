import React from 'react';

function Note({ note, actions, day, month, year }) {
    const textRef = React.createRef();
    return <li>#{note.id} 
        <input 
            type="text" 
            ref={textRef} 
            defaultValue={note.text}
            onKeyUp={
                e => {
                    if (e.keyCode == 27) e.target.value = note.text;
                    if (e.keyCode == 13) actions.updateNote({ text: e.target.value, day, month, year, id: note.id})
                }
            }
            onBlur={
                (e) => actions.updateNote({ text: e.target.value, day, month, year, id: note.id})
            }
        />
        <button onClick={() => actions.removeNote({ day, month, year, id: note.id}) }>remove</button>
    </li>
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
            notes.map((note, i) => <Note key={i} note={note} actions={actions} day={day} month={month} year={year} />)
        }
    </div>
};