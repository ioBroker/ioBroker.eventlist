# Blockly blocks

Source of `admin/blockly.js`, the two blocks ioBroker.javascript's Blockly editor shows in its
`sendTo` category: `eventlist` adds an own event to the event list, `eventlist_delete` removes
events from it. **`admin/blockly.js` is generated - never edit it directly.**

```bash
npm run build:blockly   # type check + bundle into admin/blockly.js
```

`npm run build` runs it too, so a release always ships a bundle that matches this source.

The bundle stays committed: installations from GitHub do not run `prepublishOnly`, so the built file
has to be in the repository.

| file                      |                                                              |
|---------------------------|--------------------------------------------------------------|
| `blockly.ts`              | entry point, installs the words and the blocks               |
| `blocks/insert.ts`        | the `eventlist` block, generates the `insert` command        |
| `blocks/delete.ts`        | the `eventlist_delete` block, generates the `delete` command |
| `helpers.ts`              | the dropdowns, the log line and the generator registration   |
| `words.ts`, `i18n/*.json` | the words                                                    |

The block must be declared in `io-package.json` as `common.blockly: true`, otherwise the javascript
adapter never loads the file.

## Take the types from `blockly`, the runtime from `window`

`blockly` is a **dev** dependency - it contributes types and nothing else:

```ts
import type { Block } from 'blockly/core';

const Blockly = window.Blockly;
```

Never `import * as Blockly from 'blockly/core'` here. The editor loads this file long after it has
created its own Blockly instance, and an import would bundle a *second*, private one. The blocks
would register themselves on that private instance and stay invisible to the editor - with no error
anywhere.

The globals the editor provides (`window.Blockly` including its ioBroker extras `Words`, `Translate`
and `Sendto`, plus `window.main` and `window.systemLang`) are declared in `iobroker-blockly.d.ts`.

## Words

`i18n/*.json` holds one file per language, keyed by word. The field labels are the same words the
admin GUI uses, so they were taken from `src-admin/src/i18n` and the block reads in every language
exactly like the settings dialog does.

A language file is allowed to be incomplete: `Blockly.Translate` falls back to English for a word it
does not find. `uk` and `zh-cn` therefore only carry the words the adapter already had translated.

The help URL is not in there. It is a link, not a word, so `words.ts` sets it directly.

The words are bundled rather than fetched: the editor loads `admin/blockly.js` as a classic script
and `Blockly.Words` has to be filled before the block registers itself, so there is no point at which
the files could be loaded over the network.

## Generators and empty inputs

Blockly >= 10 looks generators up in `Blockly.JavaScript.forBlock`; registering on the plain slot is
not enough, because the editor migrates that slot before it loads any adapter's `blockly.js`.
`registerGenerator()` in `helpers.ts` handles both.

`valueToCode` returns an empty string for an unconnected input. The generator has to leave that part
out instead of emitting `event: ,`, which is a syntax error that takes the user's entire script down.
Only `event` and `id` really matter to the adapter; value and icon are optional.

For `eventlist_delete` an empty input is worse than a syntax error: the adapter deletes the **whole
list** for an empty filter (`if (!filter || filter === '*')`). A block that is set to "State ID or
time" but has nothing connected therefore emits a comment and no `sendTo` at all.
