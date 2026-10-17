import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Alert, Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSession } from '../app/session';
import { tokens } from '../app/theme';
import { Badge, Initials, Panel } from '../components/ui';
/** Landing page inside the app shell; modules add their dashboards here as they are released. */
export function HomePage() {
    const { t } = useTranslation();
    const { me } = useSession();
    return (_jsxs(Stack, { spacing: `${tokens.gap}px`, children: [_jsx(Panel, { padding: 3, children: _jsxs(Stack, { direction: "row", spacing: 2, sx: { alignItems: 'center' }, children: [_jsx(Initials, { name: me.displayName, size: 52 }), _jsxs(Box, { children: [_jsx(Typography, { component: "h1", sx: { fontSize: 21, fontWeight: 700, color: tokens.navy800 }, children: t('home.welcome', { name: me.displayName }) }), _jsx(Typography, { sx: { fontSize: 13.5, color: tokens.gray600 }, children: t('home.intro') }), me.isPlatformAdmin && (_jsx(Box, { sx: { mt: 1 }, children: _jsx(Badge, { tone: "info", children: t('home.platformAdmin') }) }))] })] }) }), me.permissions.length === 0 && _jsx(Alert, { severity: "info", children: t('home.noPermissions') })] }));
}
