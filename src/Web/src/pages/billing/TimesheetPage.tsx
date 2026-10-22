import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { adjustmentTypes, billingApi, invoiceApi, type AdjustmentType, type BillingSettings, type TimesheetDetail, type TimesheetLine, type WorkerPay } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { recordTones, RecordHero, SectionTitle } from '../../components/RecordLayout';
import { PillTabs } from '../../components/ui';
import { ApprovalBar, useRecordApproval, ShownStatus } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { ColumnsButton, useHiddenColumns } from '../../components/hr/ColumnsMenu';
import { sar } from '../operations/delivery';
import { ExcelUploadDialog } from './ExcelUploadDialog';
import { InvoiceStatusBadge } from './invoices';
import { SourceBadge, TimesheetStatusBadge } from './timesheets';
import { useCrumb } from '../../app/breadcrumbs';

type Tab = 'invoice' | 'payroll' | 'suppliers' | 'unknown';

const card = { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, border: `1px solid ${tokens.gray100}` };
const dayMs = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs);

// Each adjustment's color in the trail.
const adjustmentColor: Record<AdjustmentType, string> = {
  Absence: '#e03434',
  Overtime: '#1f6fd1',
  ClientAddition: '#1f9d55',
  ClientDeduction: '#b8770a',
  CustomerLoan: '#7c4dcc',
  FeeDays: '#0f8f84',
  OtherCost: '#5d6f7b',
  InternalAddition: '#17734b',
  InternalDeduction: '#a32a5c',
};

/** The month as a desk calendar's page: the month's name on red, the cycle's days under it. */
function CalendarPage({ month, days }: { month: string; days: number }) {
  return (
    <Box sx={{ width: 50, borderRadius: '10px', overflow: 'hidden', bgcolor: '#fff', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.18)' }}>
      <Box sx={{ bgcolor: '#e03434', color: '#fff', fontSize: 10, fontWeight: 800, py: '1px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{month}</Box>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: recordTones.timesheet.main, lineHeight: 1.35 }}>{days}</Typography>
    </Box>
  );
}

/**
 * The worker's month in one bar: the cycle's days, the part the worker was on the project in green, and a red square
 * for each day of absence at the end of it.
 */
function MonthBar({ from, to, lineFrom, lineTo, absence }: { from: string; to: string; lineFrom: string; lineTo: string; absence: number }) {
  const total = Math.max(1, daysBetween(from, to) + 1);
  const start = Math.max(0, daysBetween(from, lineFrom));
  const length = Math.max(0, Math.min(total - start, daysBetween(lineFrom, lineTo) + 1));
  const absent = Math.min(length, Math.ceil(absence));
  const day = 100 / total;
  return (
    <Box sx={{ position: 'relative', height: 14, borderRadius: '4px', bgcolor: tokens.gray100, overflow: 'hidden', minWidth: 80 }}>
      <Box sx={{ position: 'absolute', insetBlock: 0, insetInlineStart: `${start * day}%`, width: `${length * day}%`, bgcolor: '#2fae73', borderRadius: '3px' }} />
      {Array.from({ length: absent }, (_, n) => (
        <Box
          key={n}
          sx={{ position: 'absolute', top: 2, bottom: 2, insetInlineStart: `calc(${(start + length - absent + n) * day}% + 1px)`, width: `calc(${day}% - 2px)`, bgcolor: '#e03434', borderRadius: '2px' }}
        />
      ))}
    </Box>
  );
}

/**
 * One project's timesheet for a cycle, as an attendance register: the band with the month, the approval bar, the
 * workers with their month drawn as a bar (absences in red) and the figures the timesheet makes for each; beside them
 * what the timesheet makes (invoice, payroll, suppliers, attendance) and the trail of adjustments; then the invoice,
 * payroll and supplier details and the approval's history.
 */
export function TimesheetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [sheet, setSheet] = useState<TimesheetDetail | null>(null);
  useCrumb(sheet?.timesheetNo, `/billing/timesheets/${id}`);
  const [tab, setTab] = useState<Tab>('invoice');
  const [adjusting, setAdjusting] = useState<TimesheetLine | null>(null);
  const [settings, setSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approval = useRecordApproval(sheet?.approval?.instanceId);

  const reload = useCallback(async () => {
    try {
      setSheet(await billingApi.get(id!));
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!sheet) {
    return <ErrorMessage messageKey={error} />;
  }

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
      await approval.reload();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const look = recordTones.timesheet;
  const workers = new Set(sheet.lines.map((l) => l.workerId)).size;
  const days = sheet.lines.reduce((s, l) => s + l.workDays, 0);
  const absence = sheet.lines.reduce((s, l) => s + l.absenceDays, 0);
  const attendance = days > 0 ? Math.round(((days - absence) / days) * 1000) / 10 : 0;
  const payroll = sheet.payroll.reduce((s, p) => s + p.net, 0);
  const suppliers = sheet.suppliers.reduce((s, p) => s + p.net, 0);
  const noPrice = sheet.lines.filter((l) => l.totalPrice <= 0);
  const canRun = (!sheet.awaitingApproval && sheet.canEdit) || approval.detail?.summary.status === 'Failed';
  const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(sheet.month));
  const monthShort = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(sheet.month));
  const nameOf = (workerId: string) => sheet.lines.find((l) => l.workerId === workerId)?.name ?? '—';
  const makeInvoice = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id: invoiceId } = await invoiceApi.fromTimesheet(sheet.id);
      navigate(`/billing/invoices/${invoiceId}`);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <RecordHero
        tone="timesheet"
        icon={<CalendarPage month={monthShort} days={daysBetween(sheet.from, sheet.to) + 1} />}
        kind={t('timesheets.timesheetOf', { month: monthName })}
        number={sheet.timesheetNo}
        status={
          <Box sx={{ bgcolor: '#fff', borderRadius: 99, px: 0.25 }}>
            <ShownStatus approval={approval.detail}><TimesheetStatusBadge status={sheet.status} /></ShownStatus>
          </Box>
        }
        title={sheet.projectName}
        subtitle={`${sheet.customerName ?? '—'} · ${t('timesheets.cycle', { from: date(sheet.from), to: date(sheet.to) })} · ${t(`timesheets.dayBasis.${sheet.dayBasis}`)}`}
        actions={
          <>
            {sheet.canSubmit && (
              <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy || noPrice.length > 0} onClick={() => void run(() => billingApi.submit(sheet.id))}>
                {t('timesheets.submit')}
              </Button>
            )}
            {sheet.canInvoice && (
              <Button variant="contained" startIcon={<ReceiptLongOutlinedIcon />} disabled={busy} onClick={() => void makeInvoice()}>
                {t('invoices.makeFromTimesheet')}
              </Button>
            )}
            {canRun && <RunProcessButton screen="billing.timesheet" recordId={sheet.id} title={`${sheet.timesheetNo} — ${sheet.projectName}`} onStarted={() => void reload().then(() => approval.reload())} />}
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={`/api/v1/billing/timesheets/${sheet.id}/excel`} download>
              {t('timesheets.excel.download')}
            </Button>
            <Button variant="outlined" startIcon={<MoreHorizIcon />} onClick={(e) => setMenu(e.currentTarget)}>
              {t('invoices.more')}
            </Button>
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(`/billing/timesheets?month=${sheet.month}`)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        {sheet.canEdit && (
          <MenuItem onClick={() => (setMenu(null), void run(() => billingApi.generate(sheet.projectId, sheet.month)))}>
            <ListItemIcon>
              <AutoModeOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {t('timesheets.regenerate')}
          </MenuItem>
        )}
        {sheet.canEdit && (
          <MenuItem onClick={() => (setMenu(null), setUploading(true))}>
            <ListItemIcon>
              <UploadFileOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {t('timesheets.excel.upload')}
          </MenuItem>
        )}
        <MenuItem onClick={() => (setMenu(null), setSettings(true))}>
          <ListItemIcon>
            <SettingsOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {t('timesheets.settings.title')}
        </MenuItem>
      </Menu>

      <ErrorMessage messageKey={error} />
      {noPrice.length > 0 && (
        <Alert severity="error" sx={{ mb: `${tokens.gap}px` }}>
          {t('timesheets.noPrice', { workers: noPrice.map((l) => l.workerNo).join('، ') })}
        </Alert>
      )}
      {sheet.lastComment && sheet.status === 'Returned' && (
        <Alert severity="info" sx={{ mb: `${tokens.gap}px` }}>
          {t('operations.delivery.lastComment')}: {sheet.lastComment}
        </Alert>
      )}
      {sheet.approval && (
        <ApprovalBar
          status={sheet.approval}
          detail={approval.detail}
          loading={approval.loading}
          onChanged={() => {
            void approval.reload();
            void reload();
          }}
        />
      )}

      {/* What the timesheet makes, and the trail of its adjustments. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(0, 1fr)' }, gap: `${tokens.gap}px`, mb: `${tokens.gap}px`, alignItems: 'stretch' }}>
          {/* What the timesheet makes. */}
          <Box sx={{ ...card, overflow: 'hidden' }}>
            <Box sx={{ px: 2.25, py: 1.25, color: '#fff', background: look.dark, fontSize: 14, fontWeight: 800 }}>{t('timesheets.effect.title')}</Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '230px minmax(0, 1fr)' }, alignItems: 'center', columnGap: 1 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.75, px: 2.25, py: 1.5 }}>
              <Box sx={{ position: 'relative', width: 78, height: 78, flex: '0 0 auto' }}>
                <CircularProgress variant="determinate" value={100} size={78} thickness={5} sx={{ color: tokens.gray100, position: 'absolute' }} />
                <CircularProgress variant="determinate" value={attendance} size={78} thickness={5} sx={{ color: look.main, position: 'absolute', '& circle': { strokeLinecap: 'round' } }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t('timesheets.effect.attendance')}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: look.main, lineHeight: 1.2 }}>{attendance}%</Typography>
                <Typography sx={{ fontSize: 12, color: tokens.gray600 }}>
                  {t('timesheets.effect.days', { days: sar(days), workers })}
                  {absence > 0 && (
                    <Box component="b" sx={{ color: '#e03434' }}>
                      {' · '}
                      {t('timesheets.effect.absence', { days: sar(absence) })}
                    </Box>
                  )}
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ px: 2.25, py: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 3 }}>
              {[
                [t('timesheets.tiles.amount'), sar(sheet.invoice.amount), tokens.navy800],
                [t('timesheets.tiles.vat'), sar(sheet.invoice.vat), tokens.navy800],
                [t('timesheets.tiles.total'), sar(sheet.invoice.total), recordTones.invoice.main],
                [t('timesheets.tiles.payroll'), sar(payroll), look.main],
                [t('timesheets.tiles.suppliers'), sar(suppliers), tokens.navy800],
                ...(sheet.unknownSource.length > 0 ? [[t('timesheets.tiles.unknown'), String(sheet.unknownSource.length), tokens.warning]] : []),
              ].map(([label, value, color], n) => (
                <Stack key={label} direction="row" sx={{ justifyContent: 'space-between', gap: 2, py: 0.85, borderBottom: `1px solid ${tokens.gray100}` }}>
                  <Typography sx={{ fontSize: 13, color: tokens.gray500 }}>{label}</Typography>
                  <Typography sx={{ fontSize: n === 2 || n === 3 ? 15 : 13.5, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
                </Stack>
              ))}
            </Box>
            </Box>
            {sheet.invoiceDoc && (
              <Box sx={{ px: 2.25, pb: 2 }}>
                <Button fullWidth variant="outlined" startIcon={<ReceiptLongOutlinedIcon />} onClick={() => navigate(`/billing/invoices/${sheet.invoiceDoc!.id}`)} sx={{ justifyContent: 'space-between' }}>
                  {t('invoices.openInvoice', { number: sheet.invoiceDoc.invoiceNo ?? t('invoices.noNumber') })}
                  <InvoiceStatusBadge status={sheet.invoiceDoc.status} />
                </Button>
              </Box>
            )}
          </Box>

          {/* The trail of adjustments. */}
          <Box sx={{ ...card, p: 2.25, maxHeight: 330, overflowY: 'auto' }}>
            <SectionTitle icon={<EditNoteOutlinedIcon />} title={t('timesheets.trail.title', { count: sheet.adjustments.length })} />
            {sheet.adjustments.length === 0 && <Typography sx={{ py: 2, textAlign: 'center', fontSize: 13, color: tokens.gray500 }}>{t('timesheets.trail.none')}</Typography>}
            {[...sheet.adjustments]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((a) => (
                <Stack key={a.id} direction="row" sx={{ gap: 1.25, py: 1, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.gray100}` } }}>
                  <Box sx={{ flex: '0 0 4px', borderRadius: 4, bgcolor: adjustmentColor[a.type] }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: adjustmentColor[a.type] }}>
                      {t(`timesheets.adjustments.${a.type}`)}: {sar(a.value)} {t(`timesheets.units.${a.type}`)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: tokens.gray600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <bdi>{nameOf(a.workerId)}</bdi> · {a.reason}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                      <bdi>{date(a.createdAt)}</bdi> · {a.createdByName}
                    </Typography>
                  </Box>
                </Stack>
              ))}
          </Box>
      </Box>

      <Box>
        <Stack spacing={`${tokens.gap}px`} sx={{ minWidth: 0 }}>
          {/* The attendance register. */}
          <Box sx={{ ...card, p: 2.25, minWidth: 0 }}>
            <SectionTitle
              icon={<EventAvailableOutlinedIcon />}
              title={t('timesheets.register.title', { count: sheet.lines.length })}
              extra={
                <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
                  <Legend color="#2fae73" label={t('timesheets.register.present')} />
                  <Legend color="#e03434" label={t('timesheets.register.absent')} />
                  <Legend color={tokens.gray200} label={t('timesheets.register.outside')} />
                </Stack>
              }
            />
            <WorkersTab sheet={sheet} onAdjust={setAdjusting} />
          </Box>

          {/* What the timesheet makes, in detail. */}
          <Box sx={{ ...card, p: 2.25 }}>
            <PillTabs
              value={tab}
              onChange={setTab}
              options={[
                { value: 'invoice', label: t('timesheets.tabs.invoice') },
                { value: 'payroll', label: t('timesheets.tabs.payroll', { count: sheet.payroll.length }) },
                { value: 'suppliers', label: t('timesheets.tabs.suppliers', { count: sheet.suppliers.length }) },
                ...(sheet.unknownSource.length > 0 ? [{ value: 'unknown' as const, label: t('timesheets.tabs.unknown', { count: sheet.unknownSource.length }) }] : []),
              ]}
            />
            {tab === 'invoice' && <InvoiceTab sheet={sheet} />}
            {tab === 'payroll' && (
              <>
                <Hint text={t('timesheets.payrollHint')} />
                <PayTable rows={sheet.payroll} />
              </>
            )}
            {tab === 'suppliers' && (
              <>
                <Hint text={t('timesheets.suppliersHint')} />
                {sheet.suppliers.length === 0 ? (
                  <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('timesheets.noSuppliers')}</Typography>
                ) : (
                  <Stack spacing={2}>
                    {sheet.suppliers.map((s) => (
                      <Box key={s.supplierName} sx={{ border: `1px solid ${tokens.navy50}`, borderRadius: `${tokens.radius}px`, p: 1.5 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, flex: 1 }}>{s.supplierName}</Typography>
                          <Typography sx={{ fontSize: 12.5, color: tokens.gray600 }}>{t('timesheets.supplierSummary', { workers: s.workers, days: sar(s.workDays), net: sar(s.net) })}</Typography>
                        </Stack>
                        <PayTable rows={s.items} />
                      </Box>
                    ))}
                  </Stack>
                )}
              </>
            )}
            {tab === 'unknown' && (
              <>
                <Alert severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ mb: 1.5 }}>
                  {t('timesheets.unknownHint')}
                </Alert>
                <PayTable rows={sheet.unknownSource} />
              </>
            )}
          </Box>

        </Stack>

      </Box>

      {uploading && (
        <ExcelUploadDialog
          timesheetId={sheet.id}
          onClose={() => setUploading(false)}
          onApplied={() => {
            setUploading(false);
            void reload();
          }}
        />
      )}
      {adjusting && <AdjustDialog sheet={sheet} line={adjusting} onClose={() => setAdjusting(null)} onChanged={() => void reload()} />}
      {settings && (
        <SettingsDialog
          sheet={sheet}
          onClose={() => setSettings(false)}
          onSaved={() => {
            setSettings(false);
            if (sheet.canEdit) void run(() => billingApi.generate(sheet.projectId, sheet.month));
          }}
        />
      )}
    </Box>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, color: tokens.gray600 }}>
      <Box sx={{ width: 12, height: 10, borderRadius: '2px', bgcolor: color }} />
      {label}
    </Stack>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5, fontSize: 12.5, color: tokens.gray500 }}>
      <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      {text}
    </Stack>
  );
}

// The register's optional columns (name, days, the invoice amount and the worker's net always show).
type RegisterColumn = 'period' | 'price' | 'salary' | 'fees' | 'housing' | 'transport' | 'overtimeAmount' | 'additions' | 'deductions' | 'loans' | 'other' | 'gosi' | 'vat' | 'total' | 'internal';
const registerColumns: { key: RegisterColumn; group: 'days' | 'invoice' | 'worker'; value: (l: TimesheetLine) => number; signed?: boolean }[] = [
  { key: 'price', group: 'invoice', value: (l) => l.totalPrice },
  { key: 'salary', group: 'invoice', value: (l) => l.dueSalary - l.absenceAmount },
  { key: 'fees', group: 'invoice', value: (l) => l.dueFees },
  { key: 'housing', group: 'invoice', value: (l) => l.dueHousing },
  { key: 'transport', group: 'invoice', value: (l) => l.dueTransport },
  { key: 'overtimeAmount', group: 'invoice', value: (l) => l.overtime },
  { key: 'additions', group: 'invoice', value: (l) => l.clientAdditions },
  { key: 'deductions', group: 'invoice', value: (l) => -l.clientDeductions, signed: true },
  { key: 'loans', group: 'invoice', value: (l) => -l.customerLoans, signed: true },
  { key: 'other', group: 'invoice', value: (l) => l.otherCosts },
  { key: 'gosi', group: 'invoice', value: (l) => l.gosi },
];
const registerAfter: { key: RegisterColumn; group: 'invoice' | 'worker'; value: (l: TimesheetLine) => number; signed?: boolean }[] = [
  { key: 'vat', group: 'invoice', value: (l) => l.vat },
  { key: 'total', group: 'invoice', value: (l) => l.invoiceTotal },
  { key: 'internal', group: 'worker', value: (l) => l.internalAdditions - l.internalDeductions, signed: true },
];
const registerOptional: RegisterColumn[] = ['period', 'price', 'salary', 'fees', 'housing', 'transport', 'overtimeAmount', 'additions', 'deductions', 'loans', 'other', 'gosi', 'vat', 'total', 'internal'];

/**
 * The attendance register as a dense grid (the user's request: as many of the timesheet's columns as the screen holds):
 * the worker, the month's bar, the days (present, absent, overtime), what the line puts on the invoice element by
 * element, and the worker's side; the optional columns are chosen from «columns».
 */
function WorkersTab({ sheet, onAdjust }: { sheet: TimesheetDetail; onAdjust: (line: TimesheetLine) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  const look = recordTones.timesheet;
  const { shown, toggle } = useHiddenColumns<RegisterColumn>('timesheets.hiddenColumns', registerOptional, ['price', 'housing', 'transport', 'loans', 'other', 'gosi', 'vat']);
  const adjustments = (workerId: string) => sheet.adjustments.filter((a) => a.workerId === workerId).length;
  const sum = (pick: (l: TimesheetLine) => number) => sheet.lines.reduce((s, l) => s + pick(l), 0);
  const before = registerColumns.filter((c) => shown(c.key));
  const after = registerAfter.filter((c) => shown(c.key));
  const invoiceCols = before.length + 1 + after.filter((c) => c.group === 'invoice').length;
  const workerCols = after.filter((c) => c.group === 'worker').length + 1;
  const label = (key: RegisterColumn) => t(`timesheets.grid.${key}`);
  const money = (v: number, signed?: boolean) => (v === 0 ? <Box component="span" sx={{ color: tokens.gray300 }}>—</Box> : <bdi style={{ color: signed && v < 0 ? '#b8770a' : undefined }}>{sar(v)}</bdi>);
  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1 }}>
        <ColumnsButton
          columns={registerOptional.map((key) => ({ key, label: label(key), group: t(`timesheets.grid.groups.${key === 'period' ? 'days' : ([...registerColumns, ...registerAfter].find((c) => c.key === key)?.group ?? 'invoice')}`) }))}
          shown={shown}
          toggle={toggle}
        />
      </Stack>
      <TableContainer sx={{ border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px`, maxHeight: 720 }}>
        <Table
          size="small"
          stickyHeader
          sx={{
            '& .MuiTableCell-root': { px: 0.75 },
            '& .MuiTableCell-body': { fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', py: 0.6 },
            '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even) .MuiTableCell-body': { bgcolor: '#fafcfb' },
            '& .pin': { position: 'sticky', insetInlineStart: 0, zIndex: 2, bgcolor: '#fff', boxShadow: `inset -1px 0 0 ${tokens.gray100}` },
            '& td.g-days': { backgroundImage: 'linear-gradient(rgba(47,174,115,.06), rgba(47,174,115,.06))' },
            '& td.g-invoice': { backgroundImage: 'linear-gradient(rgba(31,111,209,.045), rgba(31,111,209,.045))' },
            '& td.g-worker': { backgroundImage: 'linear-gradient(rgba(124,77,204,.06), rgba(124,77,204,.06))' },
            '& .gs': { borderInlineStart: '2px solid #fff' },
            '& td.gs': { borderInlineStart: `2px solid ${tokens.gray100}` },
          }}
        >
          <TableHead
            sx={{
              '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: look.dark, color: '#fff', borderBottom: 0, borderRadius: 0, fontSize: 11.5, lineHeight: 1.3, py: 0.6, verticalAlign: 'bottom' },
              '& .grp': { textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid rgba(255,255,255,.25) !important' },
              '& th.g-days.grp': { bgcolor: '#17734b !important' },
              '& th.g-days:not(.grp)': { bgcolor: '#1f8f5f !important' },
              '& th.g-invoice.grp': { bgcolor: '#1d4f91 !important' },
              '& th.g-invoice:not(.grp)': { bgcolor: '#2a64b0 !important' },
              '& th.g-worker.grp': { bgcolor: '#55358f !important' },
              '& th.g-worker:not(.grp)': { bgcolor: '#6a47aa !important' },
              '& tr:nth-of-type(2) th': { top: 28 },
              '& th.pin': { zIndex: 4 },
            }}
          >
            <TableRow>
              <TableCell rowSpan={2} className="pin" sx={{ minWidth: 170 }}>
                {t('workforce.col.name')}
              </TableCell>
              <TableCell colSpan={shown('period') ? 4 : 3} className="grp g-days gs">
                {t('timesheets.grid.groups.days')}
              </TableCell>
              <TableCell colSpan={invoiceCols} className="grp g-invoice gs">
                {t('timesheets.grid.groups.invoice')}
              </TableCell>
              <TableCell colSpan={workerCols} className="grp g-worker gs">
                {t('timesheets.grid.groups.worker')}
              </TableCell>
              {sheet.canEdit && <TableCell rowSpan={2} />}
            </TableRow>
            <TableRow>
              {shown('period') && <TableCell className="g-days gs">{label('period')}</TableCell>}
              <TableCell align="center" className={shown('period') ? 'g-days' : 'g-days gs'}>{t('timesheets.register.present')}</TableCell>
              <TableCell align="center" className="g-days">{t('timesheets.register.absent')}</TableCell>
              <TableCell align="center" className="g-days">{t('timesheets.grid.overtimeHours')}</TableCell>
              {before.map((c) => (
                <TableCell key={c.key} align="right" className={`g-invoice${c === before[0] ? ' gs' : ''}`}>
                  {label(c.key)}
                </TableCell>
              ))}
              <TableCell align="right" className={before.length === 0 ? 'g-invoice gs' : 'g-invoice'}>{t('timesheets.grid.amount')}</TableCell>
              {after.filter((c) => c.group === 'invoice').map((c) => (
                <TableCell key={c.key} align="right" className="g-invoice">
                  {label(c.key)}
                </TableCell>
              ))}
              {after.filter((c) => c.group === 'worker').map((c) => (
                <TableCell key={c.key} align="right" className="g-worker gs">
                  {label(c.key)}
                </TableCell>
              ))}
              <TableCell align="right" className={shown('internal') ? 'g-worker' : 'g-worker gs'}>{t('timesheets.grid.net')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sheet.lines.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell className="pin" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${l.workerId}?tab=periods`)}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.navy800, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.name}>
                    {l.name}
                  </Typography>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 10.5, color: tokens.gray500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span dir="ltr">{l.workerNo}</span> · {(ar ? l.professionAr : l.professionEn) ?? '—'}
                    </Typography>
                    {l.source !== 'Company' && <SourceBadge source={l.source} supplier={l.supplierName} />}
                  </Stack>
                </TableCell>
                {shown('period') && (
                  <TableCell className="g-days gs" sx={{ minWidth: 96 }} title={`${date(l.lineFrom)} – ${date(l.lineTo)} · ${l.sourceNo}${l.fromOldSystem ? ` · ${t('workforce.periods.oldSystem')}` : ''}`}>
                    <MonthBar from={sheet.from} to={sheet.to} lineFrom={l.lineFrom} lineTo={l.lineTo} absence={l.absenceDays} />
                  </TableCell>
                )}
                <TableCell align="center" className={shown('period') ? 'g-days' : 'g-days gs'} sx={{ fontWeight: 800, color: `${look.main} !important` }}>
                  {sar(l.workDays - l.absenceDays)}
                </TableCell>
                <TableCell align="center" className="g-days" title={l.absenceDays > 0 ? `−${sar(l.absenceAmount)}` : undefined} sx={{ fontWeight: 800, color: l.absenceDays > 0 ? '#e03434 !important' : undefined }}>
                  {l.absenceDays > 0 ? sar(l.absenceDays) : <Box component="span" sx={{ color: tokens.gray300 }}>—</Box>}
                </TableCell>
                <TableCell align="center" className="g-days" sx={{ color: l.overtimeHours > 0 ? '#1f6fd1 !important' : undefined, fontWeight: 700 }}>
                  {l.overtimeHours > 0 ? sar(l.overtimeHours) : <Box component="span" sx={{ color: tokens.gray300 }}>—</Box>}
                </TableCell>
                {before.map((c) => (
                  <TableCell key={c.key} align="right" className={`g-invoice${c === before[0] ? ' gs' : ''}`}>
                    {c.key === 'price' && l.totalPrice <= 0 ? <Box component="span" sx={{ color: tokens.danger, fontWeight: 700 }}>{t('timesheets.noPriceShort')}</Box> : money(c.value(l), c.signed)}
                  </TableCell>
                ))}
                <TableCell align="right" className={before.length === 0 ? 'g-invoice gs' : 'g-invoice'} sx={{ fontWeight: 800, color: `${tokens.navy800} !important` }}>
                  {sar(l.invoiceAmount)}
                </TableCell>
                {after.map((c) => (
                  <TableCell key={c.key} align="right" className={c.group === 'worker' ? 'g-worker gs' : 'g-invoice'} sx={c.key === 'total' ? { fontWeight: 700 } : undefined}>
                    {money(c.value(l), c.signed)}
                  </TableCell>
                ))}
                <TableCell align="right" className={shown('internal') ? 'g-worker' : 'g-worker gs'} sx={{ fontWeight: 700 }}>
                  {sar(l.workerNet)}
                </TableCell>
                {sheet.canEdit && (
                  <TableCell sx={{ px: '2px !important' }}>
                    <Tooltip title={t('timesheets.adjust')}>
                      <IconButton size="small" onClick={() => onAdjust(l)} sx={{ color: look.main, p: 0.5 }}>
                        <EditNoteOutlinedIcon fontSize="small" />
                        {adjustments(l.workerId) > 0 && (
                          <Box component="span" sx={{ fontSize: 10.5, fontWeight: 800, marginInlineStart: '2px' }}>
                            {adjustments(l.workerId)}
                          </Box>
                        )}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {sheet.lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={30} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                  {t('timesheets.noLines')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {sheet.lines.length > 0 && (
            <TableFooter sx={{ '& .MuiTableCell-footer': { fontSize: 12, fontWeight: 800, color: tokens.navy800, borderTop: `2px solid ${look.main}`, bgcolor: '#f6faf8', position: 'sticky', bottom: 0, px: 0.75, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } }}>
              <TableRow>
                <TableCell className="pin" sx={{ bgcolor: '#f6faf8 !important' }}>
                  {t('timesheets.grid.totalRow')}
                  <Typography component="span" sx={{ display: 'block', fontSize: 10.5, color: tokens.gray500 }}>
                    {t('timesheets.grid.lines', { count: sheet.lines.length })}
                  </Typography>
                </TableCell>
                {shown('period') && <TableCell className="g-days gs" />}
                <TableCell align="center" className={shown('period') ? 'g-days' : 'g-days gs'} sx={{ color: `${look.main} !important` }}>{sar(sum((l) => l.workDays - l.absenceDays))}</TableCell>
                <TableCell align="center" className="g-days" sx={{ color: '#e03434 !important' }}>{sar(sum((l) => l.absenceDays))}</TableCell>
                <TableCell align="center" className="g-days" sx={{ color: '#1f6fd1 !important' }}>{sar(sum((l) => l.overtimeHours))}</TableCell>
                {before.map((c) => (
                  <TableCell key={c.key} align="right" className={`g-invoice${c === before[0] ? ' gs' : ''}`}>
                    {c.key === 'price' ? '' : sar(sum(c.value))}
                  </TableCell>
                ))}
                <TableCell align="right" className={before.length === 0 ? 'g-invoice gs' : 'g-invoice'}>{sar(sum((l) => l.invoiceAmount))}</TableCell>
                {after.map((c) => (
                  <TableCell key={c.key} align="right" className={c.group === 'worker' ? 'g-worker gs' : 'g-invoice'}>
                    {sar(sum(c.value))}
                  </TableCell>
                ))}
                <TableCell align="right" className={shown('internal') ? 'g-worker' : 'g-worker gs'}>{sar(sum((l) => l.workerNet))}</TableCell>
                {sheet.canEdit && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableContainer>
    </>
  );
}

function InvoiceTab({ sheet }: { sheet: TimesheetDetail }) {
  const { t } = useTranslation();
  const i = sheet.invoice;
  const rows: [string, number, boolean?][] = [
    [t('timesheets.invoice.salary'), i.dueSalary],
    [t('timesheets.invoice.absence'), -i.absenceAmount],
    [t('timesheets.invoice.fees'), i.dueFees],
    [t('timesheets.invoice.housing'), i.dueHousing, true],
    [t('timesheets.invoice.transport'), i.dueTransport, true],
    [t('timesheets.invoice.overtime'), i.overtime],
    [t('timesheets.invoice.additions'), i.clientAdditions],
    [t('timesheets.invoice.deductions'), -i.clientDeductions],
    [t('timesheets.invoice.loans'), -i.customerLoans],
    [t('timesheets.invoice.other'), i.otherCosts],
    [t('timesheets.invoice.gosi'), i.gosi],
  ];
  return (
    <>
      <Hint text={t('timesheets.invoiceHint')} />
      <Box sx={{ maxWidth: 560 }}>
        {rows
          .filter(([, value, part]) => value !== 0 || !part)
          .map(([label, value, part]) => (
            <Stack key={label} direction="row" sx={{ justifyContent: 'space-between', py: 0.75, borderBottom: `1px dashed ${tokens.gray200}`, paddingInlineStart: part ? 3 : 0, color: part ? tokens.gray500 : tokens.gray700 }}>
              <Typography sx={{ fontSize: 13.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: value < 0 ? tokens.danger : undefined }}>{sar(value)}</Typography>
            </Stack>
          ))}
        <Stack direction="row" sx={{ justifyContent: 'space-between', py: 1, mt: 0.5 }}>
          <Typography sx={{ fontWeight: 800 }}>{t('timesheets.invoice.amount')}</Typography>
          <Typography sx={{ fontWeight: 800 }}>{sar(i.amount)}</Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
          <Typography>{t('timesheets.invoice.vat', { rate: Math.round(sheet.settings.vatRate * 100) })}</Typography>
          <Typography sx={{ fontWeight: 700 }}>{sar(i.vat)}</Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', py: 1.25, px: 1.5, mt: 1, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy700, color: '#fff' }}>
          <Typography sx={{ fontWeight: 800 }}>{t('timesheets.invoice.total')}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{sar(i.total)}</Typography>
        </Stack>
      </Box>
    </>
  );
}

function PayTable({ rows }: { rows: WorkerPay[] }) {
  const { t } = useTranslation();
  const total = (pick: (p: WorkerPay) => number) => sar(rows.reduce((s, p) => s + pick(p), 0));
  if (rows.length === 0) {
    return <Typography sx={{ py: 4, textAlign: 'center', color: tokens.gray500 }}>{t('timesheets.noWorkers')}</Typography>;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('workforce.col.name')}</TableCell>
            <TableCell align="center">{t('timesheets.pay.salary')}</TableCell>
            <TableCell align="center">{t('timesheets.col.days')}</TableCell>
            <TableCell align="center">{t('timesheets.pay.due')}</TableCell>
            <TableCell align="center">{t('timesheets.col.absence')}</TableCell>
            <TableCell align="center">{t('timesheets.col.overtime')}</TableCell>
            <TableCell align="center">{t('timesheets.pay.additions')}</TableCell>
            <TableCell align="center">{t('timesheets.pay.deductions')}</TableCell>
            <TableCell align="center">{t('timesheets.pay.internal')}</TableCell>
            <TableCell align="center">{t('timesheets.col.net')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.workerId} hover>
              <TableCell sx={{ minWidth: 170 }}>
                <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                  {p.name}
                </Typography>
                <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                  {p.workerNo}
                </Typography>
              </TableCell>
              <TableCell align="center">{sar(p.paySalary)}</TableCell>
              <TableCell align="center">{sar(p.workDays)}</TableCell>
              <TableCell align="center">{sar(p.payDueSalary)}</TableCell>
              <TableCell align="center">{p.payAbsence > 0 ? `−${sar(p.payAbsence)}` : '—'}</TableCell>
              <TableCell align="center">{p.overtime > 0 ? sar(p.overtime) : '—'}</TableCell>
              <TableCell align="center">{p.clientAdditions > 0 ? sar(p.clientAdditions) : '—'}</TableCell>
              <TableCell align="center">{p.clientDeductions + p.customerLoans > 0 ? `−${sar(p.clientDeductions + p.customerLoans)}` : '—'}</TableCell>
              <TableCell align="center" sx={{ color: p.internalAdditions - p.internalDeductions < 0 ? tokens.danger : undefined }}>
                {p.internalAdditions === 0 && p.internalDeductions === 0 ? '—' : sar(p.internalAdditions - p.internalDeductions)}
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                {sar(p.net)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow sx={{ '& td': { fontWeight: 800, color: tokens.navy800, fontSize: 13 } }}>
            <TableCell>{t('timesheets.pay.total', { count: rows.length })}</TableCell>
            <TableCell />
            <TableCell align="center">{total((p) => p.workDays)}</TableCell>
            <TableCell align="center">{total((p) => p.payDueSalary)}</TableCell>
            <TableCell align="center">{total((p) => p.payAbsence)}</TableCell>
            <TableCell align="center">{total((p) => p.overtime)}</TableCell>
            <TableCell align="center">{total((p) => p.clientAdditions)}</TableCell>
            <TableCell align="center">{total((p) => p.clientDeductions + p.customerLoans)}</TableCell>
            <TableCell align="center">{total((p) => p.internalAdditions - p.internalDeductions)}</TableCell>
            <TableCell align="center">{total((p) => p.net)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
}

function AdjustDialog({ sheet, line, onClose, onChanged }: { sheet: TimesheetDetail; line: TimesheetLine; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [type, setType] = useState<AdjustmentType>('Absence');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = sheet.adjustments.filter((a) => a.workerId === line.workerId);

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('timesheets.adjustTitle', { name: line.name })}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        {mine.length > 0 && (
          <Stack spacing={0.75} sx={{ mb: 2 }}>
            {mine.map((a) => (
              <Stack key={a.id} direction="row" sx={{ alignItems: 'center', gap: 1, p: 1, borderRadius: '10px', bgcolor: tokens.gray50 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>
                    {t(`timesheets.adjustments.${a.type}`)}: {sar(a.value)} {t(`timesheets.units.${a.type}`)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>
                    {a.reason} · {a.createdByName}
                  </Typography>
                </Box>
                <IconButton size="small" disabled={busy} onClick={() => void act(() => billingApi.removeAdjustment(sheet.id, a.id))}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select sx={{ flex: 2 }} label={t('timesheets.adjustmentType')} value={type} onChange={(e) => setType(e.target.value as AdjustmentType)}>
              {adjustmentTypes.map((x) => (
                <MenuItem key={x} value={x}>
                  {t(`timesheets.adjustments.${x}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              sx={{ flex: 1 }}
              label={t(`timesheets.units.${type}`)}
              value={value}
              onChange={(e) => setValue(e.target.value.replace(type === 'FeeDays' ? /[^\d.-]/g : /[^\d.]/g, ''))}
              slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
            />
          </Stack>
          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{t(`timesheets.adjustmentHints.${type}`)}</Typography>
          <TextField label={t('timesheets.reason')} value={reason} onChange={(e) => setReason(e.target.value)} required slotProps={{ htmlInput: { maxLength: 500 } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
        <Button
          variant="contained"
          disabled={busy || !Number(value) || !reason.trim()}
          onClick={() =>
            void act(async () => {
              await billingApi.adjust(sheet.id, { workerId: line.workerId, type, value: Number(value), reason: reason.trim() });
              setValue('');
              setReason('');
            })
          }
        >
          {t('timesheets.addAdjustment')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SettingsDialog({ sheet, onClose, onSaved }: { sheet: TimesheetDetail; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState<BillingSettings>(sheet.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const num = (key: keyof BillingSettings, label: string, scale = 1) => (
    <TextField
      label={label}
      value={s[key] === null ? '' : String(Math.round(Number(s[key]) * scale * 10000) / 10000)}
      onChange={(e) => setS({ ...s, [key]: e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.]/g, '')) / scale })}
      slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
    />
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('timesheets.settings.title')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 2 }}>{t('timesheets.settings.hint', { project: sheet.projectName })}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField select label={t('timesheets.settings.cycleStartDay')} value={s.cycleStartDay} onChange={(e) => setS({ ...s, cycleStartDay: Number(e.target.value) })}>
            {Array.from({ length: 28 }, (_, n) => n + 1).map((d) => (
              <MenuItem key={d} value={d}>
                {d === 1 ? t('timesheets.settings.calendarMonth') : t('timesheets.settings.fromDay', { day: d, prev: d - 1 })}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={t('timesheets.settings.dayBasis')} value={s.dayBasis} onChange={(e) => setS({ ...s, dayBasis: e.target.value as BillingSettings['dayBasis'] })}>
            <MenuItem value="Thirty">{t('timesheets.dayBasis.Thirty')}</MenuItem>
            <MenuItem value="ActualDays">{t('timesheets.dayBasis.ActualDays')}</MenuItem>
          </TextField>
          {num('overtimeMultiplier', t('timesheets.settings.overtimeMultiplier'))}
          {num('monthlyHours', t('timesheets.settings.monthlyHours'))}
          {num('overtimeHourlyRate', t('timesheets.settings.overtimeHourlyRate'))}
          {num('maxOvertimeHours', t('timesheets.settings.maxOvertimeHours'))}
          {num('gosiRate', t('timesheets.settings.gosiRate'), 100)}
          {num('vatRate', t('timesheets.settings.vatRate'), 100)}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            billingApi
              .saveSettings(sheet.projectId, s)
              .then(onSaved)
              .catch((failure: unknown) => setError(errorKey(failure)))
              .finally(() => setBusy(false));
          }}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
