import React from 'react';

import { connect } from 'react-redux';
import Calendar from '../views/Calendar';

export default connect(({ year, month }) => {
    return { year, month };
}, (dispatch) => {
    return {
        actions: {
            showDetail: (payload) => dispatch({ type: 'showDetail', payload})
        }
    }
})(Calendar);