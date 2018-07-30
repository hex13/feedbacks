import React from 'react';
import Navigation from '../containers/Navigation';


const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export default function Calendar({ year, month, actions }) {
    
    const date = new Date(year, month - 1, 5);
    const name = monthNames[date.getMonth()];
    const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    

    const els = [];
    
    let week = [];
    const offset = ((new Date(date.getFullYear(), date.getMonth(), 1).getDay() - 1) + 7) % 7;
    console.log({days, offset});
    const start = 1 - offset;
    const getDayNumber = (i) => {
        if (i >= 1 && i <= days) {
            return i;
        }
        return '?'
    };
    for (let i = start; i <= days + (7 - days % 7); i++) {
        const day = getDayNumber(i);
        week.push(<Calendar.Day day={day} onClick={() => actions.showDetail({ day, month, year}) }/>);

        if ((i + offset) % 7 == 0) {
            els.push(<div>{week}</div>);
            week = [];
        } 
    }
    return <div>
        <Navigation action="backward" target="month" />
        <Navigation action="backward" target="year" />
        <h3>{ name } { year } </h3>
        { 
            els
        }
        <Navigation action="forward" target="month" />
        <Navigation action="forward" target="year" />
    </div>
};

Calendar.Day = ({ day, onClick }) => {
    return <button 
        style={{display:'inline-block', background: 'none', border: 'none', width: 40, height: 40,margin: 10}}
        onClick={onClick}
    >
        { day }
    </button>  
};