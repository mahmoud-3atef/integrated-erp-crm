import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accessApi, localName, type Permission, type Role } from '../../api/access';
import { errorKey } from '../../api/auth';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader, Panel } from '../../components/ui';

export function RolesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('identity.roles.manage', true);

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([accessApi.roles(), accessApi.permissions()]);
      setRoles(r);
      setPermissions(p);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box>
      <PageHeader
        title={t('roles.title')}
        subtitle={t('roles.intro')}
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
              {t('roles.new')}
            </Button>
          )
        }
      />
      <ErrorMessage messageKey={error} />
      <Panel>
        <TableContainer sx={{ borderRadius: '6px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('roles.name')}</TableCell>
                <TableCell>{t('roles.type')}</TableCell>
                <TableCell>{t('roles.permissions')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(roles ?? []).map((role) => (
                <TableRow key={role.id} hover>
                  <TableCell sx={{ fontWeight: 500, color: tokens.gray900 }}>{localName(role, i18n.language)}</TableCell>
                  <TableCell>
                    {role.kind === 'Custom' ? <Badge tone="neutral">{t('roles.custom')}</Badge> : <Badge tone="primary" icon={<LockOutlinedIcon />}>{t('roles.builtIn')}</Badge>}
                  </TableCell>
                  <TableCell>{t('roles.permissionCount', { count: role.permissions.length })}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={canManage && role.kind === 'Custom' ? t('common.edit') : t('roles.permissions')}>
                      <IconButton size="small" onClick={() => setEditing(role)} aria-label={`${t('common.edit')} ${localName(role, i18n.language)}`}>
                        {canManage && role.kind === 'Custom' ? <EditOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
      {editing && (
        <RoleDialog
          role={editing === 'new' ? null : editing}
          permissions={permissions}
          readOnly={!canManage || (editing !== 'new' && editing.kind !== 'Custom')}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </Box>
  );
}

interface RoleDialogProps {
  role: Role | null;
  permissions: Permission[];
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function RoleDialog({ role, permissions, readOnly, onClose, onSaved }: RoleDialogProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [code, setCode] = useState(role?.code ?? '');
  const [nameAr, setNameAr] = useState(role?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(role?.nameEn ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byGroup = new Map<string, Permission[]>();
    for (const p of permissions) {
      const key = i18n.language === 'ar' ? p.groupAr : p.groupEn;
      byGroup.set(key, [...(byGroup.get(key) ?? []), p]);
    }
    return [...byGroup.entries()];
  }, [permissions, i18n.language]);

  const toggle = (codes: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      codes.forEach((c) => (on ? next.add(c) : next.delete(c)));
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const input = { code, nameAr, nameEn, permissions: [...selected] };
      await (role ? accessApi.updateRole(role.id, input) : accessApi.createRole(input));
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle>{role ? localName(role, i18n.language) : t('roles.new')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        {readOnly && role?.kind !== 'Custom' && role && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t(role.kind === 'Administrator' ? 'roles.builtInAdmin' : 'roles.builtInReadOnly')}
          </Alert>
        )}
        <Stack spacing={2} sx={{ mb: 2 }}>
          {!role && (
            <TextField
              label={t('roles.code')}
              helperText={t('roles.codeHint')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              slotProps={{ htmlInput: { dir: 'ltr', maxLength: 50 } }}
            />
          )}
          <TextField label={t('roles.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required disabled={readOnly} slotProps={{ htmlInput: { dir: 'rtl', lang: 'ar' } }} />
          <TextField label={t('roles.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required disabled={readOnly} slotProps={{ htmlInput: { dir: 'ltr', lang: 'en' } }} />
        </Stack>
        <Typography variant="subtitle1" gutterBottom>
          {t('roles.permissions')}
        </Typography>
        {groups.map(([group, items]) => {
          const codes = items.map((p) => p.code);
          const count = codes.filter((c) => selected.has(c)).length;
          return (
            <Box key={group} sx={{ mb: 1.5 }}>
              <FormControlLabel
                label={<Typography sx={{ fontWeight: 600 }}>{group}</Typography>}
                control={
                  <Checkbox
                    checked={count === codes.length}
                    indeterminate={count > 0 && count < codes.length}
                    onChange={(e) => toggle(codes, e.target.checked)}
                    disabled={readOnly}
                  />
                }
              />
              <Stack sx={{ pl: 4 }}>
                {items.map((p) => (
                  <FormControlLabel
                    key={p.code}
                    label={localName(p, i18n.language)}
                    control={<Checkbox checked={selected.has(p.code)} onChange={(e) => toggle([p.code], e.target.checked)} disabled={readOnly} size="small" />}
                  />
                ))}
              </Stack>
            </Box>
          );
        })}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{readOnly ? t('common.close') : t('common.cancel')}</Button>
        {!readOnly && (
          <Button variant="contained" onClick={() => void save()} disabled={busy || !nameAr.trim() || !nameEn.trim() || (!role && !code.trim())}>
            {busy ? t('common.loading') : t('common.save')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
