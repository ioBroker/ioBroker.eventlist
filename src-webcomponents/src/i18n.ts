/**
 * The words the elements show, in the language of the system.
 *
 * They are picked at build time from the i18n files of the native widgets and from `OWN_ELEMENT_WORDS`
 * (`words.ts`) and replace `__EVENTLIST_WORDS__` - see `vite.config.ts`. Each module gets the words of its element
 * only (`COMPONENT_WORDS`); only the types are imported from `words.ts`, so nothing else of it is bundled.
 */
import type { ComponentName } from './constants';
import type { ComponentWord, ElementWord } from './words';

declare const __EVENTLIST_WORDS__: Record<string, Record<string, string>>;

const WORDS = __EVENTLIST_WORDS__;

/** Gives a word in the language of the system */
export type Word<K extends ElementWord> = (key: K) => string;

/**
 * The words of one element in the language of the system, English if there is none in it
 *
 * @param lang the language of the ioBroker system
 */
export function getWords<N extends ComponentName>(lang: string): Word<ComponentWord<N>> {
    return key => WORDS[lang]?.[key] || WORDS.en?.[key] || key;
}
