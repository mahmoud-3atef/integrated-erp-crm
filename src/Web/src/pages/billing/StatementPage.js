import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Box, Button, GlobalStyles, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';
import { DateField } from '../../components/DateField';
function Tile({ label, value, tone = tokens.navy800 }) {
    return (_jsxs(Box, { sx: { p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50, '@media print': { border: '1px solid #c9d3e0', bgcolor: '#fff' } }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: label }), _jsx(Typography, { sx: { fontSize: 19, fontWeight: 800, color: tone, lineHeight: 1.3 }, children: value })] }));
}
/**
 * A project's statement for a period: the balance before it, every invoice, note, receipt and old-system balance, the
 * running balance and the closing one. <paramref name="print"/>: the page alone, to print (opened in its own tab).
 */
export function StatementPage({ print = false }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const { ar, date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const from = params.get('from') ?? `${new Date().getFullYear()}-01-01`;
    const to = params.get('to') ?? isoToday();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        setData(null);
        receivablesApi
            .statement(id, from, to)
            .then((value) => {
            setData(value);
            if (print)
                document.title = `${value.projectName} — ${from} → ${to}`;
        })
            .catch((failure) => setError(errorKey(failure)));
    }, [id, from, to, print]);
    const set = (key, value) => {
        const next = new URLSearchParams(params);
        next.set(key, value);
        setParams(next, { replace: true });
    };
    const open = (kind, documentId) => {
        if (!documentId || print)
            return;
        navigate(kind === 'Receipt' ? `/billing/receipts/${documentId}` : `/billing/invoices/${documentId}`);
    };
    return (_jsxs(Box, { sx: print ? { p: 3, bgcolor: '#fff', minHeight: '100vh', '@media print': { p: 0 } } : undefined, children: [print && _jsx(GlobalStyles, { styles: { '@page': { size: 'A4', margin: '10mm' } } }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: print ? 'none' : tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 2, alignItems: { md: 'center' } }, children: [_jsxs(Box, { sx: { flex: 1 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('statement.title') }), _jsx(Typography, { component: "h1", sx: { fontSize: 21, fontWeight: 800, color: tokens.navy800 }, children: data?.projectName ?? '…' }), _jsxs(Typography, { sx: { fontSize: 13, color: tokens.gray600 }, children: [t('commercial.col.customer'), ": ", data?.customerName ?? '—', " \u00B7 ", t('statement.period', { from: date(from), to: date(to) })] })] }), _jsxs(Stack, { direction: "row", sx: { gap: 1.25, alignItems: 'center', '@media print': { display: 'none' } }, children: [!print && (_jsxs(_Fragment, { children: [_jsx(DateField, { size: "small", label: t('statement.from'), value: from, onChange: (e) => e.target.value && set('from', e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(DateField, { size: "small", label: t('statement.to'), value: to, onChange: (e) => e.target.value && set('to', e.target.value), slotProps: { inputLabel: { shrink: true } } })] })), _jsx(Button, { variant: print ? 'contained' : 'text', startIcon: _jsx(PrintOutlinedIcon, {}), onClick: () => (print ? window.print() : window.open(`/billing/statements/${id}/print?from=${from}&to=${to}`, '_blank', 'noopener')), children: t('invoices.printDoc') }), !print && (_jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate(-1), children: t('common.back') }))] })] }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25, mt: 2 }, children: [_jsx(Tile, { label: t('statement.opening'), value: sar(data?.opening ?? 0) }), _jsx(Tile, { label: t('statement.debits'), value: sar(data?.debits ?? 0) }), _jsx(Tile, { label: t('statement.credits'), value: sar(data?.credits ?? 0), tone: "#1f9d55" }), _jsx(Tile, { label: t('statement.closing'), value: sar(data?.closing ?? 0), tone: (data?.closing ?? 0) > 0 ? tokens.danger : tokens.teal })] })] }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: print ? 'none' : tokens.shadowSm, p: 2 }, children: [!data && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('statement.date') }), _jsx(TableCell, { children: t('statement.document') }), _jsx(TableCell, { children: t('statement.description') }), _jsx(TableCell, { align: "center", children: t('statement.debit') }), _jsx(TableCell, { align: "center", children: t('statement.credit') }), _jsx(TableCell, { align: "center", children: t('statement.balance') })] }) }), _jsxs(TableBody, { children: [data && (_jsxs(TableRow, { sx: { bgcolor: tokens.gray50 }, children: [_jsx(TableCell, { children: date(data.from) }), _jsx(TableCell, { colSpan: 4, sx: { fontWeight: 700 }, children: t('statement.opening') }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800 }, children: sar(data.opening) })] })), data?.entries.map((e, n) => (_jsxs(TableRow, { hover: true, sx: { cursor: e.documentId && !print ? 'pointer' : 'default' }, onClick: () => open(e.kind, e.documentId), children: [_jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(e.date) }), _jsxs(TableCell, { children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: e.number }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t(`statement.kinds.${e.kind}`) })] }), _jsx(TableCell, { sx: { fontSize: 12.5 }, children: e.description }), _jsx(TableCell, { align: "center", children: e.debit > 0 ? sar(e.debit) : '' }), _jsx(TableCell, { align: "center", sx: { color: '#1f9d55' }, children: e.credit > 0 ? sar(e.credit) : '' }), _jsx(TableCell, { align: "center", sx: { fontWeight: 700 }, children: sar(e.balance) })] }, n))), data && (_jsxs(TableRow, { sx: { bgcolor: tokens.navy50 }, children: [_jsx(TableCell, { children: date(data.to) }), _jsx(TableCell, { colSpan: 2, sx: { fontWeight: 800 }, children: t('statement.closing') }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800 }, children: sar(data.debits) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: '#1f9d55' }, children: sar(data.credits) }), _jsx(TableCell, { align: "center", sx: { fontWeight: 900, color: tokens.navy800 }, children: sar(data.closing) })] }))] })] }) })] })] }));
}
