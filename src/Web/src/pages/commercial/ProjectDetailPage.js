import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Box, Button, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi } from '../../api/commercial';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge, PillTabs } from '../../components/ui';
import { placementLook } from '../../components/workforce/placement';
import { draftFromSuggestion, PackageDialog, PackagesTable, SuggestionsTable, WorkerPricesTable } from './pricing';
import { contractStatusTone, DaysLeft, useCommercialFormat } from './ProjectsPage';
import { useCrumb } from '../../app/breadcrumbs';
import { billingApi } from '../../api/billing';
import { CreateTimesheetDialog, TimesheetSettingsDialog } from '../billing/timesheetSetup';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
/** One project, as the old project page: title bar, project and contract sections, then its workers, price packages and worker prices. */
export function ProjectDetailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const { ar, date } = useCommercialFormat();
    const { can } = useSession();
    const canPrices = can('commercial.prices.view', true);
    const canManage = can('commercial.prices.manage', true);
    const [dialog, setDialog] = useState(null);
    const [reload, setReload] = useState(0);
    // The project's timesheet settings, and «إنشاء التحضير الشهري» (billing's own permissions).
    const seeBilling = can('billing.timesheets.view', true);
    const canGenerate = can('billing.timesheets.manage', true);
    const [billing, setBilling] = useState(null);
    const [creating, setCreating] = useState(false);
    const [editingBilling, setEditingBilling] = useState(false);
    const [billingReload, setBillingReload] = useState(0);
    const [params] = useSearchParams();
    const [project, setProject] = useState(null);
    useCrumb(project?.summary.name);
    const [prices, setPrices] = useState(null);
    const [tab, setTab] = useState(() => (params.get('tab') === 'packages' ? 'packages' : 'workers'));
    const [error, setError] = useState(null);
    useEffect(() => {
        commercialApi
            .project(id)
            .then((loaded) => {
            // Opened by the old system's id (from a worker's file): continue on the project's own address.
            if (loaded.summary.id !== id)
                navigate(`/commercial/projects/${loaded.summary.id}`, { replace: true });
            else
                setProject(loaded);
        })
            .catch((failure) => setError(errorKey(failure)));
    }, [id, navigate]);
    // The prices and the timesheet settings once the project is known by its own id.
    const known = project?.summary.id === id;
    useEffect(() => {
        if (canPrices && known) {
            commercialApi.projectPrices(id).then(setPrices).catch((failure) => setError(errorKey(failure)));
        }
    }, [id, known, canPrices, reload]);
    useEffect(() => {
        if (id && known && seeBilling) {
            billingApi.settings(id).then(setBilling).catch(() => setBilling(null));
        }
    }, [id, known, seeBilling, billingReload]);
    const toggle = async (row) => {
        try {
            await commercialApi.setPackageActive(row.id, !row.isActive);
            setReload((n) => n + 1);
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    };
    if (!project) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const p = project.summary;
    const months = p.startsOn && p.endsOn ? Math.round((new Date(p.endsOn).getTime() - new Date(p.startsOn).getTime()) / (30.44 * 86400000)) : null;
    const working = project.workers.filter((w) => w.placement === 'Working').length;
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 2, bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '16px 20px', mb: `${tokens.gap}px` }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '16px', bgcolor: tokens.navy700, color: '#fff', fontSize: 24, fontWeight: 800 }, children: p.name.trim().charAt(0).toUpperCase() }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { sx: { display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12.5, color: tokens.gray500, '& svg': { fontSize: 16 } }, children: [_jsx(AccountTreeOutlinedIcon, {}), t('commercial.projectDetails')] }), _jsx(Typography, { component: "h1", sx: { fontSize: 20, fontWeight: 800, color: tokens.navy800 }, children: p.name })] }), p.contractStatus && _jsx(Badge, { tone: contractStatusTone[p.contractStatus], children: t(`commercial.contractStatus.${p.contractStatus}`) }), !p.isActive && _jsx(Badge, { tone: "neutral", children: t('commercial.inactive') }), canGenerate && (_jsx(Button, { variant: "contained", startIcon: _jsx(PostAddOutlinedIcon, {}), onClick: () => setCreating(true), children: t('timesheets.create.button') })), _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate(-1), children: t('common.back') })] }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start', mb: `${tokens.gap}px` }, children: [_jsxs(FieldSection, { title: t('commercial.sections.project'), icon: _jsx(BusinessOutlinedIcon, {}), children: [_jsx(FieldBox, { label: t('commercial.field.code'), icon: _jsx(TagOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: p.code }) }), _jsx(FieldBox, { label: t('commercial.field.cr'), icon: _jsx(BadgeOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: project.commercialRegistration ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.col.customer'), icon: _jsx(BusinessOutlinedIcon, {}), wide: true, children: p.customerId ? (_jsx(Link, { component: RouterLink, to: `/commercial/customers/${p.customerId}`, underline: "hover", children: p.customerName })) : (_jsx(Badge, { tone: "danger", children: t('commercial.noCustomer') })) }), _jsx(FieldBox, { label: t('commercial.col.manager'), icon: _jsx(ManageAccountsOutlinedIcon, {}), children: p.manager ?? '—' }), _jsx(FieldBox, { label: t('commercial.field.contact'), icon: _jsx(PersonOutlinedIcon, {}), children: project.contactName ?? '—' }), _jsx(FieldBox, { label: t('commercial.field.mobile'), icon: _jsx(ContactPhoneOutlinedIcon, {}), children: _jsx("span", { dir: "ltr", children: project.contactMobile ?? '—' }) }), _jsx(FieldBox, { label: t('commercial.field.city'), icon: _jsx(LocationCityOutlinedIcon, {}), children: project.city ?? '—' }), _jsx(FieldBox, { label: t('commercial.field.sector'), icon: _jsx(CategoryOutlinedIcon, {}), children: project.sector ?? '—' }), _jsx(FieldBox, { label: t('commercial.col.created'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: date(p.createdAt) }), project.contactEmails && (_jsx(FieldBox, { label: t('commercial.field.emails'), icon: _jsx(EmailOutlinedIcon, {}), wide: true, multiline: true, children: _jsx("span", { dir: "ltr", children: project.contactEmails }) }))] }), billing && (_jsxs(FieldSection, { title: t('timesheets.projectSettings.title'), icon: _jsx(TuneOutlinedIcon, {}), tone: "sky", children: [_jsx(FieldBox, { label: t('timesheets.settings.cycleStartDay'), icon: _jsx(DateRangeOutlinedIcon, {}), children: billing.cycleStartDay === 1 ? t('timesheets.settings.calendarMonth') : t('timesheets.settings.fromDay', { day: billing.cycleStartDay, prev: billing.cycleStartDay - 1 }) }), _jsx(FieldBox, { label: t('timesheets.settings.dayBasis'), icon: _jsx(CalendarMonthOutlinedIcon, {}), children: t(`timesheets.dayBasis.${billing.dayBasis}`) }), _jsx(FieldBox, { label: t('timesheets.settings.overtimeMultiplier'), icon: _jsx(TagOutlinedIcon, {}), children: _jsx("bdi", { children: billing.overtimeMultiplier }) }), _jsx(FieldBox, { label: t('timesheets.settings.monthlyHours'), icon: _jsx(TagOutlinedIcon, {}), children: _jsx("bdi", { children: billing.monthlyHours }) }), _jsx(FieldBox, { label: t('timesheets.settings.gosiRate'), icon: _jsx(TagOutlinedIcon, {}), children: _jsxs("bdi", { children: [Math.round(billing.gosiRate * 10000) / 100, "%"] }) }), _jsx(FieldBox, { label: t('timesheets.settings.vatRate'), icon: _jsx(TagOutlinedIcon, {}), children: _jsxs("bdi", { children: [Math.round(billing.vatRate * 10000) / 100, "%"] }) }), canGenerate && (_jsx(Box, { sx: { gridColumn: '1 / -1' }, children: _jsx(Button, { size: "small", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setEditingBilling(true), children: t('timesheets.projectSettings.edit') }) }))] })), _jsxs(FieldSection, { title: t('commercial.sections.contract'), icon: _jsx(DescriptionOutlinedIcon, {}), tone: "sky", children: [_jsx(FieldBox, { label: t('commercial.col.contractStatus'), icon: _jsx(VerifiedOutlinedIcon, {}), children: p.contractStatus ? t(`commercial.contractStatus.${p.contractStatus}`) : '—' }), _jsx(FieldBox, { label: t('commercial.col.contractType'), icon: _jsx(CategoryOutlinedIcon, {}), children: p.contractType ? t(`commercial.contractType.${p.contractType}`) : '—' }), _jsx(FieldBox, { label: t('commercial.field.start'), icon: _jsx(EventAvailableOutlinedIcon, {}), children: date(p.startsOn) }), _jsx(FieldBox, { label: t('commercial.field.end'), icon: _jsx(EventBusyOutlinedIcon, {}), children: date(p.endsOn) }), _jsxs(FieldBox, { label: t('commercial.field.duration'), icon: _jsx(HourglassBottomOutlinedIcon, {}), wide: true, children: [months !== null ? t('commercial.months', { count: months }) : '—', _jsx(Box, { component: "span", sx: { marginInlineStart: 1.5 }, children: _jsx(DaysLeft, { days: p.daysLeft }) })] }), _jsx(FieldBox, { label: t('commercial.field.contractNo'), icon: _jsx(TagOutlinedIcon, {}), wide: true, children: _jsx("span", { dir: "ltr", children: project.contractNo }) })] })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }, children: [_jsx(PillTabs, { value: tab, onChange: setTab, options: [
                            { value: 'workers', label: t('commercial.tabs.workers', { count: working, total: project.workers.length }) },
                            ...(prices
                                ? [
                                    { value: 'packages', label: t('commercial.tabs.packages', { count: prices.packages.length }) },
                                    { value: 'prices', label: t('commercial.tabs.prices', { count: prices.workers.filter((w) => w.status !== 'Package').length }) },
                                ]
                                : []),
                        ] }), tab === 'packages' && prices ? (_jsxs(_Fragment, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600 }, children: t('commercial.prices.projectPackagesIntro') }), canManage && (_jsx(Button, { variant: "contained", size: "small", startIcon: _jsx(AddIcon, {}), onClick: () => setDialog({ draft: { projectId: p.id } }), children: t('commercial.prices.new') }))] }), prices.packages.length === 0 ? (_jsx(Typography, { sx: { py: 3, textAlign: 'center', color: tokens.gray500 }, children: t('commercial.prices.noPackages') })) : (_jsx(PackagesTable, { rows: prices.packages, showProject: true, onEdit: canManage ? (row) => setDialog({ package: row }) : undefined, onToggle: canManage ? (row) => void toggle(row) : undefined })), prices.suggestions.length > 0 && (_jsxs(Box, { sx: { mt: 3 }, children: [_jsx(Typography, { sx: { fontSize: 15, fontWeight: 800, color: tokens.navy800 }, children: t('commercial.prices.tabs.suggestions') }), _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600, mb: 1 }, children: t('commercial.prices.suggestionsIntro') }), _jsx(SuggestionsTable, { rows: prices.suggestions, onCreate: canManage ? (row) => setDialog({ draft: draftFromSuggestion(row) }) : undefined })] }))] })) : tab === 'prices' && prices ? (prices.workers.length === 0 ? (_jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('commercial.noWorkers') })) : (_jsx(WorkerPricesTable, { rows: prices.workers }))) : project.workers.length === 0 ? (_jsx(Typography, { sx: { py: 4, textAlign: 'center', color: tokens.gray500 }, children: t('commercial.noWorkers') })) : (_jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), _jsx(TableCell, { children: t('workforce.col.number') }), _jsx(TableCell, { children: t('workforce.col.status') }), _jsx(TableCell, { children: t('workforce.col.profession') }), _jsx(TableCell, { children: t('workforce.col.nationality') }), _jsx(TableCell, { children: t('workforce.col.joined') })] }) }), _jsx(TableBody, { children: project.workers.map((w) => {
                                        const look = placementLook[w.placement];
                                        return (_jsxs(TableRow, { hover: true, sx: { cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${w.id}`), children: [_jsx(TableCell, { dir: "ltr", sx: { fontWeight: 600, color: tokens.navy800, textAlign: 'start' }, children: w.name }), _jsx(TableCell, { dir: "ltr", children: w.workerNo }), _jsx(TableCell, { children: _jsx(Box, { component: "span", sx: { display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700, color: look.tone, bgcolor: look.soft }, children: (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`) }) }), _jsx(TableCell, { children: (ar ? w.professionAr : w.professionEn) ?? '—' }), _jsx(TableCell, { children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' }), _jsx(TableCell, { sx: { whiteSpace: 'nowrap' }, children: date(w.joinedOn) })] }, w.id));
                                    }) })] }) })), _jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mt: 2.5, fontSize: 12.5, color: tokens.gray500 }, children: [_jsx(InfoOutlinedIcon, { sx: { fontSize: 16 } }), tab === 'prices' ? t('commercial.prices.workersNote') : t('commercial.readOnly')] })] }), dialog && _jsx(PackageDialog, { package: dialog.package, draft: dialog.draft, onClose: () => setDialog(null), onSaved: () => (setDialog(null), setReload((n) => n + 1)) }), creating && _jsx(CreateTimesheetDialog, { projectId: id, projectName: p.name, onClose: () => setCreating(false) }), editingBilling && billing && (_jsx(TimesheetSettingsDialog, { projectId: id, projectName: p.name, settings: billing, onClose: () => setEditingBilling(false), onSaved: () => {
                    setEditingBilling(false);
                    setBillingReload((n) => n + 1);
                } }))] }));
}
