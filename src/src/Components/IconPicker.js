import React from 'react';
import PropTypes from 'prop-types';
import {withStyles} from '@material-ui/core/styles';

import TextField from '@material-ui/core/TextField';
import I18n from '@iobroker/adapter-react/i18n';

const styles = theme => ({
    textField: {

    },
    textFieldWithButton: {
        width: 'calc(100% - 70px)'
    },
});

class IconPicker extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: this.props.value || '',
        };
    }

    render() {
        return <TextField
            margin="dense"
            label={this.props.label || I18n.t('Icon')}
            value={this.state.value}
            onChange={e => this.setState({value: e.target.value})}
            type="text"
            className={this.props.classes.textField}
        />;
    }
}

IconPicker.propTypes = {
    value: PropTypes.string,
    label: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(IconPicker);