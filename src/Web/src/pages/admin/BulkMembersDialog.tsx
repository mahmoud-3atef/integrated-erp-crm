import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accessApi, localName, type BulkMember, type Role } from '../../api/access';
import { errorKey } from '../../api/auth';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';

const tone = { new: 'info', member: 'neutral', not_found: 'danger', added: 'success', failed: 'danger' } as const;

/**
 * «إضافة مجموعة مستخدمين» (the user's request, 2026-10-23: the old system's users): the names from an Excel list or
 * typed one per line, then a preview — who is in the directory, who is already a member — where any can be left out,
 * then adding the chosen ones at once, each with the chosen role (read only by default) for all registrations.
 */
export function BulkMembersDialog({ roles, onClose, onDone }: { roles: Role[]; onClose: () => void; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [roleId, setRoleId] = useState(() => roles.find((r) => r.kind === 'ReadOnly')?.id ?? '');
  const [preview, setPreview] = useState<BulkMember[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkMember[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = () => text.split(/[\r\n,;]+/).map((n) => n.trim()).filter(Boolean);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  };

  const readFile = (file: File | undefined) =>
    file &&
    act(async () => {
      setText((await accessApi.readUserNames(file)).join('\n'));
      setPreview(null);
    });

  const check = () =>
    act(async () => {
      const rows = await accessApi.bulkPreview(names(), roleId || null);
      setPreview(rows);
      setChosen(new Set(rows.filter((r) => r.outcome !== 'not_found').map((r) => r.userName)));
    });

  const add = () =>
    act(async () => {
      setResult(await accessApi.bulkAdd([...chosen], roleId || null));
      onDone();
    });

  const rows = result ?? preview;
  const toggle = (name: string) =>
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md" aria-labelledby="bulk-title">
      <DialogTitle id="bulk-title">{t('users.bulk.title')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        {!rows && (
          <Stack sx={{ gap: 1.5 }}>
            <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>{t('users.bulk.intro')}</Typography>
            <input ref={input} type="file" accept=".xlsx" hidden onChange={(e) => void readFile(e.target.files?.[0])} />
            <Box>
              <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={busy} onClick={() => (input.current && ((input.current.value = ''), input.current.click()))}>
                {t('users.bulk.file')}
              </Button>
            </Box>
            <TextField label={t('users.bulk.names')} value={text} onChange={(e) => setText(e.target.value)} multiline minRows={6} maxRows={12} helperText={t('users.bulk.namesHint', { count: names().length })} slotProps={{ htmlInput: { dir: 'ltr' } }} />
            <TextField select label={t('users.bulk.role')} value={roleId} onChange={(e) => setRoleId(e.target.value)} helperText={t('users.bulk.roleHint')}>
              <MenuItem value="">{t('users.bulk.noRole')}</MenuItem>
              {roles
                .filter((r) => r.isActive)
                .map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {localName(r, i18n.language)}
                  </MenuItem>
                ))}
            </TextField>
          </Stack>
        )}
        {busy && <LinearProgress sx={{ my: 1.5, borderRadius: 2 }} />}
        {rows && (
          <>
            <Alert severity={result ? 'success' : 'info'} sx={{ mb: 1.5 }}>
              {result
                ? t('users.bulk.done', { added: result.filter((r) => r.outcome === 'added').length, member: result.filter((r) => r.outcome === 'member').length, failed: result.filter((r) => r.outcome === 'not_found' || r.outcome === 'failed').length })
                : t('users.bulk.previewHint', { count: chosen.size, role: localName(roles.find((r) => r.id === roleId) ?? { nameAr: t('users.bulk.noRole'), nameEn: t('users.bulk.noRole') }, i18n.language) })}
            </Alert>
            <TableContainer sx={{ maxHeight: 420, border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {!result && <TableCell padding="checkbox" />}
                    <TableCell>{t('users.bulk.userName')}</TableCell>
                    <TableCell>{t('users.bulk.name')}</TableCell>
                    <TableCell>{t('users.bulk.email')}</TableCell>
                    <TableCell>{t('users.bulk.outcome')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.userName} hover>
                      {!result && (
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={chosen.has(r.userName)} disabled={r.outcome === 'not_found'} onChange={() => toggle(r.userName)} slotProps={{ input: { 'aria-label': r.userName } }} />
                        </TableCell>
                      )}
                      <TableCell>
                        <bdi>{r.userName}</bdi>
                      </TableCell>
                      <TableCell>{r.displayName ?? '—'}</TableCell>
                      <TableCell>
                        <bdi>{r.email ?? '—'}</bdi>
                      </TableCell>
                      <TableCell>
                        <Badge tone={tone[r.outcome]}>{t(`users.bulk.outcomes.${r.outcome}`)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {result ? t('common.close') : t('common.cancel')}
        </Button>
        {preview && !result && (
          <Button onClick={() => setPreview(null)} disabled={busy}>
            {t('users.bulk.back')}
          </Button>
        )}
        {!rows && (
          <Button variant="contained" disabled={busy || names().length === 0} onClick={() => void check()}>
            {t('users.bulk.check')}
          </Button>
        )}
        {preview && !result && (
          <Button variant="contained" disabled={busy || chosen.size === 0} onClick={() => void add()}>
            {t('users.bulk.add', { count: chosen.size })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
