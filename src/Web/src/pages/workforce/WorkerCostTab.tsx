import Add from '@mui/icons-material/Add';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import { Alert, Box, Button, CircularProgress, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { costsApi, type CostInput, type CostOptions, type WorkerCost } from '../../api/costs';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { FieldBox, FieldSection } from '../../components/FieldSection';
import { Badge } from '../../components/ui';
import { CostDialog } from './SupplierCostsPage';

/** A worker's cost to the company: for a supplier's worker the agreed cost (its history), for the company's the salary. */
export function WorkerCostTab({ workerId, name }: { workerId: string; name: string }) {
  const { t, i18n } = useTranslation();
  const { can } = useSession();
  const ar = i18n.language === 'ar';
  const manage = can('workforce.costs.manage', true);
  const [cost, setCost] = useState<WorkerCost | null>(null);
  const [options, setOptions] = useState<CostOptions | null>(null);
  const [editing, setEditing] = useState<CostInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (v: number) => (
    <>
      {new Intl.NumberFormat(ar ? 'ar-SA-u-nu-latn' : 'en-US', { maximumFractionDigits: 2 }).format(v)}
      <Box component="small" sx={{ fontSize: 12, fontWeight: 500, color: tokens.gray500, marginInlineStart: 0.5 }}>
        {t('workforce.sar')}
      </Box>
    </>
  );

  const load = useCallback(() => {
    costsApi.worker(workerId).then(setCost).catch((f) => setError(errorKey(f)));
  }, [workerId]);
  useEffect(() => {
    load();
    costsApi.options().then(setOptions).catch(() => undefined);
  }, [load]);

  if (!can('workforce.costs.view', true)) return <Alert severity="info">{t('costs.noAccess')}</Alert>;
  if (!cost) return error ? <ErrorMessage messageKey={error} /> : <CircularProgress size={28} sx={{ m: 3 }} />;

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await costsApi.addCard(workerId, editing);
      setEditing(null);
      load();
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };

  if (cost.source !== 'Supplier') {
    return (
      <Stack spacing={2}>
        <Alert severity="info">{t(cost.source === 'Company' ? 'costs.worker.company' : 'costs.worker.unknown')}</Alert>
        <FieldSection title={t('costs.worker.companyCost')} icon={<PaidOutlinedIcon />}>
          <FieldBox label={t('costs.worker.salary')} icon={<PaidOutlinedIcon />}>
            {cost.salary !== null ? money(cost.salary) : '—'}
          </FieldBox>
          <FieldBox label={t('costs.worker.expenses')} icon={<RuleOutlinedIcon />}>
            {t('costs.worker.expensesSoon')}
          </FieldBox>
        </FieldSection>
      </Stack>
    );
  }

  return (
    <Box>
      <ErrorMessage messageKey={editing ? null : error} />
      {manage && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setEditing({ supplier: cost.supplier, professionCode: null, nationalityCode: null, monthlyCost: cost.monthlyCost ?? 0, method: cost.method ?? 'MonthlyFixed', effectiveFrom: `${new Date().toISOString().slice(0, 7)}-01`, notes: null })}
          >
            {t('costs.worker.newCard')}
          </Button>
        </Stack>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        <FieldSection title={t('costs.worker.current')} icon={<PaidOutlinedIcon />} tone="gold">
          <FieldBox label={t('costs.col.supplier')} icon={<LocalShippingOutlinedIcon />}>
            <bdi>{cost.supplier}</bdi>
          </FieldBox>
          <FieldBox label={t('costs.col.cost')} icon={<PaidOutlinedIcon />} highlight>
            {cost.monthlyCost !== null ? money(cost.monthlyCost) : <Badge tone="danger">{t('costs.source.none')}</Badge>}
          </FieldBox>
          <FieldBox label={t('costs.col.method')} icon={<RuleOutlinedIcon />}>
            {cost.method ? t(`costs.method.${cost.method}`) : '—'}
          </FieldBox>
          <FieldBox label={t('costs.col.from')} icon={<CalendarMonthOutlinedIcon />}>
            <bdi>{cost.effectiveFrom?.replaceAll('-', '/') ?? '—'}</bdi>
          </FieldBox>
          <FieldBox label={t('costs.col.source')} icon={<Inventory2OutlinedIcon />} wide>
            {cost.costSource === 'Card'
              ? t('costs.source.Card')
              : cost.package
                ? t('costs.worker.fromPackage', {
                    supplier: cost.package.supplier,
                    profession: cost.package.professionCode ? (ar ? cost.package.professionAr : cost.package.professionEn) : t('costs.any'),
                    nationality: cost.package.nationalityCode ? (ar ? cost.package.nationalityAr : cost.package.nationalityEn) : t('costs.any'),
                  })
                : t('costs.worker.noneHint')}
          </FieldBox>
        </FieldSection>
        <FieldSection title={t('costs.worker.history', { count: cost.cards.length })} icon={<CalendarMonthOutlinedIcon />} columns={1}>
          {cost.cards.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: tokens.gray500 }}>{t('costs.worker.noCards')}</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('costs.col.from')}</TableCell>
                  <TableCell>{t('costs.col.cost')}</TableCell>
                  <TableCell>{t('costs.col.method')}</TableCell>
                  <TableCell>{t('costs.worker.by')}</TableCell>
                  {manage && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {cost.cards.map((c) => (
                  <TableRow key={c.id} sx={c.current ? { bgcolor: '#FFFBEB' } : undefined}>
                    <TableCell>
                      <bdi>{c.effectiveFrom.replaceAll('-', '/')}</bdi> {c.current && <Badge tone="success">{t('costs.worker.currentBadge')}</Badge>}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{money(c.monthlyCost)}</TableCell>
                    <TableCell>{t(`costs.method.${c.method}`)}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {c.createdBy}
                      {c.notes && <Box sx={{ color: tokens.gray500 }}>{c.notes}</Box>}
                    </TableCell>
                    {manage && (
                      <TableCell>
                        <IconButton size="small" aria-label={t('costs.worker.deleteCard')} onClick={() => window.confirm(t('costs.worker.deleteConfirm')) && costsApi.deleteCard(workerId, c.id).then(load).catch((f) => setError(errorKey(f)))}>
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </FieldSection>
      </Box>
      {editing && (
        <CostDialog
          title={t('costs.cardTitle', { name })}
          input={editing}
          options={options}
          package={false}
          error={error}
          busy={busy}
          onChange={setEditing}
          onClose={() => { setEditing(null); setError(null); }}
          onSave={save}
        />
      )}
    </Box>
  );
}
