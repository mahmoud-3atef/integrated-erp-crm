import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import SearchIcon from '@mui/icons-material/Search';
import { Box, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography, } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { receivablesApi } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { PageHeader } from '../../components/ui';
import { isoToday, sar } from '../operations/delivery';
import { DateField } from '../../components/DateField';
const buckets = [
    { key: 'current', tone: '#1f9d55' },
    { key: 'days30', tone: '#7cb342' },
    { key: 'days60', tone: '#f0a20b' },
    { key: 'days90', tone: '#e8710a' },
    { key: 'days180', tone: '#d64545' },
    { key: 'over180', tone: '#8e1b1b' },
];
/** The debts' ages: what each project owes by days past due, its credit and its net, by project or by project manager. */
export function AgingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [asOf, setAsOf] = useState(isoToday());
    const [group, setGroup] = useState('project');
    const [search, setSearch] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        setData(null);
        receivablesApi
            .aging(asOf)
            .then((value) => {
            setData(value);
            setError(null);
        })
            .catch((failure) => setError(errorKey(failure)));
    }, [asOf]);
    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        const list = (data?.rows ?? []).filter((r) => !term || [r.projectName, r.customerName, r.manager].some((v) => v?.toLowerCase().includes(term)));
        if (group === 'project')
            return list;
        const byManager = new Map();
        for (const r of list) {
            const name = r.manager ?? t('aging.noManager');
            const sum = byManager.get(name);
            byManager.set(name, sum
                ? {
                    ...sum,
                    current: sum.current + r.current,
                    days30: sum.days30 + r.days30,
                    days60: sum.days60 + r.days60,
                    days90: sum.days90 + r.days90,
                    days180: sum.days180 + r.days180,
                    over180: sum.over180 + r.over180,
                    total: sum.total + r.total,
                    credit: sum.credit + r.credit,
                    net: sum.net + r.net,
                    items: sum.items + 1,
                }
                : { ...r, projectName: name, customerName: null, items: 1 });
        }
        return [...byManager.values()].sort((a, b) => b.net - a.net);
    }, [data, search, group, t]);
    const sum = (pick) => rows.reduce((s, r) => s + pick(r), 0);
    const total = sum((r) => r.total);
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('aging.title'), subtitle: t('aging.intro') }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('aging.totalOwed') }), _jsx(Typography, { sx: { fontSize: 26, fontWeight: 800, color: tokens.navy800 }, children: sar(sum((r) => r.net)) }), _jsx(Box, { sx: { display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', bgcolor: tokens.gray100, my: 1.5 }, children: total > 0 &&
                            buckets.map((b) => {
                                const value = sum((r) => r[b.key]);
                                return value > 0 ? _jsx(Box, { title: `${t(`aging.buckets.${b.key}`)}: ${sar(value)}`, sx: { width: `${(value / total) * 100}%`, bgcolor: b.tone } }, b.key) : null;
                            }) }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(7, 1fr)' }, gap: 1.25 }, children: [buckets.map((b) => (_jsxs(Box, { sx: { p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50, borderInlineStart: `4px solid ${b.tone}` }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t(`aging.buckets.${b.key}`) }), _jsx(Typography, { sx: { fontSize: 17, fontWeight: 800, color: tokens.navy800 }, children: sar(sum((r) => r[b.key])) })] }, b.key))), _jsxs(Box, { sx: { p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50, borderInlineStart: '4px solid #2b7bd9' }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: t('aging.credit') }), _jsx(Typography, { sx: { fontSize: 17, fontWeight: 800, color: '#2b7bd9' }, children: sar(sum((r) => r.credit)) })] })] })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsx(TextField, { size: "small", sx: { minWidth: 280 }, placeholder: t('aging.search'), value: search, onChange: (e) => setSearch(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(DateField, { size: "small", label: t('aging.asOf'), value: asOf, onChange: (e) => e.target.value && setAsOf(e.target.value), slotProps: { inputLabel: { shrink: true } } }), _jsx(Box, { sx: { flex: 1 } }), _jsxs(ToggleButtonGroup, { size: "small", exclusive: true, sx: { whiteSpace: 'nowrap' }, value: group, onChange: (_, v) => v && setGroup(v), children: [_jsx(ToggleButton, { value: "project", children: t('aging.byProject') }), _jsx(ToggleButton, { value: "manager", children: t('aging.byManager') })] })] }), !data && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", sx: { '& th, & td': { px: 1, fontSize: 12.5 }, '& th': { whiteSpace: 'nowrap' } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: group === 'project' ? t('commercial.col.project') : t('commercial.col.manager') }), buckets.map((b) => (_jsx(TableCell, { align: "center", children: t(`aging.buckets.${b.key}`) }, b.key))), _jsx(TableCell, { align: "center", children: t('aging.total') }), _jsx(TableCell, { align: "center", children: t('aging.credit') }), _jsx(TableCell, { align: "center", children: t('aging.net') })] }) }), _jsxs(TableBody, { children: [rows.map((r) => (_jsxs(TableRow, { hover: true, sx: { cursor: group === 'project' ? 'pointer' : 'default' }, onClick: () => group === 'project' && navigate(`/billing/statements/${r.projectId ?? r.projectCrmId}`), children: [_jsxs(TableCell, { sx: { minWidth: 190 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: r.projectName }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: group === 'project' ? [r.customerName, r.manager].filter(Boolean).join(' · ') || '—' : t('aging.projects', { count: r.items }) })] }), buckets.map((b) => (_jsx(TableCell, { align: "center", sx: { whiteSpace: 'nowrap', color: r[b.key] > 0 ? b.tone : tokens.gray300, fontWeight: r[b.key] > 0 ? 700 : 400 }, children: r[b.key] > 0 ? sar(r[b.key]) : '—' }, b.key))), _jsx(TableCell, { align: "center", sx: { fontWeight: 700 }, children: sar(r.total) }), _jsx(TableCell, { align: "center", sx: { color: '#2b7bd9' }, children: r.credit > 0 ? sar(r.credit) : '—' }), _jsx(TableCell, { align: "center", sx: { fontWeight: 800, color: tokens.navy800 }, children: sar(r.net) })] }, group === 'project' ? r.projectCrmId : r.projectName))), data && rows.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 10, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('aging.empty') }) }))] }), rows.length > 0 && (_jsx(TableFooter, { children: _jsxs(TableRow, { sx: { '& td': { fontWeight: 800, color: tokens.navy800, fontSize: 13 } }, children: [_jsx(TableCell, { children: t('aging.total') }), buckets.map((b) => (_jsx(TableCell, { align: "center", children: sar(sum((r) => r[b.key])) }, b.key))), _jsx(TableCell, { align: "center", children: sar(total) }), _jsx(TableCell, { align: "center", children: sar(sum((r) => r.credit)) }), _jsx(TableCell, { align: "center", children: sar(sum((r) => r.net)) })] }) }))] }) })] })] }));
}
