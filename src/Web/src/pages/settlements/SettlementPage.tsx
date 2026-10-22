import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
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
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { endReasons, settlementsApi, type EndReason, type SettlementDetail, type SettlementLine } from '../../api/settlements';
import { useCrumb } from '../../app/breadcrumbs';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrScope, hr } from '../../components/hr/Hr';
import { GlassChip, GlassFact, GlassHero, GlassKpi, GlassRow, glassButton, glassPanel } from '../../components/glass';
import { ApprovalBar, useRecordApproval } from '../../components/workflow/RecordApproval';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { Money, sar, useYears } from './settlementParts';
import { DateField } from '../../components/DateField';

/**
 * One settlement (docs/03-migration-plan/18), with the details' glass tint: the strip with its KPIs and facts, the
 * approval bar, the dues and the deductions (each line with the article or the record it comes from), the net, and for
 * an end of service the award's breakdown. Every figure is the server's; the entries change only before it is sent.
 */
export function SettlementPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const { date } = useCommercialFormat();
  const years = useYears();
  const [d, setD] = useState<SettlementDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'edit' | 'pay' | 'cancel'>(null);
  const [busy, setBusy] = useState(false);
  const approval = useRecordApproval(d?.approval?.instanceId);
  useCrumb(d?.settlementNo, `/hr/settlements/${id}`);

  const reload = useCallback(async () => {
    try {
      setD(await settlementsApi.get(id));
      setError(null);
    } catch (f) {
      setError(errorKey(f));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!d) {
    return (
      <HrScope>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </HrScope>
    );
  }

  const end = d.kind === 'EndOfService';
  const worker = d.party === 'Worker';
  const adds = d.lines.filter((l) => l.side === 'Addition');
  const deds = d.lines.filter((l) => l.side === 'Deduction');
  const done = () => {
    setDialog(null);
    void reload();
    void approval.reload();
  };
  const submit = async () => {
    setBusy(true);
    try {
      await settlementsApi.submit(d.id);
      done();
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HrScope>
      <GlassHero
        tint="detail"
        overline={
          <>
            {t('settlements.crumb')} › <bdi>{d.settlementNo}</bdi>
          </>
        }
        title={t(end ? 'settlements.titleEnd' : 'settlements.titleVacation', { name: d.name })}
        chip={<GlassChip>{t(`settlements.status.${d.status}`)}</GlassChip>}
        subtitle={
          end
            ? `${t(`settlements.reason.${d.reason}`)} · ${t('settlements.lastDayOn', { date: date(d.lastDay) })}`
            : `${t('settlements.annualLeave')} · ${date(d.leaveFrom)} – ${date(d.leaveTo)}${d.leaveRequestNo ? ` · ${d.leaveRequestNo}` : ''}${worker ? ` · ${t('settlements.party.Worker')}` : ''}`
        }
        actions={
          <>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.open(`/hr/settlements/${d.id}/print`, '_blank')} sx={glassButton()}>
              {t('settlements.print')}
            </Button>
            {d.canEdit && (
              <>
                <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setDialog('edit')} sx={glassButton()}>
                  {t('settlements.edit')}
                </Button>
                <Button variant="outlined" onClick={() => setDialog('cancel')} sx={glassButton()}>
                  {t('settlements.cancel')}
                </Button>
                <Button variant="outlined" startIcon={<SendOutlinedIcon />} disabled={busy} onClick={() => void submit()} sx={glassButton(true)}>
                  {t('settlements.submit')}
                </Button>
              </>
            )}
            {d.canPay && (
              <Button variant="outlined" startIcon={<PaymentsOutlinedIcon />} onClick={() => setDialog('pay')} sx={glassButton(true)}>
                {t('settlements.pay')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)} sx={glassButton()}>
              {t('common.back')}
            </Button>
          </>
        }
      >
        <GlassRow>
          {end ? (
            <GlassKpi icon={<HourglassBottomOutlinedIcon />} label={t('settlements.kpi.service')} value={years(d.serviceYears)} hint={t('settlements.kpi.serviceHint', { from: date(d.hireDate), days: d.serviceDays.toLocaleString('en-US'), excluded: d.excludedDays })} />
          ) : (
            <GlassKpi icon={<BeachAccessOutlinedIcon />} label={t('settlements.kpi.leaveDays')} value={t('settlements.daysN', { count: d.leaveDays })} hint={`${date(d.leaveFrom)} – ${date(d.leaveTo)}`} />
          )}
          <GlassKpi icon={<AddCircleOutlineIcon />} label={t('settlements.dues')} value={sar(d.totalAdditions)} hint={t('settlements.itemsN', { count: adds.length })} />
          <GlassKpi icon={<RemoveCircleOutlineIcon />} label={t('settlements.deductions')} value={sar(d.totalDeductions)} hint={t('settlements.itemsN', { count: deds.length })} />
          <GlassKpi icon={<CheckCircleOutlineIcon />} label={t('settlements.net')} value={sar(d.net)} hint={d.status === 'Paid' ? t('settlements.paidOn', { date: date(d.paidOn) }) : t('settlements.netHint')} />
        </GlassRow>
        <GlassRow>
          <GlassFact label={t(worker ? 'settlements.worker' : 'settlements.employee')}>
            <RouterLink to={worker ? `/workforce/workers/${d.personId}` : `/hr/employees/${d.personId}`} style={{ color: '#fff' }}>
              <bdi>{d.personNo}</bdi>
            </RouterLink>
            {(ar ? d.jobTitleAr : d.jobTitleEn) && ` · ${ar ? d.jobTitleAr : d.jobTitleEn}`}
            {(ar ? d.departmentAr : d.departmentEn) && ` · ${ar ? d.departmentAr : d.departmentEn}`}
          </GlassFact>
          <GlassFact label={t('settlements.wage')}>
            <Money value={d.wage} muted />
          </GlassFact>
          {end ? (
            <GlassFact label={t('settlements.leaveBalance')}>{t('settlements.daysN', { count: d.leaveDays })}</GlassFact>
          ) : (
            <GlassFact label={t(worker ? 'settlements.workerLeaveRequest' : 'settlements.leaveRequest')}>
              {d.leaveRequestId ? (
                <RouterLink to={worker ? `/operations/movements/${d.leaveRequestId}` : `/hr/leave/${d.leaveRequestId}`} style={{ color: '#fff' }}>
                  <bdi>{d.leaveRequestNo}</bdi>
                </RouterLink>
              ) : (
                '—'
              )}
            </GlassFact>
          )}
          <GlassFact label={t('settlements.unpaidFrom')}>{d.unpaidDays > 0 ? date(d.unpaidFrom) : t('settlements.allPaid')}</GlassFact>
        </GlassRow>
      </GlassHero>

      <ErrorMessage messageKey={error} />
      {d.approval && <ApprovalBar status={d.approval} detail={approval.detail} onChanged={done} />}
      {d.lastComment && d.status === 'Returned' && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {d.lastComment}
        </Alert>
      )}
      {d.net < 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('settlements.negative')}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Side title={t('settlements.dues')} tone="add" lines={adds} total={d.totalAdditions} d={d} />
        <Side title={t('settlements.deductions')} tone="deduct" lines={deds} total={d.totalDeductions} d={d} />
      </Box>

      <Box sx={{ mt: 2, borderRadius: '18px', p: '18px 22px', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center', background: 'radial-gradient(400px 200px at 10% 0%, rgba(56,189,248,.3), transparent 60%), linear-gradient(135deg, #082B49, #1e3a8a)' }}>
        <Box>
          <Typography sx={{ opacity: 0.8, fontSize: 13 }}>{t('settlements.netDue')}</Typography>
          <Typography sx={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            <Money value={d.net} muted />
          </Typography>
          <Typography sx={{ opacity: 0.7, fontSize: 12 }}>{t('settlements.netFormula')}</Typography>
        </Box>
        <Typography sx={{ opacity: 0.85, fontSize: 12.5, maxWidth: 460 }}>
          {d.notes ?? t('settlements.serverNote')}
          {d.status === 'Paid' && (
            <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
              {t('settlements.paidBy', { date: date(d.paidOn), method: t(`settlements.method.${d.paymentMethod}`, { defaultValue: d.paymentMethod ?? '' }), by: d.paidByName })}
              {d.paymentReference && <> · <bdi>{d.paymentReference}</bdi></>}
            </Box>
          )}
        </Typography>
      </Box>

      {end && <Award d={d} />}

      {dialog === 'edit' && <EditDialog d={d} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog === 'pay' && <PayDialog id={d.id} onClose={() => setDialog(null)} onPaid={done} />}
      {dialog === 'cancel' && <CancelDialog id={d.id} onClose={() => setDialog(null)} onCancelled={done} />}
    </HrScope>
  );
}

/** A line's details: the days and their rate, the article it comes from, or the record it takes. */
export function useLineDetail() {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const years = useYears();
  return (l: SettlementLine, d: SettlementDetail) => {
    switch (l.code) {
      case 'unpaid_salary':
        return t('settlements.detail.unpaid', { from: date(d.unpaidFrom), to: date(d.lastDay), days: l.days, rate: sar(l.rate) });
      case 'timesheet_pay':
        return t('settlements.detail.timesheet', { no: l.reference, days: l.days });
      case 'leave_allowance':
        return t('settlements.detail.leave', { days: l.days, rate: sar(l.rate) });
      case 'leave_balance':
        return t('settlements.detail.balance', { days: l.days, rate: sar(l.rate) });
      case 'end_of_service':
        return t('settlements.detail.award', { years: years(d.serviceYears), share: t(`settlements.share.${shareOf(l.rate)}`) });
      case 'article_77':
        return t(d.term === 'Fixed' ? 'settlements.detail.art77Fixed' : 'settlements.detail.art77');
      case 'installment':
        return t('settlements.detail.installment', { no: l.reference, period: l.sourcePeriod });
      case 'penalty_days':
      case 'suspension':
        return t('settlements.detail.days', { no: l.reference, days: l.days, rate: sar(l.rate) });
      case 'penalty_amount':
      case 'other_due':
        return l.reference ?? '';
      default:
        return '';
    }
  };
}

const shareOf = (rate: number) => (rate >= 0.99 ? 'all' : rate >= 0.66 ? 'twoThirds' : rate >= 0.33 ? 'third' : 'none');

function Side({ title, tone, lines, total, d }: { title: string; tone: 'add' | 'deduct'; lines: SettlementLine[]; total: number; d: SettlementDetail }) {
  const { t } = useTranslation();
  const detail = useLineDetail();
  const main = tone === 'add' ? '#047857' : '#B45309';
  return (
    <Box component="section" sx={{ ...(glassPanel as object), p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
        <Box aria-hidden sx={{ width: 30, height: 30, borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#fff', background: tone === 'add' ? 'linear-gradient(135deg,#34d399,#059669)' : 'linear-gradient(135deg,#fbbf24,#d97706)', '& svg': { fontSize: 18 } }}>
          {tone === 'add' ? <AddCircleOutlineIcon /> : <RemoveCircleOutlineIcon />}
        </Box>
        <Typography component="h2" sx={{ fontWeight: 800, fontSize: 15, color: main }}>
          {title}
        </Typography>
      </Stack>
      {lines.length === 0 ? (
        <Typography sx={{ py: 2, color: hr.textMuted, fontSize: 13 }}>{t(tone === 'add' ? 'settlements.noDues' : 'settlements.noDeductions')}</Typography>
      ) : (
        lines.map((l) => (
          <Row key={l.lineNo} label={t(`settlements.line.${l.code}`)} hint={detail(l, d)}>
            <Money value={l.amount} strong />
          </Row>
        ))
      )}
      <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1.25, px: 1.5, py: 1.25, borderRadius: '12px', fontWeight: 800, color: main, bgcolor: tone === 'add' ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.14)' }}>
        <span>{t(tone === 'add' ? 'settlements.totalDues' : 'settlements.totalDeductions')}</span>
        <Money value={total} strong />
      </Stack>
    </Box>
  );
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 1.1, borderBottom: '1px dashed rgba(100,116,139,.25)' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, color: '#334155' }}>{label}</Typography>
        {hint && <Typography sx={{ fontSize: 11.5, color: hr.textMuted }}>{hint}</Typography>}
      </Box>
      {children}
    </Stack>
  );
}

/** The award line by line (articles 84 and 85). */
function Award({ d }: { d: SettlementDetail }) {
  const { t } = useTranslation();
  const first = Math.min(d.serviceYears, 5);
  const after = Math.max(d.serviceYears - 5, 0);
  const award = d.lines.find((l) => l.code === 'end_of_service')?.amount ?? 0;
  // The rows add up to the server's full award: what is after the five years, and the rest for them.
  const afterAmount = Math.round(d.wage * after * 100) / 100;
  return (
    <Box component="section" sx={{ ...(glassPanel as object), p: 2, mt: 2 }}>
      <Typography component="h2" sx={{ fontWeight: 800, fontSize: 15, mb: 1 }}>
        {t('settlements.award.title')}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('settlements.award.item')}</TableCell>
            <TableCell>{t('settlements.award.period')}</TableCell>
            <TableCell>{t('settlements.award.rate')}</TableCell>
            <TableCell align="center">{t('settlements.award.amount')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>{t('settlements.award.first')}</TableCell>
            <TableCell>{t('settlements.yearsDec', { value: first.toFixed(2) })}</TableCell>
            <TableCell>{t('settlements.award.half')}</TableCell>
            <TableCell align="center">{sar(d.awardFull - afterAmount)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>{t('settlements.award.after')}</TableCell>
            <TableCell>{after > 0 ? t('settlements.yearsDec', { value: after.toFixed(2) }) : '—'}</TableCell>
            <TableCell>{t('settlements.award.whole')}</TableCell>
            <TableCell align="center">{sar(afterAmount)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>{t('settlements.award.full')}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell align="center">{sar(d.awardFull)}</TableCell>
          </TableRow>
          <TableRow sx={{ '& td': { fontWeight: 800 } }}>
            <TableCell>{t('settlements.award.due', { reason: t(`settlements.reason.${d.reason}`) })}</TableCell>
            <TableCell />
            <TableCell>{t(`settlements.share.${shareOf(d.awardFactor)}`)}</TableCell>
            <TableCell align="center">{sar(award)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Typography sx={{ fontSize: 11.5, color: hr.textMuted, mt: 1 }}>{t('settlements.award.note')}</Typography>
    </Box>
  );
}

function EditDialog({ d, onClose, onSaved }: { d: SettlementDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const end = d.kind === 'EndOfService';
  const [reason, setReason] = useState<EndReason>(d.reason ?? 'ContractEnd');
  const [lastDay, setLastDay] = useState(d.lastDay);
  const [term, setTerm] = useState(d.term);
  const [ends, setEnds] = useState(d.contractEndsOn ?? '');
  const [other, setOther] = useState(String(d.otherAdditions));
  const [custody, setCustody] = useState(String(d.custody));
  const [otherDeduction, setOtherDeduction] = useState(String(d.otherDeductions));
  const [full, setFull] = useState(d.deductFullAdvance);
  const [notes, setNotes] = useState(d.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = (v: string) => Math.max(0, Number(v) || 0);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await settlementsApi.update(d.id, {
        reason: end ? reason : null,
        lastDay: end ? lastDay : null,
        term: end ? term : null,
        contractEndsOn: end && term === 'Fixed' ? ends : null,
        otherAdditions: amount(other),
        custody: amount(custody),
        otherDeductions: amount(otherDeduction),
        deductFullAdvance: full,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  const money = (label: string, value: string, set: (v: string) => void) => (
    <TextField size="small" type="number" label={label} value={value} onChange={(e) => set(e.target.value)} slotProps={{ htmlInput: { min: 0, step: 0.01 } }} />
  );
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>{t('settlements.edit')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 0.5 }}>
          {end && (
            <>
              <TextField select size="small" label={t('settlements.col.reason')} value={reason} onChange={(e) => setReason(e.target.value as EndReason)}>
                {endReasons.map((r) => (
                  <MenuItem key={r} value={r}>
                    {t(`settlements.reason.${r}`)}
                  </MenuItem>
                ))}
              </TextField>
              <DateField size="small" label={t('settlements.create.lastDay')} value={lastDay} onChange={(e) => setLastDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
                <TextField select size="small" label={t('settlements.create.term')} value={term} onChange={(e) => setTerm(e.target.value as 'Indefinite' | 'Fixed')} sx={{ flex: 1 }}>
                  <MenuItem value="Indefinite">{t('settlements.term.Indefinite')}</MenuItem>
                  <MenuItem value="Fixed">{t('settlements.term.Fixed')}</MenuItem>
                </TextField>
                {term === 'Fixed' && (
                  <DateField size="small" label={t('settlements.create.contractEnds')} value={ends} onChange={(e) => setEnds(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
                )}
              </Stack>
            </>
          )}
          {money(t('settlements.line.other_addition'), other, setOther)}
          {money(t('settlements.line.custody'), custody, setCustody)}
          {money(t('settlements.line.other_deduction'), otherDeduction, setOtherDeduction)}
          {!end && d.party === 'Staff' && <FormControlLabel control={<Checkbox checked={full} onChange={(e) => setFull(e.target.checked)} />} label={t('settlements.fullAdvance')} />}
          <TextField size="small" multiline minRows={2} label={t('settlements.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <Typography sx={{ fontSize: 12, color: hr.textMuted }}>{t('settlements.editHint')}</Typography>
          {error && <Alert severity="error">{t(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy || (end && (!lastDay || (term === 'Fixed' && !ends)))} onClick={() => void save()}>
          {t('settlements.saveRecalculate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PayDialog({ id, onClose, onPaid }: { id: string; onClose: () => void; onPaid: () => void }) {
  const { t } = useTranslation();
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pay = async () => {
    setBusy(true);
    try {
      await settlementsApi.pay(id, { paidOn, method, reference: reference.trim() || null });
      onPaid();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{t('settlements.pay')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 0.5 }}>
          <DateField size="small" label={t('settlements.paidOnLabel')} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select size="small" label={t('settlements.methodLabel')} value={method} onChange={(e) => setMethod(e.target.value)}>
            {['Transfer', 'Cash', 'Cheque'].map((m) => (
              <MenuItem key={m} value={m}>
                {t(`settlements.method.${m}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label={t('settlements.referenceLabel')} value={reference} onChange={(e) => setReference(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
          {error && <Alert severity="error">{t(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={busy} onClick={() => void pay()}>
          {t('settlements.confirmPay')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CancelDialog({ id, onClose, onCancelled }: { id: string; onClose: () => void; onCancelled: () => void }) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancel = async () => {
    try {
      await settlementsApi.cancel(id, comment.trim() || null);
      onCancelled();
    } catch (f) {
      setError(errorKey(f));
    }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>{t('settlements.cancel')}</DialogTitle>
      <DialogContent>
        <Stack sx={{ gap: 2, pt: 0.5 }}>
          <Typography sx={{ fontSize: 13 }}>{t('settlements.cancelConfirm')}</Typography>
          <TextField size="small" multiline minRows={2} label={t('settlements.cancelReason')} value={comment} onChange={(e) => setComment(e.target.value)} />
          {error && <Alert severity="error">{t(error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.back')}</Button>
        <Button variant="contained" color="error" onClick={() => void cancel()}>
          {t('settlements.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
