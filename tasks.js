/*!
 * ioBroker build tasks
 * Date: 2019-01-28
 */
'use strict';

const fs = require('node:fs');
const { deleteFoldersRecursive, npmInstall, buildReact, copyFiles, patchHtmlFile } = require('@iobroker/build-tools');
const pkg = require('./package.json');
const ioPackage = require('./io-package.json');
const version = pkg?.version || ioPackage.common.version;

/** Directory of the admin/web React sources */
const SRC_ADMIN = `${__dirname}/src-admin`;
/** Directory of the vis-2 widget sources */
const SRC_WIDGETS = `${__dirname}/src-widgets`;
/** Directory of the device manager widget sources */
const SRC_DEVICES = `${__dirname}/src-devices`;

//TASKS
function clean() {
    deleteFoldersRecursive(`${__dirname}/admin`, ['blockly.js', 'jsonCustom.json']);
    deleteFoldersRecursive(`${__dirname}/www`);
}

async function copyAllFiles() {
    copyFiles(['src-admin/build/**/*', '!src-admin/build/index.html'], 'admin/');
    await patchHtmlFile(`${SRC_ADMIN}/build/index.html`);
    fs.copyFileSync(`${SRC_ADMIN}/build/index.html`, `${__dirname}/admin/index_m.html`);

    if (fs.existsSync(`${__dirname}/widgets/eventlist.html`)) {
        let code = fs.readFileSync(`${__dirname}/widgets/eventlist.html`).toString('utf8');
        code = code.replace(/version: "\d+\.\d+\.\d+"/g, `version: "${version}"`);
        fs.writeFileSync(`${__dirname}/widgets/eventlist.html`, code);
    }

    if (fs.existsSync(`${SRC_ADMIN}/build/index.html`)) {
        const code = fs.readFileSync(`${SRC_ADMIN}/build/index.html`).toString('utf8');
        fs.writeFileSync(`${__dirname}/admin/tab_m.html`, code);
    } else if (fs.existsSync(`${__dirname}/admin/index.html`)) {
        const code = fs.readFileSync(`${__dirname}/admin/index.html`).toString('utf8');
        fs.writeFileSync(`${__dirname}/admin/tab_m.html`, code);
    }

    copyFiles(['src-admin/build/**/*'], 'www/');
    if (fs.existsSync(`${__dirname}/www/index.html`)) {
        let code = fs.readFileSync(`${__dirname}/www/index.html`).toString('utf8');
        if (!code.includes('_socket/info.js')) {
            code = code.replace(
                '<link rel="manifest" href="./manifest.json"/>',
                '<link rel="manifest" href="./manifest.json"/><script type="text/javascript" src="../_socket/info.js"></script>',
            );
        }
        code = code.replace(
            '<script type="text/javascript" src="../../lib/js/socket.io.js"></script>',
            '<script type="text/javascript" src="../lib/js/socket.io.js"></script>',
        );
        fs.writeFileSync(`${__dirname}/www/index.html`, code);
    }
}
function copyI18n() {
    copyFiles(['src/i18n/**/*'], 'build/i18n/');
}

/**
 * Copies the built vis-2 widgets into `widgets/eventlist/`.
 *
 * The vis-1 widget set lives in the same place - `widgets/eventlist.html` and the `css/` and `img/`
 * folders next to it - and must survive, so only the bundle of the previous build is removed.
 */
function copyWidgets() {
    deleteFoldersRecursive(`${__dirname}/widgets/eventlist/assets`);
    copyFiles(
        ['src-widgets/build/**/*', '!src-widgets/build/index.html', '!src-widgets/build/mf-manifest.json'],
        'widgets/eventlist/',
    );
}

/**
 * Copies the built device manager widget into `admin/dm-widgets/`.
 *
 * `clean()` keeps only `blockly.js` and `jsonCustom.json` in `admin/`, so this has to run after the
 * admin build, not before it.
 */
function copyDevices() {
    copyFiles(['src-devices/build/**/*', '!src-devices/build/index.html'], 'admin/dm-widgets/');
    copyFiles(['src-devices/img/**/*'], 'admin/dm-widgets/');
    copyFiles(['src-devices/src/i18n/*.json'], 'admin/dm-widgets/i18n/');
}

async function installIfNeeded(dir) {
    if (!fs.existsSync(`${dir}/node_modules`)) {
        await npmInstall(dir);
    }
}

async function buildAdmin() {
    clean();
    await installIfNeeded(SRC_ADMIN);
    await buildReact(SRC_ADMIN, { rootDir: __dirname, vite: true });
    await copyAllFiles();
}

async function buildWidgets() {
    deleteFoldersRecursive(`${SRC_WIDGETS}/build`);
    await installIfNeeded(SRC_WIDGETS);
    await buildReact(SRC_WIDGETS, { rootDir: __dirname, vite: true });
    copyWidgets();
}

async function buildDevices() {
    deleteFoldersRecursive(`${SRC_DEVICES}/build`);
    await installIfNeeded(SRC_DEVICES);
    await buildReact(SRC_DEVICES, { rootDir: __dirname, vite: true });
    copyDevices();
}

async function main() {
    const onlyAdmin = process.argv.includes('--admin');
    const onlyWidgets = process.argv.includes('--widgets');
    const onlyDevices = process.argv.includes('--devices');
    const all = !onlyAdmin && !onlyWidgets && !onlyDevices;

    copyI18n();

    if (all || onlyAdmin) {
        await buildAdmin();
    }
    if (all || onlyWidgets) {
        await buildWidgets();
    }
    if (all || onlyDevices) {
        await buildDevices();
    }
}

main().catch(e => {
    console.log(`Cannot build: ${e}`);
    process.exit(2);
});
