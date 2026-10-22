import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, InputAdornment, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { returnsApi } from '../../api/operations';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { ReturnStatusBadge, returnTone } from './returns';
import { ReturnOrderWizard } from './ReturnOrderWizard';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';
/** Return orders, as the old "أوامر التسكين" page: search, cards that filter, and the orders. */
export function ReturnOrdersPage({ creating = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [wizard, setWizard] = useState(creating);
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const status = params.get('status') ?? '';
    const source = params.get('source') ?? '';
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
        returnsApi
            .list({ search, status, source, sort, desc, page, pageSize })
            .then((value) => !cancelled && (setData(value), setError(null)))
            .catch((failure) => !cancelled && setError(errorKey(failure)))
            .finally(() => !cancelled && setBusy(false));
        return () => {
            cancelled = true;
        };
    }, [search, status, source, sort, desc, page, pageSize]);
    const sortBy = (key) => (sort === key ? setDesc((d) => !d) : (setSort(key), setDesc(true)));
    const head = (key, label) => (_jsx(TableSortLabel, { active: sort === key, direction: desc ? 'desc' : 'asc', onClick: () => sortBy(key), sx: { color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'inherit !important' } }, children: label }));
    const card = (key, label, value, foot, icon, tone) => (_jsx(StripItem, { label: label, value: (value ?? 0).toLocaleString('en-US'), foot: status === key ? `✓ ${t('workforce.currentFilter')}` : foot, icon: icon, tone: tone, active: status === key, onClick: () => update({ status: status === key ? null : key || null }) }));
    const stages = useCurrentStages('operations.return_order', (data?.items ?? []).map((x) => x.id));
    return (_jsxs(Box, { children: [_jsx(ListHero, { tone: "return", icon: _jsx(KeyboardReturnOutlinedIcon, {}), title: t('operations.return.title'), subtitle: t('operations.return.intro'), actions: can('operations.return.create', true) ? (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setWizard(true), children: t('operations.return.new') })) : undefined }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(StatusStrip, { count: 5, children: [card('', t('operations.return.cards.all'), data?.totals.all, t('operations.return.cards.allFoot'), _jsx(KeyboardReturnOutlinedIcon, {}), tokens.navy700), card('preparing', t('operations.return.cards.preparing'), data?.totals.underPreparation, t('operations.return.cards.preparingFoot'), _jsx(EditNoteOutlinedIcon, {}), '#6b7a90'), card('approval', t('operations.return.cards.approval'), data?.totals.inApproval, t('operations.return.cards.approvalFoot'), _jsx(HourglassBottomOutlinedIcon, {}), '#d9822b'), card('completed', t('operations.return.cards.completed'), data?.totals.completed, t('operations.return.cards.completedFoot'), _jsx(HotelOutlinedIcon, {}), '#1f9d55'), card('closed', t('operations.return.cards.closed'), data?.totals.closed, t('operations.return.cards.closedFoot'), _jsx(BlockOutlinedIcon, {}), '#c0392b')] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 560 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('operations.return.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || status || source) && _jsx(Button, { onClick: () => (setText(''), setParams(new URLSearchParams(), { replace: true })), children: t('workforce.reset') })] }), _jsxs(TextField, { select: true, size: "small", value: source || 'all', onChange: (e) => update({ source: e.target.value === 'all' ? null : e.target.value }), sx: { minWidth: 200 }, children: [_jsx(MenuItem, { value: "all", children: t('operations.delivery.source.all') }), _jsx(MenuItem, { value: "system", children: t('operations.delivery.source.system') }), _jsx(MenuItem, { value: "crm", children: t('operations.delivery.source.crm') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t('operations.delivery.count', { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: toneHead('return'), children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: head('name', t('operations.return.col.worker')) }), _jsx(TableCell, { children: t('operations.return.col.project') }), _jsx(TableCell, { children: t('operations.return.col.housing') }), _jsx(TableCell, { children: t('operations.return.col.entry') }), _jsx(TableCell, { children: t('operations.return.col.reason') }), _jsx(TableCell, { children: head('arrivedOn', t('operations.return.col.arrivedOn')) }), _jsx(TableCell, { children: t('operations.delivery.col.status') }), _jsx(TableCell, { children: t('operations.return.col.createdBy') })] }) }), _jsxs(TableBody, { children: [data?.items.map((o) => (_jsxs(TableRow, { hover: true, sx: [{ cursor: 'pointer' }, rowEdge(toneColors[returnTone[o.status]].fg)], onClick: () => navigate(`/operations/return-orders/${o.id}`), children: [_jsx(TableCell, { sx: { minWidth: 230 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Initials, { name: o.name, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: o.name }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsxs(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500 }, children: [o.orderNo, " \u00B7 ", o.workerNo] }), o.source === 'Crm' && _jsx(Badge, { tone: "neutral", children: t('operations.delivery.fromCrm') })] })] })] }) }), _jsx(TableCell, { sx: { minWidth: 150 }, children: o.projectName ?? '—' }), _jsx(TableCell, { sx: { minWidth: 170 }, children: o.housingName ?? '—' }), _jsx(TableCell, { children: t(`operations.return.entry.${o.entry}`) }), _jsx(TableCell, { children: t(`operations.return.reasons.${o.reason}`) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(o.arrivedOn) }), _jsxs(TableCell, { children: [_jsx(ReturnStatusBadge, { row: o }), _jsx(StageLine, { stage: stages[o.id] })] }), _jsx(TableCell, { children: o.createdByName })] }, o.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 8, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('operations.delivery.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] }), wizard && (_jsx(ReturnOrderWizard, { initialWorkerId: creating ? location.state?.workerId : undefined, fixedWorker: creating && !!location.state?.fromWorker, onClose: () => (creating ? (location.state?.fromWorker ? navigate(-1) : navigate('/operations/return-orders')) : setWizard(false)), onSaved: (saved, failed) => navigate(`/operations/return-orders/${saved}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`) }))] }));
}
