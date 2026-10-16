import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { accessApi, localName, type Assignment, type LegalEntity, type Member, type Role } from '../../api/access';
import { errorKey } from '../../api/auth';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';

const allEntities = 'all';

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { can, reload: reloadSession } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [editing, setEditing] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = can('identity.users.manage', true);

  const load = useCallback(async () => {
    try {
      const [m, r, e] = await Promise.all([accessApi.members(), can('identity.roles.view', true) ? accessApi.roles() : Promise.resolve([]), accessApi.legalEntities()]);
      setMembers(m);
      setRoles(r);
      setEntities(e);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [can]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleName = (id: string) => {
    const role = roles.find((r) => r.id === id);
    return role ? localName(role, i18n.language) : '…';
  };
  const entityCode = (id: string | null) => (id ? (entities.find((e) => e.id === id)?.code ?? '…') : null);

  return (
    <Stack spacing={2} sx={{ maxWidth: 900 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5" component="h1">
            {t('users.title')}
          </Typography>
          <Typography color="text.secondary">{t('users.intro')}</Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setAdding(true)} sx={{ flexShrink: 0 }}>
            {t('users.add')}
          </Button>
        )}
      </Stack>
      <ErrorMessage messageKey={error} />
      <Paper variant="outlined">
        <List disablePadding>
          {members.map((member) => (
            <ListItemButton key={member.membershipId} divider onClick={() => setEditing(member)} disabled={!canManage}>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{member.displayName}</span>
                    {member.userName && (
                      <Typography component="span" variant="body2" color="text.secondary" dir="ltr">
                        {member.userName}
                      </Typography>
                    )}
                    {!member.isActive && <Chip size="small" color="warning" label={t('users.inactive')} />}
                  </Stack>
                }
                secondary={
                  member.roles.length === 0 ? (
                    t('users.noRoles')
                  ) : (
                    <Stack component="span" direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {member.roles.map((a) => (
                        <Chip
                          key={`${a.roleId}-${a.legalEntityId ?? allEntities}`}
                          component="span"
                          size="small"
                          variant="outlined"
                          label={entityCode(a.legalEntityId) ? `${roleName(a.roleId)} · ${entityCode(a.legalEntityId)}` : roleName(a.roleId)}
                        />
                      ))}
                    </Stack>
                  )
                }
                slotProps={{ secondary: { component: 'div' } }}
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      {adding && (
        <AddMemberDialog
          onClose={() => setAdding(false)}
          onAdded={(member) => {
            setAdding(false);
            void load();
            setEditing(member);
          }}
        />
      )}
      {editing && (
        <MemberDialog
          member={editing}
          roles={roles}
          entities={entities}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
            // My own roles may have changed: refresh the menu.
            void reloadSession();
          }}
        />
      )}
    </Stack>
  );
}

function AddMemberDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (member: Member) => void }) {
  const { t } = useTranslation();
  const [userName, setUserName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAdded(await accessApi.addMember(userName.trim()));
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{t('users.add')}</DialogTitle>
        <DialogContent>
          <ErrorMessage messageKey={error} />
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t('users.addIntro')}
          </Typography>
          <TextField
            label={t('login.userName')}
            helperText={t('login.userNameHint')}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            autoFocus
            fullWidth
            required
            slotProps={{ htmlInput: { dir: 'ltr', autoComplete: 'off' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={busy || !userName.trim()}>
            {busy ? t('common.loading') : t('users.addSubmit')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

interface MemberDialogProps {
  member: Member;
  roles: Role[];
  entities: LegalEntity[];
  onClose: () => void;
  onSaved: () => void;
}

function MemberDialog({ member, roles, entities, onClose, onSaved }: MemberDialogProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [rows, setRows] = useState<Assignment[]>(member.roles);
  const [active, setActive] = useState(member.isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, change: Partial<Assignment>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (active !== member.isActive) {
        await accessApi.setActive(member.membershipId, active);
      }
      await accessApi.setRoles(member.membershipId, rows.filter((r) => r.roleId));
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle>{member.displayName}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label={t('users.active')} sx={{ mb: 2 }} />
        <Typography variant="subtitle1">{t('users.roles')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('users.rolesIntro')}
        </Typography>
        <Stack spacing={1.5}>
          {rows.map((row, index) => (
            <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
              <TextField select label={t('users.role')} value={row.roleId} onChange={(e) => update(index, { roleId: e.target.value })} sx={{ flex: 1 }} size="small">
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {localName(r, i18n.language)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('users.scope')}
                value={row.legalEntityId ?? allEntities}
                onChange={(e) => update(index, { legalEntityId: e.target.value === allEntities ? null : e.target.value })}
                sx={{ flex: 1 }}
                size="small"
              >
                <MenuItem value={allEntities}>{t('users.allEntities')}</MenuItem>
                {entities.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {`${e.code} — ${localName(e, i18n.language)}`}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton aria-label={t('users.removeRole')} onClick={() => setRows((current) => current.filter((_, i) => i !== index))} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
        <Button startIcon={<AddIcon />} onClick={() => setRows((current) => [...current, { roleId: roles[0]?.id ?? '', legalEntityId: null }])} sx={{ mt: 1.5 }} disabled={roles.length === 0}>
          {t('users.addRole')}
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          {busy ? t('common.loading') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
