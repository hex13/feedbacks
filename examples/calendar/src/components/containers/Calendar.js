import React from 'react';

import { connect } from 'react-redux';
import Calendar from '../views/Calendar';

export default connect(state => state, (dispatch) => {
    return {
        actions: {
            showDetail: (payload) => dispatch({ type: 'showDetail', payload})
        }
    }
})(Calendar);