import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
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
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { paymentMethods, receivablesApi, type BankAccount, type PaymentMethod, type ProjectOpen, type ReceiptProject } from '../../api/billing';
import { tokens } from '../../app/theme';
import { recordTones } from '../../components/RecordLayout';
import { WizardCard, WizardDialog } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';

const key = (kind: string, id: string) => `${kind}:${id}`;

/** The receipt as it fills in: a small emerald card with the payment, and how much of it goes to invoices. */
function ReceiptPreview({ amount, method, account, payer, receiptDate, allocated }: { amount: number; method: PaymentMethod; account: string | null; payer: string | null; receiptDate: string; allocated: number }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const share = amount > 0 ? Math.min(100, Math.round((allocated / amount) * 100)) : 0;
  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '20px',
          p: 2.25,
          color: '#fff',
          minHeight: 180,
          display: 'flex',
          flexDirection: 'column',
          background: recordTones.receipt.band,
          boxShadow: '0 14px 30px rgba(6,90,82,.28)',
          '&::before': { content: '""', position: 'absolute', width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.07)', top: -100, insetInlineEnd: -70 },
        }}
      >
        <Stack direction="row" sx={{ position: 'relative', alignItems: 'center', gap: 0.75, fontSize: 12.5, opacity: 0.92, '& svg': { fontSize: 17 } }}>
          {method === 'Cash' ? <PaymentsOutlinedIcon /> : <AccountBalanceOutlinedIcon />}
          {t(`receipts.method.${method}`)}
        </Stack>
        {account && <Typography sx={{ position: 'relative', fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account}</Typography>}
        <Box sx={{ position: 'relative', mt: 2 }}>
          <Typography sx={{ fontSize: 11.5, opacity: 0.8 }}>{t('receipts.received')}</Typography>
          <Typography sx={{ fontSize: 27, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
            {amount > 0 ? sar(amount) : '—'}
            <Box component="span" sx={{ fontSize: 13, opacity: 0.85, marginInlineStart: 0.75 }}>
              {t('operations.delivery.sarUnit')}
            </Box>
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" sx={{ position: 'relative', justifyContent: 'space-between', gap: 1.5, mt: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, opacity: 0.75 }}>{t('receipts.from')}</Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payer ?? '—'}</Typography>
          </Box>
          <Box sx={{ flex: '0 0 auto', textAlign: 'end' }}>
            <Typography sx={{ fontSize: 11, opacity: 0.75 }}>{t('receipts.col.date')}</Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>{receiptDate ? date(receiptDate) : '—'}</Typography>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, border: `1px solid ${tokens.gray100}`, p: 1.75 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', fontSize: 12.5, mb: 0.75 }}>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('receipts.allocatedShare')}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: recordTones.receipt.main }}>{share}%</Typography>
        </Stack>
        <Box sx={{ height: 8, borderRadius: 99, bgcolor: tokens.gray100, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${share}%`, borderRadius: 99, bgcolor: recordTones.receipt.main, transition: 'width .3s ease' }} />
        </Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1, fontSize: 12 }}>
          <Typography sx={{ fontSize: 12, color: tokens.gray600 }}>{t('receipts.allocatedOf', { amount: sar(allocated) })}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: amount - allocated > 0 ? '#b8770a' : tokens.gray500 }}>{t('receipts.leftCredit', { amount: sar(Math.max(0, amount - allocated)) })}</Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

/**
 * A new or returned receipt in one screen (it needs no steps): the payment, then how it pays the project's open
 * invoices, beside a live card of the receipt. Saved as a draft; sending it for approval is on the receipt's page.
 */
export function ReceiptDialog({
  id,
  onClose,
  onSaved,
  preset,
}: {
  id?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
  /** Opened on an invoice: its project, and the amount left on it allocated to it. */
  preset?: { projectId: string; kind: 'Invoice' | 'DebitNote'; targetId: string; amount: number };
}) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const [projects, setProjects] = useState<ReceiptProject[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [projectId, setProjectId] = useState<string | null>(preset?.projectId ?? null);
  const [receiptDate, setReceiptDate] = useState(isoToday());
  const [amount, setAmount] = useState(preset ? String(preset.amount) : '');
  const [method, setMethod] = useState<PaymentMethod>('BankTransfer');
  const [accountId, setAccountId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [open, setOpen] = useState<ProjectOpen | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>(preset ? { [key(preset.kind, preset.targetId)]: String(preset.amount) } : {});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    receivablesApi.projects().then(setProjects).catch((failure: unknown) => setError(errorKey(failure)));
    receivablesApi.bankAccounts().then((list) => setAccounts(list.filter((a) => a.isActive))).catch((failure: unknown) => setError(errorKey(failure)));
    if (id) {
      receivablesApi
        .receipt(id)
        .then((r) => {
          setReceiptNo(r.receiptNo);
          setProjectId(r.projectId);
          setReceiptDate(r.receiptDate);
          setAmount(String(r.amount));
          setMethod(r.method);
          setAccountId(r.bankAccountId ?? '');
          setReference(r.reference ?? '');
          setNotes(r.notes ?? '');
          setAllocations(Object.fromEntries(r.allocations.map((a) => [key(a.kind, a.targetId), String(a.amount)])));
        })
        .catch((failure: unknown) => setError(errorKey(failure)));
    }
  }, [id]);

  useEffect(() => {
    if (!projectId) {
      setOpen(null);
      return;
    }

    setLoading(true);
    receivablesApi
      .open(projectId, id)
      .then(setOpen)
      .catch((failure: unknown) => setError(errorKey(failure)))
      .finally(() => setLoading(false));
  }, [projectId, id]);

  const project = projects.find((p) => p.id === projectId) ?? null;
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const total = Number(amount) || 0;
  const allocated = useMemo(() => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0), [allocations]);
  const items = open?.items ?? [];
  const overItem = items.some((i) => (Number(allocations[key(i.kind, i.id)]) || 0) > i.available + 0.001);
  const valid = !!projectId && total > 0 && !!receiptDate && (method === 'Cash' || !!accountId) && allocated <= total + 0.001 && !overItem;

  // Oldest due first, until the amount runs out.
  const autoAllocate = () => {
    let left = total;
    const next: Record<string, string> = {};
    for (const i of [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
      if (left <= 0) break;
      const take = Math.min(left, i.available);
      if (take > 0) {
        next[key(i.kind, i.id)] = String(Math.round(take * 100) / 100);
        left = Math.round((left - take) * 100) / 100;
      }
    }

    setAllocations(next);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const input = {
      projectId: projectId!,
      receiptDate,
      amount: total,
      method,
      bankAccountId: accountId || null,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      allocations: items
        .map((i) => ({ kind: i.kind, targetId: i.id, amount: Number(allocations[key(i.kind, i.id)]) || 0 }))
        .filter((a) => a.amount > 0),
    };
    try {
      if (id) {
        await receivablesApi.update(id, input);
        onSaved(id);
      } else {
        onSaved((await receivablesApi.create(input)).id);
      }
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };

  return (
    <WizardDialog
      tone="receipt"
      icon={<PaymentsOutlinedIcon />}
      title={id ? `${t('receipts.editTitle')}${receiptNo ? ` ${receiptNo}` : ''}` : t('receipts.new')}
      subtitle={project ? `${project.name}${project.customerName ? ` · ${project.customerName}` : ''}` : t('receipts.dialogHint')}
      steps={[{ key: 'receipt', label: t('receipts.voucher') }]}
      step={0}
      onStep={() => undefined}
      canNext={valid}
      onClose={onClose}
      onFinish={() => void save()}
      finishLabel={t('receipts.save')}
      busy={busy}
      error={error}
      aside={<ReceiptPreview amount={total} method={method} account={method === 'Cash' ? null : (account?.display ?? null)} payer={project?.customerName ?? project?.name ?? null} receiptDate={receiptDate} allocated={allocated} />}
    >
      <WizardCard title={t('receipts.sections.payment')} icon={<PaymentsOutlinedIcon />}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2 }}>
          <Autocomplete
            options={projects}
            value={project}
            disabled={!!id}
            onChange={(_, v) => {
              setProjectId(v?.id ?? null);
              setAllocations({});
            }}
            getOptionLabel={(p) => `${p.name} (${p.code})`}
            renderOption={(props, p) => (
              <li {...props} key={p.id}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{p.customerName ?? p.code}</Typography>
                </Box>
                {p.outstanding > 0 && <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.danger }}>{sar(p.outstanding)}</Typography>}
              </li>
            )}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label={t('commercial.col.project')} required autoFocus={!id} />}
          />
          <TextField type="date" label={t('receipts.col.date')} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            label={t('receipts.col.amount')}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            required
            slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal', style: { fontWeight: 800, fontSize: 17 } } }}
          />
          <TextField select label={t('receipts.col.method')} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {paymentMethods.map((m) => (
              <MenuItem key={m} value={m}>
                {t(`receipts.method.${m}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('receipts.bankAccount')}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required={method !== 'Cash'}
            helperText={accounts.length === 0 ? t('receipts.noAccounts') : undefined}
          >
            <MenuItem value="">—</MenuItem>
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.display}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t('receipts.reference')} value={reference} onChange={(e) => setReference(e.target.value)} slotProps={{ htmlInput: { maxLength: 100, dir: 'ltr' } }} />
          <TextField sx={{ gridColumn: '1 / -1' }} label={t('receipts.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Box>
      </WizardCard>

      <WizardCard
        title={t('receipts.sections.allocation')}
        icon={<SwapVertOutlinedIcon />}
        action={
          <Button size="small" variant="outlined" startIcon={<AutoFixHighOutlinedIcon />} disabled={!open || total <= 0 || items.length === 0} onClick={autoAllocate} sx={{ color: recordTones.receipt.main, borderColor: recordTones.receipt.main }}>
            {t('receipts.autoAllocate')}
          </Button>
        }
      >
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mt: -1, mb: 1.5 }}>{t('receipts.allocationHint')}</Typography>
        {loading && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        {!projectId && <Typography sx={{ py: 3, textAlign: 'center', color: tokens.gray500 }}>{t('receipts.chooseProject')}</Typography>}
        {open && items.length === 0 && <Typography sx={{ py: 3, textAlign: 'center', color: tokens.gray500 }}>{t('receipts.nothingOpen')}</Typography>}
        {open && items.length > 0 && (
          <TableContainer sx={{ border: `1px solid ${tokens.gray100}`, borderRadius: `${tokens.radius}px` }}>
            <Table size="small">
              <TableHead
                sx={{
                  '& .MuiTableRow-root': { background: recordTones.receipt.dark },
                  '& .MuiTableCell-head, & .MuiTableCell-head:first-of-type, & .MuiTableCell-head:last-of-type': { bgcolor: 'transparent', color: '#fff', borderBottom: 0, borderRadius: 0 },
                }}
              >
                <TableRow>
                  <TableCell>{t('receipts.col.item')}</TableCell>
                  <TableCell>{t('receipts.col.due')}</TableCell>
                  <TableCell align="center">{t('receipts.col.total')}</TableCell>
                  <TableCell align="center">{t('receipts.col.outstanding')}</TableCell>
                  <TableCell align="center" sx={{ width: 170 }}>
                    {t('receipts.col.allocate')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((i) => {
                  const k = key(i.kind, i.id);
                  const over = (Number(allocations[k]) || 0) > i.available + 0.001;
                  return (
                    <TableRow key={k} hover>
                      <TableCell>
                        <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                          {i.number}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t(`receipts.kind.${i.kind}`)}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {date(i.dueDate)}
                        {i.daysOverdue > 0 && <Typography sx={{ fontSize: 11.5, color: tokens.danger }}>{t('receipts.overdue', { days: i.daysOverdue })}</Typography>}
                      </TableCell>
                      <TableCell align="center">{sar(i.total - i.credited)}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        {sar(i.available)}
                        {i.available < i.outstanding && <Typography sx={{ fontSize: 11, color: tokens.warning }}>{t('receipts.reserved', { amount: sar(i.outstanding - i.available) })}</Typography>}
                      </TableCell>
                      <TableCell align="center">
                        <TextField
                          size="small"
                          value={allocations[k] ?? ''}
                          error={over}
                          onChange={(e) => setAllocations({ ...allocations, [k]: e.target.value.replace(/[^\d.]/g, '') })}
                          slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal', style: { textAlign: 'center' } } }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {allocated > total + 0.001 && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {t('errors.validation_receipt_over_amount')}
          </Alert>
        )}
        {overItem && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {t('errors.validation_receipt_over_item')}
          </Alert>
        )}
      </WizardCard>
    </WizardDialog>
  );
}
