/*!
 * ioBroker gulpfile
 * Date: 2019-01-28
 */
'use strict';

const fs = require('node:fs');
const { deleteFoldersRecursive, npmInstall, buildReact, copyFiles, patchHtmlFile } = require('@iobroker/build-tools');
const pkg = require('./package.json');
const iopackage = require('./io-package.json');
const { copyFileSync } = require('node:fs');
const version = pkg?.version ? pkg.version : iopackage.common.version;

//TASKS
function clean() {
    deleteFoldersRecursive(`${__dirname}/admin`, ['blockly.js', 'jsonCustom.json']);
    deleteFoldersRecursive(`${__dirname}/www`);
}

async function copyAllFiles() {
    copyFiles(['src/build/**/*', '!src/build/index.html'], 'admin/');
    await patchHtmlFile(`${__dirname}/src/build/index.html`);
    copyFileSync(`${__dirname}/src/build/index.html`, `${__dirname}/admin/index_m.html`);

    if (fs.existsSync(`${__dirname}/widgets/eventlist.html`)) {
        let code = fs.readFileSync(`${__dirname}/widgets/eventlist.html`).toString('utf8');
        code = code.replace(/version: "\d+\.\d+\.\d+"/g, `version: "${version}"`);
        fs.writeFileSync(`${__dirname}/widgets/eventlist.html`, code);
    }

    if (fs.existsSync(`${__dirname}/src/build/index.html`)) {
        const code = fs.readFileSync(`${__dirname}/src/build/index.html`).toString('utf8');
        fs.writeFileSync(`${__dirname}/admin/tab_m.html`, code);
    } else if (fs.existsSync(`${__dirname}/admin/index.html`)) {
        const code = fs.readFileSync(`${__dirname}/admin/index.html`).toString('utf8');
        fs.writeFileSync(`${__dirname}/admin/tab_m.html`, code);
    }

    copyFiles(['src/build/**/*'], 'www/');
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
clean();
let npmPromise;
if (!fs.existsSync(`${__dirname}/src/node_modules`)) {
    npmPromise = npmInstall(`${__dirname}/src`).catch(e => {
        console.log(`Cannot npm install: ${e}`);
        process.exit(2);
    });
} else {
    npmPromise = Promise.resolve();
}

npmPromise
    .then(() => buildReact(`${__dirname}/src`, { rootDir: `${__dirname}/src`, vite: true }))
    .then(() => copyAllFiles())
    .catch(e => {
        console.log(`Cannot build: ${e}`);
        process.exit(2);
    });
