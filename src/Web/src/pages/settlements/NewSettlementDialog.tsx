import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { endReasons, settlementsApi, type EndReason, type SettlementKind, type SettlementLeave, type SettlementParty, type SettlementWorker } from '../../api/settlements';
import { hr } from '../../components/hr/Hr';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { usePeople, type Person } from '../deductions/advances';
import { DateField } from '../../components/DateField';

/**
 * A new settlement. A vacation one is for an approved leave without one: the staff's leave request, or a sponsored
 * worker's vacation departure (4.11ب). An end-of-service one is for an employee or a sponsored worker, with the reason
 * and the last day (and a fixed-term contract's end, for article 77). The server calculates it.
 */
export function NewSettlementDialog({ onClose, onCreated, employee, party: initialParty = 'Staff' }: { onClose: () => void; onCreated: (id: string) => void; employee?: Person; party?: SettlementParty }) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { date } = useCommercialFormat();
  const [party, setParty] = useState<SettlementParty>(employee ? 'Staff' : initialParty);
  const [kind, setKind] = useState<SettlementKind>(employee ? 'EndOfService' : 'Vacation');
  const [leaves, setLeaves] = useState<SettlementLeave[] | null>(null);
  const [leavesOf, setLeavesOf] = useState<SettlementParty | null>(null);
  const [leave, setLeave] = useState<SettlementLeave | null>(null);
  const [search, setSearch] = useState('');
  const people = usePeople(search, party === 'Staff' && kind === 'EndOfService' && !employee);
  const [who, setWho] = useState<Person | null>(employee ?? null);
  const [workers, setWorkers] = useState<SettlementWorker[]>([]);
  const [worker, setWorker] = useState<SettlementWorker | null>(null);
  const [reason, setReason] = useState<EndReason>('ContractEnd');
  const [lastDay, setLastDay] = useState('');
  const [term, setTerm] = useState<'Indefinite' | 'Fixed'>('Indefinite');
  const [ends, setEnds] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== 'Vacation' || leavesOf === party) return;
    setLeavesOf(party);
    setLeaves(null);
    setLeave(null);
    (party === 'Worker' ? settlementsApi.workerLeaves() : settlementsApi.leaves()).then(setLeaves).catch((f: unknown) => setError(errorKey(f)));
  }, [party, kind, leavesOf]);
  useEffect(() => {
    if (party !== 'Worker' || search.trim().length < 2) return;
    const timer = setTimeout(() => settlementsApi.workers(search).then(setWorkers).catch(() => setWorkers([])), 250);
    return () => clearTimeout(timer);
  }, [party, search]);

  const endReady = Boolean(lastDay && (term === 'Indefinite' || ends));
  const ready = kind === 'Vacation' ? Boolean(leave) : Boolean(party === 'Worker' ? worker : who) && endReady;
  const create = async () => {
    setBusy(true);
    setError(null);
    const end = { reason, lastDay, term, contractEndsOn: term === 'Fixed' ? ends : null };
    try {
      const made =
        kind === 'Vacation'
          ? await settlementsApi.create({ kind, party, leaveRequestId: leave!.requestId })
          : await settlementsApi.create({ kind, party, employeeId: (party === 'Worker' ? worker : who)!.id, ...end });
      onCreated(made.id);
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  const dateField = (label: string, value: string, set: (v: string) => void) => (
    <DateField size="small" required label={label} value={value} onChange={(e) => set(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{t('settlements.new')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 0.5 }}>
          {!employee && (
            <>
              <ToggleButtonGroup exclusive fullWidth size="small" value={party} onChange={(_, v: SettlementParty | null) => v && setParty(v)} aria-label={t('settlements.create.party')}>
                <ToggleButton value="Staff">{t('settlements.party.Staff')}</ToggleButton>
                <ToggleButton value="Worker">{t('settlements.party.Worker')}</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup exclusive fullWidth size="small" value={kind} onChange={(_, v: SettlementKind | null) => v && setKind(v)} aria-label={t('settlements.col.kind')}>
                <ToggleButton value="Vacation">{t('settlements.kind.Vacation')}</ToggleButton>
                <ToggleButton value="EndOfService">{t('settlements.kind.EndOfService')}</ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
          {party === 'Worker' && kind === 'EndOfService' ? (
            <>
              <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t('settlements.create.workerHint')}</Typography>
              <Autocomplete
                size="small"
                options={workers}
                value={worker}
                onChange={(_, v) => setWorker(v)}
                onInputChange={(_, v) => setSearch(v)}
                getOptionLabel={(o) => `${o.name} · ${o.workerNo}`}
                isOptionEqualToValue={(x, y) => x.id === y.id}
                filterOptions={(x) => x}
                noOptionsText={t('settlements.create.noWorkers')}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o.id}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        <bdi>{o.name}</bdi> · <bdi>{o.workerNo}</bdi>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: hr.textMuted }}>
                        <bdi>{o.sponsor}</bdi>
                        {o.projectName && ` · ${o.projectName}`}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} required label={t('settlements.create.worker')} />}
              />
            </>
          ) : kind === 'Vacation' ? (
            <>
              <Typography sx={{ fontSize: 12.5, color: hr.textMuted }}>{t(party === 'Worker' ? 'settlements.create.workerVacationHint' : 'settlements.create.vacationHint')}</Typography>
              <Autocomplete
                size="small"
                loading={leaves === null}
                options={leaves ?? []}
                value={leave}
                onChange={(_, v) => setLeave(v)}
                getOptionLabel={(o) => `${o.name} · ${o.requestNo}`}
                isOptionEqualToValue={(x, y) => x.requestId === y.requestId}
                noOptionsText={t(party === 'Worker' ? 'settlements.create.noWorkerLeaves' : 'settlements.create.noLeaves')}
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
                renderInput={(params) => <TextField {...params} required label={t(party === 'Worker' ? 'settlements.create.workerLeave' : 'settlements.create.leave')} />}
              />
            </>
          ) : (
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
          )}
          {kind === 'EndOfService' && (
            <>
              <TextField select size="small" required label={t('settlements.col.reason')} value={reason} onChange={(e) => setReason(e.target.value as EndReason)}>
                {endReasons.map((r) => (
                  <MenuItem key={r} value={r}>
                    {t(`settlements.reason.${r}`)}
                  </MenuItem>
                ))}
              </TextField>
              <Typography sx={{ fontSize: 12, color: hr.textMuted, mt: -1 }}>{t(`settlements.reasonHint.${reason}`)}</Typography>
              {dateField(t('settlements.create.lastDay'), lastDay, setLastDay)}
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
                <TextField select size="small" label={t('settlements.create.term')} value={term} onChange={(e) => setTerm(e.target.value as 'Indefinite' | 'Fixed')} sx={{ flex: 1 }}>
                  <MenuItem value="Indefinite">{t('settlements.term.Indefinite')}</MenuItem>
                  <MenuItem value="Fixed">{t('settlements.term.Fixed')}</MenuItem>
                </TextField>
                {term === 'Fixed' && dateField(t('settlements.create.contractEnds'), ends, setEnds)}
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
