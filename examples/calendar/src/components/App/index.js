import React from 'react';

import Calendar from '../Calendar';
import Detail from '../Detail';

import { connect } from '../common';
import { changeTheme } from '../../actions';
import { changeThemeOk } from '../../actions';

function _ThemeDialog({ onChange, theme, hidden, onOpen }) {
    if (hidden) return <button onClick={ onOpen }>
        change theme
    </button>
    return <div>
        <form style={{position: 'absolute', margin: 10}}>
        <fieldset style={{margin: 20}}>
            <legend>choose theme:</legend>
        {
            ['theme-dark', 'theme-light'].map(name => {
                return <p key={name}><label>
                    { name }
                    <input type="radio" onChange={(e) => onChange(e.target.value)} value={name} checked={theme.name == name} name={'a'}/>
                </label></p>
            })
        }
        </fieldset>
        </form>
    </div>
}

const ThemeDialog = connect(state => {
    return {
        theme: state.theme,
        hidden: !state.themeDialog.visible 
    }
}, dispatch => {
    return {
        onChange: value => dispatch(changeThemeOk(value)),
        onOpen: () => {
            dispatch(changeTheme())
        } 
    }
})(_ThemeDialog);

function App({ notesByDay, waiting, text, theme, dispatch }) {
    return <div id="theme" className={theme.name}>
        <ThemeDialog />
        <Calendar />
        <Detail />

        <h4>notesByDay</h4>
        { <div>
            {
                Object.keys(notesByDay).map(k => {
                    console.log(notesByDay[k])
                    return <div>
                        { k } : { (notesByDay[k] || []).map(n => n.text).join('; ') }
                    </div>
                })
            }
        </div> }
    </div>;
}
export default connect(state => ({
    ...state    
}))(App);
