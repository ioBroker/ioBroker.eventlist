import react from '@vitejs/plugin-react';
import { checkManifest, getReactImportPath, REACT_SPECIFIERS } from '@iobroker/web-components';
import { readFileSync } from 'node:fs';
import type { Plugin, UserConfig } from 'vite';

// with the extension: Vite may load its config natively, without a bundler that would add it
import { COMPONENT_NAMES, getManifestFile, getModuleFile, getModulePath, type ComponentName } from './src/constants.ts';
import { buildManifest } from './src/manifest.ts';
import {
    COMPONENT_WORDS,
    LANGUAGES,
    OWN_ELEMENT_WORDS,
    OWN_MANIFEST_WORDS,
    type Language,
    type Translations,
} from './src/words.ts';

/**
 * The web components of the eventlist adapter, one ES module each in `admin/webcomponents/` with its manifest
 * `<name>.json` next to it (`common.webComponents`):
 *
 * - `<iob-eventlist-events>` - the event list as a table, like the vis-2 widget "Events"
 * - `<iob-eventlist-last-event>` - the newest event, the list in a dialog, like the devices widget "Last event"
 * - `<iob-eventlist-alarms>` - the standing alarms, the events and the journal, like the vis-2 widget "Alarms and
 *   events" and the devices widget "Alarms"
 * - `<iob-eventlist-pdf>` - a button that creates the PDF of the list and opens it, like the vis-2 widget "PDF"
 *
 * Every host - vis-2, devices, Aura, admin - reads them from `/adapter/eventlist/webcomponents/`. No module
 * federation: the host shares nothing but the socket.
 *
 * One build per component - `vite build --mode <name>` (`npm run build` runs all of them): a host imports exactly
 * one URL per component, so each module is one file, with the shared code compiled into each. One build with
 * several entries would move the shared code into a chunk of its own.
 *
 * React is not bundled: the four React imports point at `lib/esm/react-19.js`, which web and admin serve beside
 * `adapter/`. The path is relative to the module, so a path prefix of a reverse proxy stays.
 */

/** The module of each component */
const ENTRIES: Record<ComponentName, string> = {
    'eventlist-events': './src/EventsElement.tsx',
    'eventlist-last-event': './src/LastEventElement.tsx',
    'eventlist-alarms': './src/AlarmsElement.tsx',
    'eventlist-pdf': './src/PdfElement.tsx',
};

/** The i18n files of the native widgets: vis-2 (keys without prefix) and devices (keys with `evl_`) */
const I18N_FOLDERS = ['../src-widgets/src/i18n/', '../src-devices/src/i18n/'];

/** The words of the native widgets in one language, both sets in one dictionary - their keys do not overlap */
function readAdapterWords(lang: Language): Record<string, string> {
    const words: Record<string, string> = {};
    for (const folder of I18N_FOLDERS) {
        Object.assign(
            words,
            JSON.parse(readFileSync(new URL(`${folder}${lang}.json`, import.meta.url), 'utf8')) as Record<
                string,
                string
            >,
        );
    }
    return words;
}

const ADAPTER_WORDS = Object.fromEntries(LANGUAGES.map(lang => [lang, readAdapterWords(lang)])) as Record<
    Language,
    Record<string, string>
>;

const OWN_WORDS: Record<string, Translations> = { ...OWN_ELEMENT_WORDS, ...OWN_MANIFEST_WORDS };

/**
 * A word in every language: from the native widgets, else one of our own. Stops the build if a language misses it
 *
 * @param key the word
 */
function translate(key: string): Translations {
    const text = {} as Translations;
    for (const lang of LANGUAGES) {
        const word = ADAPTER_WORDS[lang][key] || OWN_WORDS[key]?.[lang];
        if (!word) {
            throw new Error(`The word "${key}" has no text in "${lang}"`);
        }
        text[lang] = word;
    }
    return text;
}

/**
 * The words one element shows, by language - `__EVENTLIST_WORDS__` of `src/i18n.ts`
 *
 * @param name the component
 */
function getElementWords(name: ComponentName): Record<Language, Record<string, string>> {
    const texts = [...new Set<string>(COMPONENT_WORDS[name])].map(key => [key, translate(key)] as const);
    return Object.fromEntries(
        LANGUAGES.map(lang => [lang, Object.fromEntries(texts.map(([key, text]) => [key, text[lang]]))]),
    ) as Record<Language, Record<string, string>>;
}

/** Writes `<name>.json` next to the module, checked like a host checks it */
function manifestFile(name: ComponentName): Plugin {
    return {
        name: 'eventlist-web-component-manifest',
        generateBundle() {
            const manifest = buildManifest(name, translate);
            const problem = checkManifest(manifest);
            if (problem) {
                this.error(`${getManifestFile(name)}: ${problem}`);
            }
            if (manifest.module !== getModuleFile(name)) {
                this.error(`${getManifestFile(name)}: "module" must be "${getModuleFile(name)}"`);
            }
            this.emitFile({
                type: 'asset',
                fileName: getManifestFile(name),
                source: `${JSON.stringify(manifest, null, 4)}\n`,
            });
        },
    };
}

export default ({ mode }: { mode: string }): UserConfig => {
    const name = COMPONENT_NAMES.find(component => component === mode);
    if (!name) {
        throw new Error(`Build one component at a time: vite build --mode <${COMPONENT_NAMES.join('|')}>`);
    }
    const reactImport = getReactImportPath(getModulePath(name));

    return {
        plugins: [react(), manifestFile(name)],
        define: {
            __EVENTLIST_WORDS__: JSON.stringify(getElementWords(name)),
            'process.env.NODE_ENV': JSON.stringify('production'),
        },
        build: {
            target: 'es2022',
            outDir: './build',
            // the builds of all components write into the same folder: only the first one empties it
            emptyOutDir: name === COMPONENT_NAMES[0],
            lib: {
                entry: ENTRIES[name],
                formats: ['es'],
                fileName: (): string => getModuleFile(name),
            },
            rollupOptions: {
                external: [...REACT_SPECIFIERS],
                output: {
                    paths: Object.fromEntries(REACT_SPECIFIERS.map(specifier => [specifier, reactImport])),
                    // one file: a host imports exactly one URL
                    codeSplitting: false,
                    // library mode keeps whitespace for the bundler of a consumer; this module is loaded as it is
                    minify: true,
                },
            },
        },
    };
};
