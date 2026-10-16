import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { Badge as MuiBadge, Box, Button, ButtonBase, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { documentsApi, type Notification, type NotificationPage } from '../api/documents';
import { tokens } from '../app/theme';
import { EmptyState } from './ui';

const refreshMs = 60_000;

/** Bell in the top bar: unread count (refreshed every minute and when the tab comes back), latest messages. */
export function NotificationsBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState<NotificationPage>({ unreadCount: 0, items: [] });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      setPage(await documentsApi.notifications());
    } catch {
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

  const open = async (item: Notification) => {
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
  const when = (value: string) =>
    new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const label = page.unreadCount > 0 ? t('notifications.unread', { count: page.unreadCount }) : t('notifications.title');

  return (
    <>
      <Tooltip title={label}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={label}>
          <MuiBadge badgeContent={page.unreadCount} color="error" max={99}>
            <NotificationsNoneOutlinedIcon />
          </MuiBadge>
        </IconButton>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 16px)', mt: 1, borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowMd } } }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: `1px solid ${tokens.border}` }}>
          <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>{t('notifications.title')}</Typography>
          {page.unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAllIcon />} onClick={() => void readAll()}>
              {t('notifications.readAll')}
            </Button>
          )}
        </Stack>
        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {page.items.length === 0 && <EmptyState text={t('notifications.empty')} />}
          {page.items.map((item) => (
            <ButtonBase
              key={item.id}
              onClick={() => void open(item)}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'start',
                px: 2,
                py: 1.25,
                borderBottom: `1px solid ${tokens.gray100}`,
                bgcolor: item.isRead ? 'transparent' : tokens.navy50,
                '&:hover': { bgcolor: tokens.tint },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {!item.isRead && <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.navy600, flex: '0 0 auto' }} />}
                <Typography sx={{ fontSize: 13.5, fontWeight: item.isRead ? 500 : 700, color: tokens.navy800 }}>{ar ? item.titleAr : item.titleEn}</Typography>
              </Stack>
              <Typography sx={{ mt: 0.25, fontSize: 12.5, lineHeight: 1.6, color: tokens.gray600 }}>{ar ? item.bodyAr : item.bodyEn}</Typography>
              <Typography sx={{ mt: 0.5, fontSize: 11.5, color: tokens.gray500 }}>{when(item.createdAt)}</Typography>
            </ButtonBase>
          ))}
        </Box>
      </Popover>
    </>
  );
}
