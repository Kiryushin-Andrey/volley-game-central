// Utility to initialize application theme based on environment (Telegram vs browser)
// Applies Telegram theme variables when inside Telegram WebApp, otherwise
// uses system dark/light theme via prefers-color-scheme with live updates.

export type ThemeCleanup = () => void;

export function initAppTheme(): ThemeCleanup {
    const telegramWebApp = (window as any)?.Telegram?.WebApp;
    const isTelegramWebApp = Boolean(telegramWebApp?.initDataUnsafe?.user);

    if (isTelegramWebApp) {
        const p = telegramWebApp.themeParams || {};
        document.documentElement.style.setProperty('--tg-theme-bg-color', p.bg_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-text-color', p.text_color || '#000000');
        document.documentElement.style.setProperty('--tg-theme-hint-color', p.hint_color || '#999999');
        document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', p.secondary_bg_color || '#f8f9fa');
        document.documentElement.style.setProperty('--tg-theme-link-color', p.link_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-theme-button-color', p.button_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', p.button_text_color || '#ffffff');

        // Optional: update on Telegram theme changes
        const onThemeChanged = () => {
            const p = telegramWebApp.themeParams || {};
            document.documentElement.style.setProperty('--tg-theme-bg-color', p.bg_color || '#ffffff');
            document.documentElement.style.setProperty('--tg-theme-text-color', p.text_color || '#000000');
            document.documentElement.style.setProperty('--tg-theme-hint-color', p.hint_color || '#999999');
            document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', p.secondary_bg_color || '#f8f9fa');
            document.documentElement.style.setProperty('--tg-theme-link-color', p.link_color || '#2481cc');
            document.documentElement.style.setProperty('--tg-theme-button-color', p.button_color || '#2481cc');
            document.documentElement.style.setProperty('--tg-theme-button-text-color', p.button_text_color || '#ffffff');
        };

        try {
            telegramWebApp.onEvent?.('themeChanged', onThemeChanged);
            return () => telegramWebApp.offEvent?.('themeChanged', onThemeChanged);
        } catch {
            return () => { };
        }
    }

    // Browser mode: apply system theme and listen for changes
    const applySystemTheme = (isDark: boolean) => {
        if (isDark) {
            document.documentElement.style.setProperty('--tg-theme-bg-color', '#121212');
            document.documentElement.style.setProperty('--tg-theme-text-color', '#e5e7eb');
            document.documentElement.style.setProperty('--tg-theme-hint-color', '#9aa0a6');
            document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', '#1e1e1e');
            document.documentElement.style.setProperty('--tg-theme-link-color', '#62aef7');
            document.documentElement.style.setProperty('--tg-theme-button-color', '#2a85ff');
            document.documentElement.style.setProperty('--tg-theme-button-text-color', '#ffffff');
        } else {
            document.documentElement.style.setProperty('--tg-theme-bg-color', '#ffffff');
            document.documentElement.style.setProperty('--tg-theme-text-color', '#111827');
            document.documentElement.style.setProperty('--tg-theme-hint-color', '#6b7280');
            document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', '#f8f9fa');
            document.documentElement.style.setProperty('--tg-theme-link-color', '#2481cc');
            document.documentElement.style.setProperty('--tg-theme-button-color', '#2481cc');
            document.documentElement.style.setProperty('--tg-theme-button-text-color', '#ffffff');
        }
    };

    const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
    let cleanup: ThemeCleanup = () => { };

    if (mql) {
        // Initial apply
        applySystemTheme(mql.matches);

        // Change listener
        const changeHandler = (ev: MediaQueryListEvent | MediaQueryList) => {
            const matches = 'matches' in ev ? ev.matches : mql.matches;
            applySystemTheme(matches);
        };

        try {
            mql.addEventListener('change', changeHandler as EventListener);
            cleanup = () => mql.removeEventListener('change', changeHandler as EventListener);
        } catch {
            // Safari < 14 fallback
            // @ts-ignore
            mql.addListener(changeHandler);
            cleanup = () => {
                // @ts-ignore
                mql.removeListener(changeHandler);
            };
        }
    } else {
        // Fallback to light theme
        applySystemTheme(false);
    }

    return cleanup;
}
