import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { endReasons, settlementsApi, type EndReason, type SettlementKind, type SettlementLeave } from '../../api/settlements';
import { hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { usePeople, type Person } from '../deductions/advances';

/**
 * A new settlement: a vacation one for an approved annual leave without one, or an end-of-service one for an employee
 * with the reason and the last day (and a fixed-term contract's end, for article 77). The server calculates it.
 */
export function NewSettlementDialog({ onClose, onCreated, employee }: { onClose: () => void; onCreated: (id: string) => void; employee?: Person }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const [kind, setKind] = useState<SettlementKind>(employee ? 'EndOfService' : 'Vacation');
  const [leaves, setLeaves] = useState<SettlementLeave[] | null>(null);
  const [leave, setLeave] = useState<SettlementLeave | null>(null);
  const [search, setSearch] = useState('');
  const people = usePeople(search, kind === 'EndOfService' && !employee);
  const [who, setWho] = useState<Person | null>(employee ?? null);
  const [reason, setReason] = useState<EndReason>('ContractEnd');
  const [lastDay, setLastDay] = useState('');
  const [term, setTerm] = useState<'Indefinite' | 'Fixed'>('Indefinite');
  const [ends, setEnds] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === 'Vacation' && leaves === null) settlementsApi.leaves().then(setLeaves).catch((f: unknown) => setError(errorKey(f)));
  }, [kind, leaves]);

  const ready = kind === 'Vacation' ? Boolean(leave) : Boolean(who && lastDay && (term === 'Indefinite' || ends));
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const made =
        kind === 'Vacation'
          ? await settlementsApi.create({ kind, leaveRequestId: leave!.requestId })
          : await settlementsApi.create({ kind, employeeId: who!.id, reason, lastDay, term, contractEndsOn: term === 'Fixed' ? ends : null });
      onCreated(made.id);
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{t('settlements.new')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 0.5 }}>
          {!employee && (
            <ToggleButtonGroup exclusive fullWidth size="small" value={kind} onChange={(_, v: SettlementKind | null) => v && setKind(v)}>
              <ToggleButton value="Vacation">{t('settlements.kind.Vacation')}</ToggleButton>
              <ToggleButton value="EndOfService">{t('settlements.kind.EndOfService')}</ToggleButton>
            </ToggleButtonGroup>
          )}
          {kind === 'Vacation' ? (
            <>
              <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('settlements.create.vacationHint')}</Typography>
              <Autocomplete
                size="small"
                loading={leaves === null}
                options={leaves ?? []}
                value={leave}
                onChange={(_, v) => setLeave(v)}
                getOptionLabel={(o) => `${o.name} · ${o.requestNo}`}
                isOptionEqualToValue={(x, y) => x.requestId === y.requestId}
                noOptionsText={t('settlements.create.noLeaves')}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o.requestId}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {o.name} · <bdi>{o.employeeNo}</bdi>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: hr.textMuted }}>
                        <bdi>{o.requestNo}</bdi> · {date(o.from)} – {date(o.to)} · {t('settlements.daysN', { count: o.days })}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} required label={t('settlements.create.leave')} />}
              />
            </>
          ) : (
            <>
              <Autocomplete
                size="small"
                disabled={Boolean(employee)}
                options={people}
                value={who}
                onChange={(_, v) => setWho(v)}
                onInputChange={(_, v) => setSearch(v)}
                getOptionLabel={(o) => (ar ? o.nameAr : o.nameEn)}
                isOptionEqualToValue={(x, y) => x.id === y.id}
                filterOptions={(x) => x}
                renderInput={(params) => <TextField {...params} required label={t('settlements.create.employee')} />}
              />
              <TextField select size="small" required label={t('settlements.col.reason')} value={reason} onChange={(e) => setReason(e.target.value as EndReason)}>
                {endReasons.map((r) => (
                  <MenuItem key={r} value={r}>
                    {t(`settlements.reason.${r}`)}
                  </MenuItem>
                ))}
              </TextField>
              <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: -1 }}>{t(`settlements.reasonHint.${reason}`)}</Typography>
              <TextField size="small" type="date" required label={t('settlements.create.lastDay')} value={lastDay} onChange={(e) => setLastDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
                <TextField select size="small" label={t('settlements.create.term')} value={term} onChange={(e) => setTerm(e.target.value as 'Indefinite' | 'Fixed')} sx={{ flex: 1 }}>
                  <MenuItem value="Indefinite">{t('settlements.term.Indefinite')}</MenuItem>
                  <MenuItem value="Fixed">{t('settlements.term.Fixed')}</MenuItem>
                </TextField>
                {term === 'Fixed' && (
                  <TextField size="small" type="date" required label={t('settlements.create.contractEnds')} value={ends} onChange={(e) => setEnds(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
                )}
              </Stack>
            </>
          )}
          {error && <Alert severity="error">{t(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={!ready || busy} onClick={() => void create()}>
          {t('settlements.create.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
