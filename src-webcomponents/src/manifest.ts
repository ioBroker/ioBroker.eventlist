/**
 * The manifests of the web components. Read by the build only (`vite.config.ts`), which writes each one as
 * `<name>.json` next to its module - a host reads that file for its palette and its settings without loading the
 * module.
 *
 * The texts come from `t()`: the words of the native widgets (`src-widgets/src/i18n/`, `src-devices/src/i18n/`) and
 * `OWN_MANIFEST_WORDS` of `words.ts`, in every language. The name of a component is the name of its native widget -
 * the label of the devices widget if there is one, else the one the palette of vis-2 shows - so that vis-2 and
 * devices offer the native widget instead of the component where they have one.
 */
import type { WebComponentManifest, WebComponentSetting, WebComponentSettingsPanel } from '@iobroker/web-components';

// with the extension: `vite.config.ts` imports this file, and Vite may load its config natively
import { getModuleFile, getTag, type ComponentName } from './constants.ts';
import type { ManifestWord, Translations } from './words.ts';

/** A text of a manifest in every language */
export type ManifestText = (key: ManifestWord) => Translations;

const SCHEMA = 'https://raw.githubusercontent.com/ioBroker/web-components/main/schemas/manifest.json';

/** relative to the manifest file: /adapter/eventlist/eventlist.png */
const ICON = '../eventlist.png';

/** The instance of the eventlist adapter: JSON-Config stores `eventlist.0` */
function instanceSetting(t: ManifestText, label: ManifestWord): WebComponentSetting {
    return { type: 'instance', adapter: 'eventlist', default: 'eventlist.0', label: t(label) };
}

function eventsSettings(t: ManifestText): WebComponentSettingsPanel {
    return {
        type: 'panel',
        items: {
            instance: instanceSetting(t, 'instance'),
            maxRows: { type: 'number', min: 0, default: 0, label: t('max_rows') },
            filterById: { type: 'text', label: t('filter_by_id'), help: t('tooltip_filter_by_id') },
            columnsHeader: { type: 'header', text: t('group_header') },
            showTime: { type: 'checkbox', default: true, label: t('show_time') },
            showValue: { type: 'checkbox', default: true, label: t('show_value') },
            showDuration: { type: 'checkbox', default: true, label: t('show_duration') },
            titlesHeader: { type: 'header', text: t('group_header_title') },
            textTime: { type: 'text', label: t('text_time'), help: t('headerTextHelp') },
            textEvent: { type: 'text', label: t('text_event'), help: t('headerTextHelp') },
            textValue: { type: 'text', label: t('text_value'), help: t('headerTextHelp') },
            textDuration: { type: 'text', label: t('text_duration'), help: t('headerTextHelp') },
        },
    };
}

function lastEventSettings(t: ManifestText): WebComponentSettingsPanel {
    return {
        type: 'panel',
        items: {
            instance: instanceSetting(t, 'evl_instance'),
            name: { type: 'text', label: t('evl_name') },
            filter: { type: 'text', label: t('evl_filter'), help: t('evl_tooltip_filter') },
            maxRows: { type: 'number', min: 0, default: 30, label: t('evl_max_rows') },
            showValue: { type: 'checkbox', default: true, label: t('evl_show_value') },
            showDuration: { type: 'checkbox', default: false, label: t('evl_show_duration') },
        },
    };
}

function alarmsSettings(t: ManifestText): WebComponentSettingsPanel {
    const noMessages = 'data.show === "events" || data.show === "journal"';
    const noEvents = 'data.show === "messages" || data.show === "journal"';
    const noJournal = '!data.showJournal && data.show !== "journal"';

    return {
        type: 'panel',
        items: {
            instance: instanceSetting(t, 'instance'),
            layout: {
                type: 'select',
                default: 'auto',
                label: t('layout'),
                help: t('layoutHelp'),
                options: [
                    { value: 'auto', label: t('layoutAuto') },
                    { value: 'tile', label: t('layoutTile') },
                    { value: 'panel', label: t('layoutPanel') },
                ],
            },
            name: { type: 'text', label: t('evl_name') },
            show: {
                type: 'select',
                default: 'both',
                label: t('show_what'),
                options: [
                    { value: 'both', label: t('show_both') },
                    { value: 'messages', label: t('show_messages') },
                    { value: 'events', label: t('show_events') },
                    { value: 'journal', label: t('evl_show_journal') },
                ],
            },
            messagesRatio: {
                type: 'slider',
                min: 10,
                max: 90,
                step: 5,
                default: 50,
                label: t('messages_ratio'),
                hidden: 'data.show !== "both"',
            },
            showTitles: { type: 'checkbox', default: true, label: t('show_titles') },
            showSummary: {
                type: 'checkbox',
                default: true,
                label: t('show_summary'),
                help: t('tooltip_show_summary'),
                hidden: noMessages,
            },
            allowAck: {
                type: 'checkbox',
                default: false,
                label: t('allow_ack'),
                help: t('tooltip_allow_ack'),
                hidden: noMessages,
            },
            messagesHeader: { type: 'header', text: t('group_messages'), hidden: noMessages },
            maxMessages: { type: 'number', min: 0, default: 0, label: t('max_rows'), hidden: noMessages },
            filterLevel: {
                type: 'select',
                default: '',
                label: t('filter_level'),
                options: [
                    { value: '', label: t('all_levels') },
                    { value: 'fatal', label: t('level_fatal') },
                    { value: 'alarm', label: t('level_alarm') },
                    { value: 'warning', label: t('level_warning') },
                    { value: 'info', label: t('level_info') },
                ],
            },
            showSince: { type: 'checkbox', default: true, label: t('show_since'), hidden: noMessages },
            showMessageValue: { type: 'checkbox', default: true, label: t('show_value'), hidden: noMessages },
            showCount: { type: 'checkbox', default: false, label: t('show_count'), hidden: noMessages },
            showGroup: { type: 'checkbox', default: false, label: t('show_group'), hidden: noMessages },
            eventsHeader: { type: 'header', text: t('group_events'), hidden: noEvents },
            maxEvents: { type: 'number', min: 0, default: 0, label: t('max_rows'), hidden: noEvents },
            filterById: {
                type: 'text',
                label: t('filter_by_id'),
                help: t('tooltip_filter_by_id'),
                hidden: noEvents,
            },
            showTime: { type: 'checkbox', default: true, label: t('show_time'), hidden: noEvents },
            showValue: { type: 'checkbox', default: true, label: t('show_value'), hidden: noEvents },
            showDuration: { type: 'checkbox', default: false, label: t('show_duration'), hidden: noEvents },
            journalHeader: { type: 'header', text: t('group_journal') },
            showJournal: {
                type: 'checkbox',
                default: false,
                label: t('show_journal'),
                help: t('tooltip_show_journal'),
                hidden: 'data.show === "journal"',
            },
            maxJournal: { type: 'number', min: 0, default: 20, label: t('max_rows'), hidden: noJournal },
            journalArchive: {
                type: 'checkbox',
                default: false,
                label: t('journal_archive'),
                help: t('tooltip_journal_archive'),
                hidden: noJournal,
            },
            allowExport: {
                type: 'checkbox',
                default: false,
                label: t('allow_export'),
                help: t('tooltip_allow_export'),
                hidden: noJournal,
            },
        },
    };
}

function pdfSettings(t: ManifestText): WebComponentSettingsPanel {
    return {
        type: 'panel',
        items: {
            instance: instanceSetting(t, 'instance'),
            text: { type: 'text', default: 'PDF', label: t('pdf_text') },
        },
    };
}

/**
 * The manifest of a component
 *
 * @param name the component
 * @param t the texts in every language
 */
export function buildManifest(name: ComponentName, t: ManifestText): WebComponentManifest {
    const base = {
        $schema: SCHEMA,
        manifestVersion: 1 as const,
        tag: getTag(name),
        icon: ICON,
        module: getModuleFile(name),
    };

    switch (name) {
        case 'eventlist-events':
            return {
                ...base,
                // the palette label of the vis-2 widget "Events"
                name: t('events'),
                description: t('descEvents'),
                size: { width: 400, height: 300 },
                settings: eventsSettings(t),
            };
        case 'eventlist-last-event':
            return {
                ...base,
                // the label of the devices widget `EventlistLastEventComponent`
                name: t('EventlistLastEvent'),
                description: t('descLastEvent'),
                size: { width: 300, height: 150 },
                settings: lastEventSettings(t),
            };
        case 'eventlist-alarms':
            return {
                ...base,
                // the label of the devices widget `EventlistAlarmsComponent`; vis-2 calls its widget "Alarms and events"
                name: t('EventlistAlarms'),
                description: t('descAlarms'),
                size: { width: 400, height: 300 },
                settings: alarmsSettings(t),
            };
        case 'eventlist-pdf':
            return {
                ...base,
                // the palette label of the vis-2 widget "PDF"
                name: t('pdf'),
                description: t('descPdf'),
                size: { width: 200, height: 100 },
                settings: pdfSettings(t),
            };
    }
}
