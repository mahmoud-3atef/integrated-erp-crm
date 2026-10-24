import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import TableViewOutlinedIcon from '@mui/icons-material/TableViewOutlined';
import { Alert, Box, Button, Chip, InputAdornment, Link, MenuItem, Pagination, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { staffApi } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrScope, hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLegalEntities } from '../payroll/RunDialogs';
import { card, wf } from '../workforce/workforceUi';
import { HireDialog } from './StaffDialogs';
import { BulkUpdateDialog } from './BulkUpdateDialog';
import { daysUntil, StaffStatusBadge } from './staff';
const tabs = ['all', 'active', 'probation', 'ending', 'incomplete', 'left'];
/**
 * The staff directory, laid out as the workers list (the user's choice, 2026-10-24; an exception to the HR spec's page
 * header and KPI row, docs/02-target-architecture/22): one toolbar — search, status, department, registration, the
 * total and the actions — the applied filters, and a dense table with a navy header and the employee column held in
 * place; the employees come page by page from the server, as before.
 */
export function StaffDirectoryPage({ creating = false } = {}) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { date } = useCommercialFormat();
    const entities = useLegalEntities();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') ?? 'all';
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [department, setDepartment] = useState('');
    const [entity, setEntity] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [data, setData] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [hire, setHire] = useState(creating);
    const [bulk, setBulk] = useState(false);
    const [version, setVersion] = useState(0);
    const latest = useRef(0);
    const canManage = can('staff.manage', true);
    const ar = i18n.language === 'ar';
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    useEffect(() => setPage(1), [query, department, entity, tab, pageSize]);
    useEffect(() => {
        staffApi.structure().then((s) => setDepartments(s.departments)).catch(() => setDepartments([]));
    }, [version]);
    const q = useMemo(() => ({ search: query, tab, departmentId: department || undefined, legalEntityId: entity || undefined, page, pageSize }), [query, tab, department, entity, page, pageSize]);
    useEffect(() => {
        const ticket = ++latest.current;
        staffApi
            .employees(q)
            .then((d) => ticket === latest.current && (setData(d), setError(null)))
            .catch((failure) => ticket === latest.current && setError(errorKey(failure)));
    }, [q, version]);
    const runImport = async () => {
        setBusy(true);
        setError(null);
        try {
            const r = await staffApi.importOld();
            setNotice(t('staff.imported', r));
            setVersion((v) => v + 1);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    const setTab = (value) => setParams((p) => (value === 'all' ? p.delete('tab') : p.set('tab', value), p), { replace: true });
    const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
    const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
    const filtered = !!(query || department || entity || tab !== 'all');
    const departmentName = departments.find((d) => d.id === department);
    const entityName = entities.find((e) => e.id === entity);
    const control = { '& .MuiOutlinedInput-root': { borderRadius: wf.control, height: 40 } };
    const chip = { bgcolor: wf.goldSoft, color: wf.navy, fontWeight: 600, '& .MuiChip-deleteIcon': { color: wf.goldText } };
    return (_jsxs(HrScope, { children: [_jsx(ErrorMessage, { messageKey: error }), notice && (_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, onClose: () => setNotice(null), children: notice })), _jsxs(Box, { sx: { ...card, p: { xs: 1.5, md: 2 } }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.25, alignItems: { md: 'center' }, mb: 1.25, flexWrap: 'wrap' }, children: [_jsx(TextField, { size: "small", label: t('workforce.ui.searchLabel'), value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('staff.filters.search'), sx: { width: { xs: '100%', md: 300 }, ...control }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, inputLabel: { shrink: true } } }), _jsx(TextField, { select: true, size: "small", label: t('staff.cols.status'), value: tab, onChange: (e) => setTab(e.target.value), sx: { width: { xs: '100%', md: 180 }, ...control }, children: tabs.map((k) => (_jsx(MenuItem, { value: k, children: t(`staff.tabs.${k}`) }, k))) }), _jsxs(TextField, { select: true, size: "small", label: t('staff.filters.department'), value: department, onChange: (e) => setDepartment(e.target.value), sx: { width: { xs: '100%', md: 200 }, ...control }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staff.filters.allDepartments') }), departments.map((d) => (_jsx(MenuItem, { value: d.id, children: ar ? d.nameAr : d.nameEn }, d.id)))] }), _jsxs(TextField, { select: true, size: "small", label: t('staff.filters.legalEntity'), value: entity, onChange: (e) => setEntity(e.target.value), sx: { width: { xs: '100%', md: 190 }, ...control }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staff.filters.allEntities') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: localName(e, i18n.language) }, e.id)))] }), _jsx(Box, { sx: { flex: 1 } }), canManage && (_jsxs(Stack, { direction: "row", sx: { gap: 1, flexWrap: 'wrap' }, children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(SyncIcon, {}), disabled: busy, onClick: () => void runImport(), sx: { height: 40, borderRadius: wf.control, borderColor: wf.border, color: wf.navy }, children: t('staff.import') }), can('staff.bulk_update', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(TableViewOutlinedIcon, {}), onClick: () => setBulk(true), sx: { height: 40, borderRadius: wf.control, borderColor: wf.border, color: wf.navy }, children: t('staff.bulk.action') })), _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setHire(true), sx: { height: 40, borderRadius: wf.control, bgcolor: wf.navy, boxShadow: 'none', '&:hover': { bgcolor: wf.navyHover, boxShadow: 'none' } }, children: t('staff.new') })] })), _jsxs(Box, { sx: { textAlign: 'end' }, children: [_jsx(Typography, { sx: { fontSize: 12, color: wf.textSecondary, lineHeight: 1.2 }, children: t('workforce.ui.total.staff') }), _jsx(Typography, { sx: { fontSize: 18, fontWeight: 600, color: wf.navy, fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }, children: data ? data.total.toLocaleString('en-US') : '—' })] })] }), filtered && (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, mb: 1.25, flexWrap: 'wrap' }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: wf.textSecondary }, children: t('workforce.ui.applied') }), tab !== 'all' && _jsx(Chip, { size: "small", label: `${t('staff.cols.status')}: ${t(`staff.tabs.${tab}`)}`, onDelete: () => setTab('all'), deleteIcon: _jsx(CloseIcon, {}), sx: chip }), departmentName && _jsx(Chip, { size: "small", label: `${t('staff.filters.department')}: ${ar ? departmentName.nameAr : departmentName.nameEn}`, onDelete: () => setDepartment(''), deleteIcon: _jsx(CloseIcon, {}), sx: chip }), entityName && _jsx(Chip, { size: "small", label: `${t('staff.filters.legalEntity')}: ${localName(entityName, i18n.language)}`, onDelete: () => setEntity(''), deleteIcon: _jsx(CloseIcon, {}), sx: chip }), query && _jsx(Chip, { size: "small", label: `${t('workforce.ui.searchLabel')}: ${query}`, onDelete: () => (setSearch(''), setQuery('')), deleteIcon: _jsx(CloseIcon, {}), sx: chip }), _jsx(Link, { component: "button", onClick: () => (setSearch(''), setQuery(''), setDepartment(''), setEntity(''), setTab('all')), sx: { fontSize: 12.5, fontWeight: 600, color: wf.navy }, children: t('workforce.ui.clearAll') })] })), !data ? (_jsx(Stack, { sx: { gap: 0.5 }, children: Array.from({ length: 8 }, (_, i) => (_jsx(Skeleton, { height: 40 }, i))) })) : data.total === 0 ? (_jsx(HrEmptyState, { icon: _jsx(PersonSearchOutlinedIcon, {}), title: filtered ? t('staff.noResults') : t('staff.empty'), hint: filtered ? undefined : t('staff.emptyHint') })) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { sx: { maxHeight: 'calc(100dvh - 240px)', minHeight: 240, border: `1px solid ${wf.border}`, borderRadius: wf.control }, children: _jsxs(Table, { size: "small", stickyHeader: true, sx: {
                                        borderCollapse: 'separate',
                                        // !important: the HR theme (HrScope) styles table heads light; this list's head is navy, as the workers list.
                                        '& thead th': { bgcolor: `${wf.navy} !important`, color: '#fff !important', fontSize: 12.5, fontWeight: 600, py: 1.25, borderBottom: '0 !important', whiteSpace: 'nowrap' },
                                        '& td': { fontSize: 13, color: wf.text, height: 44, py: 0.5, borderBottom: `1px solid ${wf.subtle}` },
                                        '& tbody tr:hover td': { bgcolor: wf.rowHover },
                                        // The employee column stays in view while scrolling sideways.
                                        '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: wf.surface, boxShadow: `inset -1px 0 0 ${wf.border}` },
                                        '& th.pin': { zIndex: 4, bgcolor: wf.navy },
                                    }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { className: "pin", sx: { minWidth: 220 }, children: t('staff.cols.employee') }), _jsx(TableCell, { children: t('staff.cols.number') }), _jsx(TableCell, { children: t('staff.cols.department') }), _jsx(TableCell, { children: t('staff.cols.jobTitle') }), _jsx(TableCell, { children: t('staff.cols.status') }), _jsx(TableCell, { children: t('staff.cols.hire') }), _jsx(TableCell, { children: t('staff.cols.contractEnd') }), _jsx(TableCell, { children: t('staff.cols.file') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: data.items.map((r) => {
                                                const left = daysUntil(r.contractEndsOn);
                                                const open = () => navigate(`/hr/employees/${r.id}`);
                                                return (_jsxs(TableRow, { hover: true, tabIndex: 0, sx: { cursor: 'pointer', '&:focus-visible td': { bgcolor: wf.rowHover }, '&:focus-visible': { outline: `2px solid ${wf.gold}`, outlineOffset: -2 } }, onClick: open, onKeyDown: (e) => e.key === 'Enter' && open(), children: [_jsx(TableCell, { className: "pin", children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(HrAvatar, { name: r.nameEn || r.name, size: 28 }), _jsxs(Box, { sx: { minWidth: 0, maxWidth: 240 }, children: [_jsx(Typography, { sx: { fontWeight: 600, fontSize: 13, color: wf.navy, lineHeight: 1.3 }, children: r.name }), _jsx(Typography, { sx: { fontSize: 11.5, color: wf.textSecondary }, children: (ar ? r.nationalityAr : r.nationalityEn) ?? '' })] })] }) }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums', color: `${wf.textSecondary} !important` }, children: _jsx("bdi", { children: r.employeeNo }) }), _jsx(TableCell, { children: (ar ? r.departmentAr : r.departmentEn) ?? t('staff.unset') }), _jsx(TableCell, { children: (ar ? r.jobTitleAr : r.jobTitleEn) ?? t('staff.unset') }), _jsx(TableCell, { children: _jsx(StaffStatusBadge, { status: r.status }) }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }, children: r.hireDate ? date(r.hireDate) : '—' }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: left !== null && left >= 0 && left <= 90 ? '#B45309 !important' : undefined, fontWeight: left !== null && left >= 0 && left <= 90 ? 700 : undefined }, children: r.contractEndsOn ? date(r.contractEndsOn) : '—' }), _jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: { width: 64, height: 6, borderRadius: 99, bgcolor: wf.subtle, overflow: 'hidden' }, role: "img", "aria-label": `${r.completeness}%`, children: _jsx(Box, { sx: { height: '100%', width: `${r.completeness}%`, bgcolor: r.completeness >= 80 ? hr.success : r.completeness >= 50 ? hr.warning : hr.danger } }) }), _jsx(Typography, { component: "span", sx: { fontSize: 12, color: wf.textSecondary, fontVariantNumeric: 'tabular-nums' }, children: _jsxs("bdi", { children: [r.completeness, "%"] }) })] }) }), _jsx(TableCell, { children: _jsx(Button, { size: "small", sx: { fontWeight: 600, color: wf.navy }, children: t('staff.open') }) })] }, r.id));
                                            }) })] }) }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 1.5, mt: 1.5 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: wf.textSecondary }, children: t('staff.shown', { from, to, total: data.total }) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Pagination, { count: Math.max(1, Math.ceil(data.total / data.pageSize)), page: data.page, onChange: (_, p) => setPage(p), shape: "rounded", size: "small", sx: { '& .Mui-selected': { bgcolor: `${wf.navy} !important`, color: '#fff' } } }), _jsx(TextField, { select: true, size: "small", value: pageSize, onChange: (e) => setPageSize(Number(e.target.value)), sx: { width: 150, '& .MuiOutlinedInput-root': { borderRadius: wf.control } }, children: [10, 25, 50, 100].map((n) => (_jsx(MenuItem, { value: n, children: t('staff.perPage', { count: n }) }, n))) })] })] }))] }), _jsx(HireDialog, { open: hire, departments: departments, onClose: () => {
                    setHire(false);
                    if (creating)
                        navigate('/hr/employees');
                }, onSaved: (id) => navigate(`/hr/employees/${id}`) }), bulk && (_jsx(BulkUpdateDialog, { onClose: () => setBulk(false), onApplied: (changes) => {
                    setBulk(false);
                    setNotice(t('staff.bulk.applied', { count: changes }));
                    setVersion((v) => v + 1);
                } }))] }));
}
