# vis-2 widgets

The React widgets for vis-2. They are built with Vite and module federation into
`widgets/eventlist/customWidgets.js`, which `io-package.json` announces in `common.visWidgets`.

```bash
npm run build:widgets   # type check + bundle + copy into widgets/
```

`npm run build` runs it too.

| widget | id | |
|---|---|---|
| `Events.tsx` | `tplEventlist` | the event list as a table |
| `PdfButton.tsx` | `tplEventlistButton` | triggers the PDF and opens it |

## Why the ids are the ones of the old widgets

`widgets/eventlist.html` still carries the vis-1 versions of both widgets as EJS templates, and it has
to: vis-1 cannot load React widgets. vis-2 reads both sets and prefers the React widget whenever one
exists with the same `tpl` id, so the two live side by side and a project keeps working after moving
from vis-1 to vis-2. That only holds as long as the ids stay `tplEventlist` and `tplEventlistButton`
and the widget set stays `eventlist`.

The field names are new all the same (`showTime` instead of `showEventTime` and so on) - vis-2 does
not migrate the old data, so a widget placed in vis-1 shows its defaults when it is opened in vis-2.

## Words

`src/i18n/*.json` holds one file per language, keyed by word, and `translations.ts` adds the prefix
`eventlist_` that `Generic.getI18nPrefix()` announces. Most words already existed translated in the
`systemDictionary` of `widgets/eventlist.html`, so they were taken from there and the widget reads in
every language exactly like the vis-1 one. Ukrainian has no words there, so it falls back to English.

## Take the runtime from the host

`window.visRxWidget` is the base class of every widget and comes from the vis-2 runtime.
`src/Generic.tsx` reads it from `window`; it must not be imported, otherwise the widget would bring
its own copy and vis-2 would not recognise the class.

React, MUI and emotion are shared modules, declared through `moduleFederationShared()` in
`vite.config.ts`. They are dev dependencies here: the host provides them at runtime.
