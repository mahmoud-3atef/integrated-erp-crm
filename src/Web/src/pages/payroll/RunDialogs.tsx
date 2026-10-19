import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accessApi, localName, type LegalEntity } from '../../api/access';
import { errorKey } from '../../api/auth';
import { payrollApi, type SponsorLink } from '../../api/payroll';
import { ErrorMessage } from '../../auth/AuthLayout';
import { hr } from '../../components/hr/Hr';

/** The company's active commercial registrations (the payroll is per registration). */
export function useLegalEntities() {
  const [list, setList] = useState<LegalEntity[]>([]);
  useEffect(() => {
    accessApi
      .legalEntities()
      .then((all) => setList(all.filter((e) => e.isActive)))
      .catch(() => setList([]));
  }, []);
  return list;
}

/** A new run: the registration and the period (the day after its last run, for a month, by default). */
export function NewRunDialog({ open, defaultEntity, onClose, onCreated, onLinkSponsors }: { open: boolean; defaultEntity?: string; onClose: () => void; onCreated: (id: string) => void; onLinkSponsors: () => void }) {
  const { t, i18n } = useTranslation();
  const entities = useLegalEntities();
  const [entity, setEntity] = useState(defaultEntity ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const first = entities[0];
    if (!entity && first) {
      setEntity(first.id);
    }
  }, [entities, entity]);

  useEffect(() => {
    if (!open || !entity) {
      return;
    }
    payrollApi
      .nextPeriod(entity)
      .then((p) => {
        setFrom(p.from);
        setTo(p.to);
      })
      .catch(() => undefined);
  }, [open, entity]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onCreated((await payrollApi.create({ legalEntityId: entity, from, to })).id);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: `${hr.radius}px` } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('payroll.create.title')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 1 }}>
          <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('payroll.create.hint')}</Typography>
          <ErrorMessage messageKey={error} />
          {error === 'errors.validation_payroll_no_sponsors' && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={onLinkSponsors}>
                  {t('payroll.sponsors')}
                </Button>
              }
            >
              {t('payroll.create.linkFirst')}
            </Alert>
          )}
          <TextField select label={t('payroll.create.legalEntity')} value={entity} onChange={(e) => setEntity(e.target.value)} required>
            {entities.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {localName(e, i18n.language)}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" sx={{ gap: 2 }}>
            <TextField type="date" label={t('payroll.create.from')} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
            <TextField type="date" label={t('payroll.create.to')} value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !entity || !from || !to}>
          {t('payroll.create.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Which of the old system's sponsors is which commercial registration (set once). */
export function SponsorsDialog({ open, onClose }: { open: boolean; onClose: (saved: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const entities = useLegalEntities();
  const [links, setLinks] = useState<SponsorLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      payrollApi.sponsors().then(setLinks).catch((failure) => setError(errorKey(failure)));
    }
  }, [open]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await payrollApi.linkSponsors(links.map((l) => ({ sponsor: l.sponsor, legalEntityId: l.legalEntityId })));
      onClose(true);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : () => onClose(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: `${hr.radius}px` } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('payroll.sponsorDialog.title')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: hr.textMuted, mb: 2 }}>{t('payroll.sponsorDialog.hint')}</Typography>
        <ErrorMessage messageKey={error} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('payroll.sponsorDialog.sponsor')}</TableCell>
              <TableCell>{t('payroll.sponsorDialog.legalEntity')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {links.map((l, i) => (
              <TableRow key={l.sponsor}>
                <TableCell>
                  <bdi dir="ltr" style={{ fontWeight: 600 }}>
                    {l.sponsor}
                  </bdi>
                </TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={l.legalEntityId ?? ''}
                    onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, legalEntityId: e.target.value || null } : x)))}
                    slotProps={{ htmlInput: { 'aria-label': `${t('payroll.sponsorDialog.legalEntity')} — ${l.sponsor}` } }}
                  >
                    <MenuItem value="">{t('payroll.sponsorDialog.none')}</MenuItem>
                    {entities.map((e) => (
                      <MenuItem key={e.id} value={e.id}>
                        {localName(e, i18n.language)}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onClose(false)} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
