import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { Alert, Box, Button, InputAdornment, LinearProgress, Stack, TablePagination, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PageHeader, PillTabs } from '../../components/ui';
import { PackagesTable, WorkerPricesTable } from './pricing';
/** Price packages of all projects, and the workers at a special price or without one. */
export function PricesPage() {
    const { t } = useTranslation();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') ?? 'packages';
    const status = params.get('status') ?? '';
    const search = params.get('q') ?? '';
    const page = Number(params.get('page') ?? '1');
    const [text, setText] = useState(search);
    const [pageSize, setPageSize] = useState(50);
    const [packages, setPackages] = useState(null);
    const [exceptions, setExceptions] = useState(null);
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
        const q = { search, status, page, pageSize };
        const load = tab === 'packages'
            ? commercialApi.prices(q).then((value) => !cancelled && setPackages(value))
            : Promise.all([commercialApi.priceExceptions({ ...q, sort: 'difference' }), packages ? Promise.resolve(packages) : commercialApi.prices({ page: 1, pageSize: 10 })]).then(([value, totals]) => !cancelled && (setExceptions(value), setPackages((current) => current ?? totals)));
        load
            .then(() => !cancelled && setError(null))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [tab, search, status, page, pageSize]);
    const totals = packages?.totals;
    // The packages card shows all packages; the special and missing cards filter the workers tab; on-package is a count only.
    const card = (key, cardTab, label, value, foot, icon, tone) => {
        const active = key !== null && tab === cardTab && status === key;
        return (_jsx(KpiCard, { label: label, value: (value ?? 0).toLocaleString('en-US'), foot: active ? `✓ ${t('workforce.currentFilter')}` : foot, icon: icon, tone: tone, active: active, onClick: key === null ? undefined : () => update(active ? { status: null } : { tab: cardTab === 'packages' ? null : cardTab, status: key || null }) }));
    };
    const total = tab === 'packages' ? packages?.total ?? 0 : exceptions?.total ?? 0;
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('commercial.prices.title'), subtitle: t('commercial.prices.intro') }), _jsx(Alert, { severity: "info", icon: _jsx(InfoOutlinedIcon, {}), sx: { mb: 2 }, children: t('commercial.prices.derived') }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(KpiGrid, { count: 4, children: [card('', 'packages', t('commercial.prices.cards.packages'), totals?.packages, t('commercial.prices.cards.packagesFoot', { count: totals?.projects ?? 0 }), _jsx(SellOutlinedIcon, {}), tokens.navy700), card(null, 'packages', t('commercial.prices.cards.onPackage'), totals?.onPackage, t('commercial.prices.cards.onPackageFoot'), _jsx(TaskAltOutlinedIcon, {}), '#1f9d55'), card('special', 'exceptions', t('commercial.prices.cards.special'), totals?.special, t('commercial.prices.cards.specialFoot'), _jsx(PriceChangeOutlinedIcon, {}), '#d9822b'), card('missing', 'exceptions', t('commercial.prices.cards.missing'), totals?.missing, t('commercial.prices.cards.missingFoot'), _jsx(ErrorOutlineOutlinedIcon, {}), '#c0392b')] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsx(PillTabs, { value: tab, onChange: (value) => update({ tab: value === 'packages' ? null : value, status: null }), options: [
                            { value: 'packages', label: t('commercial.prices.tabs.packages') },
                            { value: 'exceptions', label: t('commercial.prices.tabs.exceptions') },
                        ] }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 520 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t(tab === 'packages' ? 'commercial.prices.search' : 'commercial.prices.searchWorkers'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || status) && _jsx(Button, { onClick: () => (setText(''), update({ q: null, status: null })), children: t('workforce.reset') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t(tab === 'packages' ? 'commercial.prices.count' : 'commercial.prices.workersCount', { count: total }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), tab === 'packages' && packages && _jsx(PackagesTable, { rows: packages.items, showProject: true }), tab === 'exceptions' && exceptions && _jsx(WorkerPricesTable, { rows: exceptions.items, showProject: true }), total === 0 && !busy && (_jsx(Typography, { sx: { py: 5, textAlign: 'center', color: tokens.gray500 }, children: t('commercial.prices.empty') })), _jsx(TablePagination, { component: "div", count: total, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] })] }));
}
