import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/gui-components/modulefederation.admin.config';
import pack from './package.json';

const shared = moduleFederationShared(pack);
delete shared['@iobroker/json-config'];

const config = {
    plugins: [
        federation({
            // the manifest tells the admin which component library this was built against
            manifest: true,
            // Must be unique per component set and match the first segment of `name` in
            // `admin/jsonCustom.json` - two components sharing this name collide at runtime.
            name: 'EventlistComponentsSet',
            filename: 'customComponents.js',
            exposes: {
                './Components': './src/Components.tsx',
            },
            remotes: {},
            // React, MUI, the GUI components and json-config come from the admin at runtime
            shared,
            dts: false,
        }),
        react(),
        commonjs(),
    ],
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        port: 3001,
    },
    base: './',
    build: {
        target: 'chrome89',
        outDir: './build',
        rollupOptions: {
            onwarn(warning: { code: string }, warn: (warning: { code: string }) => void): void {
                // Suppress "Module level directives cause errors when bundled" warnings
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
                    return;
                }
                warn(warning);
            },
        },
    },
};

export default config;
