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
import DialogTitle from '@material-ui/core/DialogTitle';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';

import ClearIcon from '@material-ui/icons/Close';
import CancelIcon from '@material-ui/icons/Close';
import CheckIcon from '@material-ui/icons/Check';
import SelectIcon from '@material-ui/icons/ViewModule';

const styles = theme => ({
    textField: {

    },
    textFieldWithButton: {
        width: 'calc(100% - 70px)'
    },
    textDense: {
        marginTop: 0,
        marginBottom: 0,
    },
    buttonIcon: {
        marginRight: theme.spacing(1),
    }
});

class IconPicker extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            value: this.props.value || '',
            showDialog: false,
            selectedTab: 0,
        };
    }
    renderPredefinedIcons() {

    }

    renderDialog() {
        if (!this.state.showDialog) {
            return null;
        }
        return <Dialog
            open={true}
            onClose={() => this.setState({showDialog: false})}
        >
            <DialogTitle>{I18n.t('Select icon...')}</DialogTitle>
            <DialogContent>
                <Tabs value={this.state.selectedTab} onChange={(e, selectedTab) => this.setState({selectedTab})}>
                    <Tab label={I18n.t('Predefined')} />
                    <Tab label={I18n.t('User defined')} />
                </Tabs>
                {this.state.selectedTab === 0 && <div>
                    {this.renderPredefinedIcons()}
                </div>}
                {this.state.selectedTab === 1 && <div>
                </div>}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.setState({showDialog: false})} color="primary"><CancelIcon className={this.props.classes.buttonIcon}/>{I18n.t('Cancel')}</Button>
                <Button onClick={() => this.props.onClose(this.state.value)} color="primary" autoFocus>
                    <CheckIcon className={this.props.classes.buttonIcon}/>{I18n.t('Select')}
                </Button>
            </DialogActions>
        </Dialog>
    }

    render() {
        return <div
            style={this.props.style || {}}
            className={ this.props.className || ''}
        >
            <TextField
                margin="dense"
                label={this.props.label || I18n.t('Icon')}
                value={this.state.value}
                onChange={e => this.setState({value: e.target.value})}
                type="text"
                InputProps={{
                    endAdornment: this.state.value ? (
                        <IconButton
                            onClick={() => this.setState({ value: '' })}>
                            <ClearIcon />
                        </IconButton>
                    ) : undefined,
                }}
                className={this.props.classes.textField}
            />
            <IconButton onClick={() => this.setState({showDialog: true})}>
                <SelectIcon/>
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