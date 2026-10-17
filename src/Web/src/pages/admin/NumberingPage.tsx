import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey, request } from '../../api/auth';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';

type Reset = 'Never' | 'Yearly' | 'Monthly';

interface Numbering {
  key: string;
  groupAr: string;
  groupEn: string;
  nameAr: string;
  nameEn: string;
  inUse: boolean;
  pattern: string;
  reset: Reset;
  startAt: number;
  defaultPattern: string;
  defaultReset: Reset;
  customized: boolean;
  nextValue: number;
  nextNumber: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

const base = '/api/v1/organization/numbering';
const tokensList = ['{YYYY}', '{YY}', '{MM}', '{N:4}', '{N:5}', '{N:6}'];

/** The number a pattern gives (as the server formats it), or null when the pattern is not usable. */
function preview(pattern: string, value: number, date = new Date()): string | null {
  if (!/\{N(:\d{1,2})?\}/.test(pattern)) return null;
  let bad = false;
  const text = pattern.replace(/\{([A-Z]+)(?::(\d{1,2}))?\}/g, (_, token: string, width?: string) => {
    switch (token) {
      case 'N':
        return String(value).padStart(Number(width ?? 0), '0');
      case 'YYYY':
        return String(date.getFullYear());
      case 'YY':
        return String(date.getFullYear() % 100).padStart(2, '0');
      case 'MM':
        return String(date.getMonth() + 1).padStart(2, '0');
      default:
        bad = true;
        return '';
    }
  });
  return bad ? null : text;
}

/** The company's numbering of its documents: each document type's pattern, when its counter starts again, and where it starts. */
export function NumberingPage() {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const ar = i18n.language === 'ar';
  const canManage = can('organization.settings.manage', true);
  const [rows, setRows] = useState<Numbering[] | null>(null);
  const [editing, setEditing] = useState<Numbering | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await request<Numbering[]>('GET', base));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = useMemo(() => {
    const map = new Map<string, Numbering[]>();
    for (const row of rows ?? []) {
      const key = ar ? row.groupAr : row.groupEn;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [rows, ar]);

  return (
    <Box>
      <PageHeader title={t('numbering.title')} subtitle={t('numbering.intro')} />
      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
        {t('numbering.how')}
      </Alert>
      <ErrorMessage messageKey={error} />
      {!rows && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}

      <Stack spacing={`${tokens.gap}px`}>
        {groups.map(([group, items]) => (
          <Box key={group} sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 1 }}>{group}</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('numbering.col.document')}</TableCell>
                    <TableCell>{t('numbering.col.pattern')}</TableCell>
                    <TableCell>{t('numbering.col.reset')}</TableCell>
                    <TableCell>{t('numbering.col.next')}</TableCell>
                    <TableCell>{t('numbering.col.updated')}</TableCell>
                    {canManage && <TableCell />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((n) => (
                    <TableRow key={n.key} hover>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.navy800 }}>{ar ? n.nameAr : n.nameEn}</Typography>
                        <Stack direction="row" sx={{ gap: 0.75, mt: 0.25 }}>
                          {!n.inUse && <Badge tone="neutral">{t('numbering.reserved')}</Badge>}
                          {n.customized && <Badge tone="primary">{t('numbering.customized')}</Badge>}
                        </Stack>
                      </TableCell>
                      <TableCell dir="ltr" sx={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13, textAlign: 'start', whiteSpace: 'nowrap' }}>
                        {n.pattern}
                      </TableCell>
                      <TableCell>{t(`numbering.resets.${n.reset}`)}</TableCell>
                      <TableCell>
                        <Box dir="ltr" sx={{ display: 'inline-block', whiteSpace: 'nowrap', px: 1.25, py: 0.4, borderRadius: '8px', bgcolor: tokens.navy50, color: tokens.navy800, fontWeight: 800, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13 }}>
                          {n.nextNumber}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: tokens.gray500 }}>
                        {n.updatedByName ? `${n.updatedByName} · ${new Date(n.updatedAt!).toLocaleDateString('en-GB')}` : t('numbering.default')}
                      </TableCell>
                      {canManage && (
                        <TableCell align="left" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title={t('common.edit')}>
                            <IconButton size="small" onClick={() => setEditing(n)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {n.customized && (
                            <Tooltip title={t('numbering.backToDefault', { pattern: n.defaultPattern })}>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  void request<void>('DELETE', `${base}/${n.key}`)
                                    .then(reload)
                                    .catch((failure: unknown) => setError(errorKey(failure)))
                                }
                              >
                                <RestartAltOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))}
      </Stack>

      {editing && (
        <NumberingDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </Box>
  );
}

function NumberingDialog({ row, onClose, onSaved }: { row: Numbering; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation();
  const [pattern, setPattern] = useState(row.pattern);
  const [reset, setReset] = useState<Reset>(row.reset);
  const [startAt, setStartAt] = useState(String(row.startAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = Math.max(1, Number(startAt) || 1);
  const next = reset === row.reset ? Math.max(row.nextValue, start) : start;
  const shown = preview(pattern, next);
  const year = pattern.includes('{YYYY}') || pattern.includes('{YY}');
  const problem = !shown
    ? 'numbering.problems.pattern'
    : reset === 'Yearly' && !year
      ? 'numbering.problems.year'
      : reset === 'Monthly' && (!year || !pattern.includes('{MM}'))
        ? 'numbering.problems.month'
        : null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await request<void>('PUT', `${base}/${row.key}`, { pattern: pattern.trim(), reset, startAt: start });
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('numbering.edit', { name: i18n.language === 'ar' ? row.nameAr : row.nameEn })}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2}>
          <Box>
            <TextField
              fullWidth
              label={t('numbering.col.pattern')}
              value={pattern}
              onChange={(e) => setPattern(e.target.value.toUpperCase())}
              slotProps={{ htmlInput: { dir: 'ltr', maxLength: 40, style: { fontFamily: 'ui-monospace, Consolas, monospace' } } }}
              helperText={t('numbering.patternHint')}
            />
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
              {tokensList.map((token) => (
                <Chip key={token} size="small" label={token} onClick={() => setPattern((p) => p + token)} sx={{ fontFamily: 'ui-monospace, Consolas, monospace', direction: 'ltr' }} />
              ))}
            </Stack>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select sx={{ flex: 1 }} label={t('numbering.col.reset')} value={reset} onChange={(e) => setReset(e.target.value as Reset)}>
              {(['Never', 'Yearly', 'Monthly'] as const).map((r) => (
                <MenuItem key={r} value={r}>
                  {t(`numbering.resets.${r}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              sx={{ flex: 1 }}
              label={t('numbering.startAt')}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value.replace(/\D/g, ''))}
              helperText={t('numbering.startHint')}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
            />
          </Stack>
          <Box sx={{ p: 2, borderRadius: `${tokens.radius}px`, bgcolor: problem ? '#fdeeee' : tokens.navy50, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray600, mb: 0.5 }}>{t('numbering.preview')}</Typography>
            <Typography dir="ltr" sx={{ fontSize: 24, fontWeight: 800, color: problem ? tokens.danger : tokens.navy800, fontFamily: 'ui-monospace, Consolas, monospace' }}>
              {shown ?? '—'}
            </Typography>
            {problem && <Typography sx={{ fontSize: 12.5, color: tokens.danger, mt: 0.5 }}>{t(problem)}</Typography>}
          </Box>
          {reset !== row.reset && <Alert severity="warning">{t('numbering.resetWarning')}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || !!problem} onClick={() => void save()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
