import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Alert, Box, Button, InputAdornment, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Badge, Initials, PageHeader } from '../../components/ui';
import { useCommercialFormat } from './ProjectsPage';
/** Customers: cards, search (name, number, CR, VAT, mobile) and their projects and workers. */
export function CustomersPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const status = params.get('status') ?? '';
    const search = params.get('q') ?? '';
    const page = Number(params.get('page') ?? '1');
    const [text, setText] = useState(search);
    const [sort, setSort] = useState('created');
    const [desc, setDesc] = useState(true);
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
        commercialApi
            .customers({ search, status, sort, desc, page, pageSize })
            .then((value) => !cancelled && (setData(value), setError(null)))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [search, status, sort, desc, page, pageSize]);
    const sortBy = (key) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(key !== 'name')));
    const head = (key, label) => (_jsx(TableSortLabel, { active: sort === key, direction: desc ? 'desc' : 'asc', onClick: () => sortBy(key), sx: { color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }, children: label }));
    const card = (key, label, value, foot, icon, tone) => (_jsx(KpiCard, { label: label, value: (value ?? 0).toLocaleString('en-US'), foot: status === key ? `✓ ${t('workforce.currentFilter')}` : foot, icon: icon, tone: tone, active: status === key, onClick: key ? () => update({ status: status === key ? null : key }) : undefined }));
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('commercial.customers.title'), subtitle: t('commercial.customers.intro') }), _jsx(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: 2 }, children: t('commercial.readOnly') }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(KpiGrid, { count: 4, children: [card('', t('commercial.customers.cards.all'), data?.total, t('commercial.customers.cards.allFoot'), _jsx(BusinessOutlinedIcon, {}), tokens.navy700), card('active', t('commercial.customers.cards.active'), data?.active, t('commercial.customers.cards.activeFoot'), _jsx(VerifiedOutlinedIcon, {}), '#1f9d55'), card('withProjects', t('commercial.customers.cards.withProjects'), data?.withProjects, t('commercial.customers.cards.withProjectsFoot'), _jsx(AccountTreeOutlinedIcon, {}), '#1b6a92'), card('withWorkers', t('commercial.customers.cards.workers'), data?.workers, t('commercial.customers.cards.workersFoot'), _jsx(EngineeringOutlinedIcon, {}), '#0e7c86')] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('commercial.customers.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || status) && _jsx(Button, { onClick: () => (setText(''), setParams(new URLSearchParams(), { replace: true })), children: t('workforce.reset') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t('commercial.customers.count', { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: head('name', t('commercial.col.customer')) }), _jsx(TableCell, { children: t('commercial.field.cr') }), _jsx(TableCell, { children: t('commercial.field.vat') }), _jsx(TableCell, { children: t('commercial.field.mobile') }), _jsx(TableCell, { children: t('commercial.field.city') }), _jsx(TableCell, { align: "center", children: t('commercial.col.projects') }), _jsx(TableCell, { align: "center", children: head('workers', t('commercial.col.workers')) }), _jsx(TableCell, { children: head('created', t('commercial.col.created')) })] }) }), _jsxs(TableBody, { children: [data?.items.map((c) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer', opacity: c.isActive ? 1 : 0.6 }, onClick: () => navigate(`/commercial/customers/${c.id}`), children: [_jsx(TableCell, { sx: { minWidth: 240 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Initials, { name: c.name, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: c.name }), c.customerNo && (_jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: c.customerNo }))] })] }) }), _jsx(TableCell, { dir: "ltr", children: c.commercialRegistration ?? '—' }), _jsx(TableCell, { dir: "ltr", children: c.vatNumber ?? '—' }), _jsx(TableCell, { dir: "ltr", children: c.mobile ?? '—' }), _jsx(TableCell, { children: c.city ?? '—' }), _jsx(TableCell, { align: "center", children: c.projects > 0 ? `${c.activeProjects} / ${c.projects}` : '—' }), _jsx(TableCell, { align: "center", children: c.workers > 0 ? _jsx(Badge, { tone: "info", children: c.workers }) : '—' }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(c.createdAt) })] }, c.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 8, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('commercial.customers.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] })] }));
}
