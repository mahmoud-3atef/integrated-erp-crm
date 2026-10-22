import Add from '@mui/icons-material/Add';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { expensesApi, type Expense, type ExpenseInput, type ExpenseList, type ExpenseProject, type ExpenseScope, type ExpenseWorker } from '../../api/expenses';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { AttachmentsDialog } from '../../components/AttachmentsDialog';
import { KpiCard } from '../../components/KpiCard';
import { Badge, PageHeader } from '../../components/ui';
import { DateField } from '../../components/DateField';

type Category = { code: string; nameAr: string; nameEn: string };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthRange = (month: string): [string, string] => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return [`${month}-01`, iso(new Date(y, m, 0))];
};

export const scopeIcon: Record<ExpenseScope, ReactNode> = {
  Project: <AccountTreeOutlinedIcon />,
  Worker: <EngineeringOutlinedIcon />,
  General: <BusinessOutlinedIcon />,
};

/**
 * The company's expenses (docs/03-migration-plan/16): on a project (its cost), a worker (their cost) or the company;
 * by month, category and whom they are charged to, with the month's totals. A cost of several months (a year's
 * residence renewal) is spread over them in the profitability.
 */
export function ExpensesPage({ workerId, compact }: { workerId?: string; compact?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const ar = i18n.language === 'ar';
  const manage = can('expenses.manage', true);
  const [month, setMonth] = useState(compact ? '' : iso(new Date()).slice(0, 7));
  const [scope, setScope] = useState<ExpenseScope | ''>('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [withCancelled, setWithCancelled] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<ExpenseList | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<ExpenseProject[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; input: ExpenseInput; worker: ExpenseWorker | null } | null>(null);
  const [cancelling, setCancelling] = useState<Expense | null>(null);
  const [files, setFiles] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const money = useMemo(() => new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [ar]);

  const load = useCallback(() => {
    setData(null);
    const [from, to] = month ? monthRange(month) : [undefined, undefined];
    expensesApi
      .list({ from, to, scope, category, search, withCancelled, workerId, page: page + 1, pageSize })
      .then(setData)
      .catch((f) => setError(errorKey(f)));
  }, [month, scope, category, search, withCancelled, workerId, page, pageSize]);
  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);
  useEffect(() => {
    expensesApi.categories().then(setCategories).catch(() => undefined);
    expensesApi.projects().then(setProjects).catch(() => undefined);
  }, []);

  if (!can('expenses.view', true)) return <Alert severity={compact ? 'info' : 'warning'}>{t('expenses.noAccess')}</Alert>;

  const name = (c: { nameAr: string; nameEn: string }) => (ar ? c.nameAr : c.nameEn);
  const blank = (): ExpenseInput => ({ spentOn: iso(new Date()), category: categories[0]?.code ?? '', workerId: workerId ?? null, projectCrmId: null, amount: 0, vat: 0, months: 1, paidTo: null, reference: null, notes: null });
  const sum = (key: ExpenseScope) => data?.byScope.find((s) => s.key === key);

  return (
    <Box>
      {!compact && (
        <PageHeader
          title={t('expenses.title')}
          subtitle={t('expenses.intro')}
          actions={
            manage ? (
              <Button variant="contained" startIcon={<Add />} onClick={() => setEditing({ id: null, input: blank(), worker: null })}>
                {t('expenses.add')}
              </Button>
            ) : undefined
          }
        />
      )}
      {compact && manage && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1.5 }}>
          <Button variant="contained" startIcon={<Add />} onClick={() => setEditing({ id: null, input: blank(), worker: null })}>
            {t('expenses.add')}
          </Button>
        </Stack>
      )}
      <ErrorMessage messageKey={editing || cancelling ? null : error} />

      {!compact && (
        <Box sx={{ display: 'grid', gap: `${tokens.gap}px`, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mt: 3.5, mb: `${tokens.gap}px` }}>
          <KpiCard label={t('expenses.kpi.total')} value={data ? money.format(data.amount) : '—'} foot={t('expenses.kpi.totalFoot', { count: data?.total ?? 0, vat: data ? money.format(data.vat) : '—' })} icon={<ReceiptLongOutlinedIcon />} tone={tokens.navy600} active={scope === ''} onClick={() => setScope('')} />
          {(['Project', 'Worker', 'General'] as ExpenseScope[]).map((k, i) => (
            <KpiCard key={k} label={t(`expenses.scope.${k}`)} value={data ? money.format(sum(k)?.amount ?? 0) : '—'} foot={t(`expenses.scopeFoot.${k}`, { count: sum(k)?.count ?? 0 })} icon={scopeIcon[k]} tone={[tokens.info, tokens.warning, tokens.gray600][i]!} active={scope === k} onClick={() => setScope(scope === k ? '' : k)} />
          ))}
        </Box>
      )}

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: compact ? 'none' : tokens.shadowSm, p: compact ? 0 : 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1, mb: 1.5, alignItems: { md: 'center' } }}>
          <TextField size="small" type="month" label={t('expenses.month')} value={month} onChange={(e) => { setMonth(e.target.value); setPage(0); }} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: { md: '0 0 180px' } }} />
          <TextField size="small" select label={t('expenses.category')} value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} sx={{ flex: { md: '0 0 220px' } }}>
            <MenuItem value="">{t('expenses.all')}</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {name(c)}
              </MenuItem>
            ))}
          </TextField>
          {!compact && (
            <TextField
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder={t('expenses.search')}
              sx={{ flex: { md: '1 1 260px' } }}
              slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) } }}
            />
          )}
          <FormControlLabel control={<Switch checked={withCancelled} onChange={(e) => setWithCancelled(e.target.checked)} />} label={t('expenses.withCancelled')} sx={{ whiteSpace: 'nowrap' }} />
        </Stack>
        {data && data.byCategory.length > 0 && !compact && (
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
            {data.byCategory.map((c) => (
              <ButtonBase key={c.key} onClick={() => setCategory(category === c.key ? '' : c.key)} sx={{ gap: 0.75, px: 1.25, py: 0.4, borderRadius: 99, border: `1px solid ${category === c.key ? tokens.navy700 : tokens.gray200}`, bgcolor: category === c.key ? tokens.navy700 : '#fff', color: category === c.key ? '#fff' : tokens.navy800, fontSize: 12.5, fontWeight: 700 }}>
                {name(c)}
                <Box component="span" sx={{ fontWeight: 800 }}>{money.format(c.amount)}</Box>
              </ButtonBase>
            ))}
          </Stack>
        )}
        {!data ? (
          <LinearProgress />
        ) : data.items.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: tokens.gray500 }}>{t('expenses.empty')}</Typography>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('expenses.col.no')}</TableCell>
                    <TableCell>{t('expenses.col.date')}</TableCell>
                    <TableCell>{t('expenses.category')}</TableCell>
                    <TableCell>{t('expenses.col.chargedTo')}</TableCell>
                    <TableCell align="right">{t('expenses.col.amount')}</TableCell>
                    <TableCell>{t('expenses.col.months')}</TableCell>
                    <TableCell>{t('expenses.col.paidTo')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((e) => (
                    <TableRow key={e.id} hover sx={e.status === 'Cancelled' ? { opacity: 0.55 } : undefined}>
                      <TableCell>
                        <bdi>{e.expenseNo}</bdi>
                        {e.status === 'Cancelled' && (
                          <Tooltip title={e.cancelReason ?? ''}>
                            <span>
                              {' '}
                              <Badge tone="danger">{t('expenses.cancelled')}</Badge>
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <bdi>{e.spentOn.replaceAll('-', '/')}</bdi>
                      </TableCell>
                      <TableCell>{ar ? e.categoryAr : e.categoryEn}</TableCell>
                      <TableCell>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, '& svg': { fontSize: 17, color: tokens.navy600 } }}>
                          {scopeIcon[e.scope]}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600 }}>
                              {e.scope === 'General' ? t('expenses.scope.General') : e.projectName ?? e.workerName}
                            </Typography>
                            {e.workerName && e.scope === 'Project' && (
                              <Typography noWrap sx={{ fontSize: 11, color: tokens.gray500 }}>
                                {e.workerName} · <bdi>{e.workerNo}</bdi>
                              </Typography>
                            )}
                            {e.scope === 'Worker' && (
                              <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
                                <bdi>{e.workerNo}</bdi>
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                        {money.format(e.amount)}
                        {e.vat > 0 && <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>{t('expenses.vatOf', { vat: money.format(e.vat) })}</Typography>}
                      </TableCell>
                      <TableCell>{e.months > 1 ? t('expenses.spread', { count: e.months }) : '—'}</TableCell>
                      <TableCell>{e.paidTo ?? '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton size="small" aria-label={t('expenses.files')} onClick={() => setFiles(e)}>
                          <AttachFileOutlinedIcon fontSize="small" />
                        </IconButton>
                        {manage && e.status === 'Active' && (
                          <>
                            <IconButton
                              size="small"
                              aria-label={t('common.edit')}
                              onClick={() =>
                                setEditing({
                                  id: e.id,
                                  input: { spentOn: e.spentOn, category: e.category, workerId: e.workerId, projectCrmId: e.projectCrmId, amount: e.amount, vat: e.vat, months: e.months, paidTo: e.paidTo, reference: e.reference, notes: e.notes },
                                  worker: e.workerId ? { id: e.workerId, workerNo: e.workerNo ?? '', name: e.workerName ?? '', projectName: null } : null,
                                })
                              }
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label={t('expenses.cancel')} onClick={() => setCancelling(e)}>
                              <BlockOutlinedIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={data.total}
              page={page}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[25, 50, 100]}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              labelRowsPerPage={t('workforce.perPage')}
              labelDisplayedRows={({ from, to, count }) => t('workforce.rows', { from, to, count })}
            />
          </>
        )}
      </Box>

      {editing && (
        <ExpenseDialog
          editing={editing}
          categories={categories}
          projects={projects}
          lockWorker={!!workerId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {cancelling && <CancelDialog expense={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); load(); }} />}
      {files && <AttachmentsDialog title={files.expenseNo} ownerType="expenses.expense" ownerId={files.id} canManage={manage && files.status === 'Active'} onClose={() => setFiles(null)} />}
    </Box>
  );
}

function ExpenseDialog({
  editing,
  categories,
  projects,
  lockWorker,
  onClose,
  onSaved,
}: {
  editing: { id: string | null; input: ExpenseInput; worker: ExpenseWorker | null };
  categories: Category[];
  projects: ExpenseProject[];
  lockWorker: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [v, setV] = useState(editing.input);
  const [worker, setWorker] = useState<ExpenseWorker | null>(editing.worker);
  const [options, setOptions] = useState<ExpenseWorker[]>(editing.worker ? [editing.worker] : []);
  const [text, setText] = useState('');
  const [chargeTo, setChargeTo] = useState<ExpenseScope>(editing.input.projectCrmId ? 'Project' : editing.input.workerId ? 'Worker' : editing.id ? 'General' : 'Project');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text.trim().length < 2) return;
    const id = setTimeout(() => expensesApi.workers(text).then(setOptions).catch(() => undefined), 250);
    return () => clearTimeout(id);
  }, [text]);

  const input: ExpenseInput = {
    ...v,
    workerId: chargeTo === 'General' ? null : worker?.id ?? v.workerId,
    projectCrmId: chargeTo === 'Project' ? v.projectCrmId : null,
  };
  const ready = input.spentOn && input.category && input.amount > 0 && (chargeTo !== 'Worker' || input.workerId) && (chargeTo !== 'Project' || input.projectCrmId);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing.id) await expensesApi.update(editing.id, input);
      else await expensesApi.create(input);
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{editing.id ? t('expenses.edit') : t('expenses.add')}</DialogTitle>
      <DialogContent>
        <ErrorMessage messageKey={error} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, mt: 1, mb: 1 }}>{t('expenses.chargeTo')}</Typography>
        <Stack direction="row" sx={{ gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {(['Project', 'Worker', 'General'] as ExpenseScope[]).map((k) => (
            <ButtonBase
              key={k}
              onClick={() => setChargeTo(k)}
              aria-pressed={chargeTo === k}
              disabled={lockWorker && k === 'General'}
              sx={{ flex: '1 1 160px', gap: 1, justifyContent: 'flex-start', p: 1.5, borderRadius: '12px', textAlign: 'start', border: `1.5px solid ${chargeTo === k ? tokens.navy700 : tokens.gray200}`, bgcolor: chargeTo === k ? tokens.navy50 : '#fff', '& svg': { color: tokens.navy700 } }}
            >
              {scopeIcon[k]}
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{t(`expenses.scope.${k}`)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t(`expenses.scopeHint.${k}`)}</Typography>
              </Box>
            </ButtonBase>
          ))}
        </Stack>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {chargeTo === 'Project' && (
            <Autocomplete
              options={projects}
              value={projects.find((p) => p.crmId === v.projectCrmId) ?? null}
              onChange={(_, p) => setV({ ...v, projectCrmId: p?.crmId ?? null })}
              getOptionLabel={(p) => `${p.name} (${p.code})`}
              isOptionEqualToValue={(a, b) => a.crmId === b.crmId}
              renderInput={(p) => <TextField {...p} label={t('expenses.project')} required />}
            />
          )}
          {chargeTo !== 'General' && (
            <Autocomplete
              options={options}
              value={worker}
              disabled={lockWorker}
              filterOptions={(x) => x}
              onInputChange={(_, value) => setText(value)}
              onChange={(_, w) => setWorker(w)}
              getOptionLabel={(w) => `${w.name} · ${w.workerNo}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={t('expenses.typeToSearch')}
              renderInput={(p) => <TextField {...p} label={chargeTo === 'Project' ? t('expenses.workerOptional') : t('expenses.worker')} required={chargeTo === 'Worker'} />}
            />
          )}
          <TextField select label={t('expenses.category')} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} required>
            {categories.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {ar ? c.nameAr : c.nameEn}
              </MenuItem>
            ))}
          </TextField>
          <DateField label={t('expenses.col.date')} value={v.spentOn} onChange={(e) => setV({ ...v, spentOn: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} required />
          <TextField type="number" label={t('expenses.amount')} value={v.amount || ''} onChange={(e) => setV({ ...v, amount: Number(e.target.value) })} required slotProps={{ htmlInput: { min: 0, step: 0.01 }, input: { endAdornment: <InputAdornment position="end">{t('workforce.sar')}</InputAdornment> } }} />
          <TextField type="number" label={t('expenses.vat')} value={v.vat || ''} onChange={(e) => setV({ ...v, vat: Number(e.target.value) })} slotProps={{ htmlInput: { min: 0, step: 0.01 }, input: { endAdornment: <InputAdornment position="end">{t('workforce.sar')}</InputAdornment> } }} />
          <TextField type="number" label={t('expenses.months')} value={v.months} onChange={(e) => setV({ ...v, months: Math.max(1, Math.min(36, Number(e.target.value) || 1)) })} helperText={v.months > 1 ? t('expenses.monthsHelpSpread', { count: v.months, share: (v.amount / v.months).toFixed(2) }) : t('expenses.monthsHelp')} slotProps={{ htmlInput: { min: 1, max: 36 } }} />
          <TextField label={t('expenses.col.paidTo')} value={v.paidTo ?? ''} onChange={(e) => setV({ ...v, paidTo: e.target.value || null })} slotProps={{ htmlInput: { maxLength: 200 } }} />
          <TextField label={t('expenses.reference')} value={v.reference ?? ''} onChange={(e) => setV({ ...v, reference: e.target.value || null })} slotProps={{ htmlInput: { maxLength: 100, dir: 'ltr' } }} />
          <TextField label={t('expenses.notes')} value={v.notes ?? ''} onChange={(e) => setV({ ...v, notes: e.target.value || null })} multiline minRows={2} sx={{ gridColumn: '1 / -1' }} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Box>
        <Typography sx={{ fontSize: 12, color: tokens.gray500, mt: 1.5 }}>{t('expenses.filesHint')}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={busy || !ready}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CancelDialog({ expense, onClose, onDone }: { expense: Expense; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{t('expenses.cancelTitle', { no: expense.expenseNo })}</DialogTitle>
      <DialogContent>
        <ErrorMessage messageKey={error} />
        <TextField autoFocus fullWidth multiline minRows={2} label={t('expenses.cancelReason')} value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} slotProps={{ htmlInput: { maxLength: 500 } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.back')}</Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await expensesApi.cancel(expense.id, reason.trim());
              onDone();
            } catch (f) {
              setError(errorKey(f));
              setBusy(false);
            }
          }}
        >
          {t('expenses.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
