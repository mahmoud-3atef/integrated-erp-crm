import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Add from '@mui/icons-material/Add';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SyncIcon from '@mui/icons-material/Sync';
import { Alert, Box, Button, InputAdornment, LinearProgress, MenuItem, Pagination, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { staffApi } from '../../api/staff';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrAvatar, HrEmptyState, HrPageHeader, HrScope, hr, hrAccents, hrCard } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { useLegalEntities } from '../payroll/RunDialogs';
import { HireDialog } from './StaffDialogs';
import { BulkUpdateDialog } from './BulkUpdateDialog';
import TableViewOutlinedIcon from '@mui/icons-material/TableViewOutlined';
import { daysUntil, StaffStatusBadge } from './staff';
const tabs = ['all', 'active', 'probation', 'ending', 'incomplete', 'left'];
/** The staff directory: the cards, the tabs and filters, and the employees page by page from the server. */
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
    const [kpis, setKpis] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState(false);
    const [hire, setHire] = useState(creating);
    const [bulk, setBulk] = useState(false);
    const [version, setVersion] = useState(0);
    const latest = useRef(0);
    const canManage = can('staff.manage', true);
    useEffect(() => {
        const timer = setTimeout(() => setQuery(search), 300);
        return () => clearTimeout(timer);
    }, [search]);
    useEffect(() => setPage(1), [query, department, entity, tab, pageSize]);
    useEffect(() => {
        staffApi.kpis().then(setKpis).catch(() => setKpis(null));
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
    const cards = kpis
        ? [
            [t('staff.kpi.employees'), kpis.employees, t('staff.kpi.employeesSub', { active: kpis.active, probation: kpis.probation, suspended: kpis.suspended }), hr.text, hrAccents.violet.tint],
            [t('staff.kpi.probation'), kpis.probation, t('staff.kpi.probationSub', { count: kpis.probationEndingIn30 }), hr.primary, hrAccents.blue.tint],
            [t('staff.kpi.ending'), kpis.contractsEndingIn90, t('staff.kpi.endingSub', { in60: kpis.contractsEndingIn60, in30: kpis.contractsEndingIn30 }), '#B45309', hrAccents.amber.tint],
            [t('staff.kpi.incomplete'), kpis.incomplete, t('staff.kpi.incompleteSub'), '#B91C1C', hrAccents.rose.tint],
            [t('staff.kpi.vacancies'), kpis.vacancies, t('staff.kpi.vacanciesSub', { count: kpis.departmentsWithVacancies }), hr.success, hrAccents.green.tint],
        ]
        : [];
    const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
    const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;
    return (_jsxs(HrScope, { children: [_jsx(HrPageHeader, { icon: _jsx(BadgeOutlinedIcon, {}), title: t('staff.title'), subtitle: t('staff.intro'), actions: canManage && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "outlined", startIcon: _jsx(SyncIcon, {}), disabled: busy, onClick: () => void runImport(), children: t('staff.import') }), can('staff.bulk_update', true) && (_jsx(Button, { variant: "outlined", startIcon: _jsx(TableViewOutlinedIcon, {}), onClick: () => setBulk(true), children: t('staff.bulk.action') })), _jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setHire(true), children: t('staff.new') })] })) }), _jsx(ErrorMessage, { messageKey: error }), notice && (_jsx(Alert, { severity: "success", sx: { mb: 1.5 }, onClose: () => setNotice(null), children: notice })), _jsx(Box, { sx: { display: 'grid', gap: 1.5, mb: 1.75, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }, children: kpis
                    ? cards.map(([label, value, sub, color, tint]) => (_jsxs(Box, { sx: { ...hrCard, bgcolor: tint, p: 1.75 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, fontWeight: 600, color: '#334155' }, children: label }), _jsx(Typography, { sx: { fontSize: 24, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }, children: value?.toLocaleString('en-US') ?? '—' }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: sub })] }, label)))
                    : Array.from({ length: 5 }, (_, i) => _jsx(Skeleton, { variant: "rounded", height: 96 }, i)) }), _jsxs(Box, { sx: { ...hrCard, px: 2, pb: 2 }, children: [_jsx(Tabs, { value: tab, onChange: (_, v) => setParams((p) => (p.set('tab', v), p), { replace: true }), variant: "scrollable", sx: { borderBottom: `1px solid ${hr.border}`, mb: 1.5 }, children: tabs.map((k) => (_jsx(Tab, { value: k, label: t(`staff.tabs.${k}`) }, k))) }), _jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1, mb: 1.5 }, children: [_jsx(TextField, { size: "small", value: search, onChange: (e) => setSearch(e.target.value), placeholder: t('staff.filters.search'), sx: { width: { md: 320 }, flex: { md: '0 0 320px' } }, slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) }, htmlInput: { 'aria-label': t('staff.filters.search') } } }), _jsxs(TextField, { select: true, size: "small", label: t('staff.filters.department'), value: department, onChange: (e) => setDepartment(e.target.value), sx: { width: { md: 240 } }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staff.filters.allDepartments') }), departments.map((d) => (_jsx(MenuItem, { value: d.id, children: i18n.language === 'ar' ? d.nameAr : d.nameEn }, d.id)))] }), _jsxs(TextField, { select: true, size: "small", label: t('staff.filters.legalEntity'), value: entity, onChange: (e) => setEntity(e.target.value), sx: { width: { md: 220 } }, slotProps: { select: { displayEmpty: true }, inputLabel: { shrink: true } }, children: [_jsx(MenuItem, { value: "", children: t('staff.filters.allEntities') }), entities.map((e) => (_jsx(MenuItem, { value: e.id, children: localName(e, i18n.language) }, e.id)))] })] }), !data ? (_jsx(LinearProgress, {})) : data.total === 0 ? (_jsx(HrEmptyState, { icon: _jsx(PersonSearchOutlinedIcon, {}), title: query || department || entity || tab !== 'all' ? t('staff.noResults') : t('staff.empty'), hint: query || department || entity ? undefined : t('staff.emptyHint') })) : (_jsxs(_Fragment, { children: [_jsx(TableContainer, { sx: { border: `1px solid ${hr.border}`, borderRadius: '10px' }, children: _jsxs(Table, { size: "small", sx: { '& td': { height: 46 } }, children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('staff.cols.employee') }), _jsx(TableCell, { children: t('staff.cols.number') }), _jsx(TableCell, { children: t('staff.cols.department') }), _jsx(TableCell, { children: t('staff.cols.jobTitle') }), _jsx(TableCell, { children: t('staff.cols.status') }), _jsx(TableCell, { children: t('staff.cols.hire') }), _jsx(TableCell, { children: t('staff.cols.contractEnd') }), _jsx(TableCell, { children: t('staff.cols.file') }), _jsx(TableCell, {})] }) }), _jsx(TableBody, { children: data.items.map((r) => {
                                                const left = daysUntil(r.contractEndsOn);
                                                const ar = i18n.language === 'ar';
                                                return (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/hr/employees/${r.id}`), children: [_jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(HrAvatar, { name: r.nameEn || r.name, size: 30 }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 13 }, children: r.name }), _jsx(Typography, { sx: { fontSize: 11.5, color: hr.textMuted }, children: (ar ? r.nationalityAr : r.nationalityEn) ?? '' })] })] }) }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums', color: hr.textMuted }, children: _jsx("bdi", { children: r.employeeNo }) }), _jsx(TableCell, { children: (ar ? r.departmentAr : r.departmentEn) ?? t('staff.unset') }), _jsx(TableCell, { children: (ar ? r.jobTitleAr : r.jobTitleEn) ?? t('staff.unset') }), _jsx(TableCell, { children: _jsx(StaffStatusBadge, { status: r.status }) }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums' }, children: r.hireDate ? date(r.hireDate) : '—' }), _jsx(TableCell, { sx: { fontVariantNumeric: 'tabular-nums', color: left !== null && left >= 0 && left <= 90 ? '#B45309' : undefined, fontWeight: left !== null && left >= 0 && left <= 90 ? 700 : undefined }, children: r.contractEndsOn ? date(r.contractEndsOn) : '—' }), _jsx(TableCell, { children: _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(Box, { sx: { width: 64, height: 6, borderRadius: 99, bgcolor: '#EEF2F7', overflow: 'hidden' }, role: "img", "aria-label": `${r.completeness}%`, children: _jsx(Box, { sx: { height: '100%', width: `${r.completeness}%`, bgcolor: r.completeness >= 80 ? hr.success : r.completeness >= 50 ? hr.warning : hr.danger } }) }), _jsx(Typography, { component: "span", sx: { fontSize: 12, color: hr.textMuted, fontVariantNumeric: 'tabular-nums' }, children: _jsxs("bdi", { children: [r.completeness, "%"] }) })] }) }), _jsx(TableCell, { children: _jsx(Button, { size: "small", sx: { fontWeight: 600 }, children: t('staff.open') }) })] }, r.id));
                                            }) })] }) }), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, sx: { alignItems: 'center', gap: 1.5, mt: 1.5 }, children: [_jsx(Typography, { sx: { fontSize: 12.5, color: hr.textMuted }, children: t('staff.shown', { from, to, total: data.total }) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Pagination, { count: Math.max(1, Math.ceil(data.total / data.pageSize)), page: data.page, onChange: (_, p) => setPage(p), shape: "rounded", color: "primary", size: "small" }), _jsx(TextField, { select: true, size: "small", value: pageSize, onChange: (e) => setPageSize(Number(e.target.value)), sx: { width: 150 }, children: [10, 25, 50, 100].map((n) => (_jsx(MenuItem, { value: n, children: t('staff.perPage', { count: n }) }, n))) })] })] }))] }), _jsx(HireDialog, { open: hire, departments: departments, onClose: () => {
                    setHire(false);
                    if (creating)
                        navigate('/hr/employees');
                }, onSaved: (id) => navigate(`/hr/employees/${id}`) }), bulk && (_jsx(BulkUpdateDialog, { onClose: () => setBulk(false), onApplied: (changes) => {
                    setBulk(false);
                    setNotice(t('staff.bulk.applied', { count: changes }));
                    setVersion((v) => v + 1);
                } }))] }));
}
