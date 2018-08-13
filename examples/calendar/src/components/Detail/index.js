import { inject } from '../common';

import Detail from './Detail';
import { addNote, removeNote } from '../../actions';
export default inject(state => state.detail, { addNote, removeNote })(Detail);