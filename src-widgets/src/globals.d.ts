declare global {
    interface Window {
        _localStorage?: Storage;
        _sessionStorage?: Storage;
    }

    declare module '*.svg';
    declare module '*.png';
    declare module '*.jpg';
    declare module '*.css';
}

export {};
