import React, { Component } from 'react';
import { withStyles } from '@mui/styles';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { lighten } from '@mui/material/styles';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Fab from '@mui/material/Fab';
import Snackbar from '@mui/material/Snackbar';
import LinearProgress  from '@mui/material/LinearProgress';
import CircularProgress  from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import Select from '@mui/material/Select';

import { MdRefresh as IconReload } from 'react-icons/md';
import { MdClose as IconClose } from 'react-icons/md';
import { MdQuestionAnswer as IconQuestion } from 'react-icons/md';
import { MdAdd as IconAddEvent } from 'react-icons/md';
import { MdEdit as IconEdit } from 'react-icons/md';
import { FaFilePdf as IconPdf } from 'react-icons/fa';
import DeleteIcon from '@mui/icons-material/Delete';
import IconEvent from '@mui/icons-material/Event';

import I18n from '@iobroker/adapter-react-v5/i18n';
import ConfirmDialog from '@iobroker/adapter-react-v5/Dialogs/Confirm';
import Router from '@iobroker/adapter-react-v5/Components/Router';
import Image from '@iobroker/adapter-react-v5/Components/Image';
import Utils from '@iobroker/adapter-react-v5/Components/Utils';
import { withWidth } from '@iobroker/adapter-react-v5';

import AddEventDialog from '../Dialogs/AddEvent';
import AddIdDialog from '../Dialogs/AddId';
import SelectStateDialog from '../Dialogs/SelectState';

// Copyright Apache 2.0 https://raw.githubusercontent.com/material-icons/material-icons/master/svg/filter_alt/baseline.svg
// https://github.com/material-icons/material-icons/blob/master/LICENSE
class IconFilter extends React.Component {
    render() {
        return <svg viewBox="0 0 24 24" width={24} height={24} xmlns="http://www.w3.org/2000/svg" className={ this.props.className }>
            <path fill="currentColor" stroke="currentColor" d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04c-.83 0-1.3.95-.79 1.61z"/>
        </svg>;
    }
}

function serialPromises(promises, _resolve, _results) {
    if (!_resolve) {
        return new Promise(resolve => serialPromises(promises, resolve, []));
    } else if (!promises || !promises.length) {
        _resolve(_results);
    } else {
        const prom = promises.shift();
        prom.then(result => {
            _results.push(result);
            setTimeout(() => serialPromises(promises, _resolve, _results), 0);
        });
    }
}

const COLOR_RUNNING_DURATION = '#59be78';

const styles = theme => ({
    tab: {
        width: '100%',
        height: '100%',
        overflow: 'hidden'
    },
    instanceNotOnline: {
        color: '#883333',
        marginLeft: theme.spacing(1)
    },
    toolbarRoot: {
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(1),
    },
    toolbarHighlight: theme.palette.mode === 'light'
        ? {
            color: theme.palette.secondary.main,
            backgroundColor: lighten(theme.palette.secondary.light, 0.85),
        }
        : {
            color: theme.palette.text.primary,
            backgroundColor: theme.palette.secondary.dark,
        },
    toolbarTitle: {
        flex: '1 1 100%',
    },
    toolbarButton: {
        marginRight: theme.spacing(1),
        //height: 37.25,
    },
    visuallyHidden: {
        border: 0,
        clip: 'rect(0 0 0 0)',
        height: 1,
        margin: -1,
        overflow: 'hidden',
        padding: 0,
        position: 'absolute',
        top: 20,
        width: 1,
    },
    tableContainer: {
        height: '100%',
        overflow: 'auto'
    },
    table:{
        width: 'auto',
    },
    tdIcons: {
        textAlign: 'right',
        marginRight: theme.spacing(1),
        marginTop: 2,
    },
    tdTs: {
        //width: 100
        paddingRight: theme.spacing(1),
    },
    tdEvent: {
        //width: `calc(100% - 250px - 52px)`,
        paddingRight: theme.spacing(1),
    },
    tdVal: {
        //width: 150,
    },
    tdDuration: {
        //paddingRight: theme.spacing(1),
    },
    tdDurationRunning: {
        animationName: 'running',
        animationDuration: '2s',
        animationIterationCount: 'infinite'
    },
    tdID: {
        opacity: 0.3
    },
    tdEdit: {

    },
    editButton: {
        height: 16,
        opacity: 0.3,
        '&:hover': {
            opacity: 1,
        }
    },
    toolbarButtonText: {
        whiteSpace: 'nowrap',
        marginLeft: 16,
        marginRight: 16,
        lineHeight: 24,
        display: 'inline-block'
    },
    tabMargins: {
        paddingLeft: theme.spacing(2),
    },
    buttonAddState: {
        minWidth: '120px !important',
    },
    icon: {
        width: 28,
        height: 28,
        verticalAlign: 'middle',
    },
    filterControl: {
        minWidth: 200,
        marginRight: theme.spacing(1),
        marginLeft: 3,
    },
    filterDiv: {
        position: 'relative',
        display: 'inline-block',
        cursor: 'pointer',
    },
    filterIcon: {

    },
    filterClearIcon: {
        color: '#FF0000',
        position: 'absolute',
        top: 0,
        left: 0,
        width: 24,
        height: 24,
        opacity: 0.5,
    },
    filterCounts: {
        fontSize: 10,
        opacity: 0.7,
        float: 'right',
        marginTop: 16,
    },
    filterSecondary: {
        opacity: 0.7,
        fontSize: 'smaller',
    }
});

class List extends Component {
    constructor(props) {
        super(props);

        let editEnabled   = window.localStorage.getItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.editEnabled`) || null;
        let editAvailable = props.editAvailable !== undefined ? props.editAvailable : true;

        let filterStates   = window.localStorage.getItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.filterStates`) || null;
        try {
            filterStates = filterStates ? JSON.parse(filterStates) : [];
        } catch (e) {
            filterStates = [];
        }

        if (!editAvailable) {
            editEnabled = false;
        } else if (!this.props.showEditButton || editEnabled === null) {
            editEnabled = props.editEnabled !== undefined ? props.editEnabled : true;
        } else if (editEnabled === 'true') {
            editEnabled = true;
        } else if (editEnabled === 'false') {
            editEnabled = false;
        }

        const location = Router.getLocation();

        this.state = {
            toast: '',
            isInstanceAlive: false,
            eventList: false,
            eventRawList: false,
            order: 'desc',
            orderBy: 'ts',
            filterStates,
            selected: [],
            showDeleteConfirm: false,
            showSelectState: location.dialog === 'selectState',
            showAddIdDialog: location.dialog === 'addId' ? location.id || true : false,
            showAddEventDialog: location.dialog === 'addEvent',
            selectedId: '',
            editEnabled,
            editAvailable,
            pdfInGeneration: false,
            stateIds: null,
            isFloatComma: true,
        };

        this.imagePrefix    = this.props.imagePrefix; // by default is admin
        this.aliveId        = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;
        this.eventListId    = `${this.props.adapterName}.${this.props.instance}.eventJSONList`;
        this.eventRawListId = `${this.props.adapterName}.${this.props.instance}.eventListRaw`;
        this.triggerPDFId   = `${this.props.adapterName}.${this.props.instance}.triggerPDF`;

        this.headCells = [
            { id: 'ts',    label: I18n.t('Time'),  align: 'right' },
            { id: 'icon'},
            { id: 'event', label: I18n.t('Event'), align: 'center' },
            { id: 'val',   label: I18n.t('Value'), align: 'left' },
        ];
    }

    readStatus(cb) {
        this.props.socket.getState(this.aliveId)
            .then(aliveState =>
                this.props.socket.getState(this.eventListId)
                    .then(state =>
                        this.props.socket.getState(this.eventRawListId)
                            .then(rawState => {
                                let eventList;
                                try {
                                    eventList = state && state.val ? JSON.parse(state.val) : []
                                } catch (e) {
                                    eventList = [];
                                }
                                let eventRawList;
                                try {
                                    eventRawList = rawState && rawState.val ? JSON.parse(rawState.val) : []
                                } catch (e) {
                                    eventRawList = [];
                                }

                                // merge together
                                eventList.forEach(item => {
                                    const raw = eventRawList.find(it => it.ts === item._id);
                                    if (raw) {
                                        item.stateId = raw.id;
                                    }
                                });

                                this.setState({isInstanceAlive: aliveState && aliveState.val, eventList, eventRawList}, () => cb && cb());
                            })));
    }

    componentDidMount() {
        this.readStatus(() => {
            this.props.socket.subscribeState(this.aliveId, this.onStateChanged);
            this.props.socket.subscribeState(this.eventListId, this.onStateChanged);
            this.props.socket.subscribeState(this.eventRawListId, this.onStateChanged);
            this.props.socket.subscribeState(this.triggerPDFId, this.onStateChanged);
        });
   }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.eventListId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.eventRawListId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.triggerPDFId, this.onStateChanged);
    }

    onStateChanged = (id, state) => {
        if (id === this.aliveId) {
            this.setState({isInstanceAlive: state && state.val});
        } if (id === this.triggerPDFId) {
            this.setState({pdfInGeneration: state && state.val});
        } else if (id === this.eventListId) {
            let eventList;
            try {
                eventList = state && state.val ? JSON.parse(state.val) : []
            } catch (e) {
                eventList = [];
            }
            // merge together
            this.state.eventRawList && eventList.forEach(item => {
                const raw = this.state.eventRawList.find(it => it.ts === item._id);
                if (raw) {
                    item.stateId = raw.id;
                }
            });
            this.setState({eventList});
        } else if (id === this.eventRawListId) {
            let eventRawList;
            try {
                eventRawList = state && state.val ? JSON.parse(state.val) : []
            } catch (e) {
                eventRawList = [];
            }
            // merge together
            let eventList = null;
            this.state.eventList && this.state.eventList.forEach((item, i) => {
                if (!item.stateId) {
                    const raw = eventRawList.find(it => it.ts === item._id);
                    if (raw) {
                        eventList = eventList || JSON.parse(JSON.stringify(this.state.eventList));
                        eventList[i].stateId = raw.id;
                    }
                }
            });
            const newState = {eventRawList};
            if (eventList) {
                newState.eventList = eventList;
            }
            this.setState(newState);
        }
    };

    renderToast() {
        if (!this.state.toast) return null;
        return (
            <Snackbar
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                open={true}
                autoHideDuration={6000}
                onClose={() => this.setState({toast: ''})}
                ContentProps={{
                    'aria-describedby': 'message-id',
                }}
                message={<span id="message-id">{this.state.toast}</span>}
                action={[
                    <IconButton
                        key="close"
                        aria-label="Close"
                        color="inherit"
                        className={this.props.classes.close}
                        onClick={() => this.setState({toast: ''})}
                    >
                        <IconClose />
                    </IconButton>,
                ]}
            />);
    }

    onRequestSort = (event, property) => {
        const isAsc = this.state.orderBy === property && this.state.order === 'asc';
        this.setState({ order: isAsc ? 'desc' : 'asc', orderBy: property });
    };

    renderHeader() {
        const createSortHandler = (property) => event =>
            this.onRequestSort(event, property);

        return <TableHead>
            <TableRow>
                {this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled && <TableCell padding="checkbox">
                    <Checkbox
                        indeterminate={!!this.state.selected.length && this.state.selected.length < this.state.eventList.length}
                        checked={this.state.eventList.length > 0 && this.state.selected.length === this.state.eventList.length}
                        disabled={!this.state.eventList.length}
                        onChange={e => {
                            if (e.target.checked) {
                                const selected = this.state.eventList.map(n => n._id);
                                const selectedId = selected.length === 1 ? this.state.eventList.find(item => item._id === selected[0]).stateId : '';
                                this.setState({selected, selectedId});
                            } else {
                                this.setState({selected: [], selectedId: ''});
                            }
                        }}
                        inputProps={{ 'aria-label': 'select all desserts' }}
                    />
                </TableCell>}
                {this.headCells.map(cell =>
                    cell.id === 'icon' ?  (
                            this.props.native.icons ? <TableCell
                                key={cell.id}
                                component="th"
                                className={this.props.classes.tdIcons}
                                align="left"
                                padding="none"
                            /> : null
                        )
                    :
                    <TableCell
                        key={cell.id}
                        className={this.props.classes['td' + cell.id[0].toUpperCase() + cell.id.substring(1)]}
                        align={cell.align}
                        padding="none"
                        component="th"
                        sortDirection={this.state.orderBy === cell.id ? this.state.order : false}
                    >
                        <TableSortLabel
                            active={this.state.orderBy === cell.id}
                            direction={this.state.orderBy === cell.id ? this.state.order : 'asc'}
                            onClick={createSortHandler(cell.id)}
                        >
                            {cell.label}
                            {this.state.orderBy === cell.id ?
                                <span className={this.props.classes.visuallyHidden}>{this.state.order === 'desc' ? I18n.t('sorted descending') : I18n.t('sorted ascending')}</span>
                                : null
                            }
                        </TableSortLabel>
                    </TableCell>
                )}
                {this.props.native.duration ?
                    <TableCell className={this.props.classes.tdDuration} component="th" padding="none" align="right">
                        {I18n.t('Duration')}</TableCell>
                    : null}
                {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdID} align="left">State ID</TableCell>}
                {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdEdit} align="left"/>}
            </TableRow>
        </TableHead>;
    }

    triggerPdf() {
        if (this.state.isInstanceAlive) {
            this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'pdf', this.props.native.pdfSettings)
                .then(() => {
                    let myWindow;
                    if (!window.location.pathname.includes('adapter/')) {
                        myWindow = window.open('/eventlist/report.pdf?q=' + Date.now(), 'pdf');
                    } else {
                        myWindow = window.open('/files/eventlist/report.pdf?q=' + Date.now(), 'pdf');
                    }

                    myWindow && myWindow.focus();
                });
        }
    }

    readIds() {
        return new Promise((resolve, reject) => {
            this.props.socket.getRawSocket().emit('getObjectView', 'custom', 'state', { startkey: '', endkey: '\u9999' }, (err, res) => {
                if (!err) {
                    const namespace = `${this.props.adapterName}.${this.props.instance || 0}`;
                    const ids = [];
                    const promises = [];
                    if (res && res.rows) {
                        for (let i = 0; i < res.rows.length; i++) {
                            const obj = res.rows[i].value;
                            if (obj[namespace]) {
                                (id => promises.push(this.props.socket.getObject(id)
                                    .then(obj => {
                                        if (obj) {
                                            let count = 0;
                                            // count states
                                            this.state.eventList.forEach(item => item.id === obj._id && count++);
                                            ids.push({id: obj._id, name: Utils.getObjectNameFromObj(obj, I18n.getLanguage()), count});
                                        }
                                    })
                                    .catch(e => ids.push({id}))
                                ))(res.rows[i].id);
                            }
                        }
                    }

                    serialPromises(promises)
                        .then(() => {
                            ids.sort((a, b) => a.id > b.id ? 1 : (a.id < b.id ? -1 : 0));
                            resolve(ids);
                        });
                } else {
                    reject(err);
                }
            });
        });
    }

    renderFilter() {
        return <>
            <div className={this.props.classes.filterDiv}
                 title={I18n.t('Clear filter')}
                 onClick={() => {
                     window.localStorage.setItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.filterStates`, '');
                     this.setState({filterStates: []});
                 }}
            >
                <IconFilter className={this.props.classes.filterIcon}/>
                {this.state.filterStates.length ? <IconClose className={this.props.classes.filterClearIcon}/> : null}
            </div>
            <Select
                variant="standard"
                className={this.props.classes.filterControl}
                multiple
                label={I18n.t('Filter by ID')}
                value={this.state.filterStates}
                onChange={event => {
                    window.localStorage.setItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.filterStates`, JSON.stringify(event.target.value));
                    this.setState({ filterStates: event.target.value });
                }}
                //input={<Input placeholder={I18n.t('Filter by ID')}/>}
                onOpen={() => this.readIds().then(ids => this.setState({ stateIds: ids }))}
                renderValue={selected => selected.length === 1 ? selected[0] : selected.length}
            >
                {!this.state.stateIds ?
                    <MenuItem><CircularProgress /></MenuItem>
                    :
                    this.state.stateIds.map(item =>
                        <MenuItem key={item.id} value={item.id}>
                            <Checkbox checked={this.state.filterStates.includes(item.id)} />
                            <ListItemText
                                primary={<span>{item.name} <span className={this.props.classes.filterCounts}>{item.count}</span></span>}
                                secondary={item.id}
                                classes={{ secondary: this.props.classes.filterSecondary }}
                            />
                        </MenuItem>)
                }
            </Select>
        </>;
    }

    renderToolbar() {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm';
        let name = this.props.name || I18n.t('Event list');
        if (typeof name === 'object') {
            name = name[I18n.getLanguage()] || name.en || I18n.t('Event list');
        }

        return <Toolbar className={clsx(this.props.classes.toolbarRoot, this.state.selected.length && this.props.classes.toolbarHighlight)}>

            {this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled && this.state.selected.length ?
                <Typography className={this.props.classes.toolbarTitle} color="inherit" variant="subtitle1" component="div">
                    {this.state.selected.length} {I18n.t('selected')}
                </Typography>
            :
                <Typography className={this.props.classes.toolbarTitle} variant="h6" id="tableTitle" component="div">
                    <span>{name}</span>
                    <span className={this.props.classes.instanceNotOnline}>{!this.state.isInstanceAlive ? I18n.t('(Instance not running)') : ''}</span>
                </Typography>
            }

            {!this.state.selected.length ? this.renderFilter() : null}

            {this.state.editAvailable && this.state.editEnabled && this.state.selected.length ?
                <>
                    <Tooltip title={I18n.t('Delete')}>
                        <IconButton aria-label="delete" onClick={() => this.setState({showDeleteConfirm: true})}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                    {this.state.selectedId ?
                        <Tooltip title={I18n.t('Edit settings for state')}>
                            <IconButton aria-label="edit" onClick={() => {
                                Router.doNavigate(null, 'addId', this.state.selectedId);
                                this.setState({showAddIdDialog: this.state.selectedId})
                            }}>
                                <IconEdit />
                            </IconButton>
                        </Tooltip>
                        : null}
                </>
                :
                <>
                    {this.state.editAvailable && this.state.editEnabled && <Tooltip title={I18n.t('Add state to event list')} className={this.props.classes.toolbarButton}>
                        <Fab variant="extended" size="small" aria-label="add" color="secondary" classes={{root: this.props.classes.buttonAddState}} onClick={() => {
                            Router.doNavigate(null, 'selectState', '');
                            this.setState({showSelectState: true});
                        }}>
                            <div className={clsx(!narrowWidth && this.props.classes.toolbarButtonText)}>
                                <IconEdit style={{verticalAlign: 'middle', marginRight: 8, paddingLeft: 16}}/>
                                {narrowWidth ? null : <span style={{verticalAlign: 'middle', paddingRight: 16}}>{I18n.t('States')}</span>}
                            </div>
                        </Fab>
                    </Tooltip>}
                    {this.state.editAvailable && this.state.editEnabled && <Tooltip title={I18n.t('Insert custom event into list')} className={this.props.classes.toolbarButton}>
                        <span>
                            <Fab variant="extended" aria-label="add" size="small" color="primary" disabled={!this.state.isInstanceAlive} onClick={() => this.setState({showAddEventDialog: true})}>
                                <div className={clsx(!narrowWidth && this.props.classes.toolbarButtonText)}>
                                    <IconAddEvent style={{verticalAlign: 'middle'}} />
                                    {narrowWidth ? null : <span style={{verticalAlign: 'middle'}}>{I18n.t('Custom Event')}</span>}
                                </div>
                            </Fab>
                        </span>
                    </Tooltip>}
                    {this.state.editAvailable && this.props.showEditButton && <Tooltip title={I18n.t('Edit mode')} className={this.props.classes.toolbarButton}>
                        <Fab
                            variant="extended"
                            aria-label="enable-edit"
                            size="small"
                            style={this.state.editEnabled ? {background: 'red'} : {}}
                            onClick={() => {
                                window.localStorage.setItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.editEnabled`, this.state.editEnabled ? 'false' : 'true');
                                this.setState({editEnabled: !this.state.editEnabled});
                            }}>
                            <IconEdit />
                        </Fab>
                    </Tooltip>}
                    {this.props.native.pdfButton && <Tooltip title={I18n.t('Generate PDF file')} className={this.props.classes.toolbarButton}>
                        <span>
                            <Fab
                                variant="extended"
                                aria-label="generate-pdf"
                                size="small"
                                disabled={!this.state.isInstanceAlive || this.state.pdfInGeneration}
                                onClick={() => this.triggerPdf()}>
                                <IconPdf />
                            </Fab>
                        </span>
                    </Tooltip>}
                    <Tooltip title={I18n.t('Refresh list')} className={this.props.classes.toolbarButton}>
                        <Fab variant="extended" aria-label="refresh" size="small" onClick={() => this.readStatus()}>
                            <IconReload />
                        </Fab>
                    </Tooltip>
                </>
            }
        </Toolbar>;
    }

    stableSort(array, comparator) {
        if (this.state.filterStates && this.state.filterStates.length) {
            array = array.filter(item => this.state.filterStates.includes(item.id));
        }
        const stabilizedThis = array.map((el, index) => [el, index]);

        stabilizedThis.sort((a, b) => {
            const order = comparator(a[0], b[0]);
            if (order !== 0) {
                return order;
            } else {
                return a[1] - b[1];
            }
        });
        return stabilizedThis.map(el => el[0]);
    }

    descendingComparator(a, b, orderBy) {
        if (b[orderBy] < a[orderBy]) {
            return -1;
        }
        if (b[orderBy] > a[orderBy]) {
            return 1;
        }
        return 0;
    }

    getComparator(order, orderBy) {
        return order === 'desc'
            ? (a, b) => this.descendingComparator(a, b, orderBy === 'ts' ? '_id' : orderBy)
            : (a, b) => -this.descendingComparator(a, b, orderBy === 'ts' ? '_id' : orderBy);
    }

    handleClick(id) {
        const selectedIndex = this.state.selected.indexOf(id);
        let newSelected = [];
        let selectedId = '';

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(this.state.selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(this.state.selected.slice(1));
        } else if (selectedIndex === this.state.selected.length - 1) {
            newSelected = newSelected.concat(this.state.selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                this.state.selected.slice(0, selectedIndex),
                this.state.selected.slice(selectedIndex + 1),
            );
        }
        if (newSelected.length === 1) {
            selectedId = this.state.eventList.find(item => item._id === newSelected[0]).stateId;
        }

        this.setState({selected: newSelected, selectedId});
    };

    deleteEntries(cb) {
        this.props.socket.getState(`${this.props.adapterName}.${this.props.instance}.eventListRaw`)
            .then(state => {
                let eventList;
                try {
                    eventList = state && state.val ? JSON.parse(state.val) : []
                } catch (e) {
                    eventList = [];
                }

                eventList = eventList.filter(item => !this.state.selected.includes(item.ts));

                this.props.socket.setState(`${this.props.adapterName}.${this.props.instance}.eventListRaw`, JSON.stringify(eventList))
                    .then(() =>
                        this.setState({selected: [], selectedId: ''}, () => cb && cb()));
            });
    }

    renderSelectState() {
        if (!this.state.showSelectState) {
            return null;
        }
        return <SelectStateDialog
            imagePrefix={this.props.imagePrefix}
            socket={this.props.socket}
            adapterName={this.props.adapterName}
            instance={this.props.instance}
            onClose={id => {
                if (id) {
                    Router.doNavigate(null, 'addId', id);
                    this.setState({showAddIdDialog: id, showSelectState: false});
                } else {
                    Router.doNavigate(null, '', '');
                    this.setState({showSelectState: false});
                }
            }}
            />;
    }

    renderList() {
        return <TableContainer className={this.props.classes.tableContainer}>
            <Table
                className={this.props.classes.table}
                size="small"
            >
                {this.renderHeader()}
                <TableBody>
                    {this.stableSort(this.state.eventList, this.getComparator(this.state.order, this.state.orderBy))
                        .map((row, index) => {
                            const isItemSelected = this.state.selected.includes(row._id);
                            const labelId = `enhanced-table-checkbox-${index}`;

                            let icon = row.icon;

                            if (!this.props.isWeb && icon?.match(/^[-_0-9a-z]+\.admin\//)) { // support of hm-rpc.admin/icons/152_hmip-swdo-i_thumb.png
                                icon = `/files/${icon}`;
                            }

                            return <TableRow
                                hover
                                onClick={() => this.handleClick(row._id)}
                                style={row._style || undefined}
                                role="checkbox"
                                aria-checked={isItemSelected}
                                tabIndex={-1}
                                key={row._id}
                                selected={isItemSelected}
                            >
                                {this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled && <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={isItemSelected}
                                        inputProps={{ 'aria-labelledby': labelId }}
                                    />
                                </TableCell>}
                                <TableCell style={row._style || undefined } className={this.props.classes.tdTs} scope="row" padding="none" align="right">{row.ts}</TableCell>
                                {this.props.native.icons ?
                                    <TableCell style={row._style || undefined } className={this.props.classes.tdIcons} component="td" padding="none" align="center">
                                        {icon ? (icon.endsWith('default') ? <IconEvent/> : <Image
                                            imagePrefix={this.imagePrefix}
                                            src={icon}
                                            className={this.props.classes.icon}
                                            color={(row._style && row._style.color) || ''}
                                        />) : null}
                                    </TableCell>
                                    : null}
                                <TableCell style={row._style || undefined } className={this.props.classes.tdEvent} align="right">{row.event}</TableCell>
                                <TableCell style={row._style || undefined } className={this.props.classes.tdVal} align="left">{row.val === undefined ? '' : row.val.toString()}</TableCell>
                                {this.props.native.duration ?
                                    <TableCell style={row.dr ? Object.assign({}, row._style || {}, {color: COLOR_RUNNING_DURATION}) : row._style || undefined } className={clsx(row.dr && this.props.classes.tdDurationRunning, this.props.classes.tdDuration)} component="td" padding="none" align="right">
                                        {row.duration || ''}</TableCell>
                                    : null}
                                {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdID} align="left">{row.stateId}</TableCell>}
                                {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdEdit} align="left">{row.stateId ?
                                    <Tooltip title={I18n.t('Edit settings for state')} className={this.props.classes.toolbarButton}>
                                        <IconButton className={this.props.classes.editButton} onClick={e => {
                                            e.stopPropagation();
                                            Router.doNavigate(null, 'addId', row.stateId);
                                            this.setState({showAddIdDialog: row.stateId});
                                        }}><IconEdit/></IconButton>
                                    </Tooltip>: null}
                                </TableCell>}
                            </TableRow>;
                        })}
                </TableBody>
            </Table>
        </TableContainer>;
    }

    renderConfirmDialog() {
        if (!this.state.showDeleteConfirm) {
            return null;
        } else {
            return <ConfirmDialog
                title={I18n.t('Please confirm')}
                text={I18n.t('Are you sure to delete events from list?')}
                ok={I18n.t('Ok')}
                cancel={I18n.t('Cancel')}
                icon={<IconQuestion/>}
                onClose={result =>
                    this.setState({showDeleteConfirm: false}, () =>
                        result && this.deleteEntries())}
                />
        }
    }

    renderAddEventDialog() {
        if (!this.state.showAddEventDialog) {
            return null;
        } else {
            return <AddEventDialog
                imagePrefix={this.imagePrefix}
                onClose={event => {
                    this.setState({showAddEventDialog: false}, () =>
                        event && this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'insert', event))
                }}
            />;
        }
    }

    renderAddIdDialog() {
        if (!this.state.showAddIdDialog) {
            return null;
        } else {
            return <AddIdDialog
                imagePrefix={this.imagePrefix}
                instance={this.props.instance}
                adapterName={this.props.adapterName}
                themeName={this.props.themeName}
                themeType={this.props.themeType}
                socket={this.props.socket}
                native={this.props.native}
                id={typeof this.state.showAddIdDialog === 'string' ? this.state.showAddIdDialog : ''}
                onClose={event => {
                    Router.doNavigate(null, '', '');
                    this.setState({showAddIdDialog: false}, () =>
                        event && this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'insert', event))
                }}
            />;
        }
    }

    render() {
        return <Paper className={ clsx(this.props.classes.tab, !(this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled) && this.props.classes.tabMargins) }>
            {this.renderToolbar()}
            {this.state.eventList ? this.renderList() : <LinearProgress />}
            {this.renderToast()}
            {this.renderConfirmDialog()}
            {this.renderAddEventDialog()}
            {this.renderAddIdDialog()}
            {this.renderSelectState()}
        </Paper>;
    }
}

List.propTypes = {
    editAvailable: PropTypes.bool,
    editEnabled: PropTypes.bool,
    showEditButton: PropTypes.bool,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
    socket: PropTypes.object.isRequired,
    themeName: PropTypes.string,
    themeType: PropTypes.string,
    native: PropTypes.object.isRequired,
    imagePrefix: PropTypes.string,
    isWeb: PropTypes.bool,
    name: PropTypes.string,
};

export default withWidth()(withStyles(styles)(List));