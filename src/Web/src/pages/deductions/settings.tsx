import Add from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Box,
  Button,
  Checkbox,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { deductionsApi, penaltyEffects, sar, type DeductionSettings, type DeductionSetup, type EmployeeDeductions, type PenaltyEffect, type PenaltyType } from '../../api/deductions';
import { useCrumb } from '../../app/breadcrumbs';
import { useSession } from '../../app/session';
import { ErrorMessage } from '../../auth/AuthLayout';
import { HrPageHeader, HrScope, HrStatusBadge, hr, hrCard } from '../../components/hr/Hr';
import { AdvanceDialog, AdvancesTable, type Person } from './advances';
import { PenaltiesTable, PenaltyDialog } from './penalties';

function NumberField({ label, value, onChange, unit, disabled }: { label: string; value: number; onChange: (v: number) => void; unit: string; disabled: boolean }) {
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      slotProps={{ htmlInput: { min: 0, step: 'any', dir: 'ltr' }, input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } }}
    />
  );
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Box sx={{ ...(hrCard as object), p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5, color: hr.text, '& svg': { color: hr.primary, fontSize: 20 } }}>
        {icon}
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>{children}</Box>
    </Box>
  );
}

/** A penalty type of the company's own, or one of the four renamed or stopped. */
function TypeDialog({ type, onClose, onSaved }: { type: PenaltyType | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [nameAr, setNameAr] = useState(type?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(type?.nameEn ?? '');
  const [effect, setEffect] = useState<PenaltyEffect>(type?.effect ?? 'DeductDays');
  const [active, setActive] = useState(type?.isActive ?? true);
  const [order, setOrder] = useState(type?.sortOrder ?? 10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await deductionsApi.saveType(type?.id ?? null, { nameAr: nameAr.trim(), nameEn: nameEn.trim() || null, effect, isActive: active, sortOrder: order });
      onSaved();
    } catch (f) {
      setError(errorKey(f));
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <HrScope>
        <DialogTitle sx={{ fontWeight: 700 }}>{type ? t('deductions.types.edit') : t('deductions.types.new')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: '8px !important' }}>
          <TextField size="small" required label={t('deductions.types.nameAr')} value={nameAr} onChange={(e) => setNameAr(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <TextField size="small" label={t('deductions.types.nameEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} slotProps={{ htmlInput: { maxLength: 100, dir: 'ltr' } }} />
          <TextField select size="small" label={t('deductions.types.effect')} value={effect} onChange={(e) => setEffect(e.target.value as PenaltyEffect)}>
            {penaltyEffects.map((x) => (
              <MenuItem key={x} value={x}>
                {t(`deductions.effects.${x}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="number" label={t('deductions.types.order')} value={order} onChange={(e) => setOrder(Number(e.target.value))} slotProps={{ htmlInput: { dir: 'ltr' } }} />
          <FormControlLabel control={<Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} />} label={t('deductions.types.active')} />
          <ErrorMessage messageKey={error} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" disabled={busy || !nameAr.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
          <Button disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </HrScope>
    </Dialog>
  );
}

/** The advance conditions, the legal penalty limits, the month's cap, and the penalty types. */
export function DeductionSettingsPage() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const { can } = useSession();
  const editable = can('deductions.settings', true);
  const [setup, setSetup] = useState<DeductionSetup | null>(null);
  const [s, setS] = useState<DeductionSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PenaltyType | null | 'new'>(null);
  useCrumb(t('deductions.settings.pageTitle'));
  const load = useCallback(() => {
    deductionsApi
      .setup()
      .then((x) => (setSetup(x), setS(x.settings), setError(null)))
      .catch((f) => setError(errorKey(f)));
  }, []);
  useEffect(load, [load]);
  if (!setup || !s) {
    return (
      <HrScope>
        <ErrorMessage messageKey={error} />
        {!error && <LinearProgress />}
      </HrScope>
    );
  }
  const set = <K extends keyof DeductionSettings>(k: K, v: DeductionSettings[K]) => (setS({ ...s, [k]: v }), setSaved(false));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await deductionsApi.saveSettings(s);
      setSaved(true);
    } catch (f) {
      setError(errorKey(f));
    } finally {
      setBusy(false);
    }
  };
  const percent = '%';
  const days = t('deductions.settings.daysUnit');
  return (
    <HrScope>
      <HrPageHeader
        icon={<SettingsOutlinedIcon />}
        title={t('deductions.settings.pageTitle')}
        subtitle={t('deductions.settings.intro')}
        actions={
          <>
            {editable && (
              <Button variant="contained" disabled={busy} onClick={() => void save()}>
                {saved ? t('deductions.settings.saved') : t('common.save')}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ArrowBackIcon sx={{ transform: (th) => (th.direction === 'rtl' ? 'scaleX(-1)' : 'none') }} />} onClick={() => navigate(-1)}>
              {t('common.back')}
            </Button>
          </>
        }
      />
      <ErrorMessage messageKey={error} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Card icon={<CreditCardOutlinedIcon />} title={t('deductions.settings.advances')}>
          <NumberField label={t('deductions.settings.advanceCap')} unit={percent} value={s.advanceCapPercent} onChange={(v) => set('advanceCapPercent', v)} disabled={!editable} />
          <NumberField label={t('deductions.settings.maxMonths')} unit={t('deductions.settings.monthsUnit')} value={s.advanceMaxMonths} onChange={(v) => set('advanceMaxMonths', v)} disabled={!editable} />
          <NumberField label={t('deductions.settings.minService')} unit={t('deductions.settings.monthsUnit')} value={s.advanceMinServiceMonths} onChange={(v) => set('advanceMinServiceMonths', v)} disabled={!editable} />
          <Box />
          <FormControlLabel control={<Checkbox disabled={!editable} checked={s.advanceAfterProbation} onChange={(e) => set('advanceAfterProbation', e.target.checked)} />} label={t('deductions.settings.afterProbation')} />
          <FormControlLabel control={<Checkbox disabled={!editable} checked={s.advanceOneOpen} onChange={(e) => set('advanceOneOpen', e.target.checked)} />} label={t('deductions.settings.oneOpen')} />
        </Card>
        <Card icon={<BalanceOutlinedIcon />} title={t('deductions.settings.limits')}>
          <NumberField label={t('deductions.settings.perViolation')} unit={days} value={s.penaltyMaxDaysPerViolation} onChange={(v) => set('penaltyMaxDaysPerViolation', v)} disabled={!editable} />
          <NumberField label={t('deductions.settings.perMonth')} unit={days} value={s.penaltyMaxDaysPerMonth} onChange={(v) => set('penaltyMaxDaysPerMonth', v)} disabled={!editable} />
          <NumberField label={t('deductions.settings.suspension')} unit={days} value={s.suspensionMaxDaysPerMonth} onChange={(v) => set('suspensionMaxDaysPerMonth', v)} disabled={!editable} />
          <NumberField label={t('deductions.settings.monthlyCap')} unit={percent} value={s.monthlyCapPercent} onChange={(v) => set('monthlyCapPercent', v)} disabled={!editable} />
          <Typography sx={{ gridColumn: '1 / -1', fontSize: 12, color: hr.textMuted }}>{t('deductions.settings.capNote')}</Typography>
        </Card>
      </Box>
      <Box sx={{ ...(hrCard as object), p: 2, mt: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700 }}>{t('deductions.types.title')}</Typography>
          {editable && (
            <Button variant="outlined" startIcon={<Add />} onClick={() => setEditing('new')}>
              {t('deductions.types.new')}
            </Button>
          )}
        </Stack>
        <TableContainer sx={{ border: `1px solid ${hr.border}`, borderRadius: '10px' }}>
          <Table size="small" sx={{ '& td': { height: 44 }, '& th': { bgcolor: '#F8FAFC', fontWeight: 700 } }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('deductions.types.name')}</TableCell>
                <TableCell>{t('deductions.types.effect')}</TableCell>
                <TableCell>{t('deductions.cols.status')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {setup.penaltyTypes.map((x) => (
                <TableRow key={x.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{ar ? x.nameAr : x.nameEn}</TableCell>
                  <TableCell>{t(`deductions.effects.${x.effect}`)}</TableCell>
                  <TableCell>
                    {x.isActive ? <HrStatusBadge label={t('deductions.types.activeBadge')} color={hr.success} tint="#D1FAE5" /> : <HrStatusBadge label={t('deductions.types.stopped')} color={hr.textMuted} tint={hr.muted} />}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'end' }}>
                    {editable && (
                      <IconButton size="small" aria-label={t('common.edit')} onClick={() => setEditing(x)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      {editing && (
        <TypeDialog
          type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </HrScope>
  );
}

/** The employee file's «advances and penalties» tab: open advances, warnings, the year's penalty days and their lists. */
export function EmployeeDeductionsPanel({ employee }: { employee: Person }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const [data, setData] = useState<EmployeeDeductions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'advance' | 'Penalty' | 'Other'>(null);
  useEffect(() => {
    deductionsApi
      .employee(employee.id)
      .then(setData)
      .catch((f) => setError(errorKey(f)));
  }, [employee.id]);
  if (!can('deductions.view', true)) return <Typography sx={{ fontSize: 13, color: hr.textMuted }}>{t('deductions.noAccess')}</Typography>;
  if (!data) return error ? <ErrorMessage messageKey={error} /> : <LinearProgress />;
  const cards: [string, string, string][] = [
    [t('deductions.profile.open'), `${sar(data.openAdvances)} ${t('deductions.sar')}`, '#F5F3FF'],
    [t('deductions.profile.warnings'), String(data.warnings), '#FFFBEB'],
    [t('deductions.profile.days'), sar(data.penaltyDaysThisYear), '#FFF1F2'],
  ];
  return (
    <HrScope>
      <Stack sx={{ gap: 1.75 }}>
        {can('deductions.manage', true) && (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialog('advance')}>
              {t('deductions.advance.new')}
            </Button>
            <Button variant="outlined" onClick={() => setDialog('Penalty')}>
              {t('deductions.penalty.new')}
            </Button>
            <Button variant="outlined" onClick={() => setDialog('Other')}>
              {t('deductions.other.new')}
            </Button>
          </Stack>
        )}
        <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {cards.map(([l, v, tint]) => (
            <Box key={l} sx={{ border: `1px solid ${hr.border}`, borderRadius: '12px', p: 1.5, bgcolor: tint }}>
              <Typography sx={{ fontWeight: 700 }}>{l}</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                <bdi>{v}</bdi>
              </Typography>
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontWeight: 700 }}>{t('deductions.profile.advances')}</Typography>
        <AdvancesTable rows={data.advances} showEmployee={false} onOpen={(id) => navigate(`/hr/advances/${id}`)} />
        <Typography sx={{ fontWeight: 700 }}>{t('deductions.profile.penalties')}</Typography>
        <PenaltiesTable rows={data.penalties} showEmployee={false} onOpen={(id) => navigate(`/hr/penalties/${id}`)} />
      </Stack>
      {dialog === 'advance' && <AdvanceDialog employee={employee} onClose={() => setDialog(null)} onSent={(id) => navigate(`/hr/advances/${id}`)} />}
      {(dialog === 'Penalty' || dialog === 'Other') && <PenaltyDialog category={dialog} employee={employee} onClose={() => setDialog(null)} onSent={(id) => navigate(`/hr/penalties/${id}`)} />}
    </HrScope>
  );
}
