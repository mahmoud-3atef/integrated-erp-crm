import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import { Box, ButtonBase, Drawer, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { workflowApi } from '../api/workflow';
import { LanguageSwitch } from '../auth/AuthLayout';
import { NotificationsBell } from '../components/NotificationsBell';
import { Initials } from '../components/ui';
import { companyName } from '../pages/ChooseCompanyPage';
import { SessionProvider, useSession } from './session';
import { tokens } from './theme';
/** The menu grows with each module; an item without its permission is not shown at all. */
const menu = [
    { items: [{ path: '/', labelKey: 'menu.home', icon: _jsx(HomeOutlinedIcon, {}) }] },
    {
        titleKey: 'menu.commercial',
        items: [
            { path: '/commercial/customers', labelKey: 'menu.customers', icon: _jsx(BusinessOutlinedIcon, {}), permission: 'commercial.customers.view', companyWide: true },
            { path: '/commercial/projects', labelKey: 'menu.projects', icon: _jsx(AccountTreeOutlinedIcon, {}), permission: 'commercial.projects.view', companyWide: true },
            { path: '/commercial/prices', labelKey: 'menu.prices', icon: _jsx(SellOutlinedIcon, {}), permission: 'commercial.prices.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.workforce',
        items: [{ path: '/workforce/workers', labelKey: 'menu.workers', icon: _jsx(EngineeringOutlinedIcon, {}), permission: 'workforce.workers.view', companyWide: true }],
    },
    {
        titleKey: 'menu.staffAffairs',
        items: [{ path: '/workforce/staff', labelKey: 'menu.staff', icon: _jsx(BadgeOutlinedIcon, {}), permission: 'workforce.staff.view', companyWide: true }],
    },
    {
        titleKey: 'menu.approvals',
        items: [
            { path: '/workflow/inbox', labelKey: 'menu.tasks', icon: _jsx(TaskAltOutlinedIcon, {}), showTaskCount: true },
            { path: '/workflow/my-requests', labelKey: 'menu.myApprovals', icon: _jsx(OutboxOutlinedIcon, {}) },
            { path: '/workflow/requests', labelKey: 'menu.requests', icon: _jsx(DescriptionOutlinedIcon, {}), anyOf: ['workflow.requests.create', 'workflow.requests.view'] },
            { path: '/workflow/monitor', labelKey: 'menu.monitor', icon: _jsx(MonitorHeartOutlinedIcon, {}), permission: 'workflow.instances.view', companyWide: true },
            { path: '/workflow/processes', labelKey: 'menu.processes', icon: _jsx(AltRouteOutlinedIcon, {}), permission: 'workflow.processes.view', companyWide: true },
        ],
    },
    {
        titleKey: 'menu.companySetup',
        items: [
            { path: '/setup/legal-entities', labelKey: 'menu.legalEntities', icon: _jsx(AccountBalanceOutlinedIcon, {}), permission: 'organization.legal_entities.view' },
            { path: '/setup/branches', labelKey: 'menu.branches', icon: _jsx(StoreOutlinedIcon, {}), permission: 'organization.branches.view' },
            { path: '/setup/reference-lists', labelKey: 'menu.referenceLists', icon: _jsx(ListAltOutlinedIcon, {}), permission: 'organization.reference_data.view' },
            { path: '/setup/modules', labelKey: 'menu.modules', icon: _jsx(ExtensionOutlinedIcon, {}), permission: 'organization.modules.view' },
        ],
    },
    {
        titleKey: 'menu.administration',
        items: [
            { path: '/admin/users', labelKey: 'menu.users', icon: _jsx(GroupOutlinedIcon, {}), permission: 'identity.users.view', companyWide: true },
            { path: '/admin/roles', labelKey: 'menu.roles', icon: _jsx(AdminPanelSettingsOutlinedIcon, {}), permission: 'identity.roles.view', companyWide: true },
            { path: '/admin/crm-sync', labelKey: 'menu.crmSync', icon: _jsx(CloudSyncOutlinedIcon, {}), permission: 'crm_sync.view', companyWide: true },
        ],
    },
];
export function AppShell() {
    return (_jsx(SessionProvider, { children: _jsx(Shell, {}) }));
}
function Shell() {
    const { t } = useTranslation();
    const { can } = useSession();
    const theme = useTheme();
    const wide = useMediaQuery(theme.breakpoints.up('md'));
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const sections = menu
        .map((section) => ({ ...section, items: section.items.filter((item) => (item.anyOf ? item.anyOf.some((code) => can(code)) : !item.permission || can(item.permission, item.companyWide))) }))
        .filter((section) => section.items.length > 0);
    const current = sections.flatMap((s) => s.items).find((item) => isActive(item.path, location.pathname));
    return (_jsxs(Box, { sx: { display: 'flex', gap: `${tokens.gap}px`, minHeight: '100dvh', p: { xs: 1, md: `${tokens.gap}px` }, bgcolor: 'background.default' }, children: [wide ? (_jsx(Box, { component: "aside", sx: {
                    position: 'sticky',
                    top: tokens.gap,
                    flex: `0 0 ${tokens.sidebarWidth}px`,
                    height: `calc(100dvh - ${tokens.gap * 2}px)`,
                    borderRadius: `${tokens.radiusLg}px`,
                    boxShadow: tokens.shadowMd,
                    overflow: 'hidden',
                }, children: _jsx(Sidebar, { sections: sections }) })) : (_jsx(Drawer, { open: open, onClose: () => setOpen(false), slotProps: { paper: { sx: { width: tokens.sidebarWidth, border: 0 } } }, children: _jsx(Sidebar, { sections: sections, onNavigate: () => setOpen(false) }) })), _jsxs(Box, { sx: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${tokens.gap}px` }, children: [_jsx(TopBar, { title: current ? t(current.labelKey) : t('app.name'), onMenu: wide ? undefined : () => setOpen(true) }), _jsx(Box, { component: "main", sx: { width: '100%', px: { xs: 0.5, md: 0 } }, children: _jsx(Outlet, {}) })] })] }));
}
function Sidebar({ sections, onNavigate }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const taskCount = useTaskCount(location.pathname);
    return (_jsxs(Box, { sx: { display: 'flex', flexDirection: 'column', height: '100%', bgcolor: tokens.navy700, color: '#fff' }, children: [_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, pt: 2.75, pb: 2.25 }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 46, height: 46, borderRadius: '50%', bgcolor: '#fff', overflow: 'hidden' }, children: _jsx(Box, { component: "img", src: "/brand/carepro-logo.png", alt: "", sx: { width: 40, height: 'auto' } }) }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: '#fff' }, children: t('app.name') }), _jsx(Typography, { sx: { fontSize: 11.5, color: 'rgba(255,255,255,.6)' }, children: t('app.tagline') })] })] }), _jsx(Box, { component: "nav", "aria-label": t('menu.label'), sx: { flex: 1, overflowY: 'auto', px: 1.5, pb: 1.5, scrollbarWidth: 'thin' }, children: sections.map((section, index) => (_jsxs(Box, { children: [section.titleKey && (_jsx(Typography, { sx: { px: 1.5, pt: 2, pb: 0.75, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.45)' }, children: t(section.titleKey) })), section.items.map((item) => {
                            const active = isActive(item.path, location.pathname);
                            return (_jsxs(ButtonBase, { onClick: () => {
                                    navigate(item.path);
                                    onNavigate?.();
                                }, "aria-current": active ? 'page' : undefined, sx: {
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                    gap: 1.5,
                                    width: '100%',
                                    px: 1.75,
                                    py: 1.25,
                                    mb: 0.4,
                                    borderRadius: 999,
                                    fontSize: 13.5,
                                    fontWeight: active ? 700 : 500,
                                    textAlign: 'start',
                                    color: active ? tokens.navy700 : 'rgba(255,255,255,.86)',
                                    bgcolor: active ? '#fff' : 'transparent',
                                    boxShadow: active ? '0 6px 16px rgba(0,0,0,.14)' : 'none',
                                    transition: 'background-color .15s, color .15s',
                                    '&:hover': { bgcolor: active ? '#fff' : 'rgba(255,255,255,.09)', color: active ? tokens.navy700 : '#fff' },
                                    '& svg': { fontSize: 20, color: active ? tokens.navy700 : 'rgba(255,255,255,.9)' },
                                }, children: [item.icon, t(item.labelKey), item.showTaskCount && taskCount > 0 && (_jsx(Box, { component: "span", "aria-label": t('tasks.waiting', { count: taskCount }), sx: {
                                            marginInlineStart: 'auto',
                                            minWidth: 22,
                                            px: 0.9,
                                            borderRadius: 999,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            textAlign: 'center',
                                            bgcolor: active ? tokens.navy700 : '#fff',
                                            color: active ? '#fff' : tokens.navy700,
                                        }, children: taskCount }))] }, item.path));
                        })] }, section.titleKey ?? index))) })] }));
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
        }, children: [onMenu && (_jsx(IconButton, { onClick: onMenu, "aria-label": t('menu.open'), children: _jsx(MenuIcon, {}) })), _jsx(Typography, { noWrap: true, sx: { fontSize: 17, fontWeight: 700, color: tokens.navy700, flexShrink: 1, minWidth: 0 }, children: title }), _jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 0.75, marginInlineStart: 'auto' }, children: [me.company && (_jsxs(Box, { sx: {
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
                        }, children: [_jsx(BusinessIcon, {}), companyName(me.company, i18n.language)] })), me.companies.length > 1 && (_jsx(Tooltip, { title: t('company.switch'), children: _jsx(IconButton, { onClick: () => navigate('/login/company'), "aria-label": t('company.switch'), children: _jsx(SwapHorizIcon, {}) }) })), _jsx(NotificationsBell, {}), _jsx(LanguageSwitch, {}), _jsx(Box, { sx: { width: '1px', height: 26, mx: 0.75, bgcolor: tokens.border, display: { xs: 'none', sm: 'block' } } }), _jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1.25 }, children: [_jsxs(Box, { sx: { display: { xs: 'none', md: 'block' }, textAlign: 'end' }, children: [_jsx(Typography, { noWrap: true, sx: { fontWeight: 600, fontSize: 13, color: tokens.navy700, lineHeight: 1.2 }, children: me.displayName }), _jsx(Typography, { noWrap: true, sx: { fontSize: 11.5, color: tokens.gray500 }, children: me.isPlatformAdmin ? t('home.platformAdmin') : me.company ? companyName(me.company, i18n.language) : '' })] }), _jsx(Initials, { name: me.displayName })] }), _jsx(Tooltip, { title: t('home.logout'), children: _jsx(IconButton, { onClick: () => void logout(), "aria-label": t('home.logout'), children: _jsx(LogoutIcon, {}) }) })] })] }));
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
