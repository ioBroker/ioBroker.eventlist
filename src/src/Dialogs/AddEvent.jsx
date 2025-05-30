import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
    Button,
    TextField,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
    Checkbox,
} from '@mui/material';

import { Cancel as CancelIcon, Add as AddIcon } from '@mui/icons-material';

import { I18n, IconPicker } from '@iobroker/adapter-react-v5';

class AddEventDialog extends Component {
    constructor(props) {
        super(props);

        this.state = {
            showTime: false,
            event: '',
            val: '',
            ts: '',
            icon: '',
        };

        this.imagePrefix = this.props.imagePrefix;
    }

    onOk() {
        const event = { event: this.state.event };
        if (this.state.ts) {
            event.ts = this.state.ts;
        }

        if (this.state.icon) {
            event.icon = this.state.icon;
        }

        if (this.state.val) {
            if (parseFloat(this.state.val).toString() === this.state.val) {
                event.val = parseFloat(this.state.val);
            } else if (this.state.val === 'true') {
                event.val = true;
            } else if (this.state.val === 'false') {
                event.val = false;
            } else {
                event.val = this.state.val;
            }
        }
        this.props.onClose(event);
    }

    render() {
        return (
            <Dialog
                open={!0}
                onClose={() => this.props.onClose()}
                aria-labelledby="form-dialog-title"
            >
                <DialogTitle id="form-dialog-title">{I18n.t('Add event')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{I18n.t('You can add event to table, e.g. some comment.')}</DialogContentText>
                    <TextField
                        variant="standard"
                        autoFocus
                        margin="dense"
                        label={I18n.t('Event text')}
                        value={this.state.event}
                        onKeyUp={e =>
                            e.key === 'Enter' &&
                            this.state.event &&
                            (!this.state.showTime || this.state.ts) &&
                            this.onOk()
                        }
                        onChange={e => this.setState({ event: e.target.value })}
                        type="text"
                        fullWidth
                    />
                    <br />
                    <TextField
                        variant="standard"
                        margin="dense"
                        label={I18n.t('Value')}
                        value={this.state.val}
                        onChange={e => this.setState({ val: e.target.value })}
                        type="text"
                        helperText={I18n.t('optional')}
                        fullWidth
                    />
                    <br />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={this.state.showTime}
                                onChange={e =>
                                    this.setState({
                                        showTime: e.target.checked,
                                        ts: e.target.checked ? new Date().toISOString() : '',
                                    })
                                }
                            />
                        }
                        label={I18n.t('Set time')}
                    />
                    <br />
                    {this.state.showTime ? (
                        <TextField
                            variant="standard"
                            label={I18n.t('Time')}
                            type="datetime-local"
                            value={this.state.ts}
                            slotProps={{
                                inputLabel: {
                                    shrink: true,
                                },
                            }}
                            onChange={e => this.setState({ ts: e.target.value })}
                        />
                    ) : null}
                    <IconPicker
                        disabled={this.props.reading}
                        imagePrefix={this.imagePrefix}
                        label={I18n.t('Icon')}
                        socket={this.props.socket}
                        value={this.state.icon}
                        onChange={icon => this.setState({ icon })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        disabled={!this.state.event || (this.state.showTime && !this.state.ts)}
                        onClick={() => this.onOk()}
                        color="primary"
                        variant="contained"
                        startIcon={<AddIcon />}
                    >
                        {I18n.t('Insert')}
                    </Button>
                    <Button
                        color="grey"
                        onClick={() => this.props.onClose()}
                        variant="contained"
                        startIcon={<CancelIcon />}
                    >
                        {I18n.t('Cancel')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

AddEventDialog.propTypes = {
    onClose: PropTypes.func.isRequired,
    imagePrefix: PropTypes.string,
};

export default AddEventDialog;
