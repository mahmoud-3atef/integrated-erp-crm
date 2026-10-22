import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { HrStatusBadge, hr } from '../../components/hr/Hr';
// What the settlement screens share: the status badge (label, colour and tint: never colour alone) and the money.
const looks = {
    Draft: { color: '#475569', tint: '#F1F5F9' },
    InApproval: { color: hr.primary, tint: '#EFF6FF' },
    Returned: { color: hr.warning, tint: '#FFFBEB' },
    Approved: { color: '#7C3AED', tint: '#F5F3FF' },
    Paid: { color: hr.success, tint: '#ECFDF5' },
    Cancelled: { color: '#64748B', tint: '#F1F5F9' },
};
export function SettlementStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(HrStatusBadge, { label: t(`settlements.status.${status}`), ...looks[status] });
}
export const sar = (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function Money({ value, strong, muted }) {
    const { t } = useTranslation();
    return (_jsxs(Box, { component: "span", sx: { fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : undefined, whiteSpace: 'nowrap' }, children: [_jsx("bdi", { children: sar(value) }), ' ', _jsx(Box, { component: "span", sx: { fontSize: '0.8em', opacity: muted ? 0.75 : 1, color: muted ? undefined : hr.textMuted, fontWeight: 500 }, children: t('settlements.sar') })] }));
}
/** «3 سنوات و4 أشهر» / «3 years 4 months» from the years of service (the Arabic forms as the staff file's service). */
export function useYears() {
    const { i18n } = useTranslation();
    return (years) => {
        const months = Math.floor(years * 12 + 1e-6);
        const y = Math.floor(months / 12);
        const m = months % 12;
        if (i18n.language === 'ar') {
            const ys = y === 0 ? '' : y === 1 ? 'سنة' : y === 2 ? 'سنتان' : y <= 10 ? `${y} سنوات` : `${y} سنة`;
            const ms = m === 0 ? '' : m === 1 ? 'شهر' : m === 2 ? 'شهران' : m <= 10 ? `${m} أشهر` : `${m} شهرًا`;
            return [ys, ms].filter(Boolean).join(' و') || 'أقل من شهر';
        }
        return [y ? `${y} year${y > 1 ? 's' : ''}` : '', m ? `${m} month${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ') || 'less than a month';
    };
}
