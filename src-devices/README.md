# Device manager widget

The widget the ioBroker device manager shows for this adapter. It is built with Vite and module
federation into `admin/dm-widgets/customDevices.js` and announced in `io-package.json` under
`common.deviceWidgets`.

```bash
npm run build:devices   # bundle + copy into admin/dm-widgets/
```

`npm run build` runs it too.

| widget | |
|---|---|
| `EventlistLastEventComponent` | tile with the newest event, the click opens the whole list in a dialog |

## Where the data comes from

The adapter already writes the list ready for display into one single state:

```
eventlist.<instance>.eventJSONList
```

It holds a JSON array, newest event first, with the time, the text, the value and the duration
already formatted, plus the icon and the colour of the event. The widget therefore subscribes to
that one state and needs neither a message to the adapter nor a lookup of objects. The optional
filter of the widget compares against the `id` of an entry, which is the state ID the event belongs
to.

## Take the runtime from the host

`WidgetGeneric`, React and MUI come from the device manager through `@iobroker/dm-widgets`:

```ts
import WidgetGeneric, { React, MuiMaterial } from '@iobroker/dm-widgets';

const Box = MuiMaterial?.Box;
```

Never import `react` or `@mui/material` directly here. The host loads this bundle into its own page,
and a second React or MUI instance would break the hooks and the theme. All those packages are dev
dependencies for that reason: they contribute types, the host provides the runtime.

## The tile and the dialog

`hasTileAction()` tells the host that the tile reacts to a click, `onTileClick()` opens the dialog.
The dialog is rendered by the widget itself, from the bridged MUI components, and is part of both
tile layouts, `renderCompact()` and `renderWideTall()`.

## Words

`src/i18n/*.json` holds one file per language, keyed by word, and they are copied to
`admin/dm-widgets/i18n` by `tasks.js`. Most words already existed translated in the vis-2 widgets
and in the admin GUI of the adapter and were taken from there, so the widget reads in every language
like the rest of the adapter. Ukrainian only has what those sources had; the rest falls back to
English.

## Not included

There is no standalone dev harness here. `ioBroker.ping` carries `index.tsx`, `App.tsx` and a
`dev-shim.ts` that fake the host so the widget can be opened with `npm start`. This widget is
developed against the real device manager instead.
