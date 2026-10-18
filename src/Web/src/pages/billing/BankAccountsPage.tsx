import Add from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { receivablesApi, type BankAccount, type BankAccountInput } from '../../api/billing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PageHeader } from '../../components/ui';

const empty: BankAccountInput = { bankName: '', accountNo: '', iban: '', label: '', isActive: true };

/** The company's bank accounts that receive the customers' payments (chosen on each receipt voucher). */
export function BankAccountsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const canManage = can('billing.bank_accounts.manage', true);
  const [list, setList] = useState<BankAccount[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; input: BankAccountInput } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setList(await receivablesApi.bankAccounts());
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const input = { ...editing.input, iban: editing.input.iban || null, label: editing.input.label || null };
      if (editing.id) await receivablesApi.saveBankAccount(editing.id, input);
      else await receivablesApi.addBankAccount(input);
      setEditing(null);
      await reload();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: 'bankName' | 'accountNo' | 'iban' | 'label', label: string, ltr = false) => (
    <TextField
      label={label}
      value={editing?.input[key] ?? ''}
      onChange={(e) => editing && setEditing({ ...editing, input: { ...editing.input, [key]: e.target.value } })}
      required={key === 'bankName' || key === 'accountNo'}
      slotProps={{ htmlInput: ltr ? { dir: 'ltr' } : undefined }}
    />
  );

  return (
    <Box>
      <PageHeader
        title={t('bankAccounts.title')}
        subtitle={t('bankAccounts.intro')}
        actions={
          canManage ? (
            <Button variant="contained" startIcon={<Add />} onClick={() => setEditing({ id: null, input: empty })}>
              {t('bankAccounts.add')}
            </Button>
          ) : undefined
        }
      />
      <ErrorMessage messageKey={editing ? null : error} />
      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('bankAccounts.label')}</TableCell>
                <TableCell>{t('bankAccounts.bank')}</TableCell>
                <TableCell>{t('bankAccounts.accountNo')}</TableCell>
                <TableCell>{t('bankAccounts.iban')}</TableCell>
                <TableCell>{t('bankAccounts.status')}</TableCell>
                {canManage && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {list?.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontWeight: 700, color: tokens.navy800 }}>{a.display}</TableCell>
                  <TableCell>{a.bankName}</TableCell>
                  <TableCell dir="ltr" sx={{ textAlign: 'start' }}>
                    {a.accountNo}
                  </TableCell>
                  <TableCell dir="ltr" sx={{ textAlign: 'start' }}>
                    {a.iban ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge tone={a.isActive ? 'success' : 'neutral'}>{a.isActive ? t('bankAccounts.active') : t('bankAccounts.inactive')}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell align="left">
                      <IconButton
                        size="small"
                        onClick={() => setEditing({ id: a.id, input: { bankName: a.bankName, accountNo: a.accountNo, iban: a.iban ?? '', label: a.label ?? '', isActive: a.isActive } })}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {list && list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: tokens.gray500 }}>
                    {t('bankAccounts.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {editing && (
        <Dialog open onClose={() => setEditing(null)} fullWidth maxWidth="sm">
          <DialogTitle>{editing.id ? t('bankAccounts.edit') : t('bankAccounts.add')}</DialogTitle>
          <DialogContent dividers>
            <ErrorMessage messageKey={error} />
            <Stack spacing={2}>
              {field('bankName', t('bankAccounts.bank'))}
              {field('accountNo', t('bankAccounts.accountNo'), true)}
              {field('iban', t('bankAccounts.iban'), true)}
              {field('label', t('bankAccounts.labelHint'))}
              <FormControlLabel
                control={<Switch checked={editing.input.isActive} onChange={(e) => setEditing({ ...editing, input: { ...editing.input, isActive: e.target.checked } })} />}
                label={t('bankAccounts.active')}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button variant="contained" disabled={busy || !editing.input.bankName.trim() || !editing.input.accountNo.trim()} onClick={() => void save()}>
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
