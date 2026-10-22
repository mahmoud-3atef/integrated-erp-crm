import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';
const storageKey = 'erp.language';
export const directionOf = (language) => (language === 'ar' ? 'rtl' : 'ltr');
function savedLanguage() {
    try {
        const value = localStorage.getItem(storageKey);
        return value === 'en' ? 'en' : 'ar';
    }
    catch {
        return 'ar';
    }
}
/** Updates <html lang/dir> so the whole page (including native controls) follows the language. */
export function applyLanguage(language) {
    document.documentElement.lang = language;
    document.documentElement.dir = directionOf(language);
    try {
        localStorage.setItem(storageKey, language);
    }
    catch {
        // Storage may be blocked (private window); the choice then lasts for this page only.
    }
}
void i18n.use(initReactI18next).init({
    resources: { ar: { translation: ar }, en: { translation: en } },
    lng: savedLanguage(),
    fallbackLng: 'ar',
    interpolation: { escapeValue: false },
    nsSeparator: false,
});
applyLanguage(i18n.language);
export default i18n;
