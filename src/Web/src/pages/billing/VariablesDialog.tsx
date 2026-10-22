import AddTaskOutlinedIcon from '@mui/icons-material/AddTaskOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { billingApi, type AdjustmentType, type SheetTotals, type TimesheetDetail, type VariablesPreview, type WorkerTotals } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { sar } from '../operations/delivery';

/** The variables a worker's month can carry, in the groups the window shows (what each one changes). */
const groups: { key: string; types: AdjustmentType[] }[] = [
  { key: 'days', types: ['Absence', 'FeeDays'] },
  { key: 'overtime', types: ['Overtime', 'OvertimeAmount'] },
  { key: 'customer', types: ['ClientAddition', 'ClientDeduction', 'CustomerLoan'] },
  { key: 'company', types: ['InternalAddition', 'InternalDeduction'] },
  { key: 'invoice', types: ['OtherCost', 'OtherDeduction'] },
];

type Totals = Partial<Record<AdjustmentType, number>>;

/** A worker's changed variables waiting to be saved, with the reason. */
interface Staged {
  workerId: string;
  totals: Totals;
  reason: string;
}

const toBody = (staged: Staged[]) =>
  staged.flatMap((s) => Object.entries(s.totals).map(([type, total]) => ({ workerId: s.workerId, type, total: total ?? 0, reason: s.reason })));

/**
 * «إضافة متغيرات»: the timesheet's invoice and salaries on top, recalculated with every variable entered; a search for
 * a worker opens all their variables; «إضافة المتغيرات» keeps them in the list below and the search goes on to the
 * next worker; «حفظ في التحضير» saves them all at once. Every figure comes from the server's own timesheet formulas.
 */
export function VariablesDialog({ sheet, onClose, onSaved }: { sheet: TimesheetDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const workers = useMemo(() => {
    const seen = new Map<string, { workerId: string; workerNo: string; name: string; iqamaNo: string | null; workDays: number }>();
    for (const l of sheet.lines) {
      const w = seen.get(l.workerId);
      if (w) w.workDays += l.workDays;
      else seen.set(l.workerId, { workerId: l.workerId, workerNo: l.workerNo, name: l.name, iqamaNo: l.iqamaNo, workDays: l.workDays });
    }
    return [...seen.values()];
  }, [sheet.lines]);
  // The worker's saved totals of each variable.
  const saved = (workerId: string): Totals => {
    const totals: Totals = {};
    for (const a of sheet.adjustments.filter((x) => x.workerId === workerId)) totals[a.type] = (totals[a.type] ?? 0) + a.value;
    return totals;
  };

  const [staged, setStaged] = useState<Staged[]>([]);
  const [worker, setWorker] = useState<(typeof workers)[number] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<VariablesPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (w: (typeof workers)[number] | null) => {
    setWorker(w);
    setProblem(null);
    if (!w) return;
    const kept = staged.find((s) => s.workerId === w.workerId);
    const base = { ...saved(w.workerId), ...(kept?.totals ?? {}) };
    setDraft(Object.fromEntries(groups.flatMap((g) => g.types).map((type) => [type, base[type] ? String(base[type]) : ''])));
    setReason(kept?.reason ?? '');
  };

  // The draft worker's changed totals (against what is saved).
  const changes = useMemo<Totals>(() => {
    if (!worker) return {};
    const old = saved(worker.workerId);
    const out: Totals = {};
    for (const [type, text] of Object.entries(draft)) {
      const value = text === '' || text === '-' ? 0 : Number(text);
      if (!Number.isNaN(value) && value !== (old[type as AdjustmentType] ?? 0)) out[type as AdjustmentType] = value;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, worker]);

  // Everything waiting plus the worker being entered, previewed on the server (debounced).
  const body = useMemo(() => {
    const others = staged.filter((s) => s.workerId !== worker?.workerId);
    return toBody(worker && Object.keys(changes).length ? [...others, { workerId: worker.workerId, totals: changes, reason: '' }] : others);
  }, [staged, worker, changes]);
  useEffect(() => {
    const handle = setTimeout(() => {
      billingApi
        .previewVariables(sheet.id, body)
        .then((p) => (setPreview(p), setProblem(null)))
        .catch((e) => setProblem(errorKey(e)));
    }, 300);
    return () => clearTimeout(handle);
  }, [sheet.id, body]);

  const workerPreview = worker ? preview?.workers.find((x) => x.workerId === worker.workerId) : undefined;
  const add = () => {
    if (!worker) return;
    setStaged((list) => [...list.filter((s) => s.workerId !== worker.workerId), ...(Object.keys(changes).length ? [{ workerId: worker.workerId, totals: changes, reason: reason.trim() }] : [])]);
    setWorker(null);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await billingApi.saveVariables(sheet.id, toBody(staged));
      onSaved();
    } catch (e) {
      setError(errorKey(e));
      setBusy(false);
    }
  };

  const nameOf = (id: string) => workers.find((w) => w.workerId === id);
  const canAdd = !!worker && Object.keys(changes).length > 0 && reason.trim().length > 0 && !problem;

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="lg" aria-labelledby="variables-title">
      <DialogTitle id="variables-title" sx={{ fontWeight: 800, color: tokens.navy800 }}>
        {t('timesheets.variables.title')} · <bdi>{sheet.timesheetNo}</bdi>
      </DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Summary before={preview?.before} after={preview?.after} />

        <Autocomplete
          sx={{ my: 2 }}
          options={workers}
          value={worker}
          onChange={(_, w) => open(w)}
          getOptionLabel={(w) => `${w.workerNo} · ${w.name}${w.iqamaNo ? ` · ${w.iqamaNo}` : ''}`}
          isOptionEqualToValue={(a, b) => a.workerId === b.workerId}
          renderInput={(params) => <TextField {...params} label={t('timesheets.variables.search')} placeholder={t('timesheets.variables.searchHint')} />}
        />

        {worker && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1.3fr) minmax(0,1fr)' }, border: `1px solid ${tokens.gray200}`, borderRadius: '14px', p: 2, mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, color: tokens.navy800, mb: 1 }}>
                <bdi>{worker.name}</bdi> · <bdi>{worker.workerNo}</bdi> · {t('timesheets.variables.workDays', { days: worker.workDays })}
              </Typography>
              {groups.map((g) => (
                <Box key={g.key} sx={{ border: `1px solid ${tokens.gray200}`, borderRadius: '10px', p: 1.25, mb: 1 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography sx={{ fontWeight: 700, color: tokens.navy800, fontSize: 13 }}>{t(`timesheets.variables.groups.${g.key}`)}</Typography>
                    <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>{t(`timesheets.variables.effects.${g.key}`)}</Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' } }}>
                    {g.types.map((type) => {
                      const changed = type in changes;
                      return (
                        <TextField
                          key={type}
                          size="small"
                          label={`${t(`timesheets.adjustments.${type}`)} (${t(`timesheets.units.${type}`)})`}
                          value={draft[type] ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, [type]: e.target.value.replace(type === 'FeeDays' ? /[^\d.-]/g : /[^\d.]/g, '') }))}
                          slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
                          sx={changed ? { '& .MuiOutlinedInput-root': { bgcolor: tokens.navy50, fontWeight: 700 } } : undefined}
                        />
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ bgcolor: tokens.gray50, borderRadius: '12px', p: 1.5 }}>
              <Typography sx={{ fontWeight: 800, color: tokens.navy800, mb: 1 }}>{t('timesheets.variables.result')}</Typography>
              {problem && <ErrorMessage messageKey={problem} />}
              <Compare label={t('timesheets.variables.net')} before={workerPreview?.before.net} after={workerPreview?.after.net} />
              <Compare label={t('timesheets.variables.invoice')} before={workerPreview?.before.invoice} after={workerPreview?.after.invoice} />
              <Compare label={t('timesheets.variables.invoiceTotal')} before={workerPreview?.before.invoiceTotal} after={workerPreview?.after.invoiceTotal} />
              {workerPreview && <Breakdown totals={workerPreview.after} />}
              <TextField
                fullWidth
                size="small"
                sx={{ mt: 1.5 }}
                label={t('timesheets.variables.reason')}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 300 } }}
              />
              <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
                <Button onClick={() => setWorker(null)}>{t('common.cancel')}</Button>
                <Button variant="contained" startIcon={<AddTaskOutlinedIcon />} disabled={!canAdd} onClick={add}>
                  {t('timesheets.variables.add')}
                </Button>
              </Stack>
            </Box>
          </Box>
        )}

        <Typography sx={{ fontWeight: 800, color: tokens.navy800, mb: 1 }}>{t('timesheets.variables.list', { count: staged.length })}</Typography>
        {staged.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: '12px' }}>
            {t('timesheets.variables.empty')}
          </Alert>
        ) : (
          <Stack sx={{ gap: 1 }}>
            {staged.map((s) => {
              const w = nameOf(s.workerId);
              const p = preview?.workers.find((x) => x.workerId === s.workerId);
              return (
                <Stack key={s.workerId} direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, p: 1.25, borderRadius: '12px', border: `1px solid ${tokens.gray200}` }}>
                  <Box sx={{ minWidth: 200 }}>
                    <Typography sx={{ fontWeight: 700, color: tokens.navy800 }}>
                      <bdi>{w?.name}</bdi>
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>
                      <bdi>{w?.workerNo}</bdi> · {s.reason}
                    </Typography>
                  </Box>
                  <Typography sx={{ flex: 1, fontSize: 12.5, color: tokens.gray600 }}>
                    {Object.entries(s.totals)
                      .map(([type, v]) => `${t(`timesheets.adjustments.${type}`)}: ${sar(v ?? 0)}`)
                      .join(' · ')}
                  </Typography>
                  <Delta label={t('timesheets.variables.net')} value={p ? p.after.net - p.before.net : null} />
                  <Delta label={t('timesheets.variables.invoice')} value={p ? p.after.invoice - p.before.invoice : null} />
                  <Stack direction="row">
                    <IconButton size="small" aria-label={t('common.edit')} onClick={() => open(w ?? null)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label={t('timesheets.variables.remove')} onClick={() => setStaged((list) => list.filter((x) => x.workerId !== s.workerId))}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" disabled={busy || staged.length === 0 || !!problem} onClick={() => void save()}>
          {busy ? t('timesheets.variables.saving') : t('timesheets.variables.save', { count: staged.length })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The timesheet's invoice and salaries, as saved and with the variables entered. */
function Summary({ before, after }: { before?: SheetTotals; after?: SheetTotals }) {
  const { t } = useTranslation();
  const items: [string, keyof SheetTotals][] = [
    ['invoice', 'invoice'],
    ['vat', 'vat'],
    ['invoiceTotal', 'invoiceTotal'],
    ['dueSalary', 'dueSalary'],
    ['net', 'net'],
  ];
  return (
    <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(5, minmax(0,1fr))' } }}>
      {items.map(([label, key]) => {
        const diff = before && after ? after[key] - before[key] : 0;
        return (
          <Box key={key} sx={{ p: 1.25, borderRadius: '12px', bgcolor: tokens.navy50 }}>
            <Typography sx={{ fontSize: 12, color: tokens.gray600 }}>{t(`timesheets.variables.sheet.${label}`)}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: tokens.navy800, fontVariantNumeric: 'tabular-nums' }}>{after ? sar(after[key]) : '—'}</Typography>
            {Math.abs(diff) >= 0.005 && (
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: diff < 0 ? tokens.danger : tokens.success }}>
                <bdi>{`${diff > 0 ? '+' : '−'}${sar(Math.abs(diff))}`}</bdi>
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function Compare({ label, before, after }: { label: string; before?: number; after?: number }) {
  const changed = before !== undefined && after !== undefined && Math.abs(after - before) >= 0.005;
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', py: 0.5 }}>
      <Typography sx={{ fontSize: 13 }}>{label}</Typography>
      <Typography component="div" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {changed && (
          <Box component="s" sx={{ color: tokens.gray500, fontSize: 12.5, marginInlineEnd: 1 }}>
            {sar(before)}
          </Box>
        )}
        <Box component="b" sx={{ fontSize: 16, color: tokens.navy800 }}>
          {after === undefined ? '—' : sar(after)}
        </Box>
      </Typography>
    </Stack>
  );
}

function Breakdown({ totals }: { totals: WorkerTotals }) {
  const { t } = useTranslation();
  const rows: [string, number][] = [
    ['dueSalary', totals.dueSalary],
    ['absence', -totals.absence],
    ['overtime', totals.overtime],
    ['fees', totals.fees],
    ['gosi', totals.gosi],
  ];
  return (
    <Box sx={{ mt: 1 }}>
      {rows
        .filter(([, v]) => v !== 0)
        .map(([key, v]) => (
          <Stack key={key} direction="row" sx={{ justifyContent: 'space-between', fontSize: 12, py: 0.4, borderBottom: `1px dashed ${tokens.gray200}` }}>
            <span>{t(`timesheets.variables.parts.${key}`)}</span>
            <bdi>{sar(v)}</bdi>
          </Stack>
        ))}
    </Box>
  );
}

function Delta({ label, value }: { label: string; value: number | null }) {
  return (
    <Box sx={{ minWidth: 110, textAlign: 'end' }}>
      <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: value === null || Math.abs(value) < 0.005 ? tokens.gray600 : value < 0 ? tokens.danger : tokens.success }}>
        <bdi>{value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${sar(Math.abs(value))}`}</bdi>
      </Typography>
    </Box>
  );
}
