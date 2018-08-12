import React from 'react';
import ReactDOM from 'react-dom';

import App from './components/App';

import { Provider } from 'react-redux';
import './index.css';

import configureStore from './store';

const store = configureStore();

ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>,
    document.getElementById('root')
);

