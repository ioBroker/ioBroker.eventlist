import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { lighten } from '@material-ui/core/styles';
import withWidth from "@material-ui/core/withWidth";

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import Checkbox from '@material-ui/core/Checkbox';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Fab from '@material-ui/core/Fab';
import Snackbar from '@material-ui/core/Snackbar';
import LinearProgress  from '@material-ui/core/LinearProgress';

import {MdRefresh as IconReload} from 'react-icons/md';
import {MdClose as IconClose} from 'react-icons/md';
import {MdQuestionAnswer as IconQuestion} from 'react-icons/md';
import {MdAdd as IconAddId} from 'react-icons/md';
import {MdAdd as IconAddEvent} from 'react-icons/md';
import {MdEdit as IconEdit} from 'react-icons/md';
import {FaFilePdf as IconPdf} from 'react-icons/fa';
import DeleteIcon from '@material-ui/icons/Delete';

import I18n from '@iobroker/adapter-react/i18n';
import ConfirmDialog from '@iobroker/adapter-react/Dialogs/Confirm';
import AddEventDialog from '../Dialogs/AddEvent';
import AddIdDialog from '../Dialogs/AddId';

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
    toolbarHighlight: theme.palette.type === 'light'
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
});

class List extends Component {
    constructor(props) {
        super(props);

        let editEnabled   = window.localStorage.getItem(`${this.props.adapterName}-${this.props.instance || 0}-adapter.editEnabled`) || null;
        let editAvailable = props.editAvailable !== undefined ? props.editAvailable : true;

        if (!editAvailable) {
            editEnabled = false;
        } else if (!this.props.showEditButton || editEnabled === null) {
            editEnabled = props.editEnabled !== undefined ? props.editEnabled : true;
        } else if (editEnabled === 'true') {
            editEnabled = true;
        } else if (editEnabled === 'false') {
            editEnabled = false;
        }

        this.state = {
            toast: '',
            isInstanceAlive: false,
            eventList: false,
            eventRawList: false,
            order: 'desc',
            orderBy: 'ts',
            selected: [],
            showDeleteConfirm: false,
            showAddIdDialog: false,
            showAddEventDialog: false,
            selectedId: '',
            editEnabled,
            editAvailable,
            pdfInGeneration: false,
        };

        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;
        this.eventListId = `${this.props.adapterName}.${this.props.instance}.eventJSONList`;
        this.eventRawListId = `${this.props.adapterName}.${this.props.instance}.eventListRaw`;
        this.triggerPDFId = `${this.props.adapterName}.${this.props.instance}.triggerPDF`;

        this.headCells = [
            { id: 'ts',    label: I18n.t('Time'),  align: 'right' },
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
        this.setState({order: isAsc ? 'desc' : 'asc', orderBy: property});
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
                {
                    this.props.native.icons ? <TableCell
                        component="th"
                        className={this.props.classes.tdIcons}
                        align="left"
                        padding="none"
                    /> : null
                }

                {this.headCells.map(headCell => (
                    <TableCell
                        key={headCell.id}
                        className={this.props.classes['td' + headCell.id[0].toUpperCase() + headCell.id.substring(1)]}
                        align={headCell.align}
                        padding="none"
                        component="th"
                        sortDirection={this.state.orderBy === headCell.id ? this.state.order : false}
                    >
                        <TableSortLabel
                            active={this.state.orderBy === headCell.id}
                            direction={this.state.orderBy === headCell.id ? this.state.order : 'asc'}
                            onClick={createSortHandler(headCell.id)}
                        >
                            {headCell.label}
                            {this.state.orderBy === headCell.id ?
                                <span className={this.props.classes.visuallyHidden}>{this.state.order === 'desc' ? I18n.t('sorted descending') : I18n.t('sorted ascending')}</span>
                                : null
                            }
                        </TableSortLabel>
                    </TableCell>
                ))}
                {this.props.native.duration ?
                    <TableCell className={this.props.classes.tdDuration} component="th" padding="none" align="right">
                        {I18n.t('Duration')}</TableCell>
                    : null}
                {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdID} align="left">State ID</TableCell>}
                {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdEdit} align="left"/>}
            </TableRow>
        </TableHead>;
    }

    renderToolbar() {
        const narrowWidth = this.props.width === 'xs' || this.props.width === 'sm';
        return <Toolbar className={clsx(this.props.classes.toolbarRoot, this.state.selected.length && this.props.classes.toolbarHighlight)}>
            {this.state.isInstanceAlive && this.state.editAvailable && this.state.editEnabled && this.state.selected.length ?
                <Typography className={this.props.classes.toolbarTitle} color="inherit" variant="subtitle1" component="div">
                    {this.state.selected.length} {I18n.t('selected')}
                </Typography>
            :
                <Typography className={this.props.classes.toolbarTitle} variant="h6" id="tableTitle" component="div">
                    <span>{I18n.t('Event list')}</span>
                    <span className={this.props.classes.instanceNotOnline}>{!this.state.isInstanceAlive ? I18n.t('(Instance not running)') : ''}</span>
                </Typography>
            }

            {this.state.editAvailable && this.state.editEnabled && this.state.selected.length ?
                <>
                    <Tooltip title={I18n.t('Delete')}>
                        <IconButton aria-label="delete" onClick={() => this.setState({showDeleteConfirm: true})}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                    {this.state.selectedId ?
                        <Tooltip title={I18n.t('Edit settings for state')}>
                            <IconButton aria-label="edit" onClick={() => this.setState({showAddIdDialog: this.state.selectedId})}>
                                <IconEdit />
                            </IconButton>
                        </Tooltip>
                        : null}
                </>
                :
                <>
                    {this.state.editAvailable && this.state.editEnabled && <Tooltip title={I18n.t('Add state to event list')} className={this.props.classes.toolbarButton}>
                        <Fab variant="extended" size="small" aria-label="add" color="secondary" onClick={() => this.setState({showAddIdDialog: true})}>
                            <div className={clsx(!narrowWidth && this.props.classes.toolbarButtonText)}>
                                <IconAddId style={{verticalAlign: 'middle'}}/>
                                {narrowWidth ? null : <span style={{verticalAlign: 'middle'}}>{I18n.t('State ID')}</span>}
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
                                onClick={() => {
                                    this.props.socket.setState(this.triggerPDFId, true, false);
                                }}>
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
                                    {this.props.native.icons ?
                                        <TableCell style={row._style || undefined } className={this.props.classes.tdIcons} component="td" padding="none" align="center">
                                            {row.icon ? <img src={row.icon} width={28} height={28} alt=""/> : null}</TableCell>
                                        : null}
                                    <TableCell style={row._style || undefined } className={this.props.classes.tdTs} scope="row" padding="none" align="right">{row.ts}</TableCell>
                                    <TableCell style={row._style || undefined } className={this.props.classes.tdEvent} align="right">{row.event}</TableCell>
                                    <TableCell style={row._style || undefined } className={this.props.classes.tdVal} align="left">{row.val === undefined ? '' : row.val.toString()}</TableCell>
                                    {this.props.native.duration ?
                                        <TableCell style={row._style || undefined } className={this.props.classes.tdDuration} component="td" padding="none" align="right">
                                            {row.duration || ''}</TableCell>
                                        : null}
                                    {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdID} align="left">{row.stateId}</TableCell>}
                                    {this.state.editAvailable && this.state.editEnabled && <TableCell className={this.props.classes.tdEdit} align="left">{row.stateId ?
                                        <Tooltip title={I18n.t('Edit settings for state')} className={this.props.classes.toolbarButton}>
                                            <IconButton className={this.props.classes.editButton} onClick={e => {
                                                e.stopPropagation();
                                                this.setState({showAddIdDialog: row.stateId})
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
                instance={this.props.instance}
                adapterName={this.props.adapterName}
                themeName={this.props.themeName}
                themeType={this.props.themeType}
                socket={this.props.socket}
                native={this.props.native}
                id={typeof this.state.showAddIdDialog === 'string' ? this.state.showAddIdDialog : ''}
                onClose={event => {
                    this.setState({showAddIdDialog: false}, () =>
                        event && this.props.socket.sendTo(`${this.props.adapterName}.${this.props.instance}`, 'insert', event))
                }}
            />;
        }
    }

    render() {
        return (
            <Paper className={ this.props.classes.tab }>
                {this.renderToolbar()}
                {this.state.eventList ? this.renderList() : <LinearProgress />}
                {this.renderToast()}
                {this.renderConfirmDialog()}
                {this.renderAddEventDialog()}
                {this.renderAddIdDialog()}
            </Paper>
        );
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
};

export default withWidth()(withStyles(styles)(List));