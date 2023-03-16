import React, { Component } from 'react';
import { withStyles } from '@mui/styles';
import PropTypes from 'prop-types';

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';

import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Close';

import { I18n, Utils } from '@iobroker/adapter-react-v5';

const styles = theme => ({
    textField: {

    },
    icon: {
        width: 32,
        maxHeight: 32,
    },
    emptyIcon: {
        marginRight: theme.spacing(1),
    },
    listItem: {
        padding: 3,
        '&:hover': {
            background: theme.palette.mode === 'dark' ? theme.palette.primary.dark : theme.palette.primary.light,
        },
    },
    listPrimary: {

    },
    listSecondary: {
        opacity: 0.7,
        fontStyle: 'italic',
        fontSize: 'smaller',
    },
    newState: {
        color: theme.palette.primary.main,
        fontSize: 'greater',
        fontWeight: 'bold',
    },
    flex: {
        flex: 1,
    },
    dialogTitle: {
        display: 'flex',
    },
});

function getSelectIdIcon(obj, prefix) {
    prefix = prefix || '.';//http://localhost:8081';
    let src = '';
    let id = obj._id.replace('system.adapter.');
    let adapter = id.split('.')[0];

    const aIcon = obj && obj.common && obj.common.icon;
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

        this.readIds()
            .then(ids => this.setState({ ids }));
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
            return <ListItemButton onClick={() => this.props.onClose(id)} key={id} className={this.props.classes.listItem}>
                <ListItemIcon>
                    {icon ? <img src={icon} className={this.props.classes.icon} alt="state"/> : <div className={this.props.classes.emptyIcon}>&nbsp;</div>}
                </ListItemIcon>
                <ListItemText primary={name} secondary={id !== name ? id : ''} classes={{primary: this.props.classes.listPrimary, secondary: this.props.classes.listSecondary}}/>
            </ListItemButton>;
        } else {
            this.promises[id] = this.promises[id] || this.getObject(id);
            if (filter && !id.toLowerCase().includes(filter)) {
                return null;
            }
            return <ListItemButton onClick={() => this.props.onClose(id)} key={id} className={this.props.classes.listItem}>
                <ListItemIcon>
                    <div className={this.props.classes.emptyIcon}>&nbsp;</div>
                </ListItemIcon>
                <ListItemText primary={id} classes={{primary: this.props.classes.listPrimary}}/>
            </ListItemButton>;
        }
    }

    render() {
        const filter = this.state.filter.toLowerCase();
        return <Dialog
            open={true}
            fullWidth={true}
            maxWidth="md"
            onClose={() => this.props.onClose()}>
            <DialogTitle className={this.props.classes.dialogTitle}>
                <div style={{ marginRight: 20, marginTop: 5 }}>{I18n.t('Select state')}</div>
                <TextField
                    variant="standard"
                    className={this.props.classes.flex}
                    label={I18n.t('Filter')}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                        endAdornment: this.state.filter ?
                            <IconButton
                                onClick={() => this.setState({ filter: '' })}
                            >
                                <ClearIcon />
                            </IconButton>
                            : undefined,
                    }}
                    autoFocus
                    value={this.state.filter}
                    onChange={e => this.setState({ filter: e.target.value })}
                    fullWidth
                    size="small"
                />
            </DialogTitle>
            <DialogContent className={this.props.classes.dialogContent}>
                <List dense>
                    {!filter && <ListItem button onClick={() => this.props.onClose(true)}>
                        <Button color="grey" variant="contained"><AddIcon />{I18n.t('Add new states')}</Button>
                    </ListItem>}
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
        </Dialog>;
    }
}

SelectStateDialog.propTypes = {
    onClose: PropTypes.func.isRequired,
    socket: PropTypes.object.isRequired,
    adapterName: PropTypes.string.isRequired,
    instance: PropTypes.number.isRequired,
    imagePrefix: PropTypes.string.isRequired,
};

export default withStyles(styles)(SelectStateDialog);
