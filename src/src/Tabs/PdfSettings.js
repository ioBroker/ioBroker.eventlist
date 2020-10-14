import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import clsx from 'clsx';

import TextField from '@material-ui/core/TextField';
import DialogMessage from '@iobroker/adapter-react/Dialogs/Message';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Grid from '@material-ui/core/Grid';
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';

import {MdHelp as IconHelp} from 'react-icons/md';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';

import ColorPicker from '@iobroker/adapter-react/Components/ColorPicker';
import I18n from '@iobroker/adapter-react/i18n';

const styles = theme => ({
    tab: {
        width: '100%',
        height: '100%'
    },
    gridContainer: {
        width: '100%',
        height: '100%'
    },
    button: {
        marginRight: 20,
    },
    settingsDivLandscape: {
    },
    iframePdfLandscape: {
        width: '100%',
        height: '100%'
    },
    field: {
        width: 100,
        marginRight: theme.spacing(1),
        marginTop: theme.spacing(1),
    },
    fieldWide: {
        width: 250,
        marginRight: theme.spacing(1),
        marginTop: theme.spacing(1),
    },
    accordionContent: {
        marginTop: 0,
        marginBottom: 0,
    },
    noCheckbox: {
        paddingLeft: 32,
    },
    formControl: {
        paddingRight: theme.spacing(1),
        minWidth: 200,
    },
    orientation: {
        marginTop: theme.spacing(1),
    },
    fontSize: {
        marginTop: -3,
    },
    buttonFormat: {
        marginTop: 20,
    },
    titleText: {
        width: 310,
        marginRight: theme.spacing(1),
        marginTop: theme.spacing(1),
    }
});

const SETTINGS = {
    orientation: 'portrait',
    enabledTime: true,
    enabledValue: true,
    enabledDuration: true,
    widthTime: 105,
    widthEvent: 200,
    widthValue: 110,
    widthDuration: 100,
    textTime: 'Time',
    textEvent: 'Event',
    textValue: 'Value',
    textDuration: 'Duration',
    paddingLeft: 60,
    paddingTopFirst: 120,
    paddingTop: 60,
    pageWidth: 510,
    pageHeight: 740,

    textColor: '#000000',
    fontSize: 10,
    colorLineOdd: '#E8E8E8',
    colorLineEven: '#FFFFFF',
    lineHeight: 18,

    colorHeaderBackground: '#888888',
    colorHeader: '#FFFFFF',
    fontSizeHeader: 13,
    enabledHeader: true,

    titleColor: '#000000',
    titleText: 'Event list on {{YYYY MM DD H:mm:ss}}',
    titleFontSize: 18,

    pageNumberOffsetX: 50,
    pageNumberOffsetY: 10,
    pageNumberFontSize: 10,
    pageNumberColor: '#000000',
    pageNumberEnabled: true,

    margins: {
        top: 30,
        bottom: 30,
        left: 30,
        right: 30,
    }
};

class PdfSettings extends Component {
    constructor(props) {
        super(props);

        let expanded = window.localStorage.getItem('eventlist.app.expanded') || '[]';
        try {
            expanded = JSON.parse(expanded);
        } catch (e) {

        }

        this.state = {
            isInstanceAlive: false,
            pdfInGeneration: false,
            random: 0,
            expanded,
        };

        this.aliveId = `system.adapter.${this.props.adapterName}.${this.props.instance}.alive`;
        this.triggerPDFId = `${this.props.adapterName}.${this.props.instance}.triggerPDF`;
    }

    componentDidMount() {
        this.props.socket.subscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.subscribeState(this.triggerPDFId, this.onStateChanged);
    }

    componentWillUnmount() {
        this.props.socket.unsubscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.triggerPDFId, this.onStateChanged);
    }

    onStateChanged = (id, state) => {
        if (id === this.aliveId) {
            if (this.state.isInstanceAlive !== (state ? state.val : false)) {
                this.setState({isInstanceAlive: state && state.val}, () => this.triggerPdf());
            }
        } if (id === this.triggerPDFId) {
            this.setState({pdfInGeneration: state && state.val});
        }
    };

    triggerPdf() {
        if (this.state.isInstanceAlive && !this.state.pdfInGeneration) {
            this.triggerTimer && clearTimeout(this.triggerTimer);
            this.triggerTimer = setTimeout(() => {
                this.triggerTimer = null;
                this.setState({pdfInGeneration: true});
                const settings = JSON.parse(JSON.stringify(this.props.native.pdfSettings));
                Object.keys(settings).forEach(attr => {
                    if (attr.toLowerCase().includes('color')) {
                        if (typeof settings[attr] === 'object') {
                            settings[attr] = ColorPicker.getColor(settings[attr], true);
                        }
                        if (settings[attr].startsWith('rgb')) {
                            settings[attr] = ColorPicker.rgb2hex(settings[attr]);
                        }
                    }
                });

                this.props.socket.sendTo(this.props.adapterName + '.' + this.props.instance, 'pdf', settings)
                    .then(() =>
                        this.setState({pdfInGeneration: false, random: this.state.random + 1}, () =>
                            setTimeout(() => {
                                if (this.lastElement) {
                                    try {
                                        this.lastElement.focus();
                                    } catch (e) {

                                    }

                                    this.lastElement = null;
                                }
                            })));
            }, 1000);
        }
    }

    onChange(attr, value, e) {
        if (e && e.target) {
            this.lastElement = e.target;
            //e.stopPropagation();
        }
        this.props.onChange('pdfSettings.' + attr, value, () =>
            this.triggerPdf());
    }

    onExpand(name, ex) {
        let expanded;
        if (name === true) {
            expanded = ['sizes', 'enabledTitle', 'enabledHeader', 'margins', 'text', 'enabledTime', 'enabledEvent', 'enabledValue', 'enabledDuration', 'pageNumberEnabled'];
        } else if (name === false) {
            expanded = [];
        } else {
            expanded = [...this.state.expanded];
            if (ex) {
                !expanded.includes(name) && expanded.push(name);
            } else {
                const pos = expanded.indexOf(name);
                pos !== -1 && expanded.splice(pos, 1);
            }
        }
        window.localStorage.setItem('eventlist.app.expanded', JSON.stringify(expanded));
        this.setState({expanded});
    }

    toggleOrientation(orientation, e) {
        if (orientation && orientation !== (this.props.native.pdfSettings.orientation || 'portrait')) {
            const native = JSON.parse(JSON.stringify(this.props.native));
            const pageWidth = native.pdfSettings.pageWidth;
            const top = native.pdfSettings.margins.top;
            const bottom = native.pdfSettings.margins.bottom;
            native.pdfSettings.pageWidth = native.pdfSettings.pageHeight;
            native.pdfSettings.pageHeight = pageWidth;
            native.pdfSettings.margins.top = native.pdfSettings.margins.left;
            native.pdfSettings.margins.left = top;
            native.pdfSettings.margins.bottom = native.pdfSettings.margins.right;
            native.pdfSettings.margins.right = bottom;
            native.pdfSettings.orientation = orientation;
            this.props.updateNative(native);
        }
    }

    renderPageSize(settings) {
        return <Accordion
            expanded={this.state.expanded.includes('sizes')}
            onChange={(event, ex) => this.onExpand('sizes', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: clsx(this.props.classes.accordionContent, this.props.classes.noCheckbox)}}>{I18n.t('Page size')}</AccordionSummary>
            <AccordionDetails style={{display: 'block'}}>
                <FormControl className={clsx(this.props.classes.fieldWide, this.props.classes.orientation)}>
                    <InputLabel>{I18n.t('Page orientation')}</InputLabel>
                    <Select
                        disabled={this.state.pdfInGeneration}
                        value={settings.orientation || 'portrait'}
                        onChange={e => this.toggleOrientation(e.target.value, e)}
                    >
                        <MenuItem value="portrait">{I18n.t('Portrait')}</MenuItem>
                        <MenuItem value="landscape">{I18n.t('Landscape')}</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Width')}
                    value={settings.pageWidth}
                    onChange={e => this.onChange('pageWidth', e.target.value, e)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Height')}
                    value={settings.pageHeight}
                    onChange={e => this.onChange('pageHeight', e.target.value, e)}
                />
                <br/>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    type="number"
                    className={this.props.classes.fieldWide}
                    label={I18n.t('Padding top for first page')}
                    value={settings.paddingTopFirst}
                    onChange={e => this.onChange('paddingTopFirst', e.target.value, e)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    type="number"
                    className={this.props.classes.fieldWide}
                    label={I18n.t('Padding top for other pages')}
                    value={settings.paddingTop}
                    onChange={e => this.onChange('paddingTop', e.target.value, e)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Padding left')}
                    value={settings.paddingLeft}
                    onChange={e => this.onChange('paddingLeft', e.target.value, e)}
                />
            </AccordionDetails>
        </Accordion>;
    }

    renderSettingsTitle(settings) {
        return <Accordion
            expanded={this.state.expanded.includes('enabledTitle')}
            onChange={(event, ex) => this.onExpand('enabledTitle', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: clsx(this.props.classes.accordionContent, this.props.classes.noCheckbox)}}>{I18n.t('Title')}</AccordionSummary>
            <AccordionDetails style={{display: 'inline-block'}}>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="titleText"
                    type="text"
                    className={clsx(this.props.classes.titleText)}
                    label={I18n.t('Title')}
                    value={settings.titleText}
                    onChange={e => this.onChange('titleText', e.target.value, e)}
                    helperText={I18n.t('You can add time with {{YYYY MM DD}}')}
                />
                <Button
                    variant="contained"
                    className={this.props.classes.buttonFormat}
                    onClick={() => window.open('https://momentjs.com/docs/#/displaying/format/', 'momentHelp')}>
                    <IconHelp className={this.props.classes.buttonIcon}/>{I18n.t('Time format description')}
                </Button>
                <br/>
                <ColorPicker
                    disabled={this.state.pdfInGeneration}
                    color={settings.titleColor}
                    style={{width: 300, display: 'inline-block', marginRight: 16, marginTop: 10}}
                    name={I18n.t('Color')}
                    onChange={color => this.onChange('titleColor', color)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="titleFontSize"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Title')}
                    value={settings.titleFontSize}
                    onChange={e => this.onChange('titleFontSize', e.target.value, e)}
                />
            </AccordionDetails>
        </Accordion>;
    }

    renderPageHeader(settings) {
        return <Accordion
            expanded={settings.enabledHeader && this.state.expanded.includes('enabledHeader')}
            onChange={(event, ex) => this.onExpand('enabledHeader', ex)}
        >
            <AccordionSummary expandIcon={settings.enabledHeader ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
                    onFocus={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                    disabled={this.state.pdfInGeneration}
                    key="enabledHeader"
                    control={<Checkbox checked={settings.enabledHeader || false} onChange={e => this.onChange('enabledHeader', e.target.checked, e)} />}
                    label={I18n.t('Show table header')}
                />
            </AccordionSummary>
            {!!settings.enabledHeader && <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="fontSizeHeader"
                    type="number"
                    className={clsx(this.props.classes.field, this.props.classes.fontSize)}
                    label={I18n.t('Font size')}
                    value={settings.fontSizeHeader}
                    onChange={e => this.onChange('fontSizeHeader', e.target.value, e)}
                />
                <ColorPicker
                    disabled={this.state.pdfInGeneration}
                    color={settings.colorHeaderBackground}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Background')}
                    onChange={color => this.onChange('colorHeaderBackground', color)}
                />
                <ColorPicker
                    disabled={this.state.pdfInGeneration}
                    color={settings.colorHeader}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Text color')}
                    onChange={color => this.onChange('colorHeader', color)}
                />
            </AccordionDetails>}
        </Accordion>;
    }

    renderPageMargins(settings) {
        return <Accordion
            expanded={this.state.expanded.includes('margins')}
            onChange={(event, ex) => this.onExpand('margins', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: clsx(this.props.classes.accordionContent, this.props.classes.noCheckbox)}}>{I18n.t('Margins')}</AccordionSummary>
            <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="top"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Top')}
                    value={settings.margins.top}
                    onChange={e => this.onChange('margins.top', e.target.value, e)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="left"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Left')}
                    value={settings.margins.left}
                    onChange={e => this.onChange('margins.left', e.target.value, e)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="bottom"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Bottom')}
                    value={settings.margins.bottom}
                    onChange={e => this.onChange('margins.bottom', e.target.value, e)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="right"
                    type="right"
                    className={this.props.classes.field}
                    label={I18n.t('Right')}
                    value={settings.margins.right}
                    onChange={e => this.onChange('margins.right', e.target.value, e)}
                />
            </AccordionDetails>
        </Accordion>;
    }

    renderSettingsText(settings) {
        return <Accordion
            expanded={this.state.expanded.includes('text')}
            onChange={(event, ex) => this.onExpand('text', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: clsx(this.props.classes.accordionContent, this.props.classes.noCheckbox)}}>{I18n.t('Text settings')}</AccordionSummary>
            <AccordionDetails style={{display: 'inline-block'}}>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="fontSize"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Font size')}
                    value={settings.fontSize}
                    onChange={e => this.onChange('fontSize', e.target.value, e)}
                />
                <ColorPicker
                    disabled={this.state.pdfInGeneration}
                    color={settings.textColor}
                    style={{width: 300, display: 'inline-block', marginRight: 16, marginTop: 10}}
                    name={I18n.t('Color')}
                    onChange={color => this.onChange('textColor', color)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="lineHeight"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Line height')}
                    value={settings.lineHeight}
                    onChange={e => this.onChange('lineHeight', e.target.value, e)}
                />
                <br/>
                <ColorPicker
                    disabled={this.state.pdfInGeneration}
                    color={settings.colorLineOdd}
                    style={{width: 408, display: 'inline-block', marginRight: 16, marginTop: 8}}
                    name={I18n.t('Odd line background')}
                    onChange={color => this.onChange('colorLineOdd', color)}
                />
                <ColorPicker
                    disabled={this.state.pdfInGeneration}
                    color={settings.colorLineEven}
                    style={{width: 400, display: 'inline-block', marginRight: 16, marginTop: 8}}
                    name={I18n.t('Even line background')}
                    onChange={color => this.onChange('colorLineEven', color)}
                />
            </AccordionDetails>
        </Accordion>;
    }

    renderSettingsTime(settings) {
        return <Accordion
            expanded={settings.enabledTime && this.state.expanded.includes('enabledTime')}
            onChange={(event, ex) => this.onExpand('enabledTime', ex)}
        >
            <AccordionSummary expandIcon={settings.enabledTime ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
                    disabled={this.state.pdfInGeneration}
                    key="enabledTime"
                    onFocus={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                    control={<Checkbox checked={settings.enabledTime || false} onChange={e => this.onChange('enabledTime', e.target.checked, e)} />}
                    label={I18n.t('Show time')}
                />
            </AccordionSummary>
            {!!settings.enabledTime && <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="widthTime"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Column width')}
                    value={settings.widthTime}
                    onChange={e => this.onChange('widthTime', e.target.value, e)}
                />
                {!!settings.enabledHeader && <TextField
                    disabled={this.state.pdfInGeneration}
                    key="textTime"
                    type="text"
                    className={this.props.classes.field}
                    label={I18n.t('Header text')}
                    value={settings.textTime}
                    onChange={e => this.onChange('textTime', e.target.value, e)}
                />}
            </AccordionDetails>}
        </Accordion>
    }

    renderSettingsEvent(settings) {
        return <Accordion
            expanded={this.state.expanded.includes('enabledEvent')}
            onChange={(event, ex) => this.onExpand('enabledEvent', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: clsx(this.props.classes.accordionContent, this.props.classes.noCheckbox)}}>{I18n.t('Event')}</AccordionSummary>
            <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="widthEvent"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Column width')}
                    value={settings.widthEvent}
                    onChange={e => this.onChange('widthEvent', e.target.value, e)}
                />
                {!!settings.enabledHeader && <TextField
                    disabled={this.state.pdfInGeneration}
                    key="textEvent"
                    type="text"
                    className={this.props.classes.field}
                    label={I18n.t('Header text')}
                    value={settings.textEvent}
                    onChange={e => this.onChange('textEvent', e.target.value, e)}
                />}
            </AccordionDetails>
        </Accordion>;
    }

    renderSettingsValue(settings) {
        return <Accordion
            expanded={settings.enabledValue && this.state.expanded.includes('enabledValue')}
            onChange={(event, ex) => this.onExpand('enabledValue', ex)}
        >
            <AccordionSummary expandIcon={settings.enabledValue ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
                    disabled={this.state.pdfInGeneration}
                    onFocus={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                    key="enabledValue"
                    control={<Checkbox checked={settings.enabledValue || false} onChange={e => this.onChange('enabledValue', e.target.checked, e)} />}
                    label={I18n.t('Show value')}
                />
            </AccordionSummary>
            {!!settings.enabledValue && <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="widthValue"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Column width')}
                    value={settings.widthValue}
                    onChange={e => this.onChange('widthValue', e.target.value, e)}
                />
                {!!settings.enabledHeader &&  <TextField
                    disabled={this.state.pdfInGeneration}
                    key="textValue"
                    type="text"
                    className={this.props.classes.field}
                    label={I18n.t('Header text')}
                    value={settings.textValue}
                    onChange={e => this.onChange('textValue', e.target.value, e)}
                />}
            </AccordionDetails>}
        </Accordion>;
    }

    renderSettingsDuration(settings) {
        return <Accordion
            expanded={settings.enabledDuration && this.state.expanded.includes('enabledDuration')}
            onChange={(event, ex) => this.onExpand('enabledDuration', ex)}

        >
            <AccordionSummary expandIcon={settings.enabledDuration ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
                    disabled={this.state.pdfInGeneration}
                    onFocus={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                    key="enabledDuration"
                    control={<Checkbox checked={settings.enabledDuration || false} onChange={e => {
                        this.onChange('enabledDuration', e.target.checked, e)
                    }} />}
                    label={I18n.t('Show duration')}
                />
            </AccordionSummary>
            {!!settings.enabledDuration && <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="widthDuration"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Column width')}
                    value={settings.widthDuration}
                    onChange={e => this.onChange('widthDuration', e.target.value, e)}
                />
                {!!settings.enabledHeader && <TextField
                    disabled={this.state.pdfInGeneration}
                    key="textDuration"
                    type="text"
                    className={this.props.classes.field}
                    label={I18n.t('Header text')}
                    value={settings.textDuration}
                    onChange={e => this.onChange('textDuration', e.target.value, e)}
                />}
            </AccordionDetails>}
        </Accordion>;
    }

    renderPageNumbers(settings) {
        return <Accordion
            expanded={settings.pageNumberEnabled && this.state.expanded.includes('pageNumberEnabled')}
            onChange={(event, ex) => this.onExpand('pageNumberEnabled', ex)}
        >
            <AccordionSummary expandIcon={settings.pageNumberEnabled ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
                    disabled={this.state.pdfInGeneration}
                    onFocus={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
                    key="pageNumberEnabled"
                    control={<Checkbox checked={settings.pageNumberEnabled || false} onChange={e => this.onChange('pageNumberEnabled', e.target.checked, e)} />}
                    label={I18n.t('Show page numbers')}
                />
            </AccordionSummary>
            {!!settings.pageNumberEnabled && <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="pageNumberFontSize"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Font size')}
                    value={settings.pageNumberFontSize}
                    onChange={e => this.onChange('pageNumberFontSize', e.target.value, e)}
                />
                <ColorPicker
                    disabled={this.state.pdfInGeneration}
                    color={settings.pageNumberColor}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Color')}
                    onChange={color => this.onChange('pageNumberColor', color)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="pageNumberOffsetX"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('X Offset')}
                    value={settings.pageNumberOffsetX}
                    onChange={e => this.onChange('pageNumberOffsetX', e.target.value, e)}
                />
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="pageNumberOffsetY"
                    type="number"
                    className={this.props.classes.field}
                    label={I18n.t('Y Offset')}
                    value={settings.pageNumberOffsetY}
                    onChange={e => this.onChange('pageNumberOffsetY', e.target.value, e)}
                />
            </AccordionDetails>}
        </Accordion>;
    }

    renderSettings() {
        const settings = Object.assign({}, SETTINGS, this.props.native.pdfSettings);

        return <Grid item xs={12} md={12} lg={6}>
            <Grid container>
                <FormControlLabel
                    key="pdfButton"
                    control={<Checkbox checked={this.props.native.pdfButton || false} onChange={e => this.props.onChange('pdfButton', e.target.checked)} />}
                    label={I18n.t('Show PDF generate button on list')}
                />
                <div style={{flexGrow: 1}}/>
                <IconButton onClick={() => this.onExpand(false)} title={I18n.t('Collapse all')} disabled={!this.state.expanded.length}><ExpandLessIcon /></IconButton>
                <IconButton onClick={() => this.onExpand(true)} title={I18n.t('Expand all')} disabled={this.state.expanded.length === 10}><ExpandMoreIcon /></IconButton>
            </Grid>
            {this.renderPageSize(settings)}
            {this.renderSettingsTitle(settings)}
            {this.renderPageHeader(settings)}
            {this.renderPageMargins(settings)}
            {this.renderSettingsText(settings)}
            {this.renderSettingsTime(settings)}
            {this.renderSettingsEvent(settings)}
            {this.renderSettingsValue(settings)}
            {this.renderSettingsDuration(settings)}
            {this.renderPageNumbers(settings)}

        </Grid>;
    }

    renderPdfFile() {
        return <Grid item xs={12} md={12} lg={6}>
            <iframe title="pdf" className={this.props.classes.iframePdfLandscape} src={'/files/eventlist/report.pdf?q=' + this.state.random} />
        </Grid>
    }

    renderMessage() {
        if (!this.state.messageText) {
            return null;
        }
        return <DialogMessage title={I18n.t('Success')} onClose={() => this.setState({messageText: ''})}>{this.state.messageText}</DialogMessage>
    }

    render() {
        return (
            <form className={this.props.classes.tab}>
                <Grid container spacing={1} className={this.props.classes.gridContainer}>
                    {this.renderSettings()}
                    {this.renderPdfFile()}
                </Grid>
            </form>
        );
    }
}

PdfSettings.propTypes = {
    native: PropTypes.object.isRequired,
    onChange: PropTypes.func,
    updateNative: PropTypes.func,
    socket: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
};

export default withStyles(styles)(PdfSettings);
