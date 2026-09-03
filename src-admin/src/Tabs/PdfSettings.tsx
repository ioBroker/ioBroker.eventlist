import React, { Component, type CSSProperties, type JSX, type SyntheticEvent } from 'react';

import {
    TextField,
    Checkbox,
    FormControlLabel,
    Grid,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    InputLabel,
    MenuItem,
    FormControl,
    Select,
    IconButton,
    Button,
    type SelectChangeEvent,
} from '@mui/material';

import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon, Help as IconHelp } from '@mui/icons-material';

import { I18n, ColorPicker, type AdminConnection } from '@iobroker/gui-components';

import type { EventListNative, PdfSettings as PdfSettingsType } from '../types';

const styles: Record<string, CSSProperties> = {
    tab: {
        width: '100%',
        height: '100%',
    },
    gridContainer: {
        width: '100%',
        height: '100%',
    },
    iframePdfLandscape: {
        width: '100%',
        height: '100%',
    },
    field: {
        width: 100,
        marginRight: 8,
        marginTop: 8,
    },
    fieldWide: {
        width: 250,
        marginRight: 8,
        marginTop: 8,
    },
    accordionContent: {
        marginTop: 0,
        marginBottom: 0,
        fontSize: '1rem',
    },
    noCheckbox: {
        paddingLeft: '32px',
    },
    orientation: {
        marginTop: 8,
    },
    fontSize: {
        marginTop: -3,
    },
    buttonFormat: {
        marginTop: 20,
    },
    titleText: {
        width: 310,
        marginRight: 8,
        marginTop: 8,
    },
};

const SETTINGS: PdfSettingsType = {
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
    },
};

const ALL_SECTIONS = [
    'sizes',
    'enabledTitle',
    'enabledHeader',
    'margins',
    'text',
    'enabledTime',
    'enabledEvent',
    'enabledValue',
    'enabledDuration',
    'pageNumberEnabled',
];

interface PdfSettingsProps {
    native: EventListNative;
    onChange: (attr: string, value: any, cb?: () => void) => void;
    updateNative: (native: EventListNative, cb?: () => void) => void;
    socket: AdminConnection;
    instance: number;
    adapterName: string;
}

interface PdfSettingsState {
    isInstanceAlive: boolean;
    pdfInGeneration: boolean;
    /** Changed to reload the PDF in the iframe */
    random: number;
    expanded: string[];
}

class PdfSettings extends Component<PdfSettingsProps, PdfSettingsState> {
    private readonly aliveId: string;
    private readonly triggerPDFId: string;
    private triggerTimer: ReturnType<typeof setTimeout> | null = null;
    private lastElement: HTMLElement | null = null;

    constructor(props: PdfSettingsProps) {
        super(props);

        let expanded: string[] = [];
        try {
            expanded = JSON.parse(window.localStorage.getItem('eventlist.app.expanded') || '[]');
        } catch {
            // ignore
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

    componentDidMount(): void {
        void this.props.socket.subscribeState(this.aliveId, this.onStateChanged);
        void this.props.socket.subscribeState(this.triggerPDFId, this.onStateChanged);
    }

    componentWillUnmount(): void {
        this.props.socket.unsubscribeState(this.aliveId, this.onStateChanged);
        this.props.socket.unsubscribeState(this.triggerPDFId, this.onStateChanged);
        if (this.triggerTimer) {
            clearTimeout(this.triggerTimer);
            this.triggerTimer = null;
        }
    }

    onStateChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id === this.aliveId) {
            const isInstanceAlive = !!state?.val;
            if (this.state.isInstanceAlive !== isInstanceAlive) {
                this.setState({ isInstanceAlive }, () => this.triggerPdf());
            }
        }
        if (id === this.triggerPDFId) {
            this.setState({ pdfInGeneration: !!state?.val });
        }
    };

    triggerPdf(): void {
        if (this.state.isInstanceAlive && !this.state.pdfInGeneration) {
            if (this.triggerTimer) {
                clearTimeout(this.triggerTimer);
            }
            this.triggerTimer = setTimeout(() => {
                this.triggerTimer = null;
                this.setState({ pdfInGeneration: true });
                const settings: Record<string, any> = JSON.parse(JSON.stringify(this.props.native.pdfSettings));
                Object.keys(settings).forEach(attr => {
                    if (attr.toLowerCase().includes('color')) {
                        if (typeof settings[attr] === 'object') {
                            settings[attr] = ColorPicker.getColor(settings[attr], true);
                        }
                        if (typeof settings[attr] === 'string' && settings[attr].startsWith('rgb')) {
                            settings[attr] = ColorPicker.rgb2hex(settings[attr]);
                        }
                    }
                });

                void this.props.socket
                    .sendTo(`${this.props.adapterName}.${this.props.instance}`, 'pdf', settings)
                    .then(() =>
                        this.setState({ pdfInGeneration: false, random: this.state.random + 1 }, () =>
                            setTimeout(() => {
                                if (this.lastElement) {
                                    try {
                                        this.lastElement.focus();
                                    } catch {
                                        // ignore
                                    }

                                    this.lastElement = null;
                                }
                            }),
                        ),
                    );
            }, 1000);
        }
    }

    onChange(attr: string, value: any, e?: SyntheticEvent): void {
        if (e?.target) {
            this.lastElement = e.target as HTMLElement;
        }
        this.props.onChange(`pdfSettings.${attr}`, value, () => this.triggerPdf());
    }

    onExpand(name: string | boolean, ex?: boolean): void {
        let expanded: string[];
        if (name === true) {
            expanded = [...ALL_SECTIONS];
        } else if (name === false) {
            expanded = [];
        } else {
            expanded = [...this.state.expanded];
            if (ex) {
                if (!expanded.includes(name)) {
                    expanded.push(name);
                }
            } else {
                const pos = expanded.indexOf(name);
                if (pos !== -1) {
                    expanded.splice(pos, 1);
                }
            }
        }
        window.localStorage.setItem('eventlist.app.expanded', JSON.stringify(expanded));
        this.setState({ expanded });
    }

    toggleOrientation(orientation: 'portrait' | 'landscape'): void {
        if (orientation && orientation !== (this.props.native.pdfSettings.orientation || 'portrait')) {
            const native: EventListNative = JSON.parse(JSON.stringify(this.props.native));
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

    renderPageSize(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={this.state.expanded.includes('sizes')}
                onChange={(_event, ex) => this.onExpand('sizes', ex)}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ '& .MuiAccordionSummary-content': { ...styles.accordionContent, ...styles.noCheckbox } }}
                >
                    {I18n.t('Page size')}
                </AccordionSummary>
                <AccordionDetails style={{ display: 'block' }}>
                    <FormControl
                        variant="standard"
                        style={{ ...styles.fieldWide, ...styles.orientation }}
                    >
                        <InputLabel>{I18n.t('Page orientation')}</InputLabel>
                        <Select
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            value={settings.orientation || 'portrait'}
                            onChange={(e: SelectChangeEvent<'portrait' | 'landscape'>) =>
                                this.toggleOrientation(e.target.value)
                            }
                        >
                            <MenuItem value="portrait">{I18n.t('Portrait')}</MenuItem>
                            <MenuItem value="landscape">{I18n.t('Landscape')}</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        type="number"
                        style={styles.field}
                        label={I18n.t('Width')}
                        value={settings.pageWidth}
                        onChange={e => this.onChange('pageWidth', e.target.value, e)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        type="number"
                        style={styles.field}
                        label={I18n.t('Height')}
                        value={settings.pageHeight}
                        onChange={e => this.onChange('pageHeight', e.target.value, e)}
                    />
                    <br />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        type="number"
                        style={styles.fieldWide}
                        label={I18n.t('Padding top for first page')}
                        value={settings.paddingTopFirst}
                        onChange={e => this.onChange('paddingTopFirst', e.target.value, e)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        type="number"
                        style={styles.fieldWide}
                        label={I18n.t('Padding top for other pages')}
                        value={settings.paddingTop}
                        onChange={e => this.onChange('paddingTop', e.target.value, e)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        type="number"
                        style={styles.field}
                        label={I18n.t('Padding left')}
                        value={settings.paddingLeft}
                        onChange={e => this.onChange('paddingLeft', e.target.value, e)}
                    />
                </AccordionDetails>
            </Accordion>
        );
    }

    renderSettingsTitle(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={this.state.expanded.includes('enabledTitle')}
                onChange={(_event, ex) => this.onExpand('enabledTitle', ex)}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ '& .MuiAccordionSummary-content': { ...styles.accordionContent, ...styles.noCheckbox } }}
                >
                    {I18n.t('Title')}
                </AccordionSummary>
                <AccordionDetails style={{ display: 'inline-block' }}>
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="titleText"
                        type="text"
                        style={styles.titleText}
                        label={I18n.t('Title')}
                        value={settings.titleText}
                        onChange={e => this.onChange('titleText', e.target.value, e)}
                        helperText={I18n.t('You can add time with {{YYYY MM DD}}')}
                    />
                    <Button
                        color="grey"
                        variant="contained"
                        style={styles.buttonFormat}
                        onClick={() => window.open('https://momentjs.com/docs/#/displaying/format/', 'momentHelp')}
                        startIcon={<IconHelp />}
                    >
                        {I18n.t('Time format description')}
                    </Button>
                    <br />
                    <ColorPicker
                        disabled={this.state.pdfInGeneration}
                        value={settings.titleColor}
                        style={{ width: 300, display: 'inline-block', marginRight: 16, marginTop: 10 }}
                        label={I18n.t('Color')}
                        onChange={color => this.onChange('titleColor', color)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="titleFontSize"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Title')}
                        value={settings.titleFontSize}
                        onChange={e => this.onChange('titleFontSize', e.target.value, e)}
                    />
                </AccordionDetails>
            </Accordion>
        );
    }

    renderPageHeader(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={!!settings.enabledHeader && this.state.expanded.includes('enabledHeader')}
                onChange={(_event, ex) => this.onExpand('enabledHeader', ex)}
            >
                <AccordionSummary
                    expandIcon={settings.enabledHeader ? <ExpandMoreIcon /> : null}
                    sx={{ '& .MuiAccordionSummary-content': styles.accordionContent }}
                >
                    <FormControlLabel
                        onFocus={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                        disabled={this.state.pdfInGeneration}
                        key="enabledHeader"
                        control={
                            <Checkbox
                                checked={settings.enabledHeader || false}
                                onChange={e => this.onChange('enabledHeader', e.target.checked, e)}
                            />
                        }
                        label={I18n.t('Show table header')}
                    />
                </AccordionSummary>
                {!!settings.enabledHeader && (
                    <AccordionDetails>
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="fontSizeHeader"
                            type="number"
                            style={{ ...styles.field, ...styles.fontSize }}
                            label={I18n.t('Font size')}
                            value={settings.fontSizeHeader}
                            onChange={e => this.onChange('fontSizeHeader', e.target.value, e)}
                        />
                        <ColorPicker
                            disabled={this.state.pdfInGeneration}
                            value={settings.colorHeaderBackground}
                            style={{ width: 300, display: 'inline-block', marginRight: 16 }}
                            label={I18n.t('Background')}
                            onChange={color => this.onChange('colorHeaderBackground', color)}
                        />
                        <ColorPicker
                            disabled={this.state.pdfInGeneration}
                            value={settings.colorHeader}
                            style={{ width: 300, display: 'inline-block', marginRight: 16 }}
                            label={I18n.t('Text color')}
                            onChange={color => this.onChange('colorHeader', color)}
                        />
                    </AccordionDetails>
                )}
            </Accordion>
        );
    }

    renderPageMargins(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={this.state.expanded.includes('margins')}
                onChange={(_event, ex) => this.onExpand('margins', ex)}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ '& .MuiAccordionSummary-content': { ...styles.accordionContent, ...styles.noCheckbox } }}
                >
                    {I18n.t('Margins')}
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="top"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Top')}
                        value={settings.margins.top}
                        onChange={e => this.onChange('margins.top', e.target.value, e)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="left"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Left')}
                        value={settings.margins.left}
                        onChange={e => this.onChange('margins.left', e.target.value, e)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="bottom"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Bottom')}
                        value={settings.margins.bottom}
                        onChange={e => this.onChange('margins.bottom', e.target.value, e)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="right"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Right')}
                        value={settings.margins.right}
                        onChange={e => this.onChange('margins.right', e.target.value, e)}
                    />
                </AccordionDetails>
            </Accordion>
        );
    }

    renderSettingsText(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={this.state.expanded.includes('text')}
                onChange={(_event, ex) => this.onExpand('text', ex)}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ '& .MuiAccordionSummary-content': { ...styles.accordionContent, ...styles.noCheckbox } }}
                >
                    {I18n.t('Text settings')}
                </AccordionSummary>
                <AccordionDetails style={{ display: 'inline-block' }}>
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="fontSize"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Font size')}
                        value={settings.fontSize}
                        onChange={e => this.onChange('fontSize', e.target.value, e)}
                    />
                    <ColorPicker
                        disabled={this.state.pdfInGeneration}
                        value={settings.textColor}
                        style={{ width: 300, display: 'inline-block', marginRight: 16, marginTop: 10 }}
                        label={I18n.t('Color')}
                        onChange={color => this.onChange('textColor', color)}
                    />
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="lineHeight"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Line height')}
                        value={settings.lineHeight}
                        onChange={e => this.onChange('lineHeight', e.target.value, e)}
                    />
                    <br />
                    <ColorPicker
                        disabled={this.state.pdfInGeneration}
                        value={settings.colorLineOdd}
                        style={{ width: 408, display: 'inline-block', marginRight: 16, marginTop: 8 }}
                        label={I18n.t('Odd line background')}
                        onChange={color => this.onChange('colorLineOdd', color)}
                    />
                    <ColorPicker
                        disabled={this.state.pdfInGeneration}
                        value={settings.colorLineEven}
                        style={{ width: 400, display: 'inline-block', marginRight: 16, marginTop: 8 }}
                        label={I18n.t('Even line background')}
                        onChange={color => this.onChange('colorLineEven', color)}
                    />
                </AccordionDetails>
            </Accordion>
        );
    }

    renderSettingsTime(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={!!settings.enabledTime && this.state.expanded.includes('enabledTime')}
                onChange={(_event, ex) => this.onExpand('enabledTime', ex)}
            >
                <AccordionSummary
                    expandIcon={settings.enabledTime ? <ExpandMoreIcon /> : null}
                    sx={{ '& .MuiAccordionSummary-content': styles.accordionContent }}
                >
                    <FormControlLabel
                        disabled={this.state.pdfInGeneration}
                        key="enabledTime"
                        onFocus={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                        control={
                            <Checkbox
                                checked={settings.enabledTime || false}
                                onChange={e => this.onChange('enabledTime', e.target.checked, e)}
                            />
                        }
                        label={I18n.t('Show time')}
                    />
                </AccordionSummary>
                {!!settings.enabledTime && (
                    <AccordionDetails>
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="widthTime"
                            type="number"
                            style={styles.field}
                            label={I18n.t('Column width')}
                            value={settings.widthTime}
                            onChange={e => this.onChange('widthTime', e.target.value, e)}
                        />
                        {!!settings.enabledHeader && (
                            <TextField
                                variant="standard"
                                disabled={this.state.pdfInGeneration}
                                key="textTime"
                                type="text"
                                style={styles.field}
                                label={I18n.t('Header text')}
                                value={settings.textTime}
                                onChange={e => this.onChange('textTime', e.target.value, e)}
                            />
                        )}
                    </AccordionDetails>
                )}
            </Accordion>
        );
    }

    renderSettingsEvent(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={this.state.expanded.includes('enabledEvent')}
                onChange={(_event, ex) => this.onExpand('enabledEvent', ex)}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ '& .MuiAccordionSummary-content': { ...styles.accordionContent, ...styles.noCheckbox } }}
                >
                    {I18n.t('Event')}
                </AccordionSummary>
                <AccordionDetails>
                    <TextField
                        variant="standard"
                        disabled={this.state.pdfInGeneration}
                        key="widthEvent"
                        type="number"
                        style={styles.field}
                        label={I18n.t('Column width')}
                        value={settings.widthEvent}
                        onChange={e => this.onChange('widthEvent', e.target.value, e)}
                    />
                    {!!settings.enabledHeader && (
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="textEvent"
                            type="text"
                            style={styles.field}
                            label={I18n.t('Header text')}
                            value={settings.textEvent}
                            onChange={e => this.onChange('textEvent', e.target.value, e)}
                        />
                    )}
                </AccordionDetails>
            </Accordion>
        );
    }

    renderSettingsValue(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={!!settings.enabledValue && this.state.expanded.includes('enabledValue')}
                onChange={(_event, ex) => this.onExpand('enabledValue', ex)}
            >
                <AccordionSummary
                    expandIcon={settings.enabledValue ? <ExpandMoreIcon /> : null}
                    sx={{ '& .MuiAccordionSummary-content': styles.accordionContent }}
                >
                    <FormControlLabel
                        disabled={this.state.pdfInGeneration}
                        onFocus={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                        key="enabledValue"
                        control={
                            <Checkbox
                                checked={settings.enabledValue || false}
                                onChange={e => this.onChange('enabledValue', e.target.checked, e)}
                            />
                        }
                        label={I18n.t('Show value')}
                    />
                </AccordionSummary>
                {!!settings.enabledValue && (
                    <AccordionDetails>
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="widthValue"
                            type="number"
                            style={styles.field}
                            label={I18n.t('Column width')}
                            value={settings.widthValue}
                            onChange={e => this.onChange('widthValue', e.target.value, e)}
                        />
                        {!!settings.enabledHeader && (
                            <TextField
                                variant="standard"
                                disabled={this.state.pdfInGeneration}
                                key="textValue"
                                type="text"
                                style={styles.field}
                                label={I18n.t('Header text')}
                                value={settings.textValue}
                                onChange={e => this.onChange('textValue', e.target.value, e)}
                            />
                        )}
                    </AccordionDetails>
                )}
            </Accordion>
        );
    }

    renderSettingsDuration(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={!!settings.enabledDuration && this.state.expanded.includes('enabledDuration')}
                onChange={(_event, ex) => this.onExpand('enabledDuration', ex)}
            >
                <AccordionSummary
                    expandIcon={settings.enabledDuration ? <ExpandMoreIcon /> : null}
                    sx={{ '& .MuiAccordionSummary-content': styles.accordionContent }}
                >
                    <FormControlLabel
                        disabled={this.state.pdfInGeneration}
                        onFocus={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                        key="enabledDuration"
                        control={
                            <Checkbox
                                checked={settings.enabledDuration || false}
                                onChange={e => this.onChange('enabledDuration', e.target.checked, e)}
                            />
                        }
                        label={I18n.t('Show duration')}
                    />
                </AccordionSummary>
                {!!settings.enabledDuration && (
                    <AccordionDetails>
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="widthDuration"
                            type="number"
                            style={styles.field}
                            label={I18n.t('Column width')}
                            value={settings.widthDuration}
                            onChange={e => this.onChange('widthDuration', e.target.value, e)}
                        />
                        {!!settings.enabledHeader && (
                            <TextField
                                variant="standard"
                                disabled={this.state.pdfInGeneration}
                                key="textDuration"
                                type="text"
                                style={styles.field}
                                label={I18n.t('Header text')}
                                value={settings.textDuration}
                                onChange={e => this.onChange('textDuration', e.target.value, e)}
                            />
                        )}
                    </AccordionDetails>
                )}
            </Accordion>
        );
    }

    renderPageNumbers(settings: PdfSettingsType): JSX.Element {
        return (
            <Accordion
                expanded={!!settings.pageNumberEnabled && this.state.expanded.includes('pageNumberEnabled')}
                onChange={(_event, ex) => this.onExpand('pageNumberEnabled', ex)}
            >
                <AccordionSummary
                    expandIcon={settings.pageNumberEnabled ? <ExpandMoreIcon /> : null}
                    sx={{ '& .MuiAccordionSummary-content': styles.accordionContent }}
                >
                    <FormControlLabel
                        disabled={this.state.pdfInGeneration}
                        onFocus={event => event.stopPropagation()}
                        onClick={event => event.stopPropagation()}
                        key="pageNumberEnabled"
                        control={
                            <Checkbox
                                checked={settings.pageNumberEnabled || false}
                                onChange={e => this.onChange('pageNumberEnabled', e.target.checked, e)}
                            />
                        }
                        label={I18n.t('Show page numbers')}
                    />
                </AccordionSummary>
                {!!settings.pageNumberEnabled && (
                    <AccordionDetails>
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="pageNumberFontSize"
                            type="number"
                            style={styles.field}
                            label={I18n.t('Font size')}
                            value={settings.pageNumberFontSize}
                            onChange={e => this.onChange('pageNumberFontSize', e.target.value, e)}
                        />
                        <ColorPicker
                            disabled={this.state.pdfInGeneration}
                            value={settings.pageNumberColor}
                            style={{ width: 300, display: 'inline-block', marginRight: 16 }}
                            label={I18n.t('Color')}
                            onChange={color => this.onChange('pageNumberColor', color)}
                        />
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="pageNumberOffsetX"
                            type="number"
                            style={styles.field}
                            label={I18n.t('X Offset')}
                            value={settings.pageNumberOffsetX}
                            onChange={e => this.onChange('pageNumberOffsetX', e.target.value, e)}
                        />
                        <TextField
                            variant="standard"
                            disabled={this.state.pdfInGeneration}
                            key="pageNumberOffsetY"
                            type="number"
                            style={styles.field}
                            label={I18n.t('Y Offset')}
                            value={settings.pageNumberOffsetY}
                            onChange={e => this.onChange('pageNumberOffsetY', e.target.value, e)}
                        />
                    </AccordionDetails>
                )}
            </Accordion>
        );
    }

    renderSettings(): JSX.Element {
        const settings: PdfSettingsType = { ...SETTINGS, ...this.props.native.pdfSettings };

        return (
            <Grid size={{ xs: 12, md: 12, lg: 6 }}>
                <Grid container>
                    <FormControlLabel
                        key="pdfButton"
                        control={
                            <Checkbox
                                checked={this.props.native.pdfButton || false}
                                onChange={e => this.props.onChange('pdfButton', e.target.checked)}
                            />
                        }
                        label={I18n.t('Show PDF generate button on list')}
                    />
                    <div style={{ flexGrow: 1 }} />
                    <IconButton
                        onClick={() => this.onExpand(false)}
                        title={I18n.t('Collapse all')}
                        disabled={!this.state.expanded.length}
                    >
                        <ExpandLessIcon />
                    </IconButton>
                    <IconButton
                        onClick={() => this.onExpand(true)}
                        title={I18n.t('Expand all')}
                        disabled={this.state.expanded.length === ALL_SECTIONS.length}
                    >
                        <ExpandMoreIcon />
                    </IconButton>
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
            </Grid>
        );
    }

    renderPdfFile(): JSX.Element {
        return (
            <Grid size={{ xs: 12, md: 12, lg: 6 }}>
                <iframe
                    title="pdf"
                    style={styles.iframePdfLandscape}
                    src={`../../files/eventlist/report${this.props.instance ? `-${this.props.instance}` : ''}.pdf?q=${this.state.random}`}
                />
            </Grid>
        );
    }

    render(): JSX.Element {
        return (
            <form style={styles.tab}>
                <Grid
                    container
                    spacing={1}
                    style={styles.gridContainer}
                >
                    {this.renderSettings()}
                    {this.renderPdfFile()}
                </Grid>
            </form>
        );
    }
}

export default PdfSettings;
