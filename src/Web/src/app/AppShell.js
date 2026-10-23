import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AltRouteOutlinedIcon from '@mui/icons-material/AltRouteOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import NotificationImportantOutlinedIcon from '@mui/icons-material/NotificationImportantOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import PinOutlinedIcon from '@mui/icons-material/PinOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TimelapseOutlinedIcon from '@mui/icons-material/TimelapseOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { Box, ButtonBase, Drawer, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { workflowApi } from '../api/workflow';
import { LanguageSwitch } from '../auth/AuthLayout';
import { AlertsButton } from '../components/AlertsButton';
import { NotificationsBell } from '../components/NotificationsBell';
import { Initials } from '../components/ui';
import { companyName } from '../pages/ChooseCompanyPage';
import { Breadcrumbs, CrumbProvider } from './breadcrumbs';
import { SessionProvider, useSession } from './session';
import { tokens } from './theme';
/** The menu grows with each module; an item without its permission is not shown at all. */
const menu = [
    {
        items: [
            { path: '/', labelKey: 'menu.home', icon: _jsx(HomeOutlinedIcon, {}) },
            { path: '/alerts', labelKey: 'menu.alerts', icon: _jsx(NotificationImportantOutlinedIcon, {}) },
        ],
    },
    {
        titleKey: 'menu.reportsSection',
        icon: _jsx(QueryStatsOutlinedIcon, {}),
        items: [
            { path: '/reports/management', labelKey: 'menu.management', icon: _jsx(SpeedOutlinedIcon, {}), permission: 'reports.management.view', companyWide: true },
            { path: '/reports/executive', labelKey: 'menu.executive', icon: _jsx(QueryStatsOutlinedIcon, {}), permission: 'reports.executive.view', companyWide: true },
            { path: '/reports/movement', labelKey: 'menu.movement', icon: _jsx(SyncAltOutlinedIcon, {}), permission: 'reports.movement.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.commercial',
        icon: _jsx(BusinessOutlinedIcon, {}),
        items: [
            { path: '/commercial/customers', labelKey: 'menu.customers', icon: _jsx(BusinessOutlinedIcon, {}), permission: 'commercial.customers.view', companyWide: true },
            { path: '/commercial/projects', labelKey: 'menu.projects', icon: _jsx(AccountTreeOutlinedIcon, {}), permission: 'commercial.projects.view', companyWide: true },
            { path: '/commercial/prices', labelKey: 'menu.prices', icon: _jsx(SellOutlinedIcon, {}), permission: 'commercial.prices.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.housingSection',
        icon: _jsx(ApartmentOutlinedIcon, {}),
        items: [
            { path: '/housing/showroom', labelKey: 'menu.showroom', icon: _jsx(StorefrontOutlinedIcon, {}), permission: 'operations.showroom.view', companyWide: true },
            { path: '/housing', labelKey: 'menu.housing', icon: _jsx(ApartmentOutlinedIcon, {}), permission: 'housing.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.operations',
        icon: _jsx(LocalShippingOutlinedIcon, {}),
        items: [
            { path: '/operations/delivery-orders', labelKey: 'menu.deliveryOrders', icon: _jsx(LocalShippingOutlinedIcon, {}), permission: 'operations.delivery.view', companyWide: true },
            { path: '/operations/return-orders', labelKey: 'menu.returnOrders', icon: _jsx(KeyboardReturnOutlinedIcon, {}), permission: 'operations.return.view', companyWide: true },
            { path: '/operations/transfer-orders', labelKey: 'menu.transferOrders', icon: _jsx(SwapHorizIcon, {}), permission: 'operations.transfer.view', companyWide: true },
            { path: '/operations/movements', labelKey: 'menu.movements', icon: _jsx(MultipleStopOutlinedIcon, {}), permission: 'operations.movements.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.billingSection',
        icon: _jsx(FactCheckOutlinedIcon, {}),
        items: [
            { path: '/billing/timesheets', labelKey: 'menu.timesheets', icon: _jsx(FactCheckOutlinedIcon, {}), permission: 'billing.timesheets.view', companyWide: true },
            { path: '/billing/invoices', labelKey: 'menu.invoices', icon: _jsx(ReceiptLongOutlinedIcon, {}), permission: 'billing.invoices.view', companyWide: true },
            { path: '/billing/receipts', labelKey: 'menu.receipts', icon: _jsx(PaymentsOutlinedIcon, {}), permission: 'billing.receipts.view', companyWide: true },
            { path: '/expenses', labelKey: 'menu.expenses', icon: _jsx(ReceiptOutlinedIcon, {}), permission: 'expenses.view', companyWide: true },
            { path: '/billing/aging', labelKey: 'menu.aging', icon: _jsx(TimelapseOutlinedIcon, {}), permission: 'billing.receipts.view', companyWide: true },
            { path: '/billing/bank-accounts', labelKey: 'menu.bankAccounts', icon: _jsx(AccountBalanceIcon, {}), permission: 'billing.receipts.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.payrollSection',
        icon: _jsx(RequestQuoteOutlinedIcon, {}),
        items: [
            { path: '/payroll/runs', labelKey: 'menu.payrollRuns', icon: _jsx(RequestQuoteOutlinedIcon, {}), permission: 'payroll.workers.view', companyWide: true },
            { path: '/payroll/staff', labelKey: 'menu.payrollStaff', icon: _jsx(ReceiptLongOutlinedIcon, {}), permission: 'payroll.staff.view', companyWide: true },
            { path: '/payroll/gosi', labelKey: 'menu.payrollGosi', icon: _jsx(ShieldOutlinedIcon, {}), permission: 'payroll.gosi.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.workforce',
        icon: _jsx(EngineeringOutlinedIcon, {}),
        items: [
            { path: '/workforce/workers', labelKey: 'menu.workers', icon: _jsx(EngineeringOutlinedIcon, {}), permission: 'workforce.workers.view', companyWide: true },
            { path: '/workforce/supplier-costs', labelKey: 'menu.supplierCosts', icon: _jsx(PaidOutlinedIcon, {}), permission: 'workforce.costs.view', companyWide: true },
            { path: '/workforce/history-issues', labelKey: 'menu.historyIssues', icon: _jsx(RuleOutlinedIcon, {}), permission: 'workforce.workers.view', companyWide: true },
            { path: '/workforce/invoice-check', labelKey: 'menu.invoiceCheck', icon: _jsx(FactCheckOutlinedIcon, {}), permission: 'workforce.workers.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.hrSection',
        icon: _jsx(BadgeOutlinedIcon, {}),
        items: [
            { path: '/hr/employees', labelKey: 'menu.hrEmployees', icon: _jsx(BadgeOutlinedIcon, {}), permission: 'staff.view', companyWide: true },
            { path: '/hr/actions', labelKey: 'menu.hrActions', icon: _jsx(WorkHistoryOutlinedIcon, {}), permission: 'staff.view', companyWide: true },
            { path: '/hr/attendance', labelKey: 'menu.hrAttendance', icon: _jsx(AccessTimeOutlinedIcon, {}), permission: 'attendance.view', companyWide: true },
            { path: '/hr/leave', labelKey: 'menu.hrLeave', icon: _jsx(BeachAccessOutlinedIcon, {}), permission: 'leave.view', companyWide: true },
            { path: '/hr/leave-balances', labelKey: 'menu.hrLeaveBalances', icon: _jsx(BalanceOutlinedIcon, {}), permission: 'leave.view', companyWide: true },
            { path: '/hr/advances', labelKey: 'menu.hrAdvances', icon: _jsx(CreditCardOutlinedIcon, {}), permission: 'deductions.view', companyWide: true },
            { path: '/hr/penalties', labelKey: 'menu.hrPenalties', icon: _jsx(GavelOutlinedIcon, {}), permission: 'deductions.view', companyWide: true },
            { path: '/hr/settlements', labelKey: 'menu.hrSettlements', icon: _jsx(HandshakeOutlinedIcon, {}), permission: 'payroll.settlements.view', companyWide: true },
            { path: '/hr/shifts', labelKey: 'menu.hrShifts', icon: _jsx(EventNoteOutlinedIcon, {}), permission: 'attendance.view', companyWide: true },
            { path: '/hr/structure', labelKey: 'menu.hrStructure', icon: _jsx(AccountTreeOutlinedIcon, {}), permission: 'staff.view', companyWide: true },
            { path: '/hr/catalog', labelKey: 'menu.hrCatalog', icon: _jsx(CategoryOutlinedIcon, {}), permission: 'staff.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.approvals',
        icon: _jsx(TaskAltOutlinedIcon, {}),
        items: [
            { path: '/workflow/inbox', labelKey: 'menu.tasks', icon: _jsx(TaskAltOutlinedIcon, {}), showTaskCount: true },
            { path: '/workflow/my-requests', labelKey: 'menu.myApprovals', icon: _jsx(OutboxOutlinedIcon, {}) },
            { path: '/workflow/requests', labelKey: 'menu.requests', icon: _jsx(DescriptionOutlinedIcon, {}), anyOf: ['workflow.requests.create', 'workflow.requests.view'] },
            { path: '/workflow/monitor', labelKey: 'menu.monitor', icon: _jsx(MonitorHeartOutlinedIcon, {}), permission: 'workflow.instances.view', companyWide: true },
            { path: '/workflow/processes', labelKey: 'menu.processes', icon: _jsx(AltRouteOutlinedIcon, {}), permission: 'workflow.processes.view', companyWide: true },
            { path: '/workflow/status-values', labelKey: 'menu.statusValues', icon: _jsx(LabelOutlinedIcon, {}), permission: 'workflow.processes.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.companySetup',
        icon: _jsx(AccountBalanceOutlinedIcon, {}),
        items: [
            { path: '/setup/legal-entities', labelKey: 'menu.legalEntities', icon: _jsx(AccountBalanceOutlinedIcon, {}), permission: 'organization.legal_entities.view' },
            { path: '/setup/branches', labelKey: 'menu.branches', icon: _jsx(StoreOutlinedIcon, {}), permission: 'organization.branches.view' },
            { path: '/setup/reference-lists', labelKey: 'menu.referenceLists', icon: _jsx(ListAltOutlinedIcon, {}), permission: 'organization.reference_data.view' },
            { path: '/setup/modules', labelKey: 'menu.modules', icon: _jsx(ExtensionOutlinedIcon, {}), permission: 'organization.modules.view' },
        ],
    },
    {
        titleKey: 'menu.administration',
        icon: _jsx(AdminPanelSettingsOutlinedIcon, {}),
        items: [
            { path: '/admin/users', labelKey: 'menu.users', icon: _jsx(GroupOutlinedIcon, {}), permission: 'identity.users.view', companyWide: true },
            { path: '/admin/roles', labelKey: 'menu.roles', icon: _jsx(AdminPanelSettingsOutlinedIcon, {}), permission: 'identity.roles.view', companyWide: true },
            { path: '/admin/crm-sync', labelKey: 'menu.crmSync', icon: _jsx(CloudSyncOutlinedIcon, {}), permission: 'crm_sync.view', companyWide: true },
            { path: '/admin/numbering', labelKey: 'menu.numbering', icon: _jsx(PinOutlinedIcon, {}), permission: 'organization.settings.view', companyWide: true },
        ],
    },
];
export function AppShell() {
    return (_jsx(SessionProvider, { children: _jsx(CrumbProvider, { children: _jsx(Shell, {}) }) }));
}
function Shell() {
    const { can } = useSession();
    const theme = useTheme();
    const wide = useMediaQuery(theme.breakpoints.up('md'));
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(readPinned);
    // An item was just chosen on the folded rail: it folds at once (the user's request, 2026-10-23), and opens again only
    // when the mouse comes back after leaving it.
    const [picked, setPicked] = useState(false);
    const fold = () => {
        if (pinned)
            return;
        setPicked(true);
        // The chosen item keeps the focus, which would keep the rail open (it opens on focus for the keyboard).
        if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
    };
    const togglePin = () => {
        const next = !pinned;
        setPinned(next);
        try {
            window.localStorage.setItem(pinKey, next ? '1' : '0');
        }
        catch {
            // The choice simply is not remembered (private window, blocked storage).
        }
    };
    const sections = menu
        .map((section) => ({ ...section, items: section.items.filter((item) => (item.anyOf ? item.anyOf.some((code) => can(code)) : !item.permission || can(item.permission, item.companyWide))) }))
        .filter((section) => section.items.length > 0);
    return (_jsxs(Box, { sx: { display: 'flex', gap: `${tokens.gap}px`, minHeight: '100dvh', p: { xs: 1, md: `${tokens.gap}px` }, bgcolor: 'background.default' }, children: [wide ? (_jsx(Box, { component: "aside", sx: {
                    position: 'sticky',
                    top: tokens.gap,
                    zIndex: 40,
                    flex: `0 0 ${pinned ? tokens.sidebarWidth : railWidth}px`,
                    height: `calc(100dvh - ${tokens.gap * 2}px)`,
                    transition: 'flex-basis .22s ease',
                }, onMouseLeave: () => setPicked(false), children: _jsx(Box, { sx: {
                        position: 'absolute',
                        insetBlock: 0,
                        insetInlineStart: 0,
                        width: pinned ? tokens.sidebarWidth : railWidth,
                        borderRadius: `${tokens.radiusLg}px`,
                        boxShadow: tokens.shadowMd,
                        overflow: 'hidden',
                        transition: 'width .22s ease, box-shadow .22s ease',
                        ...(pinned ? {} : picked ? pickedStyles : railStyles),
                    }, children: _jsx(Sidebar, { sections: sections, pinned: pinned, onPin: togglePin, onNavigate: fold }) }) })) : (_jsx(Drawer, { open: open, onClose: () => setOpen(false), slotProps: { paper: { sx: { width: tokens.sidebarWidth, border: 0 } } }, children: _jsx(Sidebar, { sections: sections, onNavigate: () => setOpen(false) }) })), _jsxs(Box, { sx: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${tokens.gap}px` }, children: [_jsx(TopBar, { title: _jsx(Breadcrumbs, { sections: sections }), onMenu: wide ? undefined : () => setOpen(true) }), _jsx(Box, { component: "main", sx: { width: '100%', px: { xs: 0.5, md: 0 } }, children: _jsx(Outlet, {}) })] })] }));
}
const railWidth = 76;
const pinKey = 'erp.sidebarPinned';
const folded = '&:not(:hover):not(:focus-within)';
/**
 * The folded rail (as on the old portal): icons only; the mouse resting on it (a moment, not passing over) or the
 * keyboard's focus opens it over the page without moving the page.
 */
const railStyles = {
    '&:hover, &:focus-within': { width: tokens.sidebarWidth, boxShadow: '0 20px 50px rgba(7,45,67,.35)', transitionDelay: '.12s' },
    [`${folded} .rail-fade`]: { opacity: 0 },
    [`${folded} .rail-wide`]: { display: 'none' },
    [`${folded} .rail-line`]: { display: 'block' },
    [`${folded} .rail-current`]: { bgcolor: 'rgba(255,255,255,.16)' },
};
/** Just after an item was chosen: folded, even with the mouse still on it (texts hidden as on the rail). */
const pickedStyles = {
    '& .rail-fade': { opacity: 0 },
    '& .rail-wide': { display: 'none' },
    '& .rail-line': { display: 'block' },
    '& .rail-current': { bgcolor: 'rgba(255,255,255,.16)' },
};
/** Folded unless the user pinned it open (remembered in this browser only). */
function readPinned() {
    try {
        return window.localStorage.getItem(pinKey) === '1';
    }
    catch {
        return false;
    }
}
/**
 * The navigation as on the old portal: the brand, the home items, then one group per section opening on a click (one
 * open at a time, the current page's group open). Folded, it is a rail of icons: the texts fade out, the section
 * titles become lines and the groups show their icons only.
 */
function Sidebar({ sections, pinned, onPin, onNavigate }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const taskCount = useTaskCount(location.pathname);
    // The item whose path matches the page best (/housing/showroom is not also «/housing»).
    const best = sections
        .flatMap((section) => section.items.map((item) => item.path))
        .filter((path) => isActive(path, location.pathname))
        .sort((a, b) => b.length - a.length)[0];
    const current = sections.find((section) => section.titleKey && section.items.some((item) => item.path === best))?.titleKey;
    const [openKey, setOpenKey] = useState(current);
    useEffect(() => setOpenKey(current), [current]);
    const text = { whiteSpace: 'nowrap', overflow: 'hidden', transition: 'opacity .15s' };
    const badge = (active) => (_jsx(Box, { component: "span", className: "rail-fade", "aria-label": t('tasks.waiting', { count: taskCount }), sx: {
            marginInlineStart: 'auto',
            minWidth: 22,
            px: 0.9,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
            bgcolor: active ? tokens.navy700 : '#fff',
            color: active ? '#fff' : tokens.navy700,
            ...text,
        }, children: taskCount }));
    const link = (item, sub) => {
        const active = item.path === best;
        return (_jsxs(ButtonBase, { onClick: () => {
                navigate(item.path);
                onNavigate?.();
            }, "aria-current": active ? 'page' : undefined, title: t(item.labelKey), sx: {
                display: 'flex',
                justifyContent: 'flex-start',
                gap: 1.5,
                width: '100%',
                px: '16px',
                py: sub ? 1 : 1.25,
                mb: 0.4,
                borderRadius: 999,
                fontSize: sub ? 13 : 13.5,
                fontWeight: active ? 700 : 500,
                textAlign: 'start',
                color: active ? tokens.navy700 : sub ? 'rgba(255,255,255,.74)' : 'rgba(255,255,255,.86)',
                bgcolor: active ? '#fff' : 'transparent',
                boxShadow: active ? '0 6px 16px rgba(0,0,0,.14)' : 'none',
                transition: 'background-color .15s, color .15s',
                '&:hover': { bgcolor: active ? '#fff' : 'rgba(255,255,255,.09)', color: active ? tokens.navy700 : '#fff' },
                '& > svg': { flex: '0 0 auto', fontSize: sub ? 18 : 20, color: active ? tokens.navy700 : sub ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.9)' },
            }, children: [item.icon, _jsx(Box, { component: "span", className: "rail-fade", sx: text, children: t(item.labelKey) }), item.showTaskCount && taskCount > 0 && badge(active)] }, item.path));
    };
    return (_jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', height: '100%', width: tokens.sidebarWidth, bgcolor: tokens.navy700, color: '#fff' }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1.5, px: '15px', pt: 2.75, pb: 2.25 }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 46, height: 46, borderRadius: '50%', bgcolor: '#fff', overflow: 'hidden' }, children: _jsx(Box, { component: "img", src: "/brand/carepro-logo.png", alt: "", sx: { width: 40, height: 'auto' } }) }), _jsxs(Box, { className: "rail-fade", sx: { minWidth: 0, flex: 1, ...text }, children: [_jsx(Typography, { noWrap: true, sx: { fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: '#fff' }, children: t('app.name') }), _jsx(Typography, { noWrap: true, sx: { fontSize: 11.5, color: 'rgba(255,255,255,.6)' }, children: t('app.tagline') })] }), onPin && (_jsx(Tooltip, { title: pinned ? t('menu.unpin') : t('menu.pin'), children: _jsx(IconButton, { onClick: onPin, "aria-label": pinned ? t('menu.unpin') : t('menu.pin'), "aria-pressed": pinned, size: "small", className: "rail-wide", sx: {
                                flex: '0 0 auto',
                                width: 32,
                                height: 32,
                                bgcolor: pinned ? '#fff' : 'rgba(255,255,255,.1)',
                                color: pinned ? tokens.navy700 : 'rgba(255,255,255,.75)',
                                transform: pinned ? 'none' : 'rotate(45deg)',
                                transition: 'background-color .15s, color .15s, transform .2s',
                                '&:hover': { bgcolor: pinned ? '#fff' : 'rgba(255,255,255,.2)', color: pinned ? tokens.navy700 : '#fff' },
                                '& svg': { fontSize: 17 },
                            }, children: _jsx(PushPinOutlinedIcon, {}) }) }))] }), _jsx(Box, { component: "nav", "aria-label": t('menu.label'), sx: { flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.5, pb: 1.5, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.2) transparent' }, children: sections.map((section, index) => {
                    if (!section.titleKey) {
                        return _jsx(Box, { children: section.items.map((item) => link(item, false)) }, index);
                    }
                    const key = section.titleKey;
                    const isOpen = openKey === key;
                    const holdsCurrent = current === key;
                    const holdsTasks = taskCount > 0 && section.items.some((item) => item.showTaskCount);
                    return (_jsxs(Box, { children: [index === 1 && (_jsxs(_Fragment, { children: [_jsx(Typography, { noWrap: true, className: "rail-wide", sx: { px: 1.5, pt: 2, pb: 0.75, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.45)' }, children: t('menu.sections') }), _jsx(Box, { "aria-hidden": true, className: "rail-line", sx: { display: 'none', height: '1px', my: 1.5, mx: 1.25, bgcolor: 'rgba(255,255,255,.14)' } })] })), _jsxs(ButtonBase, { onClick: () => setOpenKey(isOpen ? undefined : key), "aria-expanded": isOpen, title: t(key), className: holdsCurrent ? 'rail-current' : undefined, sx: {
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                    gap: 1.5,
                                    width: '100%',
                                    px: '16px',
                                    py: 1.25,
                                    mb: 0.4,
                                    borderRadius: 999,
                                    fontSize: 13.5,
                                    fontWeight: 500,
                                    textAlign: 'start',
                                    color: 'rgba(255,255,255,.86)',
                                    bgcolor: isOpen ? 'rgba(255,255,255,.12)' : 'transparent',
                                    transition: 'background-color .15s, color .15s',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,.09)', color: '#fff' },
                                    '& > svg:first-of-type': { flex: '0 0 auto', fontSize: 20, color: 'rgba(255,255,255,.9)' },
                                }, children: [section.icon, _jsx(Box, { component: "span", className: "rail-fade", sx: { ...text, flex: 1 }, children: t(key) }), holdsTasks && !isOpen && badge(false), _jsx(ExpandMoreIcon, { className: "rail-fade", sx: { flex: '0 0 auto', fontSize: 18, color: 'rgba(255,255,255,.55)', transform: isOpen ? 'rotate(180deg)' : 'none', ...text, transition: 'transform .2s, opacity .15s' } })] }), isOpen && (_jsx(Box, { className: "rail-wide", sx: { mt: 0.5, mb: 1, paddingInlineStart: 1.75 }, children: section.items.map((item) => link(item, true)) }))] }, key));
                }) })] }));
}
function TopBar({ title, onMenu }) {
    const { t, i18n } = useTranslation();
    const { me } = useSession();
    const navigate = useNavigate();
    const logout = async () => {
        await authApi.logout().catch(() => undefined);
        navigate('/login', { replace: true });
    };
    return (_jsxs(Box, { component: "header", sx: {
            position: 'sticky',
            top: { xs: 8, md: tokens.gap },
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minHeight: 62,
            px: { xs: 1, sm: 2 },
            py: 1,
            bgcolor: '#fff',
            borderRadius: `${tokens.radiusLg}px`,
            boxShadow: tokens.shadowSm,
            // Covers the gap above the bar so content does not show through while scrolling.
            '&::before': { content: '""', position: 'absolute', insetInline: -4, bottom: '100%', height: tokens.gap + 2, bgcolor: 'background.default' },
        }, children: [onMenu && (_jsx(IconButton, { onClick: onMenu, "aria-label": t('menu.open'), children: _jsx(MenuIcon, {}) })), title, _jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 0.75, marginInlineStart: 'auto' }, children: [me.company && (_jsxs(Box, { sx: {
                            display: { xs: 'none', sm: 'inline-flex' },
                            alignItems: 'center',
                            gap: 0.75,
                            px: 1.5,
                            height: 34,
                            borderRadius: 999,
                            bgcolor: tokens.tint,
                            color: tokens.navy700,
                            fontSize: 13,
                            fontWeight: 600,
                            '& svg': { fontSize: 18 },
                        }, children: [_jsx(BusinessIcon, {}), companyName(me.company, i18n.language)] })), me.companies.length > 1 && (_jsx(Tooltip, { title: t('company.switch'), children: _jsx(IconButton, { onClick: () => navigate('/login/company'), "aria-label": t('company.switch'), children: _jsx(SwapHorizIcon, {}) }) })), _jsx(AlertsButton, {}), _jsx(NotificationsBell, {}), _jsx(LanguageSwitch, {}), _jsx(Box, { sx: { width: '1px', height: 26, mx: 0.75, bgcolor: tokens.border, display: { xs: 'none', sm: 'block' } } }), _jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1.25 }, children: [_jsxs(Box, { sx: { display: { xs: 'none', md: 'block' }, textAlign: 'end' }, children: [_jsx(Typography, { noWrap: true, sx: { fontWeight: 600, fontSize: 13, color: tokens.navy700, lineHeight: 1.2 }, children: me.displayName }), _jsx(Typography, { noWrap: true, sx: { fontSize: 11.5, color: tokens.gray500 }, children: me.isPlatformAdmin ? t('home.platformAdmin') : me.company ? companyName(me.company, i18n.language) : '' })] }), _jsx(Initials, { name: me.displayName })] }), _jsx(Tooltip, { title: t('home.logout'), children: _jsx(IconButton, { onClick: () => void logout(), "aria-label": t('home.logout'), children: _jsx(LogoutIcon, {}) }) })] })] }));
}
/** Home matches only itself; other items also match their sub-pages (e.g. a chosen reference list). */
function isActive(path, pathname) {
    return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
}
/** Tasks waiting for the user: refreshed every minute and on each page change. */
function useTaskCount(pathname) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        const load = () => workflowApi.inboxCount().then((r) => setCount(r.pending)).catch(() => undefined);
        void load();
        const timer = window.setInterval(load, 60_000);
        return () => window.clearInterval(timer);
    }, [pathname]);
    return count;
}
