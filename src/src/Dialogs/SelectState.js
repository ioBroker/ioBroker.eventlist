import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import IconButton from '@material-ui/core/IconButton';

import CancelIcon from '@material-ui/icons/Cancel';
import AddIcon from '@material-ui/icons/Add';
import ClearIcon from '@material-ui/icons/Close';

import I18n from '@iobroker/adapter-react/i18n';
import Utils from '@iobroker/adapter-react/Components/Utils';

const styles = theme => ({
    textField: {

    },
    icon: {
        width: 32,
        maxHeight: 32
    },
    emptyIcon: {
        marginRight: theme.spacing(1)
    },
    listItem: {
        padding: 3,
        '&:hover': {
            background: theme.palette.type === 'dark' ? theme.palette.primary.dark : theme.palette.primary.light,
        }
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
        fontWeight: 'bold'
    }
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
                src = prefix + '/adapter/' + adapter + '/' + aIcon;
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
            .then(ids => this.setState({ids}));
    }

    readIds() {
        return new Promise((resolve, reject) => {
            this.props.socket.getRawSocket().emit('getObjectView', 'custom', 'state', {startkey: '', endkey: '\u9999'}, (err, res) => {
                if (!err) {
                    const namespace = `${this.props.adapterName}.${this.props.instance || 0}`;
                    const ids = [];
                    if (res && res.rows) {
                        for (let i = 0; i < res.rows.length; i++) {
                            const obj = res.rows[i].value;
                            if (obj[namespace]) {
                                ids.push(res.rows[i].id);
                            }
                        }
                    }

                    resolve(ids);
                } else {
                    reject(err);
                }
            });
        });
    }

    getObject(id) {
        return this.props.socket.getObject(id)
            .then(obj =>
                this.setState({[obj._id]: obj}));
    }

    renderListItem(id, filter) {
        const obj = this.state[id];
        if (obj) {
            const name = Utils.getObjectNameFromObj(obj, null, { language: this.state.lang }) || obj;
            if (filter && !id.toLowerCase().includes(filter) && !name.toLowerCase().includes(filter)) {
                return null;
            }

            const icon = getSelectIdIcon(obj);
            return <ListItem button onClick={() => this.props.onClose(id)} key={id} className={this.props.classes.listItem}>
                <ListItemIcon>
                    {icon ? <img src={icon} className={this.props.classes.icon} alt="state"/> : <div className={this.props.classes.emptyIcon}>&nbsp;</div>}
                </ListItemIcon>
                <ListItemText primary={name} secondary={id !== name ? id : ''} classes={{primary: this.props.classes.listPrimary, secondary: this.props.classes.listSecondary}}/>
            </ListItem>;
        } else {
            this.promises[id] = this.promises[id] || this.getObject(id);
            if (filter && !id.toLowerCase().includes(filter)) {
                return null;
            }
            return <ListItem button onClick={() => this.props.onClose(id)} key={id} className={this.props.classes.listItem}>
                <ListItemIcon>
                    <div className={this.props.classes.emptyIcon}>&nbsp;</div>
                </ListItemIcon>
                <ListItemText primary={id} classes={{primary: this.props.classes.listPrimary}}/>
            </ListItem>;
        }
    }

    render() {
        const filter = this.state.filter.toLowerCase();
        return <Dialog
            open={true}
            fullWidth={true}
            maxWidth="md"
            onClose={() => this.props.onClose()}>
            <DialogTitle>{I18n.t('Select state')}<TextField
                label={I18n.t('Filter')}
                InputLabelProps={ {shrink: true} }
                InputProps={{
                    endAdornment: this.state.searchedValue ?
                        <IconButton
                            onClick={() => this.setState({ searchedValue: '' })}>
                            <ClearIcon />
                        </IconButton>
                        : undefined,
                }}
                autoFocus
                value={this.state.filter}
                onChange={e => this.setState({filter: e.target.value})}
                fullWidth
                size="small"
            /></DialogTitle>
            <DialogContent className={this.props.classes.dialogContent}>
                <List dense={true}>
                    {!filter && <ListItem button onClick={() => this.props.onClose(true)}>
                        <Button variant="contained"><AddIcon />{I18n.t('Add new states')}</Button>
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
};

export default withStyles(styles)(SelectStateDialog);
