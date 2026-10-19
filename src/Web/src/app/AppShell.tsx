import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import WorkHistoryOutlinedIcon from '@mui/icons-material/WorkHistoryOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
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
import { useEffect, useState, type ReactNode } from 'react';
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

interface MenuItem {
  path: string;
  labelKey: string;
  icon: ReactNode;
  /** Shown only with this permission (the page itself is protected on the server too). */
  permission?: string;
  /** The page belongs to the whole company: a grant for some registrations only does not show it. */
  companyWide?: boolean;
  /** Any of these permissions shows the item (instead of a single one). */
  anyOf?: string[];
  /** Shows the number of tasks waiting for the user. */
  showTaskCount?: boolean;
}

interface MenuSection {
  titleKey?: string;
  items: MenuItem[];
}

/** The menu grows with each module; an item without its permission is not shown at all. */
const menu: MenuSection[] = [
  {
    items: [
      { path: '/', labelKey: 'menu.home', icon: <HomeOutlinedIcon /> },
      { path: '/alerts', labelKey: 'menu.alerts', icon: <NotificationImportantOutlinedIcon /> },
    ],
  },
  {
    titleKey: 'menu.commercial',
    items: [
      { path: '/commercial/customers', labelKey: 'menu.customers', icon: <BusinessOutlinedIcon />, permission: 'commercial.customers.view', companyWide: true },
      { path: '/commercial/projects', labelKey: 'menu.projects', icon: <AccountTreeOutlinedIcon />, permission: 'commercial.projects.view', companyWide: true },
      { path: '/commercial/prices', labelKey: 'menu.prices', icon: <SellOutlinedIcon />, permission: 'commercial.prices.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.operations',
    items: [
      { path: '/operations/delivery-orders', labelKey: 'menu.deliveryOrders', icon: <LocalShippingOutlinedIcon />, permission: 'operations.delivery.view', companyWide: true },
      { path: '/operations/return-orders', labelKey: 'menu.returnOrders', icon: <KeyboardReturnOutlinedIcon />, permission: 'operations.return.view', companyWide: true },
      { path: '/operations/transfer-orders', labelKey: 'menu.transferOrders', icon: <SwapHorizIcon />, permission: 'operations.transfer.view', companyWide: true },
      { path: '/operations/movements', labelKey: 'menu.movements', icon: <MultipleStopOutlinedIcon />, permission: 'operations.movements.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.billingSection',
    items: [
      { path: '/billing/timesheets', labelKey: 'menu.timesheets', icon: <FactCheckOutlinedIcon />, permission: 'billing.timesheets.view', companyWide: true },
      { path: '/billing/invoices', labelKey: 'menu.invoices', icon: <ReceiptLongOutlinedIcon />, permission: 'billing.invoices.view', companyWide: true },
      { path: '/billing/receipts', labelKey: 'menu.receipts', icon: <PaymentsOutlinedIcon />, permission: 'billing.receipts.view', companyWide: true },
      { path: '/billing/aging', labelKey: 'menu.aging', icon: <TimelapseOutlinedIcon />, permission: 'billing.receipts.view', companyWide: true },
      { path: '/billing/bank-accounts', labelKey: 'menu.bankAccounts', icon: <AccountBalanceIcon />, permission: 'billing.receipts.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.payrollSection',
    items: [{ path: '/payroll/runs', labelKey: 'menu.payrollRuns', icon: <RequestQuoteOutlinedIcon />, permission: 'payroll.workers.view', companyWide: true }],
  },
  {
    titleKey: 'menu.housingSection',
    items: [{ path: '/housing', labelKey: 'menu.housing', icon: <ApartmentOutlinedIcon />, permission: 'housing.view', companyWide: true }],
  },
  {
    titleKey: 'menu.workforce',
    items: [
      { path: '/workforce/workers', labelKey: 'menu.workers', icon: <EngineeringOutlinedIcon />, permission: 'workforce.workers.view', companyWide: true },
      { path: '/workforce/history-issues', labelKey: 'menu.historyIssues', icon: <RuleOutlinedIcon />, permission: 'workforce.workers.view', companyWide: true },
      { path: '/workforce/invoice-check', labelKey: 'menu.invoiceCheck', icon: <FactCheckOutlinedIcon />, permission: 'workforce.workers.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.hrSection',
    items: [
      { path: '/hr/employees', labelKey: 'menu.hrEmployees', icon: <BadgeOutlinedIcon />, permission: 'staff.view', companyWide: true },
      { path: '/hr/actions', labelKey: 'menu.hrActions', icon: <WorkHistoryOutlinedIcon />, permission: 'staff.view', companyWide: true },
      { path: '/hr/attendance', labelKey: 'menu.hrAttendance', icon: <AccessTimeOutlinedIcon />, permission: 'attendance.view', companyWide: true },
      { path: '/hr/shifts', labelKey: 'menu.hrShifts', icon: <EventNoteOutlinedIcon />, permission: 'attendance.view', companyWide: true },
      { path: '/hr/structure', labelKey: 'menu.hrStructure', icon: <AccountTreeOutlinedIcon />, permission: 'staff.view', companyWide: true },
      { path: '/hr/catalog', labelKey: 'menu.hrCatalog', icon: <CategoryOutlinedIcon />, permission: 'staff.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.approvals',
    items: [
      { path: '/workflow/inbox', labelKey: 'menu.tasks', icon: <TaskAltOutlinedIcon />, showTaskCount: true },
      { path: '/workflow/my-requests', labelKey: 'menu.myApprovals', icon: <OutboxOutlinedIcon /> },
      { path: '/workflow/requests', labelKey: 'menu.requests', icon: <DescriptionOutlinedIcon />, anyOf: ['workflow.requests.create', 'workflow.requests.view'] },
      { path: '/workflow/monitor', labelKey: 'menu.monitor', icon: <MonitorHeartOutlinedIcon />, permission: 'workflow.instances.view', companyWide: true },
      { path: '/workflow/processes', labelKey: 'menu.processes', icon: <AltRouteOutlinedIcon />, permission: 'workflow.processes.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.companySetup',
    items: [
      { path: '/setup/legal-entities', labelKey: 'menu.legalEntities', icon: <AccountBalanceOutlinedIcon />, permission: 'organization.legal_entities.view' },
      { path: '/setup/branches', labelKey: 'menu.branches', icon: <StoreOutlinedIcon />, permission: 'organization.branches.view' },
      { path: '/setup/reference-lists', labelKey: 'menu.referenceLists', icon: <ListAltOutlinedIcon />, permission: 'organization.reference_data.view' },
      { path: '/setup/modules', labelKey: 'menu.modules', icon: <ExtensionOutlinedIcon />, permission: 'organization.modules.view' },
    ],
  },
  {
    titleKey: 'menu.administration',
    items: [
      { path: '/admin/users', labelKey: 'menu.users', icon: <GroupOutlinedIcon />, permission: 'identity.users.view', companyWide: true },
      { path: '/admin/roles', labelKey: 'menu.roles', icon: <AdminPanelSettingsOutlinedIcon />, permission: 'identity.roles.view', companyWide: true },
      { path: '/admin/crm-sync', labelKey: 'menu.crmSync', icon: <CloudSyncOutlinedIcon />, permission: 'crm_sync.view', companyWide: true },
      { path: '/admin/numbering', labelKey: 'menu.numbering', icon: <PinOutlinedIcon />, permission: 'organization.settings.view', companyWide: true },
    ],
  },
];

export function AppShell() {
  return (
    <SessionProvider>
      <CrumbProvider>
        <Shell />
      </CrumbProvider>
    </SessionProvider>
  );
}

function Shell() {
  const { can } = useSession();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);

  const sections = menu
    .map((section) => ({ ...section, items: section.items.filter((item) => (item.anyOf ? item.anyOf.some((code) => can(code)) : !item.permission || can(item.permission, item.companyWide))) }))
    .filter((section) => section.items.length > 0);

  return (
    <Box sx={{ display: 'flex', gap: `${tokens.gap}px`, minHeight: '100dvh', p: { xs: 1, md: `${tokens.gap}px` }, bgcolor: 'background.default' }}>
      {wide ? (
        <Box
          component="aside"
          sx={{
            position: 'sticky',
            top: tokens.gap,
            flex: `0 0 ${tokens.sidebarWidth}px`,
            height: `calc(100dvh - ${tokens.gap * 2}px)`,
            borderRadius: `${tokens.radiusLg}px`,
            boxShadow: tokens.shadowMd,
            overflow: 'hidden',
          }}
        >
          <Sidebar sections={sections} />
        </Box>
      ) : (
        <Drawer open={open} onClose={() => setOpen(false)} slotProps={{ paper: { sx: { width: tokens.sidebarWidth, border: 0 } } }}>
          <Sidebar sections={sections} onNavigate={() => setOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: `${tokens.gap}px` }}>
        <TopBar title={<Breadcrumbs sections={sections} />} onMenu={wide ? undefined : () => setOpen(true)} />
        <Box component="main" sx={{ width: '100%', px: { xs: 0.5, md: 0 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

function Sidebar({ sections, onNavigate }: { sections: MenuSection[]; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const taskCount = useTaskCount(location.pathname);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: tokens.navy700, color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, pt: 2.75, pb: 2.25 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 46, height: 46, borderRadius: '50%', bgcolor: '#fff', overflow: 'hidden' }}>
          <Box component="img" src="/brand/carepro-logo.png" alt="" sx={{ width: 40, height: 'auto' }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: '#fff' }}>{t('app.name')}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>{t('app.tagline')}</Typography>
        </Box>
      </Box>

      <Box component="nav" aria-label={t('menu.label')} sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1.5, scrollbarWidth: 'thin' }}>
        {sections.map((section, index) => (
          <Box key={section.titleKey ?? index}>
            {section.titleKey && (
              <Typography sx={{ px: 1.5, pt: 2, pb: 0.75, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>{t(section.titleKey)}</Typography>
            )}
            {section.items.map((item) => {
              const active = isActive(item.path, location.pathname);
              return (
                <ButtonBase
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    onNavigate?.();
                  }}
                  aria-current={active ? 'page' : undefined}
                  sx={{
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
                  }}
                >
                  {item.icon}
                  {t(item.labelKey)}
                  {item.showTaskCount && taskCount > 0 && (
                    <Box
                      component="span"
                      aria-label={t('tasks.waiting', { count: taskCount })}
                      sx={{
                        marginInlineStart: 'auto',
                        minWidth: 22,
                        px: 0.9,
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: 'center',
                        bgcolor: active ? tokens.navy700 : '#fff',
                        color: active ? '#fff' : tokens.navy700,
                      }}
                    >
                      {taskCount}
                    </Box>
                  )}
                </ButtonBase>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function TopBar({ title, onMenu }: { title: ReactNode; onMenu?: () => void }) {
  const { t, i18n } = useTranslation();
  const { me } = useSession();
  const navigate = useNavigate();

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  return (
    <Box
      component="header"
      sx={{
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
      }}
    >
      {onMenu && (
        <IconButton onClick={onMenu} aria-label={t('menu.open')}>
          <MenuIcon />
        </IconButton>
      )}
      {title}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, marginInlineStart: 'auto' }}>
        {me.company && (
          <Box
            sx={{
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
            }}
          >
            <BusinessIcon />
            {companyName(me.company, i18n.language)}
          </Box>
        )}
        {me.companies.length > 1 && (
          <Tooltip title={t('company.switch')}>
            <IconButton onClick={() => navigate('/login/company')} aria-label={t('company.switch')}>
              <SwapHorizIcon />
            </IconButton>
          </Tooltip>
        )}
        <AlertsButton />
        <NotificationsBell />
        <LanguageSwitch />
        <Box sx={{ width: '1px', height: 26, mx: 0.75, bgcolor: tokens.border, display: { xs: 'none', sm: 'block' } }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'end' }}>
            <Typography noWrap sx={{ fontWeight: 600, fontSize: 13, color: tokens.navy700, lineHeight: 1.2 }}>
              {me.displayName}
            </Typography>
            <Typography noWrap sx={{ fontSize: 11.5, color: tokens.gray500 }}>
              {me.isPlatformAdmin ? t('home.platformAdmin') : me.company ? companyName(me.company, i18n.language) : ''}
            </Typography>
          </Box>
          <Initials name={me.displayName} />
        </Box>
        <Tooltip title={t('home.logout')}>
          <IconButton onClick={() => void logout()} aria-label={t('home.logout')}>
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

/** Home matches only itself; other items also match their sub-pages (e.g. a chosen reference list). */
function isActive(path: string, pathname: string) {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
}

/** Tasks waiting for the user: refreshed every minute and on each page change. */
function useTaskCount(pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => workflowApi.inboxCount().then((r) => setCount(r.pending)).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [pathname]);
  return count;
}
