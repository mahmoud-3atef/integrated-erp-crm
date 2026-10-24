import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { Link, Box, Button, Chip, InputAdornment, LinearProgress, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { kindPath, workforceApi } from '../../api/workforce';
import { ErrorMessage } from '../../auth/AuthLayout';
import { ColumnsButton, useHiddenColumns } from '../../components/hr/ColumnsMenu';
import { Initials } from '../../components/ui';
import { placementCards } from '../../components/workforce/placement';
import { card, StatusPill, wf } from './workforceUi';
const sorts = ['name', 'joined', 'salary', 'number'];
// The grid's optional columns (the name, its number, the status and the salary total always show).
const optional = ['iqama', 'profession', 'nationality', 'sponsor', 'basic', 'food', 'housing', 'transport', 'other', 'joined', 'workDays'];
const salaryParts = ['basic', 'food', 'housing', 'transport', 'other'];
// An iqama in the list shows its first four and last three digits (the proposal of 2026-10-24); the worker's file shows it
// whole, and the search still finds it by any part.
const maskId = (value) => (value.length > 7 ? `${value.slice(0, 4)}•••${value.slice(-3)}` : value);
const pageSizes = [25, 50, 100];
/**
 * Workers, or company staff (the user's redesign, 2026-10-23; docs/02-target-architecture/22): one toolbar
 * (search, status, columns, the total) with the applied filters, and a dense table with the worker column and the header
 * held in place — no title (the breadcrumb names the page), no status cards and no notes (the user's choice). The server pages, sorts and searches as before; the
 * search, the status, the sort, the page and its size live in the address, so coming back from a worker finds the same view.
 */
export function WorkersPage({ kind }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const ar = i18n.language === 'ar';
    const placement = (params.get('status') ?? '');
    const staff = kind === 'Staff';
    const k = staff ? 'staff' : 'workers';
    const search = params.get('q') ?? '';
    const page = Number(params.get('page') ?? '1');
    const sort = sorts.includes(params.get('sort')) ? params.get('sort') : 'number';
    const desc = params.get('desc') === '1';
    const pageSize = pageSizes.includes(Number(params.get('size'))) ? Number(params.get('size')) : 50;
    const [text, setText] = useState(search);
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);
    const { shown, toggle } = useHiddenColumns(`erp.cols.${k}`, optional);
    useEffect(() => setText(search), [search]);
    const update = useCallback((changes) => {
        const next = new URLSearchParams(params);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        if (!('page' in changes)) {
            next.delete('page');
        }
        setParams(next, { replace: true });
    }, [params, setParams]);
    useEffect(() => {
        let cancelled = false;
        setBusy(true);
        workforceApi
            .list(kind, { search, placement, sort, desc, page, pageSize })
            .then((value) => !cancelled && (setData(value), setError(null)))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [kind, search, placement, sort, desc, page, pageSize, attempt]);
    const money = (value) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 0 }).format(value);
    const date = (value) => (value ? value.slice(0, 10).replaceAll('-', '/') : '—');
    const withSalary = data?.items.some((i) => i.salary) ?? false;
    const parts = salaryParts.filter(shown);
    // The page's totals (said so in the row: the server knows the whole list's, the page sums only what it shows).
    const pageItems = data?.items ?? [];
    const beforeSalary = 1 + [shown('iqama'), shown('profession'), shown('nationality'), !staff && shown('sponsor')].filter(Boolean).length;
    const afterSalary = [shown('joined'), !staff && shown('workDays')].filter(Boolean).length;
    const sortBy = (key) => update(sort === key ? { sort: key, desc: desc ? null : '1' } : { sort: key === 'number' ? null : key, desc: null });
    const head = (key, label) => (_jsx(TableSortLabel, { active: sort === key, direction: desc ? 'desc' : 'asc', onClick: () => sortBy(key), sx: { color: '#fff !important', '& .MuiTableSortLabel-icon': { color: `${wf.gold} !important` } }, children: label }));
    const statusName = (p) => t(staff && p === 'Exited' ? 'workforce.staffExited' : `workforce.placement.${p}`);
    const filtered = !!(search || placement);
    const statusOptions = [...placementCards[kind], ...(staff ? [] : ['Inactive'])];
    return (_jsx(Box, { children: _jsxs(Box, { sx: { ...card, p: { xs: 1.5, md: 2 } }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.25, alignItems: { md: 'center' }, mb: 1.25, flexWrap: 'wrap' }, children: [_jsxs(Box, { component: "form", role: "search", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 300 }, maxWidth: 480 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, label: t('workforce.ui.searchLabel'), placeholder: t('workforce.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } }, sx: { '& .MuiOutlinedInput-root': { borderRadius: wf.control, height: 40 } } }), _jsx(Button, { type: "submit", variant: "contained", sx: { borderRadius: wf.control, height: 40, bgcolor: wf.navy, boxShadow: 'none', '&:hover': { bgcolor: wf.navyHover } }, children: t('workforce.searchButton') })] }), _jsxs(TextField, { select: true, size: "small", label: t('workforce.col.status'), value: placement, onChange: (e) => update({ status: e.target.value || null }), sx: { width: { xs: '100%', md: 190 }, '& .MuiOutlinedInput-root': { borderRadius: wf.control, height: 40 } }, children: [_jsx(MenuItem, { value: "", children: t('workforce.ui.allStatuses') }), statusOptions.map((p) => (_jsx(MenuItem, { value: p, children: statusName(p) }, p)))] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(ColumnsButton, { columns: optional
                                .filter((c) => !(staff && (c === 'sponsor' || c === 'workDays')) && (withSalary || !salaryParts.includes(c)))
                                .map((c) => ({
                                key: c,
                                label: salaryParts.includes(c) ? t(`workforce.salary.short.${c}`) : t(`workforce.col.${c === 'joined' && staff ? 'hired' : c}`),
                                group: salaryParts.includes(c) ? t('workforce.salary.group') : undefined,
                            })), shown: shown, toggle: toggle }), _jsxs(Box, { sx: { textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 12, color: wf.textSecondary, lineHeight: 1.2 }, children: t(`workforce.ui.total.${k}`) }), _jsx(Typography, { sx: { fontSize: 18, fontWeight: 600, color: wf.navy, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }, children: data ? data.total.toLocaleString('en-US') : '—' })] })] }), filtered && (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, mb: 1.25, flexWrap: 'wrap' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: wf.textSecondary }, children: t('workforce.ui.applied') }), placement && _jsx(Chip, { size: "small", label: `${t('workforce.col.status')}: ${statusName(placement)}`, onDelete: () => update({ status: null }), deleteIcon: _jsx(CloseIcon, {}), sx: { bgcolor: wf.goldSoft, color: wf.navy, fontWeight: 600, '& .MuiChip-deleteIcon': { color: wf.goldText } } }), search && _jsx(Chip, { size: "small", label: `${t('workforce.ui.searchLabel')}: ${search}`, onDelete: () => (setText(''), update({ q: null })), deleteIcon: _jsx(CloseIcon, {}), sx: { bgcolor: wf.goldSoft, color: wf.navy, fontWeight: 600, '& .MuiChip-deleteIcon': { color: wf.goldText } } }), _jsx(Link, { component: "button", onClick: () => (setText(''), update({ q: null, status: null })), sx: { fontSize: 12.5, fontWeight: 600, color: wf.navy }, children: t('workforce.ui.clearAll') })] })), error && (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1 }, children: [_jsx(Box, { sx: { flex: 1 }, children: _jsx(ErrorMessage, { messageKey: error }) }), _jsx(Button, { size: "small", onClick: () => setAttempt((n) => n + 1), children: t('workforce.ui.retry') })] })), _jsx(Box, { sx: { height: 4, mb: 0.5 }, children: busy && data && _jsx(LinearProgress, { sx: { borderRadius: 2, '& .MuiLinearProgress-bar': { bgcolor: wf.gold }, bgcolor: wf.subtle } }) }), _jsx(TableContainer, { sx: { maxHeight: 'calc(100dvh - 180px)', minHeight: 240, border: `1px solid ${wf.border}`, borderRadius: wf.control }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: {
                            borderCollapse: 'separate',
                            '& th': { bgcolor: wf.navy, color: '#fff', fontSize: 12.5, fontWeight: 600, py: 1, borderBottom: 0, whiteSpace: 'nowrap' },
                            '& th.grp': { textAlign: 'center', bgcolor: wf.navyHover, borderBottom: '1px solid rgba(255,255,255,.14)' },
                            '& th.sub': { bgcolor: wf.navyHover, top: 37 },
                            '& td': { fontSize: 13, color: wf.text, height: 44, py: 0.5, borderBottom: `1px solid ${wf.subtle}`, fontVariantNumeric: 'tabular-nums' },
                            '& tbody tr:nth-of-type(even) td': { bgcolor: '#FAFBFC' },
                            '& tbody tr:hover td': { bgcolor: wf.rowHover },
                            '& tfoot td': { position: 'sticky', bottom: 0, zIndex: 1, bgcolor: wf.subtle, color: wf.navy, fontWeight: 700, borderTop: `1px solid ${wf.border}`, borderBottom: 0 },
                            '& tfoot td.pin': { zIndex: 3, bgcolor: wf.subtle },
                            '& .gs': { borderInlineStart: `1px solid ${wf.border}` },
                            '& th.gs': { borderInlineStart: '1px solid rgba(255,255,255,.18)' },
                            // The worker column stays in view while scrolling sideways.
                            '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: wf.surface, boxShadow: `inset -1px 0 0 ${wf.border}` },
                            '& th.pin': { zIndex: 4, bgcolor: wf.navy },
                        }, children: [_jsxs(TableHead, { children: [_jsxs(TableRow, { children: [_jsx(TableCell, { rowSpan: withSalary ? 2 : 1, className: "pin", sx: { minWidth: 220 }, children: _jsxs(Stack, { sx: { gap: 0.25 }, children: [head('name', t('workforce.col.name')), _jsx(Box, { sx: { fontSize: 11, opacity: 0.85 }, children: head('number', t('workforce.col.number')) })] }) }), _jsx(TableCell, { rowSpan: withSalary ? 2 : 1, children: t('workforce.col.status') }), shown('iqama') && _jsx(TableCell, { rowSpan: withSalary ? 2 : 1, children: t('workforce.col.iqama') }), shown('profession') && _jsx(TableCell, { rowSpan: withSalary ? 2 : 1, children: t('workforce.col.profession') }), shown('nationality') && _jsx(TableCell, { rowSpan: withSalary ? 2 : 1, children: t('workforce.col.nationality') }), !staff && shown('sponsor') && _jsx(TableCell, { rowSpan: withSalary ? 2 : 1, children: t('workforce.col.sponsor') }), withSalary && (_jsx(TableCell, { className: "grp gs", colSpan: parts.length + 1, children: t('workforce.salary.group') })), shown('joined') && _jsx(TableCell, { rowSpan: withSalary ? 2 : 1, className: withSalary ? 'gs' : undefined, children: head('joined', t(staff ? 'workforce.col.hired' : 'workforce.col.joined')) }), !staff && shown('workDays') && _jsx(TableCell, { rowSpan: withSalary ? 2 : 1, align: "center", children: t('workforce.col.workDays') })] }), withSalary && (_jsxs(TableRow, { children: [parts.map((c, i) => (_jsx(TableCell, { align: "center", className: i === 0 ? 'sub gs' : 'sub', children: t(`workforce.salary.short.${c}`) }, c))), _jsx(TableCell, { align: "center", className: parts.length === 0 ? 'sub gs' : 'sub', children: head('salary', t('workforce.salary.short.total')) })] }))] }), _jsxs(TableBody, { children: [!data &&
                                        !error &&
                                        Array.from({ length: 8 }, (_, i) => (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 20, children: _jsx(Skeleton, { height: 28 }) }) }, i))), data?.items.map((w) => (_jsxs(TableRow, { hover: true, tabIndex: 0, sx: { cursor: 'pointer', '&:focus-visible td': { bgcolor: wf.rowHover }, '&:focus-visible': { outline: `2px solid ${wf.gold}`, outlineOffset: -2 } }, onClick: () => navigate(`/workforce/${kindPath(kind)}/${w.id}`), onKeyDown: (e) => e.key === 'Enter' && navigate(`/workforce/${kindPath(kind)}/${w.id}`), children: [_jsx(TableCell, { className: "pin", children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(Initials, { name: w.name, size: 28 }), _jsxs(Box, { sx: { minWidth: 0, maxWidth: 240 }, children: [_jsx(Typography, { dir: "auto", sx: { fontSize: 13, fontWeight: 600, color: wf.navy, lineHeight: 1.3, unicodeBidi: 'plaintext', textAlign: 'start' }, children: w.name }), _jsx(Typography, { sx: { fontSize: 11.5, color: wf.textSecondary, textAlign: 'start' }, children: _jsx("bdi", { children: w.workerNo }) })] })] }) }), _jsx(TableCell, { children: _jsx(StatusPill, { placement: w.placement, children: (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`) }) }), shown('iqama') && (_jsx(TableCell, { children: _jsx("bdi", { children: w.iqama ? maskId(w.iqama) : '—' }) })), shown('profession') && _jsx(TableCell, { children: (ar ? w.professionAr : w.professionEn) ?? '—' }), shown('nationality') && _jsx(TableCell, { children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' }), !staff && shown('sponsor') && (_jsx(TableCell, { sx: { whiteSpace: 'nowrap', fontSize: '12.5px !important' }, children: _jsx("bdi", { children: w.sponsor ?? '—' }) })), withSalary && (_jsxs(_Fragment, { children: [parts.map((c, i) => (_jsx(TableCell, { align: "center", className: i === 0 ? 'gs' : undefined, children: w.salary ? money(w.salary[c]) : '—' }, c))), _jsx(TableCell, { align: "center", className: parts.length === 0 ? 'gs' : undefined, sx: { fontWeight: 700, color: `${wf.navy} !important` }, children: w.salary ? money(w.salary.total) : '—' })] })), shown('joined') && (_jsx(TableCell, { className: withSalary ? 'gs' : undefined, sx: { whiteSpace: 'nowrap' }, children: _jsx("bdi", { children: date(w.projectJoinedOn) }) })), !staff && shown('workDays') && _jsx(TableCell, { align: "center", children: w.workDays ?? '—' })] }, w.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 20, align: "center", sx: { py: 5, color: `${wf.textSecondary} !important` }, children: filtered ? t('workforce.ui.noResults') : t('workforce.empty') }) }))] }), withSalary && pageItems.length > 0 && (_jsx(TableFooter, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { className: "pin", children: t('workforce.ui.pageTotal', { count: pageItems.length }) }), _jsx(TableCell, { colSpan: beforeSalary }), parts.map((c, i) => (_jsx(TableCell, { align: "center", className: i === 0 ? 'gs' : undefined, children: money(pageItems.reduce((sum, w) => sum + (w.salary?.[c] ?? 0), 0)) }, c))), _jsx(TableCell, { align: "center", className: parts.length === 0 ? 'gs' : undefined, children: money(pageItems.reduce((sum, w) => sum + (w.salary?.total ?? 0), 0)) }), afterSalary > 0 && _jsx(TableCell, { colSpan: afterSalary, className: "gs" })] }) }))] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: pageSizes, onRowsPerPageChange: (e) => update({ size: Number(e.target.value) === 50 ? null : String(e.target.value) }), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] }) }));
}
