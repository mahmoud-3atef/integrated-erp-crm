import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import SearchIcon from '@mui/icons-material/Search';
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
export const contractStatusTone = {
    Valid: 'success',
    WantsRenewal: 'info',
    NoRenewal: 'warning',
    Canceled: 'danger',
    Expired: 'neutral',
};
export function useCommercialFormat() {
    const { i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    return {
        ar,
        date: (value) => value ? new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—',
    };
}
/** How long is left on the contract: red once ended, amber within 60 days. */
export function DaysLeft({ days }) {
    const { t } = useTranslation();
    if (days === null) {
        return null;
    }
    const tone = days < 0 ? tokens.danger : days <= 60 ? tokens.warning : tokens.gray500;
    return (_jsx(Typography, { component: "span", sx: { fontSize: 11.5, color: tone, fontWeight: 600 }, children: days < 0 ? t('commercial.ended', { days: -days }) : t('commercial.daysLeft', { days }) }));
}
/** The contract period with how long is left (as the old page's "مدة العقد" column). */
export function ContractPeriod({ row }) {
    const { date } = useCommercialFormat();
    if (!row.startsOn && !row.endsOn) {
        return _jsx(_Fragment, { children: "\u2014" });
    }
    return (_jsxs(Box, { sx: { whiteSpace: 'nowrap' }, children: [_jsxs("div", { children: [date(row.startsOn), " \u2190 ", date(row.endsOn)] }), _jsx(DaysLeft, { days: row.daysLeft })] }));
}
/** Projects: the old page's cards (click to filter), search and columns. */
export function ProjectsPage() {
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
            .projects({ search, status, sort, desc, page, pageSize })
            .then((value) => !cancelled && (setData(value), setError(null)))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [search, status, sort, desc, page, pageSize]);
    const sortBy = (key) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(key === 'workers' || key === 'created')));
    const head = (key, label) => (_jsx(TableSortLabel, { active: sort === key, direction: desc ? 'desc' : 'asc', onClick: () => sortBy(key), sx: { color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }, children: label }));
    const card = (key, label, value, foot, icon, tone) => (_jsx(KpiCard, { label: label, value: (value ?? 0).toLocaleString('en-US'), foot: status === key ? `✓ ${t('workforce.currentFilter')}` : foot, icon: icon, tone: tone, active: status === key, onClick: () => update({ status: status === key ? null : key }) }));
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('commercial.projects.title'), subtitle: t('commercial.projects.intro') }), _jsx(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: 2 }, children: t('commercial.readOnly') }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(KpiGrid, { count: 4, children: [card('active', t('commercial.projects.cards.projects'), data?.totals.projects, t('commercial.projects.cards.projectsFoot'), _jsx(AccountTreeOutlinedIcon, {}), tokens.navy700), card('withWorkers', t('commercial.projects.cards.workers'), data?.totals.workers, t('commercial.projects.cards.workersFoot'), _jsx(EngineeringOutlinedIcon, {}), '#0e7c86'), card('ending', t('commercial.projects.cards.ending'), data?.totals.endingSoon, t('commercial.projects.cards.endingFoot'), _jsx(EventBusyOutlinedIcon, {}), '#d9822b'), card('noCustomer', t('commercial.projects.cards.noCustomer'), data?.totals.withoutCustomer, t('commercial.projects.cards.noCustomerFoot'), _jsx(LinkOffOutlinedIcon, {}), '#c0392b')] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('commercial.projects.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || status) && _jsx(Button, { onClick: () => (setText(''), setParams(new URLSearchParams(), { replace: true })), children: t('workforce.reset') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t('commercial.projects.count', { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: head('name', t('commercial.col.project')) }), _jsx(TableCell, { children: t('commercial.col.customer') }), _jsx(TableCell, { children: t('commercial.col.manager') }), _jsx(TableCell, { align: "center", children: head('workers', t('commercial.col.workers')) }), _jsx(TableCell, { children: t('commercial.col.contractType') }), _jsx(TableCell, { children: head('ends', t('commercial.col.period')) }), _jsx(TableCell, { children: head('created', t('commercial.col.created')) }), _jsx(TableCell, { children: t('commercial.col.contractStatus') })] }) }), _jsxs(TableBody, { children: [data?.items.map((p) => (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer', opacity: p.isActive ? 1 : 0.6 }, onClick: () => navigate(`/commercial/projects/${p.id}`), children: [_jsx(TableCell, { sx: { minWidth: 240 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Initials, { name: p.name, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: p.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: p.code })] })] }) }), _jsx(TableCell, { children: p.customerName ?? _jsx(Badge, { tone: "danger", children: t('commercial.noCustomer') }) }), _jsx(TableCell, { children: p.manager ?? '—' }), _jsx(TableCell, { align: "center", children: p.workers > 0 ? _jsx(Badge, { tone: "info", children: p.workers }) : '—' }), _jsx(TableCell, { children: p.contractType ? t(`commercial.contractType.${p.contractType}`) : '—' }), _jsx(TableCell, { children: _jsx(ContractPeriod, { row: p }) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(p.createdAt) }), _jsx(TableCell, { children: p.contractStatus ? _jsx(Badge, { tone: contractStatusTone[p.contractStatus], children: t(`commercial.contractStatus.${p.contractStatus}`) }) : '—' })] }, p.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 8, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('commercial.projects.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] })] }));
}
