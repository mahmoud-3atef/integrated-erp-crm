import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import NotificationImportantOutlinedIcon from '@mui/icons-material/NotificationImportantOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { keyframes } from '@emotion/react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { alertsApi, type Alert, type AlertList, type AlertSetting, type AlertSeverity } from '../../api/alerts';
import { errorKey } from '../../api/auth';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { sar } from '../operations/delivery';

const rise = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

/** "Since N days", as Arabic counts days (one, two, 3–10, 11 and more). */
const daysKey = (days: number) => (days === 1 ? 'alerts.daysOne' : days === 2 ? 'alerts.daysTwo' : days <= 10 ? 'alerts.daysFew' : 'alerts.daysMany');

const look: Record<AlertSeverity, { color: string; bg: string; icon: ReactNode }> = {
  Critical: { color: '#c23a3a', bg: '#fdecea', icon: <ErrorOutlineIcon /> },
  Warning: { color: '#c87512', bg: '#fff4e2', icon: <WarningAmberOutlinedIcon /> },
  Info: { color: '#2b6cb0', bg: '#e8f1fb', icon: <InfoOutlinedIcon /> },
};

/** A severity as a big counter card that filters the list. */
function SeverityCard({ severity, count, active, onClick }: { severity: AlertSeverity; count: number; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const l = look[severity];
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1.5,
        p: 2,
        borderRadius: `${tokens.radius + 4}px`,
        bgcolor: '#fff',
        textAlign: 'start',
        boxShadow: active ? `0 0 0 2px ${l.color}, 0 12px 26px ${l.color}2e` : tokens.shadowSm,
        transform: active ? 'translateY(-2px)' : 'none',
        transition: 'all .2s ease',
        '&:hover': { transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ width: 46, height: 46, borderRadius: '30%', display: 'grid', placeItems: 'center', color: l.color, bgcolor: l.bg, '& svg': { fontSize: 26 } }}>{l.icon}</Box>
      <Box>
        <Typography sx={{ fontSize: 26, fontWeight: 800, color: l.color, lineHeight: 1.1 }}>{count}</Typography>
        <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{t(`alerts.severity.${severity}`)}</Typography>
      </Box>
    </ButtonBase>
  );
}

/**
 * The alerts center: what needs attention now, from every module the user may see — by severity, grouped by kind, each
 * with where to act; hide one for some days; and (for whoever sets them up) which alerts are on and their days.
 */
export function AlertsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const ar = i18n.language === 'ar';
  const [params, setParams] = useSearchParams();
  const code = params.get('code');
  const [severity, setSeverity] = useState<AlertSeverity | null>(null);
  const [data, setData] = useState<AlertList | null>(null);
  const [hiding, setHiding] = useState<{ anchor: HTMLElement; alert: Alert } | null>(null);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSet = can('workflow.alerts.manage', true);

  const reload = useCallback(async () => {
    try {
      setData(await alertsApi.list());
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const shown = useMemo(() => (data?.items ?? []).filter((a) => (!severity || a.severity === severity) && (!code || a.code === code)), [data, severity, code]);
  const groups = useMemo(() => {
    const byKind = new Map<string, Alert[]>();
    for (const a of shown) byKind.set(a.code, [...(byKind.get(a.code) ?? []), a]);
    return [...byKind.values()];
  }, [shown]);
  const kinds = useMemo(() => {
    const all = new Map<string, Alert>();
    for (const a of data?.items ?? []) if (!all.has(a.code)) all.set(a.code, a);
    return [...all.values()];
  }, [data]);

  const hide = async (days: number) => {
    if (!hiding) return;
    const { alert } = hiding;
    setHiding(null);
    await alertsApi.dismiss(alert.code, alert.key, days).catch((failure: unknown) => setError(errorKey(failure)));
    await reload();
  };

  const total = (data?.counts.critical ?? 0) + (data?.counts.warning ?? 0) + (data?.counts.info ?? 0);

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: `${tokens.radiusLg}px`,
          p: { xs: 2.5, md: 3.5 },
          mb: 2.5,
          color: '#fff',
          background: 'linear-gradient(120deg, #3a1c2e 0%, #8c2f39 50%, #d9822b 100%)',
          boxShadow: '0 14px 34px rgba(140,47,57,.28)',
          animation: `${rise} .45s ease both`,
          '&::before': { content: '""', position: 'absolute', width: 320, height: 320, borderRadius: '50%', top: -160, insetInlineEnd: -80, background: 'rgba(255,255,255,.08)' },
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ position: 'relative', zIndex: 1, gap: 2, alignItems: { md: 'center' } }}>
          <Box sx={{ width: 58, height: 58, borderRadius: '30%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.18)', '& svg': { fontSize: 32 } }}>
            <NotificationImportantOutlinedIcon />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography component="h1" sx={{ fontSize: 24, fontWeight: 800 }}>
              {t('alerts.title')}
            </Typography>
            <Typography sx={{ fontSize: 13.5, opacity: 0.88, maxWidth: 720 }}>{t('alerts.intro')}</Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1 }}>
            {(data?.counts.hidden ?? 0) > 0 && (
              <Button
                startIcon={<VisibilityOutlinedIcon />}
                onClick={() => void alertsApi.restore().then(reload)}
                sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,.16)', '&:hover': { bgcolor: 'rgba(255,255,255,.26)' } }}
              >
                {t('alerts.showHidden', { count: data!.counts.hidden })}
              </Button>
            )}
            {canSet && (
              <Button startIcon={<SettingsOutlinedIcon />} onClick={() => setSettings(true)} sx={{ color: '#3a1c2e', bgcolor: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#fbeeee' } }}>
                {t('alerts.settings')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      <ErrorMessage messageKey={error} />
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, mb: 2 }}>
        {(['Critical', 'Warning', 'Info'] as const).map((s) => (
          <SeverityCard key={s} severity={s} count={data?.counts[s.toLowerCase() as 'critical' | 'warning' | 'info'] ?? 0} active={severity === s} onClick={() => setSeverity(severity === s ? null : s)} />
        ))}
      </Stack>

      {kinds.length > 1 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <ButtonBase onClick={() => setParams({}, { replace: true })} sx={{ px: 1.75, py: 0.75, borderRadius: 99, fontSize: 13, fontWeight: 700, bgcolor: !code ? tokens.navy700 : '#fff', color: !code ? '#fff' : tokens.gray600, boxShadow: tokens.shadowXs }}>
            {t('alerts.allKinds')}
          </ButtonBase>
          {kinds.map((k) => (
            <ButtonBase
              key={k.code}
              onClick={() => setParams(code === k.code ? {} : { code: k.code }, { replace: true })}
              sx={{ px: 1.75, py: 0.75, borderRadius: 99, fontSize: 13, fontWeight: 700, bgcolor: code === k.code ? tokens.navy700 : '#fff', color: code === k.code ? '#fff' : tokens.gray600, boxShadow: tokens.shadowXs }}
            >
              {ar ? k.nameAr : k.nameEn} · {data!.items.filter((a) => a.code === k.code).length}
            </ButtonBase>
          ))}
        </Stack>
      )}

      {!data && !error && <LinearProgress sx={{ borderRadius: 2 }} />}
      {data && total === 0 && (
        <Box sx={{ py: 8, textAlign: 'center', bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, animation: `${rise} .4s ease both` }}>
          <TaskAltIcon sx={{ fontSize: 56, color: '#1f9d55', mb: 1 }} />
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: tokens.navy800 }}>{t('alerts.none')}</Typography>
          <Typography sx={{ fontSize: 13, color: tokens.gray500 }}>{t('alerts.noneHint')}</Typography>
        </Box>
      )}

      <Stack spacing={2.5}>
        {groups.map((items, g) => (
          <Box key={items[0]!.code} sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, overflow: 'hidden', animation: `${rise} .4s ease both`, animationDelay: `${g * 60}ms` }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, px: 2.5, py: 1.75, borderBottom: `1px solid ${tokens.gray100}` }}>
              <Typography sx={{ flex: 1, fontSize: 15.5, fontWeight: 800, color: tokens.navy800 }}>
                {ar ? items[0]!.nameAr : items[0]!.nameEn}
                <Typography component="span" sx={{ fontSize: 12.5, color: tokens.gray500, fontWeight: 600, marginInlineStart: 1 }}>
                  {ar ? items[0]!.groupAr : items[0]!.groupEn}
                </Typography>
              </Typography>
              <Box sx={{ minWidth: 28, height: 28, px: 1, borderRadius: 99, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#fff', bgcolor: look[items[0]!.severity].color }}>
                {items.length}
              </Box>
            </Stack>
            <Box>
              {items.map((a, n) => {
                const l = look[a.severity];
                return (
                  <Stack
                    key={a.key}
                    direction={{ xs: 'column', md: 'row' }}
                    sx={{
                      gap: 1.5,
                      alignItems: { md: 'center' },
                      px: 2.5,
                      py: 1.5,
                      borderInlineStart: `4px solid ${l.color}`,
                      borderBottom: n < items.length - 1 ? `1px solid ${tokens.gray100}` : 'none',
                      transition: 'background-color .15s',
                      '&:hover': { bgcolor: tokens.gray50 },
                    }}
                  >
                    <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', color: l.color, bgcolor: l.bg, '& svg': { fontSize: 20 } }}>{l.icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>{ar ? a.titleAr : a.titleEn}</Typography>
                      {(ar ? a.detailAr : a.detailEn) && <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{ar ? a.detailAr : a.detailEn}</Typography>}
                    </Box>
                    {a.amount != null && <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.navy800, whiteSpace: 'nowrap' }}>{sar(a.amount)}</Typography>}
                    {a.days > 0 && (
                      <Box sx={{ px: 1.25, py: 0.4, borderRadius: 99, fontSize: 12, fontWeight: 700, color: l.color, bgcolor: l.bg, whiteSpace: 'nowrap' }}>{t(daysKey(a.days), { count: a.days })}</Box>
                    )}
                    <Stack direction="row" sx={{ gap: 0.5 }}>
                      <Button size="small" variant="contained" endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />} onClick={() => navigate(a.link)} sx={{ boxShadow: 'none' }}>
                        {t('alerts.open')}
                      </Button>
                      <Button size="small" startIcon={<VisibilityOffOutlinedIcon />} onClick={(e) => setHiding({ anchor: e.currentTarget, alert: a })} sx={{ color: tokens.gray500 }}>
                        {t('alerts.hide')}
                      </Button>
                    </Stack>
                  </Stack>
                );
              })}
            </Box>
          </Box>
        ))}
      </Stack>

      <Menu anchorEl={hiding?.anchor} open={!!hiding} onClose={() => setHiding(null)}>
        {(
          [
            [1, 'alerts.hideDay'],
            [7, 'alerts.hideWeek'],
            [30, 'alerts.hideMonth'],
          ] as const
        ).map(([d, label]) => (
          <MenuItem key={d} onClick={() => void hide(d)}>
            {t(label)}
          </MenuItem>
        ))}
      </Menu>
      {settings && (
        <SettingsDialog
          onClose={() => {
            setSettings(false);
            void reload();
          }}
        />
      )}
    </Box>
  );
}

/** Which alerts are on, and each one's days. */
function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [rows, setRows] = useState<AlertSetting[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    alertsApi
      .settings()
      .then(setRows)
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, []);

  const save = async () => {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      for (const r of rows) await alertsApi.saveSetting(r.code, r.enabled, r.days);
      onClose();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const change = (n: number, patch: Partial<AlertSetting>) => setRows(rows!.map((r, i) => (i === n ? { ...r, ...patch } : r)));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('alerts.settings')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 2 }}>{t('alerts.settingsHint')}</Typography>
        {!rows && <LinearProgress sx={{ borderRadius: 2 }} />}
        <Stack spacing={1.25}>
          {rows?.map((r, n) => (
            <Stack key={r.code} direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, gap: 1.5, p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: r.enabled ? tokens.gray50 : '#fff', border: `1px solid ${tokens.gray100}`, opacity: r.enabled ? 1 : 0.6 }}>
              <Switch checked={r.enabled} onChange={(e) => change(n, { enabled: e.target.checked })} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>{ar ? r.nameAr : r.nameEn}</Typography>
                <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{ar ? r.groupAr : r.groupEn}</Typography>
              </Box>
              {r.daysMeaningEn !== '—' && (
                <TextField
                  size="small"
                  sx={{ width: { sm: 280 } }}
                  label={ar ? r.daysMeaningAr : r.daysMeaningEn}
                  value={r.days}
                  disabled={!r.enabled}
                  onChange={(e) => change(n, { days: Math.min(365, Number(e.target.value.replace(/\D/g, '')) || 0) })}
                  slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
                />
              )}
            </Stack>
          ))}
        </Stack>
        {message && <Typography sx={{ mt: 2, fontSize: 13, color: '#1f9d55', fontWeight: 700 }}>{message}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button
          disabled={busy}
          onClick={() =>
            void alertsApi
              .digest()
              .then((r) => setMessage(t('alerts.digestSent', { count: r.told })))
              .catch((failure: unknown) => setError(errorKey(failure)))
          }
        >
          {t('alerts.digestNow')}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || !rows} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
