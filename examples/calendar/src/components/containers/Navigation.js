import Navigation from '../views/Navigation';
import { getLabel, connect } from './common';
import { forward, backward} from '../../actions';

export default connect((state, ownProps) => {
    return Object.assign({}, { label: getLabel(ownProps.action, state.language)})
    }, (dispatch, ownProps) => {
    return {
        actions: {
            forward: () => dispatch(forward({target: ownProps.target})),
            backward: () => dispatch(backward({target: ownProps.target})),    
        }
    }
})(Navigation);