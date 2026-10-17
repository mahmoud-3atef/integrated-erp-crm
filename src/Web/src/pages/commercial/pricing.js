import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../../app/theme';
import { Badge } from '../../components/ui';
import { useCommercialFormat } from './ProjectsPage';
const kindTone = { Package: 'success', Special: 'warning', Missing: 'danger' };
export const money = (value) => value === null || value === undefined ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** The package's monthly price: a fixed total, or "salary + fee" on Cost Plus. */
export function PackagePrice({ row }) {
    const { t } = useTranslation();
    return row.basis === 'FixedTotal' ? (_jsx(Typography, { component: "span", sx: { fontWeight: 800, color: tokens.navy800 }, children: money(row.totalPrice) })) : (_jsx(Typography, { component: "span", sx: { fontWeight: 800, color: tokens.navy800 }, children: t('commercial.prices.salaryPlus', { fee: money(row.serviceFee) }) }));
}
/** "Housing 200 · Transport 100" under a price, when the price has those parts. */
function PriceParts({ housing, transport }) {
    const { t } = useTranslation();
    const parts = [housing ? `${t('commercial.prices.col.housing')} ${money(housing)}` : null, transport ? `${t('commercial.prices.col.transport')} ${money(transport)}` : null].filter(Boolean);
    return parts.length ? _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, whiteSpace: 'nowrap' }, children: parts.join(' · ') }) : null;
}
/** Profession over nationality, in one cell. */
function Who({ profession, nationality }) {
    return (_jsxs(_Fragment, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600, color: tokens.navy800 }, children: profession ?? '—' }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: nationality ?? '—' })] }));
}
export function PriceKindBadge({ kind }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: kindTone[kind], children: t(`commercial.prices.kind.${kind}`) });
}
/** Packages (project × profession × nationality): price, its housing and transport parts, and the workers on it. */
export function PackagesTable({ rows, showProject }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { ar, date } = useCommercialFormat();
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [showProject && _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { children: t('commercial.prices.col.price') }), _jsx(TableCell, { children: t('commercial.prices.col.basis') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.onPackage') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.special') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.missing') }), _jsx(TableCell, { children: t('commercial.prices.col.since') })] }) }), _jsx(TableBody, { children: rows.map((r) => (_jsxs(TableRow, { hover: showProject, sx: { cursor: showProject ? 'pointer' : 'default' }, onClick: showProject ? () => navigate(`/commercial/projects/${r.projectId}?tab=packages`) : undefined, children: [showProject && (_jsxs(TableCell, { sx: { minWidth: 220 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: r.projectName }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: r.customerName ?? t('commercial.noCustomer') })] })), _jsx(TableCell, { children: _jsx(Who, { profession: ar ? r.professionAr : r.professionEn, nationality: ar ? r.nationalityAr : r.nationalityEn }) }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(PackagePrice, { row: r }), _jsx(PriceParts, { housing: r.housing, transport: r.transport })] }), _jsx(TableCell, { children: _jsx(Badge, { tone: r.basis === 'FixedTotal' ? 'primary' : 'info', children: t(`commercial.prices.basis.${r.basis}`) }) }), _jsx(TableCell, { align: "center", children: _jsx(Badge, { tone: "success", children: r.workers }) }), _jsx(TableCell, { align: "center", children: r.specialWorkers > 0 ? _jsx(Badge, { tone: "warning", children: r.specialWorkers }) : '—' }), _jsx(TableCell, { align: "center", children: r.missingWorkers > 0 ? _jsx(Badge, { tone: "danger", children: r.missingWorkers }) : '—' }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(r.since) })] }, r.id))) })] }) }));
}
/** Workers' current prices, as the old "تحديث سعر الخدمة" page, with how each compares to its package. */
export function WorkerPricesTable({ rows, showProject }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { ar, date } = useCommercialFormat();
    return (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), showProject && _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.salary') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.servicePrice') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.packagePrice') }), _jsx(TableCell, { align: "center", children: t('commercial.prices.col.difference') }), _jsx(TableCell, { children: t('commercial.prices.col.kind') }), _jsx(TableCell, { children: t('commercial.prices.col.workStart') })] }) }), _jsx(TableBody, { children: rows.map((w) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${w.workerId}`), children: [_jsxs(TableCell, { sx: { minWidth: 180 }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: w.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: w.workerNo })] }), showProject && _jsx(TableCell, { sx: { minWidth: 180 }, children: w.projectName }), _jsx(TableCell, { children: _jsx(Who, { profession: ar ? w.professionAr : w.professionEn, nationality: ar ? w.nationalityAr : w.nationalityEn }) }), _jsx(TableCell, { align: "center", children: money(w.salary) }), _jsxs(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: [w.fromWorkerDefault ? (_jsx(Tooltip, { title: t('commercial.prices.fromWorkerDefault'), children: _jsx(Box, { component: "span", sx: { borderBottom: `1px dashed ${tokens.gray500}` }, children: money(w.servicePrice) }) })) : (money(w.servicePrice)), _jsx(PriceParts, { housing: w.housing, transport: w.transport })] }), _jsx(TableCell, { align: "center", children: money(w.packagePrice) }), _jsx(TableCell, { align: "center", dir: "ltr", sx: { fontWeight: 700, color: !w.difference ? tokens.gray500 : w.difference > 0 ? '#1f9d55' : tokens.danger }, children: w.difference ? `${w.difference > 0 ? '+' : ''}${money(w.difference)}` : '—' }), _jsx(TableCell, { children: _jsx(PriceKindBadge, { kind: w.kind }) }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 12.5, textAlign: 'start' }, children: w.workStartNo ?? '—' }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: date(w.startedOn) })] })] }, w.id))) })] }) }));
}
