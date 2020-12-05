import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/browser';
import * as SentryIntegrations from '@sentry/integrations';
import { MuiThemeProvider} from '@material-ui/core/styles';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import {version} from '../package.json';
import theme from '@iobroker/adapter-react/Theme';
import Utils from '@iobroker/adapter-react/Components/Utils';

window.adapterName = 'eventlist';
let themeName = Utils.getThemeName();

console.log('iobroker.' + window.adapterName + '@' + version + ' using theme "' + themeName + '"');

function build() {
    return ReactDOM.render(
        <MuiThemeProvider theme={theme(themeName)}>
            <App
                onThemeChange={_theme => {
                    themeName = _theme;
                    build();
                }}
            />
        </MuiThemeProvider>,
        document.getElementById('root')
    );
}

if (window.location.host !== 'localhost:3000') {
    Sentry.init({
        dsn: 'https://f41fcdf099e848c590da9b96d0ba67c8@sentry.iobroker.net/109',
        release: 'iobroker.' + window.adapterName + '@' + version,
        integrations: [
            new SentryIntegrations.Dedupe()
        ]
    });
}

build();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
