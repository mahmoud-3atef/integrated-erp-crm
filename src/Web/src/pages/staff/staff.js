import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
import { HrStatusBadge, hr } from '../../components/hr/Hr';
// The staff's states as the HR screens show them (label, colour and tint: never colour alone).
export const staffStatusLook = {
    Active: { color: hr.success, tint: '#D1FAE5' },
    Probation: { color: hr.primary, tint: '#EFF6FF' },
    Suspended: { color: hr.danger, tint: '#FEE2E2' },
    Left: { color: '#475569', tint: '#F1F5F9' },
};
export function StaffStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(HrStatusBadge, { label: t(`staff.status.${status}`), ...staffStatusLook[status] });
}
/** «سنتان و3 أشهر» / «2 years 3 months» from a date to today. */
export function useService() {
    const { i18n } = useTranslation();
    return (from) => {
        if (!from)
            return null;
        const start = new Date(`${from}T00:00:00`);
        const now = new Date();
        let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        if (now.getDate() < start.getDate())
            months -= 1;
        if (months < 0)
            return null;
        const years = Math.floor(months / 12);
        const rest = months % 12;
        if (i18n.language === 'ar') {
            const y = years === 0 ? '' : years === 1 ? 'سنة' : years === 2 ? 'سنتان' : years <= 10 ? `${years} سنوات` : `${years} سنة`;
            const m = rest === 0 ? '' : rest === 1 ? 'شهر' : rest === 2 ? 'شهران' : rest <= 10 ? `${rest} أشهر` : `${rest} شهرًا`;
            return [y, m].filter(Boolean).join(' و') || 'أقل من شهر';
        }
        const y = years ? `${years} year${years > 1 ? 's' : ''}` : '';
        const m = rest ? `${rest} month${rest > 1 ? 's' : ''}` : '';
        return [y, m].filter(Boolean).join(' ') || 'less than a month';
    };
}
/** Days from today to a date (negative: past). */
export const daysUntil = (iso) => (iso ? Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(new Date().toISOString().slice(0, 10))) / 86_400_000) : null);
