import React from 'react';
import PropTypes from 'prop-types';
import {withStyles} from '@material-ui/core/styles';
import clsx from 'clsx';

import TextField from '@material-ui/core/TextField';
import I18n from '@iobroker/adapter-react/i18n';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Grid from '@material-ui/core/Grid';

import ClearIcon from '@material-ui/icons/Close';
import CancelIcon from '@material-ui/icons/Close';
import CheckIcon from '@material-ui/icons/Check';
import SelectIcon from '@material-ui/icons/ViewModule';

import Image from '@iobroker/adapter-react/Components/Image';
import FileBrowser from './FileBrowser';

import IconLampTable from '@iobroker/adapter-react/assets/lamp_table.svg';
import IconLampCeiling from '@iobroker/adapter-react/assets/lamp_ceiling.svg';

const ICONS = [
    {icon: IconLampTable,   color: '#FFFFFF', name: 'Table lamp'},
    {icon: IconLampCeiling, color: '#FFFFFF', name: 'Ceiling lamp'},
];

const styles = theme => ({
    div: {
        width: '100%',
        lineHeight: '48px',
    },
    dialogContent: {
        overflow: 'hidden',
    },
    dialogTab: {
        height: 500,
        overflow: 'hidden',
    },
    textField: {

    },
    textFieldWithButton: {
        width: 'calc(100% - 102px)',
        verticalAlign: 'bottom'
    },
    textDense: {
        marginTop: 0,
        marginBottom: 0,
    },
    buttonIcon: {
        marginRight: theme.spacing(1),
    },
    icon: {
        width: 32,
        height: 32,
        margin: theme.spacing(1),
        color: theme.palette.type === 'dark' ? '#FFF' : '#000'
    },
    grid: {
        padding: theme.spacing(2)
    },
    gridIcon: {
        '&:hover': {
            background: theme.palette.primary.dark,
        },
        textAlign: 'center',
    },
    selectButton: {
        verticalAlign: 'bottom'
    },
    iconSelected: {
        background: theme.palette.primary.main,
        '&:hover': {
            background: theme.palette.primary.light,
        }
    },
    imagePreviewDiv: {
        display: 'inline-block',
        marginRight: theme.spacing(1),
        verticalAlign: 'bottom',
    },
    imagePreview: {
        width: 32,
        height: 32,
        color: theme.palette.type === 'dark' ? '#FFF' : '#000',
    }
});

const PRESET_PREFIX = 'preset:';

class IconPicker extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            color: this.props.color || '',
            value: this.props.value || '',
            dialogValue: '',
            showDialog: false,
            selectedTab: this.props.value && !this.props.value.startsWith('data:image/') ? 1 : 0,
            imgError: false,
        };
        this.imagePrefix = this.props.imagePrefix || './files/';
    }

    /*static getDerivedStateFromProps(props, state) {
        const newState = {};
        let changed = false;

        if (props && state && props.value !== state.value) {
            newState.value = props.value;
            changed = true;
        }

        if (props && state && props.color !== state.color) {
            newState.color = props.color;
            changed = true;
        }

        return changed ? newState : null;
    }*/

    renderOneIcon(item, i) {
        return <Grid
            item
            xs
            key={item.name || i}
            className={clsx(this.props.classes.gridIcon, this.state.dialogValue && this.state.dialogValue.startsWith(PRESET_PREFIX) && this.state.dialogValue.endsWith(item.name) && this.props.classes.iconSelected)}
            onClick={() => this.setState({dialogValue: PRESET_PREFIX + item.name})}
            onDoubleClick={() => this.setState({dialogValue: PRESET_PREFIX + item.name}, () => this.onDialogClose(this.state.dialogValue))}
        >
            <img className={this.props.classes.icon} src={item.icon} alt={item.name} style={item.color ? {color: item.color} : {}}/>
        </Grid>;
    }

    renderPredefinedIcons() {
        return <Grid container spacing={2} justify="center" className={this.props.classes.grid}>{
            ICONS.map((item, i) => this.renderOneIcon(item, i))
        }</Grid>;
    }

    fetchIcon(src) {
        return fetch(src)
            .then(response => response.text())
    }

    getIdFromSrc(svg) {
        const len = 'data:image/svg+xml;base64, ';
        if (!svg || !svg.startsWith(len)) {
            return null;
        }
        svg = svg.substring(len.length);
        try {
            svg = atob(svg);
            const m = svg.match(/<svg id="([^"]+)"/);
            return m ? m[1] : null;
        } catch (e) {
            console.warn('Cannot decode ' + svg);
        }
        return null;
    }

    renderFileBrowser() {
        return <FileBrowser
            t={I18n.t}
            imagePrefix={this.imagePrefix}
            lang={I18n.getLanguage()}
            socket={this.props.socket}
            ready={true}
            showExpertButton={true}
            showToolbar={true}
            allowUpload={true}
            allowDownload={false}
            allowCreateFolder={true}
            allowDelete={false}
            allowView={true}
            showViewTypeButton={true}
            filterFiles={['png', 'svg', 'bmp', 'jpg', 'jpeg']}
            onSelect={(path, isDoubleClick) =>
                this.setState({dialogValue: path}, () =>
                    isDoubleClick && this.onDialogClose(path))}
        />;
    }

    onDialogClose(value) {
        if (value) {
            if (value.startsWith(PRESET_PREFIX)) {
                value = value.substring(7);
                const item = ICONS.find(item => item.name === value);
                if (item) {
                    //fetch icon
                    this.fetchIcon(item.icon)
                        .then(svg => {
                            svg = svg.replace('<svg ', '<svg id="' + value + '" ');
                            const valueSvg = 'data:image/svg+xml;base64, ' + window.btoa(svg);
                            this.setState({value: valueSvg, showDialog: false, imgError: false, dialogValue: '', dialogInitialValue: ''}, () =>
                                this.props.onChange(valueSvg));
                        });
                } else {
                    this.setState({value: '', showDialog: false, imgError: false, dialogValue: '', dialogInitialValue: ''}, () =>
                        this.props.onChange(''));
                }
            } else {
                // it is path to image
                this.setState({value, showDialog: false, imgError: false, dialogValue: '', dialogInitialValue: ''}, () =>
                    this.props.onChange(value));
            }
        } else {
            this.setState({showDialog: false});
        }
    }

    renderDialog() {
        if (!this.state.showDialog) {
            return null;
        }
        return <Dialog
            open={true}
            fullWidth
            maxWidth="lg"
            onClose={() => this.setState({showDialog: false})}
        >
            <DialogTitle>{I18n.t('Select icon...')}</DialogTitle>
            <DialogContent className={this.props.classes.dialogContent}>
                <Tabs value={this.state.selectedTab} onChange={(e, selectedTab) => this.setState({selectedTab})}>
                    <Tab label={I18n.t('Predefined')} />
                    <Tab label={I18n.t('User defined')} />
                </Tabs>
                {this.state.selectedTab === 0 && <div className={this.props.classes.dialogTab}>
                    {this.renderPredefinedIcons()}
                </div>}
                {this.state.selectedTab === 1 && <div className={this.props.classes.dialogTab}>
                    {this.renderFileBrowser()}
                </div>}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.onDialogClose()}><CancelIcon className={this.props.classes.buttonIcon}/>{I18n.t('Cancel')}</Button>
                <Button onClick={() => this.onDialogClose(this.state.dialogValue)}
                        color="primary"
                        disabled={!this.state.dialogValue || this.state.dialogInitialValue === this.state.dialogValue}
                        autoFocus
                >
                    <CheckIcon className={this.props.classes.buttonIcon}/>{I18n.t('Select')}
                </Button>
            </DialogActions>
        </Dialog>
    }

    render() {
        return <div
            key={this.props.key}
            style={this.props.style || {}}
            className={ clsx(this.props.classes.div, this.props.className)}
        >
            <div className={this.props.classes.imagePreviewDiv}>
                <Image
                    imagePrefix={this.imagePrefix}
                    showError={true}
                    color={this.state.color}
                    className={this.props.classes.imagePreview}
                    src={this.state.value}
                    alt="preview"
                />
            </div>
            <TextField
                disabled={!!this.props.disabled}
                margin="dense"
                label={this.props.label || I18n.t('Icon')}
                value={this.state.value}
                onChange={e => {
                    const value = e.target.value;
                    this.setState({value, imgError: false}, () => this.props.onChange(value));
                }}
                type="text"
                InputProps={{
                    endAdornment: this.state.value ? (
                        <IconButton
                            onClick={() => {
                                this.setState({value: '', imgError: false}, () => this.props.onChange(''));
                            }}>
                            <ClearIcon />
                        </IconButton>
                    ) : undefined,
                }}
                className={this.props.classes.textFieldWithButton}
            />
            <IconButton
                disabled={!!this.props.disabled}
                className={this.props.classes.selectButton}
                onClick={() => {
                    let id = this.getIdFromSrc(this.state.value);
                    if (id) {
                        id = PRESET_PREFIX + id;
                    } else {
                        id = this.state.value;
                    }
                    this.setState({showDialog: true, dialogValue: id, dialogInitialValue: id});
                }}
            >
                <SelectIcon/>
            </IconButton>
            {this.renderDialog()}
        </div>
    }
}

IconPicker.propTypes = {
    key: PropTypes.string,
    color: PropTypes.string,
    value: PropTypes.string,
    label: PropTypes.string,
    disabled: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    socket: PropTypes.object.isRequired,
    imagePrefix: PropTypes.string,
};

export default withStyles(styles)(IconPicker);