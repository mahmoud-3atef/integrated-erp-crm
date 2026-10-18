import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
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
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { paymentMethods, receivablesApi, type BankAccount, type PaymentMethod, type ProjectOpen, type ReceiptProject } from '../../api/billing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday, sar } from '../operations/delivery';

const key = (kind: string, id: string) => `${kind}:${id}`;

/** A new or returned receipt: the project, the payment, and how it pays the project's open invoices. */
export function ReceiptFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [projects, setProjects] = useState<ReceiptProject[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [receiptDate, setReceiptDate] = useState(isoToday());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('BankTransfer');
  const [accountId, setAccountId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState<ProjectOpen | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
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
        navigate(`/billing/receipts/${id}`);
      } else {
        const made = await receivablesApi.create(input);
        navigate(`/billing/receipts/${made.id}`);
      }
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography component="h1" sx={{ flex: 1, fontSize: 21, fontWeight: 800, color: tokens.navy800 }}>
          {id ? t('receipts.editTitle') : t('receipts.new')}
        </Typography>
        <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(id ? `/billing/receipts/${id}` : '/billing/receipts')}>
          {t('common.back')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800, mb: 2 }}>{t('receipts.sections.payment')}</Typography>
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
            renderInput={(params) => <TextField {...params} label={t('commercial.col.project')} required />}
          />
          <TextField type="date" label={t('receipts.col.date')} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            label={t('receipts.col.amount')}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            required
            slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
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
        </Box>
        <TextField sx={{ mt: 2 }} fullWidth label={t('receipts.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.navy800 }}>{t('receipts.sections.allocation')}</Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('receipts.allocationHint')}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<AutoFixHighOutlinedIcon />} disabled={!open || total <= 0 || items.length === 0} onClick={autoAllocate}>
            {t('receipts.autoAllocate')}
          </Button>
        </Stack>
        {loading && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
        {!projectId && <Typography sx={{ py: 3, textAlign: 'center', color: tokens.gray500 }}>{t('receipts.chooseProject')}</Typography>}
        {open && items.length === 0 && <Typography sx={{ py: 3, textAlign: 'center', color: tokens.gray500 }}>{t('receipts.nothingOpen')}</Typography>}
        {open && items.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
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
        {open && (
          <Stack direction="row" sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 3, mt: 2, fontSize: 13.5 }}>
            <span>
              {t('receipts.col.amount')}: <b>{sar(total)}</b>
            </span>
            <span>
              {t('receipts.allocated')}: <b>{sar(allocated)}</b>
            </span>
            <span style={{ color: total - allocated > 0 ? '#2b7bd9' : undefined }}>
              {t('receipts.toCredit')}: <b>{sar(Math.max(0, total - allocated))}</b>
            </span>
          </Stack>
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
      </Box>

      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" size="large" startIcon={<SaveOutlinedIcon />} disabled={busy || !valid} onClick={() => void save()}>
          {t('receipts.save')}
        </Button>
      </Stack>
    </Box>
  );
}
