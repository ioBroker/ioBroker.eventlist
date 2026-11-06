/**
 * The words of the web components, in the languages of ioBroker.
 *
 * Most of them are those of the native widgets: `src-widgets/src/i18n/<lang>.json` (vis-2, keys without prefix) and
 * `src-devices/src/i18n/<lang>.json` (devices, keys with `evl_`). `vite.config.ts` picks them at build time - the
 * words the elements show into the module (`__EVENTLIST_WORDS__`, see `i18n.ts`), those of the manifests into the
 * manifest files - and stops the build if one is missing in a language. Only the words the native widgets do not
 * have are here.
 *
 * The elements import only the types of this file, so its texts are not bundled into the modules: each module gets
 * the words of `COMPONENT_WORDS` it shows.
 */

// with the extension: `vite.config.ts` imports this file, and Vite may load its config natively
import type { ComponentName } from './constants.ts';

export const LANGUAGES = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'] as const;

export type Language = (typeof LANGUAGES)[number];

/** One text in every language */
export type Translations = Record<Language, string>;

/** The words of the hint shown while the instance is missing */
export const HINT_WORDS = ['chooseInstance', 'noInstance'] as const;

/** The words of the table of events */
export const EVENT_TABLE_WORDS = [
    'header_time',
    'header_event',
    'header_value',
    'header_duration',
    'no_events',
] as const;

/** The names of the levels of the adapter */
export const LEVEL_WORDS = ['level_fatal', 'level_alarm', 'level_warning', 'level_info'] as const;

/** The words of an age like "5 min" (`ageText()`) */
export const AGE_WORDS = ['just_now', 'minutes', 'hours', 'days'] as const;

/** The words of the table of standing alarms */
export const MESSAGE_TABLE_WORDS = [
    ...LEVEL_WORDS,
    ...AGE_WORDS,
    'header_level',
    'header_state',
    'header_since',
    'header_message',
    'header_value',
    'header_count',
    'header_group',
    'no_messages',
    'tooltip_ack',
] as const;

/** The words of the table of alarm cycles */
export const JOURNAL_TABLE_WORDS = [
    ...LEVEL_WORDS,
    'header_came',
    'header_level',
    'header_state',
    'header_message',
    'header_gone',
    'no_journal',
    'cycle_ACTIVE',
    'cycle_ACK',
    'cycle_CLEARED',
    'cycle_CLOSED',
] as const;

/** The words of the panel with the counters and the three tables */
export const ALARMS_PANEL_WORDS = [
    ...EVENT_TABLE_WORDS,
    ...MESSAGE_TABLE_WORDS,
    ...JOURNAL_TABLE_WORDS,
    'unacknowledged',
    'active',
    'events',
    'standing_messages',
    'alarm_journal',
    'export_csv',
] as const;

/**
 * The words each element shows. The build puts only these into its module; `getWords()` takes only these, so a
 * word that is missing here does not compile
 */
export const COMPONENT_WORDS = {
    'eventlist-events': [...HINT_WORDS, ...EVENT_TABLE_WORDS, 'sample_event'],
    'eventlist-last-event': [...HINT_WORDS, ...EVENT_TABLE_WORDS, 'sample_event', 'evl_title', 'evl_open_hint'],
    'eventlist-alarms': [
        ...HINT_WORDS,
        ...ALARMS_PANEL_WORDS,
        'sample_message',
        'evl_alarms_title',
        'evl_open_alarms_hint',
        'evl_more_alarms',
        'evl_unacknowledged_count',
    ],
    'eventlist-pdf': [...HINT_WORDS, 'pdf_generating', 'instance_not_running', 'pdfFailed'],
} as const satisfies Record<ComponentName, readonly string[]>;

/** The words one element shows */
export type ComponentWord<N extends ComponentName> = (typeof COMPONENT_WORDS)[N][number];

/** A word an element shows: one of the native widgets or one of `OWN_ELEMENT_WORDS` */
export type ElementWord = ComponentWord<ComponentName>;

export type EventTableWord = (typeof EVENT_TABLE_WORDS)[number];
export type MessageTableWord = (typeof MESSAGE_TABLE_WORDS)[number];
export type JournalTableWord = (typeof JOURNAL_TABLE_WORDS)[number];
export type AlarmsPanelWord = (typeof ALARMS_PANEL_WORDS)[number];
export type AgeWord = (typeof AGE_WORDS)[number];
export type HintWord = (typeof HINT_WORDS)[number];

/** Words the elements show that the native widgets do not have */
export const OWN_ELEMENT_WORDS = {
    chooseInstance: {
        en: 'Choose an instance of the event list in the settings',
        de: 'Instanz der Ereignisliste in den Einstellungen wählen',
        ru: 'Выберите экземпляр списка событий в настройках',
        pt: 'Escolha uma instância da lista de eventos nas configurações',
        nl: 'Kies een instantie van de gebeurtenissenlijst in de instellingen',
        fr: 'Choisissez une instance de la liste des événements dans les paramètres',
        it: "Scegli un'istanza dell'elenco eventi nelle impostazioni",
        es: 'Elija una instancia de la lista de eventos en la configuración',
        pl: 'Wybierz instancję listy zdarzeń w ustawieniach',
        uk: 'Виберіть екземпляр списку подій у налаштуваннях',
        'zh-cn': '请在设置中选择事件列表的实例',
    },
    noInstance: {
        en: 'Instance not found',
        de: 'Instanz nicht gefunden',
        ru: 'Экземпляр не найден',
        pt: 'Instância não encontrada',
        nl: 'Instantie niet gevonden',
        fr: 'Instance introuvable',
        it: 'Istanza non trovata',
        es: 'Instancia no encontrada',
        pl: 'Nie znaleziono instancji',
        uk: 'Екземпляр не знайдено',
        'zh-cn': '未找到实例',
    },
    pdfFailed: {
        en: 'The PDF was not created',
        de: 'Das PDF wurde nicht erzeugt',
        ru: 'PDF не был создан',
        pt: 'O PDF não foi criado',
        nl: 'De PDF is niet gemaakt',
        fr: "Le PDF n'a pas été créé",
        it: 'Il PDF non è stato creato',
        es: 'No se ha creado el PDF',
        pl: 'Nie utworzono pliku PDF',
        uk: 'PDF не створено',
        'zh-cn': '未能生成 PDF',
    },
} satisfies Record<string, Translations>;

/** Words of the manifests that the native widgets do not have */
export const OWN_MANIFEST_WORDS = {
    descEvents: {
        en: 'The event list as a table',
        de: 'Die Ereignisliste als Tabelle',
        ru: 'Список событий в виде таблицы',
        pt: 'A lista de eventos como tabela',
        nl: 'De gebeurtenissenlijst als tabel',
        fr: 'La liste des événements sous forme de tableau',
        it: "L'elenco eventi come tabella",
        es: 'La lista de eventos como tabla',
        pl: 'Lista zdarzeń w postaci tabeli',
        uk: 'Список подій у вигляді таблиці',
        'zh-cn': '以表格形式显示事件列表',
    },
    descLastEvent: {
        en: 'The newest event, a click shows the whole list',
        de: 'Das neueste Ereignis, ein Klick zeigt die ganze Liste',
        ru: 'Последнее событие, по клику открывается весь список',
        pt: 'O evento mais recente, um clique mostra a lista completa',
        nl: 'De nieuwste gebeurtenis, een klik toont de hele lijst',
        fr: 'Le dernier événement, un clic affiche la liste entière',
        it: "L'evento più recente, un clic mostra l'intero elenco",
        es: 'El evento más reciente, un clic muestra la lista completa',
        pl: 'Najnowsze zdarzenie, kliknięcie pokazuje całą listę',
        uk: 'Найновіша подія, клік показує весь список',
        'zh-cn': '最新事件，点击显示整个列表',
    },
    descAlarms: {
        en: 'The standing alarms, the events and the alarm journal - in a small box the worst alarm, a click shows the lists',
        de: 'Die anstehenden Alarme, die Ereignisse und das Alarmjournal - in einem kleinen Feld der schlimmste Alarm, ein Klick zeigt die Listen',
        ru: 'Активные аварии, события и журнал аварий - в маленьком поле самая тяжёлая авария, по клику открываются списки',
        pt: 'Os alarmes ativos, os eventos e o diário de alarmes - numa caixa pequena o alarme mais grave, um clique mostra as listas',
        nl: 'De openstaande alarmen, de gebeurtenissen en het alarmjournaal - in een klein vak het ernstigste alarm, een klik toont de lijsten',
        fr: "Les alarmes présentes, les événements et le journal des alarmes - dans une petite case l'alarme la plus grave, un clic affiche les listes",
        it: "Gli allarmi attivi, gli eventi e il giornale degli allarmi - in un riquadro piccolo l'allarme più grave, un clic mostra gli elenchi",
        es: 'Las alarmas activas, los eventos y el diario de alarmas - en un recuadro pequeño la alarma más grave, un clic muestra las listas',
        pl: 'Aktywne alarmy, zdarzenia i dziennik alarmów - w małym polu najpoważniejszy alarm, kliknięcie pokazuje listy',
        uk: 'Активні аварії, події та журнал аварій - у малому полі найважча аварія, клік показує списки',
        'zh-cn': '存在的报警、事件和报警日志 - 小区域中显示最严重的报警，点击显示列表',
    },
    descPdf: {
        en: 'Creates the event list as a PDF file and opens it',
        de: 'Erzeugt die Ereignisliste als PDF-Datei und öffnet sie',
        ru: 'Создаёт список событий в виде PDF-файла и открывает его',
        pt: 'Cria a lista de eventos como ficheiro PDF e abre-o',
        nl: 'Maakt de gebeurtenissenlijst als PDF-bestand en opent het',
        fr: "Crée la liste des événements sous forme de fichier PDF et l'ouvre",
        it: "Crea l'elenco eventi come file PDF e lo apre",
        es: 'Crea la lista de eventos como archivo PDF y lo abre',
        pl: 'Tworzy listę zdarzeń jako plik PDF i otwiera go',
        uk: 'Створює список подій у вигляді PDF-файлу та відкриває його',
        'zh-cn': '将事件列表生成为 PDF 文件并打开',
    },
    headerTextHelp: {
        en: 'Empty: the default title',
        de: 'Leer: der Standardtitel',
        ru: 'Пусто: стандартный заголовок',
        pt: 'Vazio: o título predefinido',
        nl: 'Leeg: de standaardtitel',
        fr: 'Vide : le titre par défaut',
        it: 'Vuoto: il titolo predefinito',
        es: 'Vacío: el título predeterminado',
        pl: 'Puste: domyślny tytuł',
        uk: 'Порожньо: стандартний заголовок',
        'zh-cn': '为空时使用默认标题',
    },
    layout: {
        en: 'Layout',
        de: 'Darstellung',
        ru: 'Вид',
        pt: 'Disposição',
        nl: 'Weergave',
        fr: 'Disposition',
        it: 'Disposizione',
        es: 'Disposición',
        pl: 'Układ',
        uk: 'Вигляд',
        'zh-cn': '布局',
    },
    layoutHelp: {
        en: 'Automatic: the tile in a small box, the lists from 360 × 240 px on',
        de: 'Automatisch: die Kachel in einem kleinen Feld, die Listen ab 360 × 240 px',
        ru: 'Автоматически: плитка в маленьком поле, списки начиная с 360 × 240 px',
        pt: 'Automático: o mosaico numa caixa pequena, as listas a partir de 360 × 240 px',
        nl: 'Automatisch: de tegel in een klein vak, de lijsten vanaf 360 × 240 px',
        fr: 'Automatique : la tuile dans une petite case, les listes à partir de 360 × 240 px',
        it: 'Automatico: il riquadro in uno spazio piccolo, gli elenchi da 360 × 240 px',
        es: 'Automático: el mosaico en un recuadro pequeño, las listas a partir de 360 × 240 px',
        pl: 'Automatycznie: kafelek w małym polu, listy od 360 × 240 px',
        uk: 'Автоматично: плитка в малому полі, списки від 360 × 240 px',
        'zh-cn': '自动：小区域显示磁贴，360 × 240 px 起显示列表',
    },
    layoutAuto: {
        en: 'Automatic, by the size',
        de: 'Automatisch, nach der Größe',
        ru: 'Автоматически, по размеру',
        pt: 'Automático, pelo tamanho',
        nl: 'Automatisch, naar grootte',
        fr: 'Automatique, selon la taille',
        it: 'Automatico, in base alla dimensione',
        es: 'Automático, según el tamaño',
        pl: 'Automatycznie, według rozmiaru',
        uk: 'Автоматично, за розміром',
        'zh-cn': '自动（按尺寸）',
    },
    layoutTile: {
        en: 'Tile with the worst alarm',
        de: 'Kachel mit dem schlimmsten Alarm',
        ru: 'Плитка с самой тяжёлой аварией',
        pt: 'Mosaico com o alarme mais grave',
        nl: 'Tegel met het ernstigste alarm',
        fr: "Tuile avec l'alarme la plus grave",
        it: "Riquadro con l'allarme più grave",
        es: 'Mosaico con la alarma más grave',
        pl: 'Kafelek z najpoważniejszym alarmem',
        uk: 'Плитка з найважчою аварією',
        'zh-cn': '显示最严重报警的磁贴',
    },
    layoutPanel: {
        en: 'The lists',
        de: 'Die Listen',
        ru: 'Списки',
        pt: 'As listas',
        nl: 'De lijsten',
        fr: 'Les listes',
        it: 'Gli elenchi',
        es: 'Las listas',
        pl: 'Listy',
        uk: 'Списки',
        'zh-cn': '列表',
    },
} satisfies Record<string, Translations>;

/** A word of a manifest: one of `OWN_MANIFEST_WORDS` or a key of the i18n files of the native widgets */
export type ManifestWord = keyof typeof OWN_MANIFEST_WORDS | (string & {});
