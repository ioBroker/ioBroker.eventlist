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

async function main() {
    const onlyAdmin = process.argv.includes('--admin');
    const onlyWidgets = process.argv.includes('--widgets');

    copyI18n();

    if (!onlyWidgets) {
        await buildAdmin();
    }
    if (!onlyAdmin) {
        await buildWidgets();
    }
}

main().catch(e => {
    console.log(`Cannot build: ${e}`);
    process.exit(2);
});
