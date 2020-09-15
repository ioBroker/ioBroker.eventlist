import React from 'react';
import PropTypes from 'prop-types';
import {withStyles} from '@material-ui/core/styles';

import TextField from '@material-ui/core/TextField';
import I18n from '@iobroker/adapter-react/i18n';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';

import ClearIcon from '@material-ui/icons/Close';
import SelectIcon from '@material-ui/icons/ViewModule';

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
            showDialog: false,
        };
    }

    renderDialog() {
        if (!this.state.showDialog) {

        }
        <Dialog
            open={true}
            onClose={handleClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">{"Use Google's location service?"}</DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    Let Google help apps determine location. This means sending anonymous location data to
                    Google, even when no apps are running.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    Disagree
                </Button>
                <Button onClick={handleClose} color="primary" autoFocus>
                    Agree
                </Button>
            </DialogActions>
        </Dialog>
    }

    renderPredefinedIcons() {

    }

    render() {
        const color = ColorPicker.getColor(this.state.color);
        let style = {};
        if (this.state.displayColorPicker && this.props.openAbove) {
            style = {
                top: -241,
            }
        }
        return <div
            style={Object.assign({}, this.props.style || {}, {position: 'relative'})}
            className={ this.props.className || ''}
            ref={this.divRef}
        >
            <TextField
                margin="dense"
                label={this.props.label || I18n.t('Icon')}
                value={this.state.value}
                onChange={e => this.setState({value: e.target.value})}
                type="text"
                InputProps={{
                    endAdornment: this.state.searchedValue ? (
                        <IconButton
                            onClick={() => this.setState({ searchedValue: '' })}>
                            <ClearIcon />
                        </IconButton>
                    ) : undefined,
                }}
                className={this.props.classes.textField}
            />
            <IconButton>

            </IconButton>
            {this.renderDialog()}
        </div>
    }
}

IconPicker.propTypes = {
    value: PropTypes.string,
    label: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    socket: PropTypes.object.isRequired,
};

export default withStyles(styles)(IconPicker);