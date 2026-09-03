# Admin/Web GUI of ioBroker.eventlist

The GUI is written in TypeScript (React 19, MUI 9, `@iobroker/gui-components`) and is built with [Vite](https://vitejs.dev/).

## Available Scripts

In this directory, you can run:

### `npm start`

Runs the app in the development mode on [http://localhost:3000](http://localhost:3000).
The socket connection is made to the admin instance on `localhost:8081`.

### `npm run check`

Type-checks the sources with `tsc`.

### `npm run lint`

Lints the sources with ESLint.

### `npm run build`

Type-checks and builds the app for production to the `build` folder.

The result is copied by `node tasks.js` (in the root directory) to `admin/` and `www/`.
