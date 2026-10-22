import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Box, Button, ButtonBase, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { invoiceCheckResults, workforceApi } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';
const resultTone = {
    Match: 'success',
    DaysDiff: 'warning',
    PriceDiff: 'warning',
    DaysAndPriceDiff: 'danger',
    NotInLedger: 'danger',
    NotInvoiced: 'danger',
    ProjectNotInvoiced: 'neutral',
};
const num = (value) => (value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 }));
/**
 * The attendance check: each line of the old system's project invoices against the days and price of the period
 * ledger for the same worker, project and invoice period, month by month, with the match rate.
 */
export function InvoiceCheckPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const month = params.get('month') ?? '';
    const result = params.get('result') ?? '';
    const search = params.get('q') ?? '';
    const page = Number(params.get('page') ?? '1');
    const [text, setText] = useState(search);
    const [pageSize, setPageSize] = useState(50);
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const update = (changes) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!('page' in changes)) {
            next.delete('page');
        }
        setParams(next, { replace: true });
    };
    useEffect(() => {
        let cancelled = false;
        setBusy(true);
        workforceApi
            .invoiceCheck({ month, result, search, page, pageSize })
            .then((value) => !cancelled && (setData(value), setError(null)))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [month, result, search, page, pageSize]);
    const monthName = (value) => new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
    const shortDate = (value) => value.slice(5).replace('-', '/');
    const counted = data ? Object.entries(data.counts).filter(([k]) => k !== 'ProjectNotInvoiced').reduce((a, [, v]) => a + v, 0) : 0;
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('workforce.invoiceCheck.title'), subtitle: t('workforce.invoiceCheck.intro') }), _jsxs(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: 2 }, children: [t('workforce.invoiceCheck.how'), data?.builtAt && (_jsx(Box, { component: "span", sx: { display: 'block', mt: 0.5, fontSize: 12.5 }, children: t('workforce.invoiceCheck.builtAt', { at: new Date(data.builtAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) }) }))] }), _jsx(ErrorMessage, { messageKey: error }), data && data.months.length > 1 && (_jsx(Stack, { direction: "row", sx: { gap: 1, mb: 2, flexWrap: 'wrap' }, children: data.months.map((m) => (_jsx(Button, { size: "small", variant: m === data.month ? 'contained' : 'outlined', onClick: () => update({ month: m, result: null }), children: monthName(m) }, m))) })), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr' }, gap: 1.5, mb: 2 }, children: [_jsxs(Box, { sx: { p: 2, borderRadius: `${tokens.radiusLg}px`, bgcolor: tokens.navy700, color: '#fff', boxShadow: tokens.shadowSm }, children: [_jsx(Typography, { sx: { fontSize: 13, opacity: 0.85 }, children: data?.month ? t('workforce.invoiceCheck.rateOf', { month: monthName(data.month) }) : t('workforce.invoiceCheck.rate') }), _jsx(Typography, { sx: { fontSize: 40, fontWeight: 800, lineHeight: 1.2 }, children: data ? `${data.matchRate.toFixed(1)}%` : '—' }), _jsx(Typography, { sx: { fontSize: 12.5, opacity: 0.85 }, children: t('workforce.invoiceCheck.rateDetail', { match: data?.counts.Match ?? 0, total: counted, invoices: data?.invoices ?? 0 }) }), _jsx(Typography, { sx: { fontSize: 12, mt: 0.5, color: (data?.matchRate ?? 0) >= 99 ? '#9be7b7' : '#ffd88a' }, children: t('workforce.invoiceCheck.target') })] }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25 }, children: ['', ...invoiceCheckResults].map((r) => {
                            const active = result === r;
                            const count = r ? data?.counts[r] ?? 0 : counted + (data?.counts.ProjectNotInvoiced ?? 0);
                            return (_jsxs(ButtonBase, { onClick: () => update({ result: r || null }), sx: {
                                    display: 'block',
                                    textAlign: 'start',
                                    p: 1.5,
                                    borderRadius: `${tokens.radius}px`,
                                    bgcolor: active ? tokens.navy700 : '#fff',
                                    color: active ? '#fff' : tokens.navy800,
                                    boxShadow: tokens.shadowSm,
                                }, children: [_jsx(Typography, { sx: { fontSize: 22, fontWeight: 800 }, children: count.toLocaleString('en-US') }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, opacity: 0.9 }, children: r ? t(`workforce.invoiceCheck.results.${r}`) : t('workforce.invoiceCheck.all') })] }, r || 'all'));
                        }) })] }), result && (_jsx(Alert, { severity: result === 'Match' ? 'success' : 'warning', sx: { mb: 2 }, children: t(`workforce.invoiceCheck.explain.${result}`) })), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, maxWidth: 560 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('workforce.invoiceCheck.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || result) && _jsx(Button, { onClick: () => (setText(''), update({ q: null, result: null })), children: t('workforce.reset') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t('workforce.invoiceCheck.count', { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('commercial.col.project') }), _jsx(TableCell, { children: t('workforce.invoiceCheck.invoice') }), _jsx(TableCell, { align: "center", children: t('workforce.invoiceCheck.invoiceDays') }), _jsx(TableCell, { align: "center", children: t('workforce.invoiceCheck.ledgerDays') }), _jsx(TableCell, { align: "center", children: t('workforce.invoiceCheck.invoicePrice') }), _jsx(TableCell, { align: "center", children: t('workforce.invoiceCheck.ledgerPrice') }), _jsx(TableCell, { children: t('workforce.invoiceCheck.result') }), _jsx(TableCell, { children: t('workforce.history.details') })] }) }), _jsxs(TableBody, { children: [data?.items.map((i) => (_jsxs(TableRow, { hover: true, sx: { cursor: i.workerId ? 'pointer' : 'default' }, onClick: () => i.workerId && navigate(`/workforce/workers/${i.workerId}?tab=periods`), children: [_jsxs(TableCell, { sx: { minWidth: 170 }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: i.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: i.workerNo })] }), _jsx(TableCell, { sx: { fontSize: 13, minWidth: 160 }, children: i.projectName ?? '—' }), _jsxs(TableCell, { sx: { whiteSpace: 'nowrap' }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600 }, children: i.invoiceNo ?? '—' }), _jsxs(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: [shortDate(i.from), " \u2013 ", shortDate(i.to)] })] }), _jsxs(TableCell, { align: "center", sx: { whiteSpace: 'nowrap' }, children: [num(i.workingDays), !!i.absentDays && (_jsx(Typography, { component: "span", sx: { display: 'block', fontSize: 11.5, color: tokens.gray500 }, children: t('workforce.invoiceCheck.absent', { days: num(i.absentDays) }) }))] }), _jsx(TableCell, { align: "center", children: num(i.ledgerDays) }), _jsx(TableCell, { align: "center", children: num(i.invoicedPrice) }), _jsx(TableCell, { align: "center", children: num(i.ledgerPrice) }), _jsx(TableCell, { children: _jsx(Badge, { tone: resultTone[i.result] ?? 'neutral', children: t(`workforce.invoiceCheck.results.${i.result}`) }) }), _jsx(TableCell, { sx: { fontSize: 12.5, minWidth: 300 }, children: i.details })] }, i.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 9, align: "center", sx: { py: 5, color: tokens.gray500 }, children: data.months.length === 0 ? t('workforce.invoiceCheck.none') : t('workforce.invoiceCheck.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] })] }));
}
