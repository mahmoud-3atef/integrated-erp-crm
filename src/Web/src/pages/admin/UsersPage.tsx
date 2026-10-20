import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Box,
  Button,
  Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
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
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { staffApi } from '../../api/staff';
import { accessApi, localName, type Assignment, type LegalEntity, type Member, type Role } from '../../api/access';
import { errorKey } from '../../api/auth';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, EmptyState, Initials, PageHeader, Panel, StatusDot } from '../../components/ui';

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
    <Box>
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.intro')}
        actions={
          canManage && (
            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setAdding(true)}>
              {t('users.add')}
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
                <TableCell>{t('users.name')}</TableCell>
                <TableCell>{t('users.roles')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.membershipId} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                      <Initials name={member.displayName} size={30} />
                      <Box>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 500, color: tokens.gray900 }}>{member.displayName}</Typography>
                        {member.userName && (
                          <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                            {member.userName}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'normal' }}>
                    {member.roles.length === 0 ? (
                      <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('users.noRoles')}</Typography>
                    ) : (
                      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                        {member.roles.map((a) => (
                          <Badge key={`${a.roleId}-${a.legalEntityId ?? allEntities}`} tone="primary">
                            {entityCode(a.legalEntityId) ? `${roleName(a.roleId)} · ${entityCode(a.legalEntityId)}` : roleName(a.roleId)}
                          </Badge>
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusDot tone={member.isActive ? 'success' : 'warning'} label={member.isActive ? t('common.active') : t('common.inactive')} />
                  </TableCell>
                  {canManage && (
                    <TableCell align="center">
                      <Tooltip title={t('common.edit')}>
                        <IconButton size="small" onClick={() => setEditing(member)} aria-label={`${t('common.edit')} ${member.displayName}`}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {members.length === 0 && <EmptyState text={t('common.empty')} />}
      </Panel>
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
    </Box>
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
  const { can } = useSession();
  const canLink = can('staff.manage', true);
  const [employee, setEmployee] = useState<{ id: string; nameAr: string; nameEn: string } | null>(null);
  const [linked, setLinked] = useState<string | null>(null);
  const [people, setPeople] = useState<{ id: string; nameAr: string; nameEn: string }[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!can('staff.view', true)) return;
    staffApi
      .userLinks()
      .then((links) => {
        const mine = links.find((l) => l.userId === member.userAccountId);
        setEmployee(mine ? { id: mine.employeeId, nameAr: mine.nameAr, nameEn: mine.nameEn } : null);
        setLinked(mine?.employeeId ?? null);
      })
      .catch(() => undefined);
  }, [member.userAccountId, can]);
  useEffect(() => {
    if (!canLink) return;
    const timer = setTimeout(() => staffApi.pick(search).then(setPeople).catch(() => setPeople([])), 250);
    return () => clearTimeout(timer);
  }, [search, canLink]);
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
      if (canLink && (employee?.id ?? null) !== linked) {
        await staffApi.linkUser(member.userAccountId, employee?.id ?? null);
      }
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
        {can('staff.view', true) && (
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="subtitle1">{t('users.employee')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('users.employeeIntro')}
            </Typography>
            <Autocomplete
              size="small"
              disabled={!canLink}
              options={people}
              value={employee}
              onChange={(_, v) => setEmployee(v)}
              onInputChange={(_, v) => setSearch(v)}
              getOptionLabel={(o) => (i18n.language === 'ar' ? o.nameAr : o.nameEn)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(x) => x}
              renderInput={(params) => <TextField {...params} label={t('users.employeePick')} />}
            />
          </Box>
        )}
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
