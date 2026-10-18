import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoModeOutlinedIcon from '@mui/icons-material/AutoModeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { adjustmentTypes, billingApi, invoiceApi, type AdjustmentType, type BillingSettings, type TimesheetDetail, type TimesheetLine, type WorkerPay } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { PillTabs } from '../../components/ui';
import { ApprovalBar, ApprovalLog, useRecordApproval } from '../../components/workflow/RecordApproval';
import { RunProcessButton } from '../../components/workflow/RunProcessButton';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from '../operations/delivery';
import { ExcelUploadDialog } from './ExcelUploadDialog';
import { InvoiceStatusBadge } from './invoices';
import { SourceBadge, TimesheetStatusBadge } from './timesheets';
import { useCrumb } from '../../app/breadcrumbs';

type Tab = 'workers' | 'invoice' | 'payroll' | 'suppliers' | 'unknown' | 'approval';

function Tile({ label, value, tone = tokens.navy800, foot }: { label: string; value: ReactNode; tone?: string; foot?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50 }}>
      <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{label}</Typography>
      <Typography sx={{ fontSize: 19, fontWeight: 800, color: tone, lineHeight: 1.3 }}>{value}</Typography>
      {foot && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{foot}</Typography>}
    </Box>
  );
}

/** One project's timesheet for a cycle: its workers, the adjustments, and the invoice, payroll and supplier statements it makes. */
export function TimesheetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [sheet, setSheet] = useState<TimesheetDetail | null>(null);
  useCrumb(sheet?.timesheetNo);
  const [tab, setTab] = useState<Tab>('workers');
  const [adjusting, setAdjusting] = useState<TimesheetLine | null>(null);
  const [settings, setSettings] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const workers = new Set(sheet.lines.map((l) => l.workerId)).size;
  const days = sheet.lines.reduce((s, l) => s + l.workDays, 0);
  const payroll = sheet.payroll.reduce((s, p) => s + p.net, 0);
  const suppliers = sheet.suppliers.reduce((s, p) => s + p.net, 0);
  const noPrice = sheet.lines.filter((l) => l.totalPrice <= 0);
  const canRun = (!sheet.awaitingApproval && sheet.canEdit) || approval.detail?.summary.status === 'Failed';
  const monthName = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(sheet.month));

  return (
    <Box>
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>
              {t('timesheets.timesheetOf', { month: monthName })} · <b dir="ltr">{sheet.timesheetNo}</b>
            </Typography>
            <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>
              {sheet.projectName}
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.gray600 }}>
              {t('commercial.col.customer')}: {sheet.customerName ?? '—'} · {t('commercial.col.contractType')}: {sheet.contractType ? t(`commercial.contractType.${sheet.contractType}`) : '—'} ·{' '}
              {t('timesheets.cycle', { from: date(sheet.from), to: date(sheet.to) })} · {t(`timesheets.dayBasis.${sheet.dayBasis}`)}
            </Typography>
          </Box>
          <Stack sx={{ alignItems: { md: 'flex-end' }, gap: 0.75 }}>
            <TimesheetStatusBadge status={sheet.status} />
            <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('timesheets.generatedBy', { name: sheet.generatedByName, at: new Date(sheet.generatedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) })}</Typography>
          </Stack>
          <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(`/billing/timesheets?month=${sheet.month}`)}>
            {t('common.back')}
          </Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', xl: 'repeat(7, 1fr)' }, gap: 1.25, mt: 2 }}>
          <Tile label={t('timesheets.tiles.workers')} value={workers} foot={t('timesheets.tiles.days', { days: sar(days) })} />
          <Tile label={t('timesheets.tiles.amount')} value={sar(sheet.invoice.amount)} />
          <Tile label={t('timesheets.tiles.vat')} value={sar(sheet.invoice.vat)} />
          <Tile label={t('timesheets.tiles.total')} value={sar(sheet.invoice.total)} tone={tokens.teal} />
          <Tile label={t('timesheets.tiles.payroll')} value={sar(payroll)} foot={t('timesheets.tiles.workersCount', { count: sheet.payroll.length })} />
          <Tile label={t('timesheets.tiles.suppliers')} value={sar(suppliers)} foot={t('timesheets.tiles.suppliersCount', { count: sheet.suppliers.length })} />
          <Tile label={t('timesheets.tiles.unknown')} value={sheet.unknownSource.length} tone={sheet.unknownSource.length > 0 ? tokens.warning : tokens.gray500} />
        </Box>

        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.25, mt: 2 }}>
          {sheet.canEdit && (
            <Button variant="outlined" startIcon={<AutoModeOutlinedIcon />} disabled={busy} onClick={() => void run(() => billingApi.generate(sheet.projectId, sheet.month))}>
              {t('timesheets.regenerate')}
            </Button>
          )}
          {sheet.canSubmit && (
            <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy || noPrice.length > 0} onClick={() => void run(() => billingApi.submit(sheet.id))}>
              {t('timesheets.submit')}
            </Button>
          )}
          {sheet.canInvoice && (
            <Button
              variant="contained"
              startIcon={<ReceiptLongOutlinedIcon />}
              disabled={busy}
              onClick={() =>
                void (async () => {
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
                })()
              }
            >
              {t('invoices.makeFromTimesheet')}
            </Button>
          )}
          {sheet.invoiceDoc && (
            <Button variant="outlined" startIcon={<ReceiptLongOutlinedIcon />} onClick={() => navigate(`/billing/invoices/${sheet.invoiceDoc!.id}`)}>
              {t('invoices.openInvoice', { number: sheet.invoiceDoc.invoiceNo ?? t('invoices.noNumber') })}
              <Box component="span" sx={{ marginInlineStart: 1 }}>
                <InvoiceStatusBadge status={sheet.invoiceDoc.status} />
              </Box>
            </Button>
          )}
          {canRun && (
            <RunProcessButton screen="billing.timesheet" recordId={sheet.id} title={`${sheet.timesheetNo} — ${sheet.projectName}`} onStarted={() => void reload().then(() => approval.reload())} />
          )}
          <Button startIcon={<FileDownloadOutlinedIcon />} component="a" href={`/api/v1/billing/timesheets/${sheet.id}/excel`} download>
            {t('timesheets.excel.download')}
          </Button>
          {sheet.canEdit && (
            <Button startIcon={<UploadFileOutlinedIcon />} onClick={() => setUploading(true)}>
              {t('timesheets.excel.upload')}
            </Button>
          )}
          <Button startIcon={<SettingsOutlinedIcon />} onClick={() => setSettings(true)}>
            {t('timesheets.settings.title')}
          </Button>
        </Stack>
      </Box>
      <ErrorMessage messageKey={error} />
      {noPrice.length > 0 && (
        <Alert severity="error" sx={{ mb: `${tokens.gap}px` }}>
          {t('timesheets.noPrice', { workers: noPrice.map((l) => l.workerNo).join('، ') })}
        </Alert>
      )}
      {sheet.status === 'Approved' && (
        <Alert severity="success" sx={{ mb: `${tokens.gap}px` }}>
          {t('timesheets.approvedHint', { name: sheet.approvedByName ?? '—' })}
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
          onChanged={() => {
            void approval.reload();
            void reload();
          }}
        />
      )}

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }}>
        <PillTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'workers', label: t('timesheets.tabs.workers', { count: sheet.lines.length }) },
            { value: 'invoice', label: t('timesheets.tabs.invoice') },
            { value: 'payroll', label: t('timesheets.tabs.payroll', { count: sheet.payroll.length }) },
            { value: 'suppliers', label: t('timesheets.tabs.suppliers', { count: sheet.suppliers.length }) },
            ...(sheet.unknownSource.length > 0 ? [{ value: 'unknown' as const, label: t('timesheets.tabs.unknown', { count: sheet.unknownSource.length }) }] : []),
            ...(sheet.approval ? [{ value: 'approval' as const, label: t('operations.delivery.tabs.approval') }] : []),
          ]}
        />
        {tab === 'workers' && <WorkersTab sheet={sheet} onAdjust={setAdjusting} />}
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
        {tab === 'approval' && sheet.approval && <ApprovalLog status={sheet.approval} detail={approval.detail} />}
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

function Hint({ text }: { text: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5, fontSize: 12.5, color: tokens.gray500 }}>
      <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      {text}
    </Stack>
  );
}

function WorkersTab({ sheet, onAdjust }: { sheet: TimesheetDetail; onAdjust: (line: TimesheetLine) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  const adjustments = (workerId: string) => sheet.adjustments.filter((a) => a.workerId === workerId).length;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('workforce.col.name')}</TableCell>
            <TableCell>{t('timesheets.col.source')}</TableCell>
            <TableCell>{t('timesheets.col.period')}</TableCell>
            <TableCell align="center">{t('timesheets.col.days')}</TableCell>
            <TableCell align="center">{t('timesheets.col.price')}</TableCell>
            <TableCell align="center">{t('timesheets.col.absence')}</TableCell>
            <TableCell align="center">{t('timesheets.col.overtime')}</TableCell>
            <TableCell align="center">{t('timesheets.col.invoice')}</TableCell>
            <TableCell align="center">{t('timesheets.col.net')}</TableCell>
            {sheet.canEdit && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {sheet.lines.map((l) => (
            <TableRow key={l.id} hover>
              <TableCell sx={{ minWidth: 180, cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${l.workerId}?tab=periods`)}>
                <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                  {l.name}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                  <span dir="ltr">{l.workerNo}</span> · {(ar ? l.professionAr : l.professionEn) ?? '—'}
                </Typography>
              </TableCell>
              <TableCell>
                <SourceBadge source={l.source} supplier={l.supplierName} />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
                {date(l.lineFrom)} – {date(l.lineTo)}
                <Typography dir="ltr" sx={{ fontSize: 11, color: tokens.gray500, textAlign: 'start' }}>
                  {l.sourceNo}
                  {l.fromOldSystem && ` · ${t('workforce.periods.oldSystem')}`}
                </Typography>
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {sar(l.workDays)}
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                {l.totalPrice > 0 ? sar(l.totalPrice) : <Typography sx={{ color: tokens.danger, fontSize: 12.5, fontWeight: 700 }}>{t('timesheets.noPriceShort')}</Typography>}
                <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>{t('operations.delivery.breakdown', { salary: sar(l.billSalary), fee: sar(Math.max(0, l.totalPrice - l.billSalary)) })}</Typography>
              </TableCell>
              <TableCell align="center">{l.absenceDays > 0 ? `${sar(l.absenceDays)} (−${sar(l.absenceAmount)})` : '—'}</TableCell>
              <TableCell align="center">{l.overtimeHours > 0 ? `${sar(l.overtimeHours)} (${sar(l.overtime)})` : '—'}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                {sar(l.invoiceAmount)}
              </TableCell>
              <TableCell align="center">{sar(l.workerNet)}</TableCell>
              {sheet.canEdit && (
                <TableCell>
                  <Tooltip title={t('timesheets.adjust')}>
                    <IconButton size="small" onClick={() => onAdjust(l)}>
                      <EditNoteOutlinedIcon fontSize="small" />
                      {adjustments(l.workerId) > 0 && (
                        <Box component="span" sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.navy700, marginInlineStart: '2px' }}>
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
              <TableCell colSpan={10} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                {t('timesheets.noLines')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
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
