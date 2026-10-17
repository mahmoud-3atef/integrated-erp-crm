import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Alert, Box, Button, ButtonBase, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { kindPath, workforceApi } from '../../api/workforce';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Initials, PageHeader } from '../../components/ui';
import { placementCards, placementLook } from '../../components/workforce/placement';
/**
 * Workers, or company staff: status cards as on the old page (click to filter), search, and the old columns.
 * Staff have no supplier and no project work days.
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
    const [text, setText] = useState(search);
    const [sort, setSort] = useState('number');
    const [desc, setDesc] = useState(false);
    const [pageSize, setPageSize] = useState(50);
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
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
    }, [kind, search, placement, sort, desc, page, pageSize]);
    const money = (value) => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 0 }).format(value);
    const date = (value) => value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—';
    const withSalary = data?.items.some((i) => i.salary) ?? false;
    const sortBy = (key) => {
        if (sort === key) {
            setDesc((d) => !d);
        }
        else {
            setSort(key);
            setDesc(false);
        }
    };
    const head = (key, label) => (_jsx(TableSortLabel, { active: sort === key, direction: desc ? 'desc' : 'asc', onClick: () => sortBy(key), sx: { color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }, children: label }));
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t(`workforce.${k}.title`), subtitle: t(`workforce.${k}.intro`) }), _jsx(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: 2 }, children: t('workforce.readOnly') }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: `repeat(${placementCards[kind].length}, 1fr)` }, gap: `${tokens.gap}px`, pt: '22px', mb: `${tokens.gap}px` }, children: placementCards[kind].map((p) => {
                    const look = placementLook[p];
                    const active = placement === p;
                    return (_jsxs(ButtonBase, { onClick: () => update({ status: active ? null : p }), sx: {
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            textAlign: 'start',
                            bgcolor: '#fff',
                            borderRadius: `${tokens.radius}px`,
                            boxShadow: active ? `0 0 0 2px ${look.tone}, ${tokens.shadowMd}` : tokens.shadowSm,
                            transition: 'box-shadow .15s, transform .15s',
                            '&:hover': { boxShadow: tokens.shadowMd, transform: 'translateY(-2px)' },
                        }, children: [_jsx(Box, { "aria-hidden": true, sx: {
                                    position: 'absolute',
                                    top: -22,
                                    insetInlineStart: 14,
                                    display: 'grid',
                                    placeItems: 'center',
                                    width: 52,
                                    height: 52,
                                    borderRadius: '50%',
                                    bgcolor: look.tone,
                                    color: '#fff',
                                    boxShadow: `0 0 0 4px ${tokens.bg}, 0 6px 14px rgba(13, 74, 108, .22)`,
                                    '& svg': { fontSize: 22 },
                                }, children: look.icon }), _jsxs(Box, { sx: { p: '12px 16px', textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: t(staff && p === 'Exited' ? 'workforce.staffExited' : `workforce.placement.${p}`) }), _jsx(Typography, { sx: { fontSize: 24, fontWeight: 700, lineHeight: 1.25, color: tokens.navy800, fontVariantNumeric: 'tabular-nums' }, children: (data?.counts[p] ?? 0).toLocaleString('en-US') })] }), _jsx(Box, { sx: { mt: 'auto', px: 2, py: 1.25, borderTop: `1px solid ${tokens.border}`, fontSize: 12.5, color: active ? look.tone : tokens.gray600, fontWeight: active ? 700 : 400 }, children: active ? `✓ ${t('workforce.currentFilter')}` : t(staff ? 'workforce.cardFoot.staff' : `workforce.cardFoot.${p}`) })] }, p));
                }) }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('workforce.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || placement) && (_jsx(Button, { onClick: () => (setText(''), setParams(new URLSearchParams(), { replace: true })), children: t('workforce.reset') }))] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t(`workforce.${k}.count`, { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: head('name', t('workforce.col.name')) }), _jsx(TableCell, { children: head('number', t('workforce.col.number')) }), _jsx(TableCell, { children: t('workforce.col.status') }), _jsx(TableCell, { children: t('workforce.col.iqama') }), _jsx(TableCell, { children: t('workforce.col.profession') }), _jsx(TableCell, { children: t('workforce.col.nationality') }), !staff && _jsx(TableCell, { children: t('workforce.col.sponsor') }), withSalary && (_jsxs(_Fragment, { children: [_jsx(TableCell, { align: "center", children: t('workforce.salary.basic') }), _jsx(TableCell, { align: "center", children: t('workforce.salary.food') }), _jsx(TableCell, { align: "center", children: t('workforce.salary.housing') }), _jsx(TableCell, { align: "center", children: t('workforce.salary.transport') }), _jsx(TableCell, { align: "center", children: t('workforce.salary.other') }), _jsx(TableCell, { align: "center", children: head('salary', t('workforce.salary.total')) })] })), _jsx(TableCell, { children: head('joined', t(staff ? 'workforce.col.hired' : 'workforce.col.joined')) }), !staff && _jsx(TableCell, { align: "center", children: t('workforce.col.workDays') })] }) }), _jsxs(TableBody, { children: [data?.items.map((w) => {
                                            const look = placementLook[w.placement];
                                            return (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/${kindPath(kind)}/${w.id}`), children: [_jsx(TableCell, { sx: { minWidth: 220 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Initials, { name: w.name, size: 30 }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 600, color: tokens.navy800 }, children: w.name })] }) }), _jsx(TableCell, { dir: "ltr", sx: { fontVariantNumeric: 'tabular-nums' }, children: w.workerNo }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: _jsxs(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700, color: look.tone, bgcolor: look.soft }, children: [_jsx(Box, { component: "span", sx: { width: 7, height: 7, borderRadius: '50%', bgcolor: look.tone } }), (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`)] }) }), _jsx(TableCell, { dir: "ltr", sx: { fontVariantNumeric: 'tabular-nums' }, children: w.iqama ?? '—' }), _jsx(TableCell, { children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(TableCell, { children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' }), !staff && _jsx(TableCell, { dir: "ltr", children: w.sponsor ?? '—' }), withSalary && (_jsxs(_Fragment, { children: [_jsx(TableCell, { align: "center", children: w.salary ? money(w.salary.basic) : '—' }), _jsx(TableCell, { align: "center", children: w.salary ? money(w.salary.food) : '—' }), _jsx(TableCell, { align: "center", children: w.salary ? money(w.salary.housing) : '—' }), _jsx(TableCell, { align: "center", children: w.salary ? money(w.salary.transport) : '—' }), _jsx(TableCell, { align: "center", children: w.salary ? money(w.salary.other) : '—' }), _jsx(TableCell, { align: "center", sx: { fontWeight: 700, color: tokens.navy800 }, children: w.salary ? money(w.salary.total) : '—' })] })), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(w.projectJoinedOn) }), !staff && _jsx(TableCell, { align: "center", children: w.workDays ?? '—' })] }, w.id));
                                        }), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: (withSalary ? 15 : 9) - (staff ? 2 : 0), align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('workforce.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] })] }));
}
