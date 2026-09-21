import React, { createRef, type CSSProperties, type JSX } from 'react';
import { ThemeProvider, StyledEngineProvider, type Theme } from '@mui/material/styles';

import { AppBar, Tabs, Tab, CssBaseline } from '@mui/material';

import {
    ColorPicker,
    Router,
    Loader,
    I18n,
    GenericApp,
    ScrollbarStyles,
    type GenericAppProps,
    type GenericAppSettings,
    type GenericAppState,
} from '@iobroker/gui-components';

import enLang from './i18n/en.json';
import deLang from './i18n/de.json';
import ruLang from './i18n/ru.json';
import ptLang from './i18n/pt.json';
import nlLang from './i18n/nl.json';
import frLang from './i18n/fr.json';
import itLang from './i18n/it.json';
import esLang from './i18n/es.json';
import plLang from './i18n/pl.json';
import ukLang from './i18n/uk.json';
import zhLang from './i18n/zh-cn.json';

import TabOptions from './Tabs/Options';
import TabList from './Tabs/List';
import TabMessages from './Tabs/Messages';
import TabJournal from './Tabs/Journal';
import TabPDF from './Tabs/PdfSettings';
import TabAlarmClasses from './Tabs/AlarmClasses';
import CollapsibleSection from './Components/CollapsibleSection';
import Splitter from './Components/Splitter';
import type { EventListNative } from './types';

const styles: Record<string, CSSProperties> = {
    app: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    tabContent: {
        padding: 10,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
    },
    tabOnlyContent: {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
};

/** Where the two sections of the tab view remember whether they are open */
const SECTION_KEY = 'eventlist.tabSections';

const sxSelected = (theme: Theme): { color: string | undefined } => ({
    color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
});

const sxIndicator = (theme: Theme): { backgroundColor: string } => ({
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
});

type AppTab = 'options' | 'list' | 'messages' | 'journal' | 'classes' | 'pdf';
const TABS: AppTab[] = ['options', 'list', 'messages', 'journal', 'classes', 'pdf'];

interface AppState extends GenericAppState {
    native: EventListNative;
    /** Space that must be kept free for the absolutely positioned save/close bar */
    saveBarHeight: number;
    /** Which sections of the tab view are open, and how the height is divided */
    sections: Sections;
}

/** The three sections of the tab view, from top to bottom */
const SECTION_NAMES = ['list', 'messages', 'journal'] as const;
type SectionName = (typeof SECTION_NAMES)[number];

interface Sections {
    list: boolean;
    messages: boolean;
    journal: boolean;
    /** How much height every section gets. Only the open ones share it. */
    weights: Record<SectionName, number>;
}

export default class App extends GenericApp<GenericAppProps, AppState> {
    private readonly isTab: boolean;
    private readonly isWeb: boolean;
    private readonly appRef = createRef<HTMLDivElement>();
    /** The box that holds the two sections of the tab view, for the splitter between them */
    private readonly stackRef = createRef<HTMLDivElement>();
    private readonly saveBarRef = createRef<HTMLDivElement>();
    private saveBarObserver: ResizeObserver | null = null;
    private observedSaveBar: HTMLElement | null = null;

    constructor(props: GenericAppProps) {
        const extendedProps: GenericAppSettings = { ...props };
        extendedProps.translations = {
            en: enLang,
            de: deLang,
            ru: ruLang,
            pt: ptLang,
            nl: nlLang,
            fr: frLang,
            it: itLang,
            es: esLang,
            pl: plLang,
            uk: ukLang,
            'zh-cn': zhLang,
        };
        extendedProps.sentryDSN = window.sentryDSN;
        extendedProps.bottomButtons = true;

        if (!window.location.pathname.includes('adapter/') && window.location.port !== '3000') {
            extendedProps.bottomButtons = false;
        } else if (window.location.pathname.includes('/tab.html') || window.location.pathname.includes('/tab_m.html')) {
            extendedProps.bottomButtons = false;
        }

        if (window.socketUrl?.startsWith(':')) {
            window.socketUrl = `${window.location.protocol}//${window.location.hostname}${window.socketUrl}`;
        }

        super(props, extendedProps);

        this.isTab = !extendedProps.bottomButtons;
        this.isWeb = window.socketUrl !== undefined;

        let sections: Sections = {
            list: true,
            messages: true,
            journal: false,
            weights: { list: 45, messages: 30, journal: 25 },
        };
        try {
            const stored = window.localStorage.getItem(SECTION_KEY);
            if (stored) {
                const read = JSON.parse(stored) as Partial<Sections>;
                sections = { ...sections, ...read, weights: { ...sections.weights, ...read.weights } };
            }
        } catch {
            // then they are open and share the height as usual
        }

        this.state = { ...this.state, saveBarHeight: 0, sections };
    }

    componentDidMount(): void {
        super.componentDidMount();

        if (typeof ResizeObserver !== 'undefined') {
            this.saveBarObserver = new ResizeObserver(() => this.measureSaveBar());
        }
        this.measureSaveBar();
    }

    componentDidUpdate(): void {
        this.measureSaveBar();
    }

    componentWillUnmount(): void {
        this.saveBarObserver?.disconnect();
        this.saveBarObserver = null;
        this.observedSaveBar = null;

        super.componentWillUnmount();
    }

    /**
     * The save/close bar of `GenericApp` is positioned absolutely and therefore takes no space in the flow.
     * Measure how much space it covers at the bottom and reserve exactly that much, so no gap and no overlap
     * can appear if the theme or the MUI version changes the height of the bar.
     */
    measureSaveBar = (): void => {
        const bar = this.saveBarRef.current?.querySelector<HTMLElement>('.MuiToolbar-root') || null;

        if (bar !== this.observedSaveBar) {
            if (this.observedSaveBar) {
                this.saveBarObserver?.unobserve(this.observedSaveBar);
            }
            if (bar) {
                this.saveBarObserver?.observe(bar);
            }
            this.observedSaveBar = bar;
        }

        const app = this.appRef.current;
        // The bar can be lifted from the bottom edge (in an iframe), so measure up to the bottom of the app
        const saveBarHeight =
            app && bar
                ? Math.max(0, Math.round(app.getBoundingClientRect().bottom - bar.getBoundingClientRect().top))
                : 0;

        if (saveBarHeight !== this.state.saveBarHeight) {
            this.setState({ saveBarHeight });
        }
    };

    getSelectedTab(): AppTab {
        const tab = this.state.selectedTab as AppTab;
        return TABS.includes(tab) ? tab : 'options';
    }

    onPrepareSave(native: Record<string, any>): boolean {
        const settings = native as EventListNative;
        if (settings.defaultBooleanColorTrue) {
            settings.defaultBooleanColorTrue = ColorPicker.getColor(settings.defaultBooleanColorTrue);
        }
        if (settings.defaultBooleanColorFalse) {
            settings.defaultBooleanColorFalse = ColorPicker.getColor(settings.defaultBooleanColorFalse);
        }

        const pdfSettings: Record<string, any> = settings.pdfSettings || {};
        Object.keys(pdfSettings).forEach(attr => {
            if (attr.toLowerCase().includes('color')) {
                if (typeof pdfSettings[attr] === 'object') {
                    pdfSettings[attr] = ColorPicker.getColor(pdfSettings[attr], true);
                }
                if (typeof pdfSettings[attr] === 'string' && pdfSettings[attr].startsWith('rgb')) {
                    pdfSettings[attr] = ColorPicker.rgb2hex(pdfSettings[attr]);
                }
            }
        });

        return super.onPrepareSave(native);
    }

    updateNative(native: EventListNative, cb?: () => void): void {
        this.setState({ native, changed: this.getIsChanged(native) }, cb);
    }

    renderTabsForConfig(): JSX.Element {
        const selectedTab = this.getSelectedTab();

        return (
            <>
                <AppBar position="static">
                    <Tabs
                        value={selectedTab}
                        onChange={(_e, value: AppTab) => Router.doNavigate(value)}
                        sx={{ '& .MuiTabs-indicator': sxIndicator }}
                    >
                        <Tab
                            sx={{ '&.Mui-selected': sxSelected }}
                            label={I18n.t('Options')}
                            value="options"
                        />
                        <Tab
                            sx={{ '&.Mui-selected': sxSelected }}
                            label={I18n.t('Event list')}
                            value="list"
                        />
                        <Tab
                            sx={{ '&.Mui-selected': sxSelected }}
                            label={I18n.t('Messages')}
                            value="messages"
                        />
                        <Tab
                            sx={{ '&.Mui-selected': sxSelected }}
                            label={I18n.t('Journal')}
                            value="journal"
                        />
                        <Tab
                            sx={{ '&.Mui-selected': sxSelected }}
                            label={I18n.t('Alarm classes')}
                            value="classes"
                        />
                        <Tab
                            sx={{ '&.Mui-selected': sxSelected }}
                            label={I18n.t('PDF')}
                            value="pdf"
                        />
                    </Tabs>
                </AppBar>

                <div style={styles.tabContent}>
                    {selectedTab === 'options' && (
                        <TabOptions
                            key="options"
                            common={this.common}
                            socket={this.socket}
                            native={this.state.native}
                            onError={text => this.setState({ errorText: text })}
                            onLoad={native => this.onLoadConfig(native)}
                            instance={this.instance}
                            adapterName={this.adapterName}
                            changed={this.state.changed}
                            onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                        />
                    )}
                    {selectedTab === 'list' && this.renderEventList()}
                    {selectedTab === 'messages' && (
                        <TabMessages
                            key="messages"
                            socket={this.socket}
                            native={this.state.native}
                            instance={this.instance}
                            adapterName={this.adapterName}
                            imagePrefix={this.isWeb ? '../' : '../..'}
                        />
                    )}
                    {selectedTab === 'journal' && (
                        <TabJournal
                            key="journal"
                            socket={this.socket}
                            native={this.state.native}
                            instance={this.instance}
                            adapterName={this.adapterName}
                        />
                    )}
                    {selectedTab === 'classes' && (
                        <TabAlarmClasses
                            key="classes"
                            native={this.state.native}
                            socket={this.socket}
                            adapterName={this.adapterName}
                            instance={this.instance}
                            onChange={(attr, value) => this.updateNativeValue(attr, value)}
                        />
                    )}
                    {selectedTab === 'pdf' && (
                        <TabPDF
                            key="pdf"
                            socket={this.socket}
                            native={this.state.native}
                            instance={this.instance}
                            adapterName={this.adapterName}
                            onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                            updateNative={(native, cb) => this.updateNative(native, cb)}
                        />
                    )}
                </div>
                <div
                    ref={this.saveBarRef}
                    style={{ flex: 'none', height: this.state.saveBarHeight }}
                >
                    {this.renderSaveCloseButtons()}
                </div>
            </>
        );
    }

    renderEventList(): JSX.Element {
        return (
            <TabList
                key="enums"
                imagePrefix={this.isWeb ? '../' : '../..'}
                isWeb={this.isWeb}
                editEnabled={!this.isTab}
                showEditButton={this.isTab}
                themeName={this.state.themeName}
                themeType={this.state.themeType}
                theme={this.state.theme}
                socket={this.socket}
                native={this.state.native}
                onError={text => this.setState({ errorText: text })}
                instance={this.instance}
                adapterName={this.adapterName}
                name={this.common?.titleLang}
            />
        );
    }

    /**
     * The tab shows the three views, one below the other: what is happening, what is standing and
     * what has happened.
     *
     * Every one of them can be folded away, because a plant that only wants to see its alarms should
     * not have to scroll past a hundred events - and the other way round. Between two open sections
     * sits a line that can be dragged, and it only takes from its own neighbour.
     */
    renderStackedTab(): JSX.Element {
        const shares = this.sectionShares();
        const titles: Record<SectionName, string> = {
            list: I18n.t('Event list'),
            messages: I18n.t('Standing messages'),
            journal: I18n.t('Alarm journal'),
        };

        let previous: SectionName | null = null;

        return (
            <div
                style={styles.tabOnlyContent}
                ref={this.stackRef}
            >
                {SECTION_NAMES.map(name => {
                    const open = this.state.sections[name];
                    const above = previous;
                    if (open) {
                        previous = name;
                    }

                    return (
                        <React.Fragment key={name}>
                            {open && above ? (
                                <Splitter
                                    containerRef={this.stackRef}
                                    ratio={shares[above]}
                                    min={10}
                                    max={shares[above] + shares[name] - 10}
                                    onRatio={(value, done) => this.setShare(above, name, value, done)}
                                />
                            ) : null}
                            <CollapsibleSection
                                title={titles[name]}
                                open={open}
                                grow={shares[name] || 1}
                                onToggle={() => this.toggleSection(name)}
                            >
                                {this.renderSection(name)}
                            </CollapsibleSection>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    }

    /**
     * What one of the three sections shows
     *
     * @param name which section
     */
    renderSection(name: SectionName): JSX.Element {
        if (name === 'list') {
            return this.renderEventList();
        }
        if (name === 'messages') {
            return (
                <TabMessages
                    key="messages-tab"
                    socket={this.socket}
                    native={this.state.native}
                    instance={this.instance}
                    adapterName={this.adapterName}
                    imagePrefix={this.isWeb ? '../' : '../..'}
                />
            );
        }
        return (
            <TabJournal
                key="journal-tab"
                socket={this.socket}
                native={this.state.native}
                instance={this.instance}
                adapterName={this.adapterName}
            />
        );
    }

    /** The share of the height every open section gets, in percent. A folded one gets nothing. */
    sectionShares(): Record<SectionName, number> {
        const { weights } = this.state.sections;
        const total = SECTION_NAMES.reduce(
            (sum, name) => sum + (this.state.sections[name] ? weights[name] || 0 : 0),
            0,
        );

        const shares = { list: 0, messages: 0, journal: 0 };
        for (const name of SECTION_NAMES) {
            shares[name] = this.state.sections[name] && total ? ((weights[name] || 0) / total) * 100 : 0;
        }
        return shares;
    }

    /**
     * The line between two sections was dragged: what the upper one gains, the lower one loses.
     *
     * While it is being dragged only the state follows, the storage is written once at the end - a
     * mouse move writes fifty times a second, and nobody needs that in the local storage.
     *
     * @param above the section over the line
     * @param below the section under it
     * @param share the share the upper one should have now, in percent
     * @param done whether the drag has ended
     */
    setShare(above: SectionName, below: SectionName, share: number, done: boolean): void {
        const shares = this.sectionShares();
        const pair = shares[above] + shares[below];
        const weights = { ...this.state.sections.weights };

        if (pair > 0) {
            const stored = weights[above] + weights[below];
            weights[above] = Math.round((share / pair) * stored * 100) / 100;
            weights[below] = Math.round((stored - weights[above]) * 100) / 100;
        }

        const sections = { ...this.state.sections, weights };
        this.setState({ sections }, () => done && App.storeSections(sections));
    }

    static storeSections(sections: AppState['sections']): void {
        try {
            window.localStorage.setItem(SECTION_KEY, JSON.stringify(sections));
        } catch {
            // then it is only for this view
        }
    }

    /** Fold one of the three sections away, and remember it for the next time */
    toggleSection(name: SectionName): void {
        const sections = { ...this.state.sections, [name]: !this.state.sections[name] };

        // one of them stays open, an empty tab helps nobody
        if (!sections.list && !sections.messages && !sections.journal) {
            sections[name === 'list' ? 'messages' : 'list'] = true;
        }

        App.storeSections(sections);
        this.setState({ sections });
    }

    render(): JSX.Element {
        if (!this.state.loaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <CssBaseline />
                        <Loader themeType={this.state.themeType} />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <CssBaseline />
                    <ScrollbarStyles theme={this.state.theme} />
                    <div
                        className="App"
                        ref={this.appRef}
                        style={{
                            ...styles.app,
                            background: this.state.theme.palette.background.default,
                            color: this.state.theme.palette.text.primary,
                        }}
                    >
                        {!this.isTab ? this.renderTabsForConfig() : this.renderStackedTab()}
                        {this.renderError()}
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
