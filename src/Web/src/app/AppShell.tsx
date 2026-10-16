import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import GroupIcon from '@mui/icons-material/Group';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { LanguageSwitch } from '../auth/AuthLayout';
import { companyName } from '../pages/ChooseCompanyPage';
import { SessionProvider, useSession } from './session';

const drawerWidth = 248;

interface MenuItem {
  path: string;
  labelKey: string;
  icon: ReactNode;
  /** Shown only with this permission (the page itself is protected on the server too). */
  permission?: string;
  /** The page belongs to the whole company: a grant for some registrations only does not show it. */
  companyWide?: boolean;
}

interface MenuSection {
  titleKey?: string;
  items: MenuItem[];
}

/** The menu grows with each module; an item without its permission is not shown at all. */
const menu: MenuSection[] = [
  { items: [{ path: '/', labelKey: 'menu.home', icon: <HomeIcon /> }] },
  {
    titleKey: 'menu.administration',
    items: [
      { path: '/admin/users', labelKey: 'menu.users', icon: <GroupIcon />, permission: 'identity.users.view', companyWide: true },
      { path: '/admin/roles', labelKey: 'menu.roles', icon: <AdminPanelSettingsIcon />, permission: 'identity.roles.view', companyWide: true },
    ],
  },
];

export function AppShell() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const { t, i18n } = useTranslation();
  const { me, can } = useSession();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    navigate('/login', { replace: true });
  };

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const sections = menu
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.permission || can(item.permission, item.companyWide)) }))
    .filter((section) => section.items.length > 0);

  const nav = (
    <Box component="nav" aria-label={t('menu.label')}>
      <Toolbar />
      {sections.map((section, index) => (
        <List key={section.titleKey ?? index} subheader={section.titleKey ? <ListSubheader>{t(section.titleKey)}</ListSubheader> : undefined}>
          {section.items.map((item) => (
            <ListItemButton key={item.path} selected={location.pathname === item.path} onClick={() => go(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={t(item.labelKey)} />
            </ListItemButton>
          ))}
        </List>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" color="default" elevation={0} sx={{ zIndex: (th) => th.zIndex.drawer + 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1 } }}>
          {!wide && (
            <IconButton edge="start" onClick={() => setOpen(true)} aria-label={t('menu.open')}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" color="primary" noWrap sx={{ fontWeight: 700, flexGrow: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            {t('app.name')}
          </Typography>
          {me.company && <Chip icon={<BusinessIcon />} label={companyName(me.company, i18n.language)} variant="outlined" sx={{ maxWidth: { xs: 110, sm: 'none' } }} />}
          {me.companies.length > 1 && (
            <IconButton onClick={() => navigate('/login/company')} aria-label={t('company.switch')} title={t('company.switch')}>
              <SwapHorizIcon />
            </IconButton>
          )}
          <LanguageSwitch />
          {/* Phones: icon only, so the bar stays on one line. */}
          <Button startIcon={<LogoutIcon />} color="inherit" onClick={() => void logout()} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            {t('home.logout')}
          </Button>
          <IconButton color="inherit" onClick={() => void logout()} aria-label={t('home.logout')} sx={{ display: { sm: 'none' } }}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={wide ? 'permanent' : 'temporary'}
        open={wide || open}
        onClose={() => setOpen(false)}
        sx={{ width: { md: drawerWidth }, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }}
      >
        {nav}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
