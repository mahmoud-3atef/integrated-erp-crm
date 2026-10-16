import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryIcon from '@mui/icons-material/History';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localName } from '../../api/access';
import { errorKey } from '../../api/auth';
import { workflowApi, type ApproverKind, type ApproverOptions, type RouteSummary, type RouteVersion, type Stage } from '../../api/workflow';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, PageHeader, Panel, StatusDot } from '../../components/ui';

/** Approval routes: one per document type, each change saved as a new version. */
export function RoutesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [options, setOptions] = useState<ApproverOptions>({ roles: [], members: [] });
  const [editing, setEditing] = useState<RouteSummary | null>(null);
  const [versionsOf, setVersionsOf] = useState<RouteSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('workflow.routes.manage', true);

  const load = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([workflowApi.routes(), workflowApi.approverOptions()]);
      setRoutes(r);
      setOptions(o);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box>
      <PageHeader title={t('routes.title')} subtitle={t('routes.intro')} />
      <ErrorMessage messageKey={error} />
      <Stack spacing={`${tokens.gap}px`}>
        {routes.map((route) => (
          <Panel key={route.documentType} padding={2.5}>
            <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: tokens.navy800 }}>{localName(route, i18n.language)}</Typography>
                <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
                  {route.hasRoute ? (
                    <>
                      <StatusDot tone={route.isActive ? 'success' : 'neutral'} label={route.isActive ? t('routes.active') : t('routes.inactive')} />
                      <Badge tone="primary">{t('routes.version', { version: route.version })}</Badge>
                    </>
                  ) : (
                    <StatusDot tone="warning" label={t('routes.notDefined')} />
                  )}
                </Stack>
              </Box>
              <Stack direction="row" spacing={1}>
                {route.hasRoute && (
                  <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => setVersionsOf(route)}>
                    {t('routes.versions')}
                  </Button>
                )}
                {canManage && (
                  <Button size="small" variant="contained" startIcon={route.hasRoute ? <EditOutlinedIcon /> : <AddIcon />} onClick={() => setEditing(route)}>
                    {route.hasRoute ? t('routes.edit') : t('routes.define')}
                  </Button>
                )}
              </Stack>
            </Stack>
            {route.stages.length > 0 ? <StageChain stages={route.stages} route={route} options={options} /> : <EmptyState text={t('routes.noStages')} />}
          </Panel>
        ))}
      </Stack>
      {editing && (
        <RouteEditor
          route={editing}
          options={options}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {versionsOf && <VersionsDialog route={versionsOf} options={options} onClose={() => setVersionsOf(null)} />}
    </Box>
  );
}

function useApproverLabel(route: RouteSummary, options: ApproverOptions) {
  const { t, i18n } = useTranslation();
  return (stage: Stage) => {
    if (stage.kind === 'User') {
      return options.members.find((m) => m.userAccountId === stage.userId)?.displayName ?? '…';
    }
    if (stage.kind === 'Role') {
      const role = options.roles.find((r) => r.id === stage.roleId);
      return role ? t('routes.anyoneWithRole', { role: localName(role, i18n.language) }) : '…';
    }
    const key = route.dynamicApprovers.find((k) => k.key === stage.dynamicKey);
    return key ? localName(key, i18n.language) : '…';
  };
}

/** Stages as numbered steps (the order the document follows). */
function StageChain({ stages, route, options }: { stages: Stage[]; route: RouteSummary; options: ApproverOptions }) {
  const { i18n } = useTranslation();
  const approver = useApproverLabel(route, options);
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, flexWrap: 'wrap' }}>
      {stages.map((stage, index) => (
        <Stack key={index} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', px: 1.75, py: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.tint, minWidth: 200 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', bgcolor: tokens.navy700, color: '#fff', fontSize: 12.5, fontWeight: 700, flex: '0 0 auto' }}>
              {index + 1}
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{i18n.language === 'ar' ? stage.nameAr : stage.nameEn}</Typography>
              <Typography sx={{ fontSize: 12, color: tokens.gray600 }}>{approver(stage)}</Typography>
            </Box>
          </Box>
          {index < stages.length - 1 && (
            <Typography aria-hidden sx={{ color: tokens.gray500, display: { xs: 'none', md: 'block' } }}>
              {i18n.dir() === 'rtl' ? '←' : '→'}
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

const emptyStage = (): Stage => ({ nameAr: '', nameEn: '', kind: 'Role', userId: null, roleId: null, dynamicKey: null });

function RouteEditor({ route, options, onClose, onSaved }: { route: RouteSummary; options: ApproverOptions; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const [stages, setStages] = useState<Stage[]>(route.stages.length > 0 ? route.stages.map((s) => ({ ...s })) : [emptyStage()]);
  const [active, setActive] = useState(route.hasRoute ? route.isActive : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, change: Partial<Stage>) => setStages((current) => current.map((s, i) => (i === index ? { ...s, ...change } : s)));
  const move = (index: number, by: number) =>
    setStages((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item!);
      return next;
    });

  const complete = stages.every(
    (s) => s.nameAr.trim() && s.nameEn.trim() && ((s.kind === 'User' && s.userId) || (s.kind === 'Role' && s.roleId) || (s.kind === 'Dynamic' && s.dynamicKey)),
  );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await workflowApi.publish(route.documentType, stages, active);
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={phone}>
      <DialogTitle>
        {t('routes.editTitle')} — {localName(route, i18n.language)}
      </DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 13, color: tokens.gray600, mb: 2 }}>{t('routes.editHint')}</Typography>
        <Stack spacing={1.5}>
          {stages.map((stage, index) => (
            <Box key={index} sx={{ p: 1.75, borderRadius: `${tokens.radius}px`, border: `1px solid ${tokens.border}`, bgcolor: tokens.gray50 }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
                <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>{t('approval.stage', { order: index + 1 })}</Typography>
                <Stack direction="row">
                  <IconButton size="small" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('routes.moveUp')}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" disabled={index === stages.length - 1} onClick={() => move(index, 1)} aria-label={t('routes.moveDown')}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <Tooltip title={t('routes.removeStage')}>
                    <span>
                      <IconButton size="small" disabled={stages.length === 1} onClick={() => setStages((c) => c.filter((_, i) => i !== index))} aria-label={t('routes.removeStage')}>
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                <TextField size="small" label={t('fields.NameAr')} value={stage.nameAr} onChange={(e) => update(index, { nameAr: e.target.value })} slotProps={{ htmlInput: { dir: 'rtl', maxLength: 200 } }} />
                <TextField size="small" label={t('fields.NameEn')} value={stage.nameEn} onChange={(e) => update(index, { nameEn: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 200 } }} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label={t('routes.approverKind')}
                  value={stage.kind}
                  onChange={(e) => update(index, { kind: e.target.value as ApproverKind, userId: null, roleId: null, dynamicKey: null })}
                  sx={{ maxWidth: { sm: 220 } }}
                >
                  <MenuItem value="Role">{t('routes.kind.Role')}</MenuItem>
                  <MenuItem value="User">{t('routes.kind.User')}</MenuItem>
                  <MenuItem value="Dynamic" disabled={route.dynamicApprovers.length === 0}>
                    {t('routes.kind.Dynamic')}
                  </MenuItem>
                </TextField>
                {stage.kind === 'Role' && (
                  <TextField select size="small" label={t('users.role')} value={stage.roleId ?? ''} onChange={(e) => update(index, { roleId: e.target.value })}>
                    {options.roles.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {localName(r, i18n.language)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {stage.kind === 'User' && (
                  <TextField select size="small" label={t('routes.user')} value={stage.userId ?? ''} onChange={(e) => update(index, { userId: e.target.value })}>
                    {options.members.map((m) => (
                      <MenuItem key={m.userAccountId} value={m.userAccountId}>
                        {m.displayName}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {stage.kind === 'Dynamic' && (
                  <TextField select size="small" label={t('routes.fromDocument')} value={stage.dynamicKey ?? ''} onChange={(e) => update(index, { dynamicKey: e.target.value })}>
                    {route.dynamicApprovers.map((k) => (
                      <MenuItem key={k.key} value={k.key}>
                        {localName(k, i18n.language)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
        <Button startIcon={<AddIcon />} onClick={() => setStages((c) => [...c, emptyStage()])} disabled={stages.length >= 10} sx={{ mt: 1.5 }}>
          {t('routes.addStage')}
        </Button>
        <Box sx={{ mt: 1 }}>
          <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label={t('routes.activeHint')} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !complete}>
          {busy ? t('common.loading') : t('routes.publish')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function VersionsDialog({ route, options, onClose }: { route: RouteSummary; options: ApproverOptions; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [versions, setVersions] = useState<RouteVersion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workflowApi.versions(route.documentType).then(setVersions).catch((failure: unknown) => setError(errorKey(failure)));
  }, [route.documentType]);

  const when = (value: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {t('routes.versions')} — {localName(route, i18n.language)}
      </DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          {versions.map((v) => (
            <Box key={v.version}>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                <Badge tone={v.version === route.version ? 'success' : 'neutral'}>{t('routes.version', { version: v.version })}</Badge>
                <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>
                  {v.publishedBy} — {when(v.publishedAt)}
                </Typography>
              </Stack>
              <StageChain stages={v.stages} route={route} options={options} />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
