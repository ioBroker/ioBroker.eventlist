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
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ColorPicker from '../Components/ColorPicker';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';

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
    },
    accordionContent: {
        marginTop: 0,
        marginBottom: 0,
    },
    noCheckbox: {
        paddingLeft: 32,
    },
    formControl: {
        minWidth: 200,
    }
});

const SETTINGS = {
    orientation: 'portrait',
    enabledTime: true,
    enabledValue: true,
    enabledDuration: true,
    widthTime: 130,
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
    titleText: 'Event list',
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
                this.props.socket.sendTo(this.props.adapterName + '.' + this.props.instance, 'pdf', this.props.native.pdfSettings)
                    .then(() =>
                        this.setState({pdfInGeneration: false, random: this.state.random + 1}, () =>
                            setTimeout(() => {
                                if (this.lastElement) {
                                    this.lastElement.focus();
                                    this.lastElement = null;
                                }
                            })));
            }, 1000);
        }
    }

    onChange(attr, value, e) {
        if (e) {
            this.lastElement = e.target;
            //e.stopPropagation();
        }
        this.props.onChange('pdfSettings.' + attr, value, () =>
            this.triggerPdf());
    }

    onExpand(name, ex) {
        const expanded = [...this.state.expanded];
        if (ex) {
            !expanded.includes(name) && expanded.push(name);
        } else {
            const pos = expanded.indexOf(name);
            pos !== -1 && expanded.splice(pos, 1);
        }
        window.localStorage.setItem('eventlist.app.expanded', JSON.stringify(expanded));
        this.setState({expanded});
    }

    renderSettingsTime(settings) {
        return <Accordion
            expanded={settings.enabledTime && this.state.expanded.includes('enabledTime')}
            onChange={(event, ex) => this.onExpand('enabledTime', ex)}
        >
            <AccordionSummary expandIcon={settings.enabledTime ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
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
                    value={settings.textTime}
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

    renderSettingsTitle(settings) {
        return <Accordion
            expanded={this.state.expanded.includes('enabledTitle')}
            onChange={(event, ex) => this.onExpand('enabledTitle', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: clsx(this.props.classes.accordionContent, this.props.classes.noCheckbox)}}>{I18n.t('Title')}</AccordionSummary>
            <AccordionDetails>
                <TextField
                    disabled={this.state.pdfInGeneration}
                    key="titleText"
                    type="text"
                    className={this.props.classes.field}
                    label={I18n.t('Title')}
                    value={settings.titleText}
                    onChange={e => this.onChange('titleText', e.target.value, e)}
                />
                <ColorPicker
                    color={settings.titleColor}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
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

    renderPageNumbers(settings) {
        return <Accordion
            expanded={settings.pageNumberEnabled && this.state.expanded.includes('pageNumberEnabled')}
            onChange={(event, ex) => this.onExpand('pageNumberEnabled', ex)}
        >
            <AccordionSummary expandIcon={settings.pageNumberEnabled ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
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

    renderPageHeader(settings) {
        return <Accordion
            expanded={settings.enabledHeader && this.state.expanded.includes('enabledHeader')}
            onChange={(event, ex) => this.onExpand('enabledHeader', ex)}
        >
            <AccordionSummary expandIcon={settings.enabledHeader ? <ExpandMoreIcon /> : null} classes={{content: this.props.classes.accordionContent}}>
                <FormControlLabel
                    onFocus={event => event.stopPropagation()}
                    onClick={event => event.stopPropagation()}
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
                    className={this.props.classes.field}
                    label={I18n.t('Font size')}
                    value={settings.fontSizeHeader}
                    onChange={e => this.onChange('fontSizeHeader', e.target.value, e)}
                />
                <ColorPicker
                    color={settings.colorHeaderBackground}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Background')}
                    onChange={color => this.onChange('colorHeaderBackground', color)}
                />
                <ColorPicker
                    color={settings.colorHeader}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Text color')}
                    onChange={color => this.onChange('colorHeader', color)}
                />
            </AccordionDetails>}
        </Accordion>;
    }

    renderSettingsText(settings) {
        return <Accordion
            expanded={this.state.expanded.includes('text')}
            onChange={(event, ex) => this.onExpand('text', ex)}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} classes={{content: clsx(this.props.classes.accordionContent, this.props.classes.noCheckbox)}}>{I18n.t('Text settings')}</AccordionSummary>
            <AccordionDetails>
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
                    color={settings.textColor}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Color')}
                    onChange={color => this.onChange('textColor', color)}
                />
                <ColorPicker
                    color={settings.colorLineOdd}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Odd line background')}
                    onChange={color => this.onChange('colorLineOdd', color)}
                />
                <ColorPicker
                    color={settings.colorLineEven}
                    style={{width: 300, display: 'inline-block', marginRight: 16}}
                    name={I18n.t('Even line background')}
                    onChange={color => this.onChange('colorLineEven', color)}
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
            </AccordionDetails>
        </Accordion>;
    }

    toggleOrientation(orientation, e) {
        if (orientation && orientation !== (this.props.native.pdfSettings.orientation || 'portrait')) {
            let pageWidth = this.props.native.pdfSettings.pageWidth;
            this.onChange('pageWidth', this.props.native.pdfSettings.pageHeight);
            this.onChange('pageHeight', pageWidth);
            const top = this.props.native.pdfSettings.margins.top;
            this.onChange('margins.top', this.props.native.pdfSettings.margins.left);
            this.onChange('margins.left', top);
            const bottom = this.props.native.pdfSettings.margins.bottom;
            this.onChange('margins.bottom', this.props.native.pdfSettings.margins.right);
            this.onChange('margins.right', bottom);
            this.onChange('orientation', e.target.value, e);
        }
    }

    renderSettings() {
        const settings = Object.assign({}, SETTINGS, this.props.native.pdfSettings);

        return <Grid item xs={12} md={12} lg={6}>
            <FormControlLabel
                key="pdfButton"
                control={<Checkbox checked={this.props.native.pdfButton || false} onChange={e => this.props.onChange('pdfButton', e.target.checked)} />}
                label={I18n.t('Show PDF generate button on list')}
            />
            <FormControl className={this.props.classes.formControl}>
                <InputLabel>{I18n.t('Page orientation')}</InputLabel>
                <Select
                    value={settings.orientation || 'portrait'}
                    onChange={e => this.toggleOrientation(e.target.value, e)}
                >
                    <MenuItem value="portrait">{I18n.t('Portrait')}</MenuItem>
                    <MenuItem value="landscape">{I18n.t('Landscape')}</MenuItem>
                </Select>
            </FormControl>
            {this.renderPageHeader(settings)}
            {this.renderSettingsTime(settings)}
            {this.renderSettingsEvent(settings)}
            {this.renderSettingsValue(settings)}
            {this.renderSettingsDuration(settings)}
            {this.renderSettingsTitle(settings)}
            {this.renderPageNumbers(settings)}
            {this.renderPageMargins(settings)}
            {this.renderSettingsText(settings)}

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
    socket: PropTypes.object.isRequired,
    instance: PropTypes.number.isRequired,
    adapterName: PropTypes.string.isRequired,
};

export default withStyles(styles)(PdfSettings);
