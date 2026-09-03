import '@mui/material/Button';

declare global {
    interface Window {
        /** Sentry DSN of this GUI */
        sentryDSN: string;
    }
}

declare module '@mui/material/Button' {
    interface ButtonPropsColorOverrides {
        grey: true;
    }
}

export {};
