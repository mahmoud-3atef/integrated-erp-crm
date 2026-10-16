import HistoryIcon from '@mui/icons-material/History';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HistoryEntry } from '../api/setup';
import { errorKey } from '../api/auth';
import { tokens } from '../app/theme';
import { ErrorMessage } from '../auth/AuthLayout';
import { Badge, EmptyState, type Tone } from './ui';

/** Technical fields that mean nothing to the reader. */
const hidden = new Set(['Id', 'TenantId', 'ListCode', 'IsSystem']);

const actionTone: Record<HistoryEntry['action'], Tone> = { Added: 'success', Modified: 'info', Deleted: 'danger' };

interface HistoryDialogProps {
  title: string;
  load: () => Promise<HistoryEntry[]>;
  /** Shows a stored value in words (e.g. a registration id as its code). */
  formatValue?: (field: string, value: unknown) => string | null;
  onClose: () => void;
}

/** Audit trail of one record: who changed what, and when (read from the audit log written with every save). */
export function HistoryDialog({ title, load, formatValue, onClose }: HistoryDialogProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load().then(setEntries).catch((failure: unknown) => setError(errorKey(failure)));
  }, [load]);

  const show = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const custom = formatValue?.(field, value);
    if (custom) {
      return custom;
    }
    if (typeof value === 'boolean') {
      return value ? t('common.yes') : t('common.no');
    }
    return String(value);
  };

  const fieldName = (field: string) => (i18n.exists(`fields.${field}`) ? t(`fields.${field}`) : field);
  const when = (value: string) =>
    new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={phone}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon sx={{ color: tokens.navy700 }} />
        {t('history.title')} — {title}
      </DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        {entries?.length === 0 && <EmptyState text={t('history.empty')} />}
        <Stack spacing={1.5}>
          {(entries ?? []).map((entry, index) => {
            const fields = Object.entries(entry.changes).filter(([field]) => !hidden.has(field));
            return (
              <Box key={index} sx={{ p: 1.75, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.border}` }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: fields.length ? 1 : 0 }}>
                  <Badge tone={actionTone[entry.action]}>{t(`history.${entry.action}`)}</Badge>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.navy800 }}>{entry.userName}</Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.gray500, marginInlineStart: 'auto' }} dir="ltr">
                    {when(entry.occurredAt)}
                  </Typography>
                </Stack>
                {fields.map(([field, change]) => (
                  <Box key={field} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' }, gap: { xs: 0, sm: 1 }, py: 0.5, fontSize: 13 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.gray600 }}>{fieldName(field)}</Typography>
                    <Typography sx={{ fontSize: 13, color: tokens.gray900 }}>
                      {entry.action === 'Modified' ? (
                        <>
                          <Box component="span" sx={{ color: tokens.gray500, textDecoration: 'line-through' }}>
                            {show(field, change.old)}
                          </Box>
                          {i18n.dir() === 'rtl' ? ' ← ' : ' → '}
                          <Box component="span" sx={{ fontWeight: 600 }}>
                            {show(field, change.new)}
                          </Box>
                        </>
                      ) : (
                        show(field, entry.action === 'Deleted' ? change.old : change.new)
                      )}
                    </Typography>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
