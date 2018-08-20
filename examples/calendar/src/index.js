import React from 'react';
import ReactDOM from 'react-dom';

import App from './components/App';

import { Provider } from 'react-redux';
import './index.css';

import { DevTools, configureStore } from './store';

const store = configureStore();

ReactDOM.render(
    <div>
        <Provider store={store}>
            <App />        
        </Provider>
    </div>,
    document.getElementById('root')
);

