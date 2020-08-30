import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';

import I18n from '@iobroker/adapter-react/i18n';

const styles = theme => ({
    textField: {

    },
});

class AddEventDialog extends Component {
    constructor(props) {
        super(props);

        this.state = {
            showTime: false,
            event: '',
            val: '',
            ts: ''
        };
    }

    render() {
        return <Dialog open={true} onClose={() => this.props.onClose()} aria-labelledby="form-dialog-title">
            <DialogTitle id="form-dialog-title">{I18n.t('Add event')}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {I18n.t('You can add event to table, e.g. some comment.')}
                </DialogContentText>
                <TextField
                    autoFocus
                    margin="dense"
                    label={I18n.t('Event text')}
                    className={this.props.classes.textField}
                    value={this.state.event}
                    onChange={e => this.setState({event: e.target.value})}
                    type="text"
                    fullWidth
                />
                <br/>
                <TextField
                    margin="dense"
                    label={I18n.t('Value')}
                    value={this.state.val}
                    onChange={e => this.setState({val: e.target.value})}
                    type="text"
                    className={this.props.classes.textField}
                    helperText={I18n.t('optional')}
                    fullWidth
                />
                <br/>
                <FormControlLabel
                    control={<Checkbox checked={this.state.showTime} onChange={e =>
                        this.setState({showTime: e.target.checked, ts: e.target.checked ? new Date().toISOString() : ''})
                    } />}
                    label={I18n.t('Set time')}
                />
                <br/>
                {this.state.showTime ? <TextField
                    label={I18n.t('Time')}
                    type="datetime-local"
                    value={this.state.ts}
                    onChange={e => this.setState({ts: e.target.value})}
                    className={this.props.classes.textField}
                    InputLabelProps={{
                        shrink: true,
                    }}
                /> : null }
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.props.onClose()} color="primary">
                    {I18n.t('Cancel')}
                </Button>
                <Button
                    disabled={!this.state.event || (this.state.showTime && !this.state.ts)}
                    onClick={() => {
                        const event = {event: this.state.event};
                        if (this.state.ts) {
                            event.ts = this.state.ts;
                        }
                        if (this.state.val) {
                            if (parseFloat(this.state.val).toString() === this.state.val) {
                                event.val = parseFloat(this.state.val);
                            } else if (this.state.val === 'true') {
                                event.val = true;
                            } else if (this.state.val === 'false') {
                                event.val = false;
                            } else  {
                                event.val = this.state.val;
                            }
                        }
                        this.props.onClose(event);
                    }}
                    color="primary">
                    {I18n.t('Insert')}
                </Button>
            </DialogActions>
        </Dialog>;
    }
}

AddEventDialog.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default withStyles(styles)(AddEventDialog);
