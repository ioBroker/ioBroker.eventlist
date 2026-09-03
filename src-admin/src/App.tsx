import React, { type CSSProperties, type JSX } from 'react';
import { ThemeProvider, StyledEngineProvider, type Theme } from '@mui/material/styles';

import { AppBar, Tabs, Tab } from '@mui/material';

import {
    ColorPicker,
    Router,
    Loader,
    I18n,
    GenericApp,
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
import TabPDF from './Tabs/PdfSettings';
import type { EventListNative } from './types';

const styles: Record<string, CSSProperties> = {
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto',
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto',
    },
};

const sxSelected = (theme: Theme): { color: string | undefined } => ({
    color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
});

const sxIndicator = (theme: Theme): { backgroundColor: string } => ({
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
});

type AppTab = 'options' | 'list' | 'pdf';
const TABS: AppTab[] = ['options', 'list', 'pdf'];

interface AppState extends GenericAppState {
    native: EventListNative;
}

class App extends GenericApp<GenericAppProps, AppState> {
    private readonly isTab: boolean;
    private readonly isWeb: boolean;

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
    }

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
                            label={I18n.t('PDF')}
                            value="pdf"
                        />
                    </Tabs>
                </AppBar>

                <div style={this.isIFrame ? styles.tabContentIFrame : styles.tabContent}>
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
                {this.renderSaveCloseButtons()}
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

    render(): JSX.Element {
        if (!this.state.loaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <Loader themeType={this.state.themeType} />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <div
                        className="App"
                        style={{
                            background: this.state.theme.palette.background.default,
                            color: this.state.theme.palette.text.primary,
                        }}
                    >
                        {!this.isTab ? this.renderTabsForConfig() : this.renderEventList()}
                        {this.renderError()}
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}

export default App;
