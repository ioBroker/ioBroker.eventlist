const fs        = require('fs');
const path      = require('path');
const fileName  = 'words.js';
const EMPTY     = '';
const iopackage = require('./io-package.json');
const request = require('request');

const languages = {
    en: {},
    de: {},
    ru: {},
    pt: {},
    nl: {},
    fr: {},
    it: {},
    es: {},
    pl: {},
    'zh-cn': {}
};

function translateIoBroker(text) {
    return new Promise((resolve, reject) =>
        resolve({}));
}

function lang2data(lang, isFlat) {
    let str = isFlat ? '' : '{\n';
    let count = 0;
    for (const w in lang) {
        if (lang.hasOwnProperty(w)) {
            count++;
            if (isFlat) {
                str += (lang[w] === '' ? (isFlat[w] || w) : lang[w]) + '\n';
            } else {
                const key = '    "' + w.replace(/"/g, '\\"') + '": ';
                str += key + '"' + lang[w].replace(/"/g, '\\"') + '",\n';
            }
        }
    }
    if (!count)
        return isFlat ? '' : '{\n}';
    if (isFlat) {
        return str;
    } else {
        return str.substring(0, str.length - 2) + '\n}';
    }
}

function readWordJs(src) {
    try {
        let words;
        if (fs.existsSync(src + 'js/' + fileName)) {
            words = fs.readFileSync(src + 'js/' + fileName).toString();
        } else {
            words = fs.readFileSync(src + fileName).toString();
        }
        words = words.substring(words.indexOf('{'), words.length);
        words = words.substring(0, words.lastIndexOf(';'));

        const resultFunc = new Function('return ' + words + ';');

        return resultFunc();
    } catch (e) {
        return null;
    }
}

function padRight(text, totalLength) {
    return text + (text.length < totalLength ? new Array(totalLength - text.length).join(' ') : '');
}

function writeWordJs(data, src) {
    let text = '';
    text += '/*global systemDictionary:true */\n';
    text += '\'use strict\';\n\n';
    text += 'systemDictionary = {\n';
    for (const word in data) {
        if (data.hasOwnProperty(word)) {
            text += '    ' + padRight('"' + word.replace(/"/g, '\\"') + '": {', 50);
            let line = '';
            for (const lang in data[word]) {
                if (data[word].hasOwnProperty(lang)) {
                    line += '"' + lang + '": "' + padRight(data[word][lang].replace(/"/g, '\\"') + '",', 50) + ' ';
                }
            }
            if (line) {
                line = line.trim();
                line = line.substring(0, line.length - 1);
            }
            text += line + '},\n';
        }
    }
    text += '};';
    if (fs.existsSync(src + 'js/' + fileName)) {
        fs.writeFileSync(src + 'js/' + fileName, text);
    } else {
        fs.writeFileSync(src + '' + fileName, text);
    }
}

function words2languages(src) {
    const langs = Object.assign({}, languages);
    const data = readWordJs(src);
    if (data) {
        for (const word in data) {
            if (data.hasOwnProperty(word)) {
                for (const lang in data[word]) {
                    if (data[word].hasOwnProperty(lang)) {
                        langs[lang][word] = data[word][lang];
                        //  pre-fill all other languages
                        for (const j in langs) {
                            if (langs.hasOwnProperty(j)) {
                                langs[j][word] = langs[j][word] || EMPTY;
                            }
                        }
                    }
                }
            }
        }
        if (!fs.existsSync(src + 'i18n/')) {
            fs.mkdirSync(src + 'i18n/');
        }
        for (const l in langs) {
            if (!langs.hasOwnProperty(l))
                continue;
            const keys = Object.keys(langs[l]);
            keys.sort();
            const obj = {};
            for (let k = 0; k < keys.length; k++) {
                obj[keys[k]] = langs[l][keys[k]];
            }
            if (!fs.existsSync(src + 'i18n/' + l)) {
                fs.mkdirSync(src + 'i18n/' + l);
            }

            fs.writeFileSync(src + 'i18n/' + l + '/translations.json', lang2data(obj));
        }
    } else {
        console.error('Cannot read or parse ' + fileName);
    }
}

function words2languagesFlat(src) {
    const langs = Object.assign({}, languages);
    const data = readWordJs(src);
    if (data) {
        for (const word in data) {
            if (data.hasOwnProperty(word)) {
                for (const lang in data[word]) {
                    if (data[word].hasOwnProperty(lang)) {
                        langs[lang][word] = data[word][lang];
                        //  pre-fill all other languages
                        for (const j in langs) {
                            if (langs.hasOwnProperty(j)) {
                                langs[j][word] = langs[j][word] || EMPTY;
                            }
                        }
                    }
                }
            }
        }
        const keys = Object.keys(langs.en);
        keys.sort();
        for (const l in langs) {
            if (!langs.hasOwnProperty(l))
                continue;
            const obj = {};
            for (let k = 0; k < keys.length; k++) {
                obj[keys[k]] = langs[l][keys[k]];
            }
            langs[l] = obj;
        }
        if (!fs.existsSync(src + 'i18n/')) {
            fs.mkdirSync(src + 'i18n/');
        }
        for (const ll in langs) {
            if (!langs.hasOwnProperty(ll))
                continue;
            if (!fs.existsSync(src + 'i18n/' + ll)) {
                fs.mkdirSync(src + 'i18n/' + ll);
            }

            fs.writeFileSync(src + 'i18n/' + ll + '/flat.txt', lang2data(langs[ll], langs.en));
        }
        fs.writeFileSync(src + 'i18n/flat.txt', keys.join('\n'));
    } else {
        console.error('Cannot read or parse ' + fileName);
    }
}

function languagesFlat2words(src) {
    const dirs = fs.readdirSync(src + 'i18n/');
    const langs = {};
    const bigOne = {};
    const order = Object.keys(languages);
    dirs.sort(function (a, b) {
        const posA = order.indexOf(a);
        const posB = order.indexOf(b);
        if (posA === -1 && posB === -1) {
            if (a > b)
                return 1;
            if (a < b)
                return -1;
            return 0;
        } else if (posA === -1) {
            return -1;
        } else if (posB === -1) {
            return 1;
        } else {
            if (posA > posB)
                return 1;
            if (posA < posB)
                return -1;
            return 0;
        }
    });
    const keys = fs.readFileSync(src + 'i18n/flat.txt').toString().split('\n');

    for (let l = 0; l < dirs.length; l++) {
        if (dirs[l] === 'flat.txt')
            continue;
        const lang = dirs[l];
        const values = fs.readFileSync(src + 'i18n/' + lang + '/flat.txt').toString().split('\n');
        langs[lang] = {};
        keys.forEach(function (word, i) {
            langs[lang][word] = values[i];
        });

        const words = langs[lang];
        for (const word in words) {
            if (words.hasOwnProperty(word)) {
                bigOne[word] = bigOne[word] || {};
                if (words[word] !== EMPTY) {
                    bigOne[word][lang] = words[word];
                }
            }
        }
    }
    // read actual words.js
    const aWords = readWordJs();

    const temporaryIgnore = ['flat.txt'];
    if (aWords) {
        // Merge words together
        for (const w in aWords) {
            if (aWords.hasOwnProperty(w)) {
                if (!bigOne[w]) {
                    console.warn('Take from actual words.js: ' + w);
                    bigOne[w] = aWords[w];
                }
                dirs.forEach(function (lang) {
                    if (temporaryIgnore.indexOf(lang) !== -1)
                        return;
                    if (!bigOne[w][lang]) {
                        console.warn('Missing "' + lang + '": ' + w);
                    }
                });
            }
        }

    }

    writeWordJs(bigOne, src);
}

function languages2words(src) {
    const dirs = fs.readdirSync(src + 'i18n/');
    const langs = {};
    const bigOne = {};
    const order = Object.keys(languages);
    dirs.sort(function (a, b) {
        const posA = order.indexOf(a);
        const posB = order.indexOf(b);
        if (posA === -1 && posB === -1) {
            if (a > b)
                return 1;
            if (a < b)
                return -1;
            return 0;
        } else if (posA === -1) {
            return -1;
        } else if (posB === -1) {
            return 1;
        } else {
            if (posA > posB)
                return 1;
            if (posA < posB)
                return -1;
            return 0;
        }
    });
    for (let l = 0; l < dirs.length; l++) {
        if (dirs[l] === 'flat.txt')
            continue;
        const lang = dirs[l];
        langs[lang] = fs.readFileSync(src + 'i18n/' + lang + '/translations.json').toString();
        langs[lang] = JSON.parse(langs[lang]);
        const words = langs[lang];
        for (const word in words) {
            if (words.hasOwnProperty(word)) {
                bigOne[word] = bigOne[word] || {};
                if (words[word] !== EMPTY) {
                    bigOne[word][lang] = words[word];
                }
            }
        }
    }
    // read actual words.js
    const aWords = readWordJs();

    const temporaryIgnore = ['flat.txt'];
    if (aWords) {
        // Merge words together
        for (const w in aWords) {
            if (aWords.hasOwnProperty(w)) {
                if (!bigOne[w]) {
                    console.warn('Take from actual words.js: ' + w);
                    bigOne[w] = aWords[w];
                }
                dirs.forEach(function (lang) {
                    if (temporaryIgnore.indexOf(lang) !== -1)
                        return;
                    if (!bigOne[w][lang]) {
                        console.warn('Missing "' + lang + '": ' + w);
                    }
                });
            }
        }

    }

    writeWordJs(bigOne, src);
}

async function translateNotExisting(obj, baseText, yandex) {
    let t = obj['en'];
    if (!t) {
        t = baseText;
    }

    if (t) {
        for (let l in languages) {
            if (!obj[l]) {
                const time = new Date().getTime();
                obj[l] = await translate(t, l, yandex);
                console.log('en -> ' + l + ' ' + (new Date().getTime() - time) + ' ms');
            }
        }
    }
}

function collectWords(src, words) {
    words = words || [];
    const files = fs.readdirSync(src);
    files.forEach(file => {
        const name = path.join(src, file);
        const stat = fs.statSync(name);
        if (stat.isDirectory()) {
            collectWords(name, words);
        } else {
            if (!file.endsWith('.js')) {
                return;
            }
            const text = fs.readFileSync(name).toString('utf8').replace(/\r\n|\r|\n/, ' ');
            const m = text.match(/I18n\.t\('[^']+'\)/g);
            m && m.forEach(text => {
                text = text.replace('I18n.t(\'', '');
                text = text.substring(0, text.length - 2);
                text && !words.includes(text) && words.push(text);
            });
        }
    });
    return words;
}

const translated = {};

async function syncWords(src, words) {
    words.sort();
    for (const lang in languages) {
        const fileName = path.join(src, lang + '.json');
        const json = fs.existsSync(fileName) ? JSON.parse(fs.readFileSync(fileName).toString('utf8')) : {};
        let changed = false;
        for (let w = 0; w < words.length; w++) {
            if (!json[words[w]]) {
                if (translated[words[w]]) {
                    json[words[w]] = translated[words[w]][lang] || '';
                } else {
                    try {
                        console.log(`Translate "${words[w]} to ${lang.toUpperCase()}`);
                        translated[words[w]] = await translateIoBroker(words[w]);
                        json[words[w]] = translated[words[w]][lang] || '';
                    } catch (e) {
                        console.error('Cannot translate: ' + e);
                        break;
                    }
                }

                changed = true;
            }
        }

        // todo remove unused

        if (changed) {
            console.log('Updated: ' + lang);
            fs.writeFileSync(fileName, JSON.stringify(json, null, 2));
        }
    }
    return true;
}

module.exports = function (gulp) {
    gulp.task('translate', async function () {
        const words = collectWords(__dirname + '/src/src');
        await syncWords(__dirname + '/src/src/i18n', words);
    });

    gulp.task('adminWords2languages', done => {
        words2languages('./src/public/');
        done();
    });

    gulp.task('adminWords2languagesFlat', done => {
        words2languagesFlat('./src/public/');
        done();
    });

    gulp.task('adminLanguagesFlat2words', done => {
        languagesFlat2words('./src/public/');
        done();
    });

    gulp.task('adminLanguages2words', done => {
        languages2words('./src/public/');
        done();
    });

    gulp.task('_translate', async function () {
        let yandex;
        const i = process.argv.indexOf('--yandex');
        if (i > -1) {
            yandex = process.argv[i + 1];
        }

        if (iopackage && iopackage.common) {
            if (iopackage.common.news) {
                console.log('Translate News');
                for (let k in iopackage.common.news) {
                    console.log('News: ' + k);
                    let nw = iopackage.common.news[k];
                    await translateNotExisting(nw, null, yandex);
                }
            }
            if (iopackage.common.titleLang) {
                console.log('Translate Title');
                await translateNotExisting(iopackage.common.titleLang, iopackage.common.title, yandex);
            }
            if (iopackage.common.desc) {
                console.log('Translate Description');
                await translateNotExisting(iopackage.common.desc, null, yandex);
            }

            if (fs.existsSync('./admin/i18n/en/translations.json')) {
                let enTranslations = require('./admin/i18n/en/translations.json');
                for (let l in languages) {
                    console.log('Translate Text: ' + l);
                    let existing = {};
                    if (fs.existsSync('./admin/i18n/' + l + '/translations.json')) {
                        existing = require('./admin/i18n/' + l + '/translations.json');
                    }
                    for (let t in enTranslations) {
                        if (!existing[t]) {
                            existing[t] = await translate(enTranslations[t], l, yandex);
                        }
                    }
                    if (!fs.existsSync('./admin/i18n/' + l + '/')) {
                        fs.mkdirSync('./admin/i18n/' + l + '/');
                    }
                    fs.writeFileSync('./admin/i18n/' + l + '/translations.json', JSON.stringify(existing, null, 4));
                }
            }

        }
        fs.writeFileSync('io-package.json', JSON.stringify(iopackage, null, 4));
    });

    gulp.task('translateAndUpdateWordsJS', gulp.series('translate', 'adminLanguages2words', 'adminWords2languages'));
};