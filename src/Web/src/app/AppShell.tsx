import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
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
  /** The group's icon (the folded rail shows the groups by their icons). */
  icon?: ReactNode;
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
    titleKey: 'menu.reportsSection',
    icon: <QueryStatsOutlinedIcon />,
    items: [
      { path: '/reports/executive', labelKey: 'menu.executive', icon: <QueryStatsOutlinedIcon />, permission: 'reports.executive.view', companyWide: true },
      { path: '/reports/movement', labelKey: 'menu.movement', icon: <SyncAltOutlinedIcon />, permission: 'reports.movement.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.commercial',
    icon: <BusinessOutlinedIcon />,
    items: [
      { path: '/commercial/customers', labelKey: 'menu.customers', icon: <BusinessOutlinedIcon />, permission: 'commercial.customers.view', companyWide: true },
      { path: '/commercial/projects', labelKey: 'menu.projects', icon: <AccountTreeOutlinedIcon />, permission: 'commercial.projects.view', companyWide: true },
      { path: '/commercial/prices', labelKey: 'menu.prices', icon: <SellOutlinedIcon />, permission: 'commercial.prices.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.housingSection',
    icon: <ApartmentOutlinedIcon />,
    items: [
      { path: '/housing/showroom', labelKey: 'menu.showroom', icon: <StorefrontOutlinedIcon />, permission: 'operations.showroom.view', companyWide: true },
      { path: '/housing', labelKey: 'menu.housing', icon: <ApartmentOutlinedIcon />, permission: 'housing.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.operations',
    icon: <LocalShippingOutlinedIcon />,
    items: [
      { path: '/operations/delivery-orders', labelKey: 'menu.deliveryOrders', icon: <LocalShippingOutlinedIcon />, permission: 'operations.delivery.view', companyWide: true },
      { path: '/operations/return-orders', labelKey: 'menu.returnOrders', icon: <KeyboardReturnOutlinedIcon />, permission: 'operations.return.view', companyWide: true },
      { path: '/operations/transfer-orders', labelKey: 'menu.transferOrders', icon: <SwapHorizIcon />, permission: 'operations.transfer.view', companyWide: true },
      { path: '/operations/movements', labelKey: 'menu.movements', icon: <MultipleStopOutlinedIcon />, permission: 'operations.movements.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.billingSection',
    icon: <FactCheckOutlinedIcon />,
    items: [
      { path: '/billing/timesheets', labelKey: 'menu.timesheets', icon: <FactCheckOutlinedIcon />, permission: 'billing.timesheets.view', companyWide: true },
      { path: '/billing/invoices', labelKey: 'menu.invoices', icon: <ReceiptLongOutlinedIcon />, permission: 'billing.invoices.view', companyWide: true },
      { path: '/billing/receipts', labelKey: 'menu.receipts', icon: <PaymentsOutlinedIcon />, permission: 'billing.receipts.view', companyWide: true },
      { path: '/expenses', labelKey: 'menu.expenses', icon: <ReceiptOutlinedIcon />, permission: 'expenses.view', companyWide: true },
      { path: '/billing/aging', labelKey: 'menu.aging', icon: <TimelapseOutlinedIcon />, permission: 'billing.receipts.view', companyWide: true },
      { path: '/billing/bank-accounts', labelKey: 'menu.bankAccounts', icon: <AccountBalanceIcon />, permission: 'billing.receipts.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.payrollSection',
    icon: <RequestQuoteOutlinedIcon />,
    items: [
      { path: '/payroll/runs', labelKey: 'menu.payrollRuns', icon: <RequestQuoteOutlinedIcon />, permission: 'payroll.workers.view', companyWide: true },
      { path: '/payroll/staff', labelKey: 'menu.payrollStaff', icon: <ReceiptLongOutlinedIcon />, permission: 'payroll.staff.view', companyWide: true },
      { path: '/payroll/gosi', labelKey: 'menu.payrollGosi', icon: <ShieldOutlinedIcon />, permission: 'payroll.gosi.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.workforce',
    icon: <EngineeringOutlinedIcon />,
    items: [
      { path: '/workforce/workers', labelKey: 'menu.workers', icon: <EngineeringOutlinedIcon />, permission: 'workforce.workers.view', companyWide: true },
      { path: '/workforce/supplier-costs', labelKey: 'menu.supplierCosts', icon: <PaidOutlinedIcon />, permission: 'workforce.costs.view', companyWide: true },
      { path: '/workforce/history-issues', labelKey: 'menu.historyIssues', icon: <RuleOutlinedIcon />, permission: 'workforce.workers.view', companyWide: true },
      { path: '/workforce/invoice-check', labelKey: 'menu.invoiceCheck', icon: <FactCheckOutlinedIcon />, permission: 'workforce.workers.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.hrSection',
    icon: <BadgeOutlinedIcon />,
    items: [
      { path: '/hr/employees', labelKey: 'menu.hrEmployees', icon: <BadgeOutlinedIcon />, permission: 'staff.view', companyWide: true },
      { path: '/hr/actions', labelKey: 'menu.hrActions', icon: <WorkHistoryOutlinedIcon />, permission: 'staff.view', companyWide: true },
      { path: '/hr/attendance', labelKey: 'menu.hrAttendance', icon: <AccessTimeOutlinedIcon />, permission: 'attendance.view', companyWide: true },
      { path: '/hr/leave', labelKey: 'menu.hrLeave', icon: <BeachAccessOutlinedIcon />, permission: 'leave.view', companyWide: true },
      { path: '/hr/leave-balances', labelKey: 'menu.hrLeaveBalances', icon: <BalanceOutlinedIcon />, permission: 'leave.view', companyWide: true },
      { path: '/hr/advances', labelKey: 'menu.hrAdvances', icon: <CreditCardOutlinedIcon />, permission: 'deductions.view', companyWide: true },
      { path: '/hr/penalties', labelKey: 'menu.hrPenalties', icon: <GavelOutlinedIcon />, permission: 'deductions.view', companyWide: true },
      { path: '/hr/settlements', labelKey: 'menu.hrSettlements', icon: <HandshakeOutlinedIcon />, permission: 'payroll.settlements.view', companyWide: true },
      { path: '/hr/shifts', labelKey: 'menu.hrShifts', icon: <EventNoteOutlinedIcon />, permission: 'attendance.view', companyWide: true },
      { path: '/hr/structure', labelKey: 'menu.hrStructure', icon: <AccountTreeOutlinedIcon />, permission: 'staff.view', companyWide: true },
      { path: '/hr/catalog', labelKey: 'menu.hrCatalog', icon: <CategoryOutlinedIcon />, permission: 'staff.view', companyWide: true },
    ],
  },
  {
    titleKey: 'menu.approvals',
    icon: <TaskAltOutlinedIcon />,
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
    icon: <AccountBalanceOutlinedIcon />,
    items: [
      { path: '/setup/legal-entities', labelKey: 'menu.legalEntities', icon: <AccountBalanceOutlinedIcon />, permission: 'organization.legal_entities.view' },
      { path: '/setup/branches', labelKey: 'menu.branches', icon: <StoreOutlinedIcon />, permission: 'organization.branches.view' },
      { path: '/setup/reference-lists', labelKey: 'menu.referenceLists', icon: <ListAltOutlinedIcon />, permission: 'organization.reference_data.view' },
      { path: '/setup/modules', labelKey: 'menu.modules', icon: <ExtensionOutlinedIcon />, permission: 'organization.modules.view' },
    ],
  },
  {
    titleKey: 'menu.administration',
    icon: <AdminPanelSettingsOutlinedIcon />,
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
  const [pinned, setPinned] = useState(readPinned);
  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try {
      window.localStorage.setItem(pinKey, next ? '1' : '0');
    } catch {
      // The choice simply is not remembered (private window, blocked storage).
    }
  };

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
            zIndex: 40,
            flex: `0 0 ${pinned ? tokens.sidebarWidth : railWidth}px`,
            height: `calc(100dvh - ${tokens.gap * 2}px)`,
            transition: 'flex-basis .22s ease',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              insetBlock: 0,
              insetInlineStart: 0,
              width: pinned ? tokens.sidebarWidth : railWidth,
              borderRadius: `${tokens.radiusLg}px`,
              boxShadow: tokens.shadowMd,
              overflow: 'hidden',
              transition: 'width .22s ease, box-shadow .22s ease',
              ...(pinned ? {} : railStyles),
            }}
          >
            <Sidebar sections={sections} pinned={pinned} onPin={togglePin} />
          </Box>
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
} as const;

/** Folded unless the user pinned it open (remembered in this browser only). */
function readPinned() {
  try {
    return window.localStorage.getItem(pinKey) === '1';
  } catch {
    return false;
  }
}

/**
 * The navigation as on the old portal: the brand, the home items, then one group per section opening on a click (one
 * open at a time, the current page's group open). Folded, it is a rail of icons: the texts fade out, the section
 * titles become lines and the groups show their icons only.
 */
function Sidebar({ sections, pinned, onPin, onNavigate }: { sections: MenuSection[]; pinned?: boolean; onPin?: () => void; onNavigate?: () => void }) {
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
  const [openKey, setOpenKey] = useState<string | undefined>(current);
  useEffect(() => setOpenKey(current), [current]);

  const text = { whiteSpace: 'nowrap', overflow: 'hidden', transition: 'opacity .15s' } as const;
  const badge = (active: boolean) => (
    <Box
      component="span"
      className="rail-fade"
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
        ...text,
      }}
    >
      {taskCount}
    </Box>
  );
  const link = (item: MenuItem, sub: boolean) => {
    const active = item.path === best;
    return (
      <ButtonBase
        key={item.path}
        onClick={() => {
          navigate(item.path);
          onNavigate?.();
        }}
        aria-current={active ? 'page' : undefined}
        title={t(item.labelKey)}
        sx={{
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
        }}
      >
        {item.icon}
        <Box component="span" className="rail-fade" sx={text}>
          {t(item.labelKey)}
        </Box>
        {item.showTaskCount && taskCount > 0 && badge(active)}
      </ButtonBase>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: tokens.sidebarWidth, bgcolor: tokens.navy700, color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: '15px', pt: 2.75, pb: 2.25 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 46, height: 46, borderRadius: '50%', bgcolor: '#fff', overflow: 'hidden' }}>
          <Box component="img" src="/brand/carepro-logo.png" alt="" sx={{ width: 40, height: 'auto' }} />
        </Box>
        <Box className="rail-fade" sx={{ minWidth: 0, flex: 1, ...text }}>
          <Typography noWrap sx={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: '#fff' }}>{t('app.name')}</Typography>
          <Typography noWrap sx={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>{t('app.tagline')}</Typography>
        </Box>
        {onPin && (
          <Tooltip title={pinned ? t('menu.unpin') : t('menu.pin')}>
            <IconButton
              onClick={onPin}
              aria-label={pinned ? t('menu.unpin') : t('menu.pin')}
              aria-pressed={pinned}
              size="small"
              className="rail-wide"
              sx={{
                flex: '0 0 auto',
                width: 32,
                height: 32,
                bgcolor: pinned ? '#fff' : 'rgba(255,255,255,.1)',
                color: pinned ? tokens.navy700 : 'rgba(255,255,255,.75)',
                transform: pinned ? 'none' : 'rotate(45deg)',
                transition: 'background-color .15s, color .15s, transform .2s',
                '&:hover': { bgcolor: pinned ? '#fff' : 'rgba(255,255,255,.2)', color: pinned ? tokens.navy700 : '#fff' },
                '& svg': { fontSize: 17 },
              }}
            >
              <PushPinOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box component="nav" aria-label={t('menu.label')} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.5, pb: 1.5, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.2) transparent' }}>
        {sections.map((section, index) => {
          if (!section.titleKey) {
            return <Box key={index}>{section.items.map((item) => link(item, false))}</Box>;
          }

          const key = section.titleKey;
          const isOpen = openKey === key;
          const holdsCurrent = current === key;
          const holdsTasks = taskCount > 0 && section.items.some((item) => item.showTaskCount);
          return (
            <Box key={key}>
              {index === 1 && (
                <>
                  <Typography noWrap className="rail-wide" sx={{ px: 1.5, pt: 2, pb: 0.75, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>
                    {t('menu.sections')}
                  </Typography>
                  <Box aria-hidden className="rail-line" sx={{ display: 'none', height: '1px', my: 1.5, mx: 1.25, bgcolor: 'rgba(255,255,255,.14)' }} />
                </>
              )}
              <ButtonBase
                onClick={() => setOpenKey(isOpen ? undefined : key)}
                aria-expanded={isOpen}
                title={t(key)}
                className={holdsCurrent ? 'rail-current' : undefined}
                sx={{
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
                }}
              >
                {section.icon}
                <Box component="span" className="rail-fade" sx={{ ...text, flex: 1 }}>
                  {t(key)}
                </Box>
                {holdsTasks && !isOpen && badge(false)}
                <ExpandMoreIcon className="rail-fade" sx={{ flex: '0 0 auto', fontSize: 18, color: 'rgba(255,255,255,.55)', transform: isOpen ? 'rotate(180deg)' : 'none', ...text, transition: 'transform .2s, opacity .15s' }} />
              </ButtonBase>
              {isOpen && (
                <Box className="rail-wide" sx={{ mt: 0.5, mb: 1, paddingInlineStart: 1.75 }}>
                  {section.items.map((item) => link(item, true))}
                </Box>
              )}
            </Box>
          );
        })}
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
