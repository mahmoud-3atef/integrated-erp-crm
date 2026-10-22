import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Box, Button, ButtonBase, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { historyIssueCodes, workforceApi } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
/**
 * The period ledger's exceptions report: what does not add up in the workers' history in the old system (two
 * movements on one day, uncovered days, a status the history does not explain…), for operations to review.
 */
export function HistoryIssuesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const code = params.get('code') ?? '';
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
            .historyIssues({ code, search, page, pageSize })
            .then((value) => !cancelled && (setData(value), setError(null)))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [code, search, page, pageSize]);
    const all = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('workforce.history.title'), subtitle: t('workforce.history.intro') }), _jsxs(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: 2 }, children: [t('workforce.history.how'), data?.builtAt && (_jsx(Box, { component: "span", sx: { display: 'block', mt: 0.5, fontSize: 12.5 }, children: t('workforce.history.builtAt', { at: new Date(data.builtAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }), workers: data.workers }) }))] }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.25, mb: 2 }, children: ['', ...historyIssueCodes].map((c) => {
                    const active = code === c;
                    const count = c ? data?.counts[c] ?? 0 : all;
                    return (_jsxs(ButtonBase, { onClick: () => update({ code: c || null }), sx: {
                            display: 'block',
                            textAlign: 'start',
                            p: 1.5,
                            borderRadius: `${tokens.radius}px`,
                            bgcolor: active ? tokens.navy700 : '#fff',
                            color: active ? '#fff' : tokens.navy800,
                            boxShadow: tokens.shadowSm,
                        }, children: [_jsx(Typography, { sx: { fontSize: 22, fontWeight: 800 }, children: count.toLocaleString('en-US') }), _jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, opacity: 0.9 }, children: c ? t(`workforce.history.codes.${c}`) : t('workforce.history.all') })] }, c || 'all'));
                }) }), code && (_jsx(Alert, { severity: "warning", icon: _jsx(ErrorOutlineOutlinedIcon, {}), sx: { mb: 2 }, children: t(`workforce.history.explain.${code}`) })), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, maxWidth: 560 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('workforce.history.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || code) && _jsx(Button, { onClick: () => (setText(''), setParams(new URLSearchParams(), { replace: true })), children: t('workforce.reset') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t('workforce.history.count', { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('workforce.history.kind') }), _jsx(TableCell, { children: t('workforce.history.on') }), _jsx(TableCell, { children: t('workforce.history.details') }), _jsx(TableCell, { children: t('commercial.col.project') })] }) }), _jsxs(TableBody, { children: [data?.items.map((i) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${i.workerId}?tab=periods`), children: [_jsxs(TableCell, { sx: { minWidth: 180 }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: i.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: i.workerNo })] }), _jsx(TableCell, { children: _jsx(Badge, { tone: "warning", children: t(`workforce.history.codes.${i.code}`) }) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(i.on) }), _jsx(TableCell, { sx: { fontSize: 13, minWidth: 320 }, children: i.details }), _jsx(TableCell, { children: i.projectName ?? '—' })] }, i.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 5, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('workforce.history.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] })] }));
}
