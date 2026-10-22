import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AddIcon from '@mui/icons-material/Add';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { Box, Button, InputAdornment, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { operationsApi } from '../../api/operations';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, Initials } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { DeliveryStatusBadge, deliveryTone } from './delivery';
import { DeliveryOrderWizard } from './DeliveryOrderWizard';
import { ListHero, rowEdge, StageLine, StatusStrip, StripItem, toneHead, useCurrentStages } from '../../components/ListLayout';
import { toneColors } from '../../app/theme';
/** Delivery orders, as the old "أوامر تسليم العمالة" page: search, cards that filter, and the orders. */
export function DeliveryOrdersPage({ creating = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [wizard, setWizard] = useState(creating);
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
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
        operationsApi
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
    const stages = useCurrentStages('operations.delivery_order', (data?.items ?? []).map((x) => x.id));
    return (_jsxs(Box, { children: [_jsx(ListHero, { tone: "delivery", icon: _jsx(LocalShippingOutlinedIcon, {}), title: t('operations.delivery.title'), subtitle: t('operations.delivery.intro'), actions: can('operations.delivery.create', true) ? (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setWizard(true), children: t('operations.delivery.new') })) : undefined }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(StatusStrip, { count: 5, children: [card('', t('operations.delivery.cards.all'), data?.totals.all, t('operations.delivery.cards.allFoot'), _jsx(DescriptionOutlinedIcon, {}), tokens.navy700), card('preparing', t('operations.delivery.cards.preparing'), data?.totals.underPreparation, t('operations.delivery.cards.preparingFoot'), _jsx(EditNoteOutlinedIcon, {}), '#6b7a90'), card('operations', t('operations.delivery.cards.operations'), data?.totals.withOperations, t('operations.delivery.cards.operationsFoot'), _jsx(HourglassBottomOutlinedIcon, {}), '#d9822b'), card('delivered', t('operations.delivery.cards.delivered'), data?.totals.delivered, t('operations.delivery.cards.deliveredFoot'), _jsx(TaskAltOutlinedIcon, {}), '#1f9d55'), card('closed', t('operations.delivery.cards.closed'), data?.totals.closed, t('operations.delivery.cards.closedFoot'), _jsx(AssignmentTurnedInOutlinedIcon, {}), '#c0392b')] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsxs(Box, { component: "form", sx: { display: 'flex', gap: 1, flex: 1, minWidth: { md: 320 }, maxWidth: 560 }, onSubmit: (e) => (e.preventDefault(), update({ q: text.trim() || null })), children: [_jsx(TextField, { size: "small", fullWidth: true, placeholder: t('operations.delivery.search'), value: text, onChange: (e) => setText(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } }), _jsx(Button, { type: "submit", variant: "contained", children: t('workforce.searchButton') }), (search || status || source) && _jsx(Button, { onClick: () => (setText(''), setParams(new URLSearchParams(), { replace: true })), children: t('workforce.reset') })] }), _jsxs(TextField, { select: true, size: "small", value: source || 'all', onChange: (e) => update({ source: e.target.value === 'all' ? null : e.target.value }), sx: { minWidth: 200 }, children: [_jsx(MenuItem, { value: "all", children: t('operations.delivery.source.all') }), _jsx(MenuItem, { value: "system", children: t('operations.delivery.source.system') }), _jsx(MenuItem, { value: "crm", children: t('operations.delivery.source.crm') })] }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Box, { sx: { px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 700, fontSize: 13 }, children: t('operations.delivery.count', { count: data?.total ?? 0 }) })] }), busy && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { sx: toneHead('delivery'), children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: head('orderNo', t('operations.delivery.col.order')) }), _jsx(TableCell, { children: head('deliverOn', t('operations.delivery.col.deliverOn')) }), _jsx(TableCell, { children: head('startOn', t('operations.delivery.col.startOn')) }), _jsx(TableCell, { align: "center", children: head('workers', t('operations.delivery.col.workers')) }), _jsx(TableCell, { children: t('commercial.col.manager') }), _jsx(TableCell, { children: t('operations.delivery.col.status') }), _jsx(TableCell, { children: t('operations.delivery.col.receiver') })] }) }), _jsxs(TableBody, { children: [data?.items.map((o) => (_jsxs(TableRow, { hover: true, sx: [{ cursor: 'pointer' }, rowEdge(toneColors[deliveryTone[o.status]].fg)], onClick: () => navigate(`/operations/delivery-orders/${o.id}`), children: [_jsx(TableCell, { sx: { minWidth: 240 }, children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25 }, children: [_jsx(Initials, { name: o.projectName, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: o.projectName }), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75 }, children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500 }, children: o.orderNo }), o.source === 'Crm' && _jsx(Badge, { tone: "neutral", children: t('operations.delivery.fromCrm') })] })] })] }) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(o.deliverOn) }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(o.startOn) }), _jsx(TableCell, { align: "center", children: _jsx(Badge, { tone: "info", children: o.workers }) }), _jsx(TableCell, { children: o.projectManager ?? '—' }), _jsxs(TableCell, { children: [_jsx(DeliveryStatusBadge, { row: o }), _jsx(StageLine, { stage: stages[o.id] })] }), _jsx(TableCell, { children: o.receiverName })] }, o.id))), data && data.items.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 7, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('operations.delivery.empty') }) }))] })] }) }), _jsx(TablePagination, { component: "div", count: data?.total ?? 0, page: Math.max(0, page - 1), onPageChange: (_, p) => update({ page: String(p + 1) }), rowsPerPage: pageSize, rowsPerPageOptions: [25, 50, 100], onRowsPerPageChange: (e) => (setPageSize(Number(e.target.value)), update({ page: null })), labelRowsPerPage: t('workforce.perPage'), labelDisplayedRows: ({ from, to, count }) => t('workforce.rows', { from, to, count }) })] }), wizard && (_jsx(DeliveryOrderWizard, { initialWorkerIds: creating ? location.state?.workerIds : undefined, fixedWorkers: creating && !!location.state?.fromWorker, onClose: () => (creating ? (location.state?.fromWorker ? navigate(-1) : navigate('/operations/delivery-orders')) : setWizard(false)), onSaved: (saved, failed) => navigate(`/operations/delivery-orders/${saved}${failed ? `?error=errors.${failed.replace('.', '_')}` : ''}`) }))] }));
}
