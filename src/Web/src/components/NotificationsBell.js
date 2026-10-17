import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { Badge as MuiBadge, Box, Button, ButtonBase, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { documentsApi } from '../api/documents';
import { tokens } from '../app/theme';
import { EmptyState } from './ui';
const refreshMs = 60_000;
/** Bell in the top bar: unread count (refreshed every minute and when the tab comes back), latest messages. */
export function NotificationsBell() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [page, setPage] = useState({ unreadCount: 0, items: [] });
    const [anchor, setAnchor] = useState(null);
    const load = useCallback(async () => {
        try {
            setPage(await documentsApi.notifications());
        }
        catch {
            // Keep the last list; the next refresh tries again.
        }
    }, []);
    useEffect(() => {
        void load();
        const timer = window.setInterval(() => void load(), refreshMs);
        const onVisible = () => document.visibilityState === 'visible' && void load();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load]);
    const open = async (item) => {
        if (!item.isRead) {
            await documentsApi.markRead(item.id).catch(() => undefined);
            void load();
        }
        setAnchor(null);
        if (item.link) {
            navigate(item.link);
        }
    };
    const readAll = async () => {
        await documentsApi.markAllRead().catch(() => undefined);
        void load();
    };
    const ar = i18n.language === 'ar';
    const when = (value) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const label = page.unreadCount > 0 ? t('notifications.unread', { count: page.unreadCount }) : t('notifications.title');
    return (_jsxs(_Fragment, { children: [_jsx(Tooltip, { title: label, children: _jsx(IconButton, { onClick: (e) => setAnchor(e.currentTarget), "aria-label": label, children: _jsx(MuiBadge, { badgeContent: page.unreadCount, color: "error", max: 99, children: _jsx(NotificationsNoneOutlinedIcon, {}) }) }) }), _jsxs(Popover, { open: anchor !== null, anchorEl: anchor, onClose: () => setAnchor(null), anchorOrigin: { vertical: 'bottom', horizontal: 'center' }, transformOrigin: { vertical: 'top', horizontal: 'center' }, slotProps: { paper: { sx: { width: 360, maxWidth: 'calc(100vw - 16px)', mt: 1, borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowMd } } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: `1px solid ${tokens.border}` }, children: [_jsx(Typography, { sx: { fontWeight: 700, color: tokens.navy800 }, children: t('notifications.title') }), page.unreadCount > 0 && (_jsx(Button, { size: "small", startIcon: _jsx(DoneAllIcon, {}), onClick: () => void readAll(), children: t('notifications.readAll') }))] }), _jsxs(Box, { sx: { maxHeight: 420, overflowY: 'auto' }, children: [page.items.length === 0 && _jsx(EmptyState, { text: t('notifications.empty') }), page.items.map((item) => (_jsxs(ButtonBase, { onClick: () => void open(item), sx: {
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'start',
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: `1px solid ${tokens.gray100}`,
                                    bgcolor: item.isRead ? 'transparent' : tokens.navy50,
                                    '&:hover': { bgcolor: tokens.tint },
                                }, children: [_jsxs(Stack, { direction: "row", spacing: 1, sx: { alignItems: 'center' }, children: [!item.isRead && _jsx(Box, { component: "span", "aria-hidden": true, sx: { width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.navy600, flex: '0 0 auto' } }), _jsx(Typography, { sx: { fontSize: 13.5, fontWeight: item.isRead ? 500 : 700, color: tokens.navy800 }, children: ar ? item.titleAr : item.titleEn })] }), _jsx(Typography, { sx: { mt: 0.25, fontSize: 12.5, lineHeight: 1.6, color: tokens.gray600 }, children: ar ? item.bodyAr : item.bodyEn }), _jsx(Typography, { sx: { mt: 0.5, fontSize: 11.5, color: tokens.gray500 }, children: when(item.createdAt) })] }, item.id)))] })] })] }));
}
