# Custom settings of a state

The settings the admin shows in the custom tab of an object - the tab behind the gear symbol in the
objects list. It is a JSON config custom component, built with Vite and module federation into
`admin/custom/customComponents.js` and announced in `admin/jsonCustom.json`.

```bash
npm run build:custom   # bundle + copy into admin/custom/
```

`npm run build` runs it too, after the admin GUI: the admin build empties `admin/`.

## What it offers

The same settings the old `admin/custom_m.html` had, before the adapter moved everything into its
own instance settings:

| setting | |
|---|---|
| event text | with the patterns, or `default` for the text from the instance settings |
| only changes | an event only when the value really changes |
| TRUE / FALSE | text and colour of both values, boolean states only |

Everything else - icons, messengers, the standing messages - stays in the instance settings, where
there is room for it. Both ways write into the same place, `common.custom.<eventlist.X>`, so they
can be mixed.

## How it is wired

```jsonc
// admin/jsonCustom.json
{
    "type": "panel",
    "items": {
        "_settings": {
            "type": "custom",
            "i18n": true,                 // loads admin/custom/i18n/<lang>.json
            "url": "custom/customComponents.js",
            "name": "EventlistComponentsSet/Components/EventlistCustom",
            "guiApi": 2                   // React 19 / MUI 9 generation
        }
    }
}
```

`name` is `<federation name>/<exposed file>/<component>`; the first part has to match the `name` in
`vite.config.ts`, otherwise two components of different adapters collide at runtime. The admin reads
`mf-manifest.json` next to the bundle to see which component library it was built against, so both
the manifest and the `assets` folder have to be copied along - `tasks.js` does that.

The words come from the admin GUI: `tasks.js` copies `src-admin/src/i18n/*.json` into
`admin/custom/i18n/`, so both dialogs use the same labels and nothing has to be translated twice.
