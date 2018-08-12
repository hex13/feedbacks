import React from 'react';

export default function Navigation({ actions, action, label }) {
    return <button onClick={actions[action]}>
        { label }
    </button>
};