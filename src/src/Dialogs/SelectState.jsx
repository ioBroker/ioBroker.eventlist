import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
    Button,
    TextField,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
} from '@mui/material';

import { Cancel as CancelIcon, Add as AddIcon, Close as ClearIcon } from '@mui/icons-material';

import { I18n, Utils } from '@iobroker/adapter-react-v5';

const styles = {
    textField: {},
    icon: {
        width: 32,
        maxHeight: 32,
    },
    emptyIcon: {
        marginRight: 8,
    },
    listItem: theme => ({
        padding: '3px',
        '&:hover': {
            background: theme.palette.mode === 'dark' ? theme.palette.primary.dark : theme.palette.primary.light,
        },
    }),
    listPrimary: {},
    listSecondary: {
        opacity: 0.7,
        fontStyle: 'italic',
        fontSize: 'smaller',
    },
    flex: {
        flex: 1,
    },
    dialogTitle: {
        display: 'flex',
    },
};

function getSelectIdIcon(obj, prefix) {
    prefix ||= '.'; //http://localhost:8081';
    let src = '';
    let id = obj._id.replace('system.adapter.');
    let adapter = id.split('.')[0];

    const aIcon = obj?.common?.icon;
    if (aIcon) {
        // if not BASE64
        if (!aIcon.startsWith('data:image/')) {
            if (aIcon.includes('.')) {
                src = `${prefix}/adapter/${adapter}/${aIcon}`;
            } else {
                return null; //'<i class="material-icons iob-list-icon">' + obj.common.icon + '</i>';
            }
        } else {
            src = aIcon;
        }
    }

    return src || null;
}

class SelectStateDialog extends Component {
    constructor(props) {
        super(props);

        this.state = {
            selected: '',
            ids: [],
            reading: true,
            filter: '',
        };

        this.promises = {};

        this.readIds().then(ids => this.setState({ ids }));
    }

    async readIds() {
        const objects = await this.props.socket.getObjectViewCustom('custom', 'state', '', '\u9999');
        const namespace = `${this.props.adapterName}.${this.props.instance || 0}`;
        const ids = [];
        Object.keys(objects).forEach(id => {
            if (objects[id][namespace]) {
                ids.push(id);
            }
        });

        return ids;
    }

    async getObject(id) {
        const obj = await this.props.socket.getObject(id);
        this.setState({ [obj._id]: obj });
    }

    renderListItem(id, filter) {
        const obj = this.state[id];
        if (obj) {
            const name = Utils.getObjectNameFromObj(obj, null, { language: this.state.lang }) || obj;
            if (filter && !id.toLowerCase().includes(filter) && !name.toLowerCase().includes(filter)) {
                return null;
            }

            const icon = getSelectIdIcon(obj, this.props.imagePrefix);
            return (
                <ListItemButton
                    onClick={() => this.props.onClose(id)}
                    key={id}
                    sx={styles.listItem}
                >
                    <ListItemIcon>
                        {icon ? (
                            <img
                                src={icon}
                                style={styles.icon}
                                alt="state"
                            />
                        ) : (
                            <div style={styles.emptyIcon}>&nbsp;</div>
                        )}
                    </ListItemIcon>
                    <ListItemText
                        primary={name}
                        secondary={id !== name ? id : ''}
                        sx={{
                            '& .MuiListItemText-primary': styles.listPrimary,
                            '& .MuiListItemText-secondary': styles.listSecondary,
                        }}
                    />
                </ListItemButton>
            );
        }
        this.promises[id] = this.promises[id] || this.getObject(id);
        if (filter && !id.toLowerCase().includes(filter)) {
            return null;
        }
        return (
            <ListItemButton
                onClick={() => this.props.onClose(id)}
                key={id}
                sx={styles.listItem}
            >
                <ListItemIcon>
                    <div style={styles.emptyIcon}>&nbsp;</div>
                </ListItemIcon>
                <ListItemText
                    primary={id}
                    style={styles.listPrimary}
                />
            </ListItemButton>
        );
    }

    render() {
        const filter = this.state.filter.toLowerCase();
        return (
            <Dialog
                open={!0}
                fullWidth
                maxWidth="md"
                onClose={() => this.props.onClose()}
            >
                <DialogTitle style={styles.dialogTitle}>
                    <div style={{ marginRight: 20, marginTop: 5 }}>{I18n.t('Select state')}</div>
                    <TextField
                        variant="standard"
                        style={styles.flex}
                        label={I18n.t('Filter')}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                            endAdornment: this.state.filter ? (
                                <IconButton onClick={() => this.setState({ filter: '' })}>
                                    <ClearIcon />
                                </IconButton>
                            ) : undefined,
                        }}
                        autoFocus
                        value={this.state.filter}
                        onChange={e => this.setState({ filter: e.target.value })}
                        fullWidth
                        size="small"
                    />
                </DialogTitle>
                <DialogContent style={styles.dialogContent}>
                    <List dense>
                        {!filter && (
                            <ListItem
                                button
                                onClick={() => this.props.onClose(true)}
                            >
                                <Button
                                    color="grey"
                                    variant="contained"
                                >
                                    <AddIcon />
                                    {I18n.t('Add new states')}
                                </Button>
                            </ListItem>
                        )}
                        {this.state.ids.map(item => this.renderListItem(item, filter))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => this.props.onClose()}
                        color="primary"
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

SelectStateDialog.propTypes = {
    onClose: PropTypes.func.isRequired,
    socket: PropTypes.object.isRequired,
    adapterName: PropTypes.string.isRequired,
    instance: PropTypes.number.isRequired,
    imagePrefix: PropTypes.string.isRequired,
};

export default SelectStateDialog;
