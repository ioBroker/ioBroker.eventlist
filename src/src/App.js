import React from 'react';
import {withStyles} from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import GenericApp from '@iobroker/adapter-react/GenericApp';
import Loader from '@iobroker/adapter-react/Components/Loader'
import { MuiThemeProvider } from '@material-ui/core/styles';

import I18n from '@iobroker/adapter-react/i18n';
import TabOptions from './Tabs/Options';
import TabList from './Tabs/List';
import TabPDF from './Tabs/PdfSettings';
import TabMessengers from './Tabs/Messengers';

const styles = theme => ({
    root: {},
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto'
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto'
    }
});

class App extends GenericApp {
    constructor(props) {
        const extendedProps = {...props};
        extendedProps.translations = {
            'en': require('./i18n/en'),
            'de': require('./i18n/de'),
            'ru': require('./i18n/ru'),
            'pt': require('./i18n/pt'),
            'nl': require('./i18n/nl'),
            'fr': require('./i18n/fr'),
            'it': require('./i18n/it'),
            'es': require('./i18n/es'),
            'pl': require('./i18n/pl'),
            'zh-cn': require('./i18n/zh-cn'),
        };
        extendedProps.bottomButtons = true;

        if (!window.location.pathname.includes('adapter/') && window.location.port !== '3000') {
            extendedProps.bottomButtons = false;
        } else if (window.location.pathname.includes('/tab.html') || window.location.pathname.includes('/tab_m.html')) {
            extendedProps.bottomButtons = false;
        }

        super(props, extendedProps);

        this.isTab = !extendedProps.bottomButtons;
    }

    getSelectedTab() {
        const tab = this.state.selectedTab;
        if (!tab || tab === 'options') {
            return 0;
        } else
        if (tab === 'list') {
            return 1;
        } else
        if (tab === 'pdf') {
            return 2;
        } else
        if (tab === 'messengers') {
            return 3;
        }
    }

    renderTabsForConfig() {
        return <>
            <AppBar position="static">
                <Tabs value={this.getSelectedTab()} onChange={(e, index) => this.selectTab(e.target.parentNode.dataset.name, index)}>
                    <Tab label={I18n.t('Options')}    data-name="options" />
                    <Tab label={I18n.t('Event list')} data-name="list" />
                    <Tab label={I18n.t('PDF')}        data-name="pdf" />
                    <Tab label={I18n.t('Messengers')} data-name="messengers" />
                </Tabs>
            </AppBar>

            <div className={this.isIFrame ? this.props.classes.tabContentIFrame : this.props.classes.tabContent}>
                {(this.state.selectedTab === 'options' || !this.state.selectedTab) && <TabOptions
                    key="options"
                    common={this.common}
                    socket={this.socket}
                    native={this.state.native}
                    onError={text => this.setState({errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text})}
                    onLoad={native => this.onLoadConfig(native)}
                    instance={this.instance}
                    adapterName={this.adapterName}
                    changed={this.state.changed}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                />}
                {this.state.selectedTab === 'list' && this.renderEventList()}
                {this.state.selectedTab === 'pdf' && <TabPDF
                    key="pdf"
                    common={this.common}
                    socket={this.socket}
                    native={this.state.native}
                    onError={text => this.setState({errorText: text})}
                    instance={this.instance}
                    adapterName={this.adapterName}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                />}
                {this.state.selectedTab === 'messengers' && <TabMessengers
                    key="messengers"
                    common={this.common}
                    socket={this.socket}
                    native={this.state.native}
                    onError={text => this.setState({errorText: text})}
                    instance={this.instance}
                    adapterName={this.adapterName}
                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                />}
            </div>
            {this.renderSaveCloseButtons()}
        </>;
    }

    renderEventList() {
        return <TabList
            key="enums"
            editEnabled={!this.isTab}
            showEditButton={this.isTab}
            themeName={this.state.themeName}
            themeType={this.state.themeType}
            common={this.common}
            socket={this.socket}
            native={this.state.native}
            onError={text => this.setState({errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text})}
            instance={this.instance}
            adapterName={this.adapterName}
        />
    }

    render() {
        if (!this.state.loaded) {
            return <MuiThemeProvider theme={this.state.theme}>
                <Loader theme={this.state.themeType} />
            </MuiThemeProvider>
        }

        return <MuiThemeProvider theme={this.state.theme}>
            <div className="App" style={{background: this.state.theme.palette.background.default, color: this.state.theme.palette.text.primary}}>
                {!this.isTab ?
                    this.renderTabsForConfig()
                    :
                    this.renderEventList()
                }
                {this.renderError()}
            </div>
        </MuiThemeProvider>;
    }
}

export default withStyles(styles)(App);
