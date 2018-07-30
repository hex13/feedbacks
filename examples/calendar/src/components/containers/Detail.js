import { connect } from './common';

import Detail from '../views/Detail';
export default connect(state => state.detail, dispatch => {
    return {
        actions: {
            addNote: (payload) => dispatch({type: 'addNote', payload})
        }
    }
})(Detail);