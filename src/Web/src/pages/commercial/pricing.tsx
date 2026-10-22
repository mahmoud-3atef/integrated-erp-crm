import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { commercialApi, type Option, type PackageInput, type PackageOptions, type PackageRow, type Suggestion, type WorkerPrice, type WorkerPriceStatus } from '../../api/commercial';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, type Tone } from '../../components/ui';
import { useCommercialFormat } from './ProjectsPage';
import { DateField } from '../../components/DateField';

const statusTone: Record<WorkerPriceStatus, Tone> = { Package: 'success', Special: 'warning', NoPackage: 'info', Missing: 'danger' };

export const money = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().slice(0, 10);

/** "Housing 200 · Transport 100" under a price, when the price has those parts. */
function PriceParts({ housing, transport }: { housing: number; transport: number }) {
  const { t } = useTranslation();
  const parts = [housing ? `${t('commercial.prices.col.housing')} ${money(housing)}` : null, transport ? `${t('commercial.prices.col.transport')} ${money(transport)}` : null].filter(Boolean);
  return parts.length ? <Typography sx={{ fontSize: 11.5, color: tokens.gray500, whiteSpace: 'nowrap' }}>{parts.join(' · ')}</Typography> : null;
}

/** Profession over nationality, in one cell. */
function Who({ profession, nationality }: { profession: string | null; nationality: string | null }) {
  return (
    <>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.navy800 }}>{profession ?? '—'}</Typography>
      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{nationality ?? '—'}</Typography>
    </>
  );
}

function PackageState({ row }: { row: PackageRow }) {
  const { t } = useTranslation();
  const now = today();
  const [tone, key]: [Tone, string] = !row.isActive
    ? ['neutral', 'stopped']
    : row.isCurrent
      ? ['success', 'current']
      : row.validFrom > now
        ? ['info', 'upcoming']
        : ['neutral', 'ended'];
  return <Badge tone={tone}>{t(`commercial.prices.state.${key}`)}</Badge>;
}

/** The price packages: who they price, the amounts, validity and the workers on them; edit and stop when allowed. */
export function PackagesTable({
  rows,
  showProject,
  onEdit,
  onToggle,
}: {
  rows: PackageRow[];
  showProject?: boolean;
  onEdit?: (row: PackageRow) => void;
  onToggle?: (row: PackageRow) => void;
}) {
  const { t } = useTranslation();
  const { ar, date } = useCommercialFormat();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('commercial.prices.col.package')}</TableCell>
            {showProject && <TableCell>{t('commercial.prices.col.scope')}</TableCell>}
            <TableCell>{t('commercial.prices.col.who')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.salary')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.serviceFee')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.total')}</TableCell>
            <TableCell>{t('commercial.prices.col.validity')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.onPackage')}</TableCell>
            <TableCell>{t('commercial.prices.col.state')}</TableCell>
            {(onEdit || onToggle) && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} hover sx={{ opacity: r.isActive ? 1 : 0.6 }}>
              <TableCell dir="ltr" sx={{ fontWeight: 700, color: tokens.navy800, textAlign: 'start', whiteSpace: 'nowrap' }}>
                {r.packageNo}
              </TableCell>
              {showProject && (
                <TableCell sx={{ minWidth: 150, maxWidth: 220 }}>
                  {r.projectId ? (
                    <>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{r.projectName}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{r.customerName ?? t('commercial.noCustomer')}</Typography>
                    </>
                  ) : (
                    <Badge tone="primary">{t('commercial.prices.general')}</Badge>
                  )}
                </TableCell>
              )}
              <TableCell>
                <Who profession={ar ? r.professionAr : r.professionEn} nationality={(ar ? r.nationalityAr : r.nationalityEn) ?? t('commercial.prices.anyNationality')} />
              </TableCell>
              <TableCell align="center">{money(r.salary)}</TableCell>
              <TableCell align="center">{money(r.serviceFee)}</TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                <Typography component="span" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                  {money(r.totalPrice)}
                </Typography>
                <PriceParts housing={r.housing} transport={r.transport} />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
                {date(r.validFrom)}
                <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{r.validTo ? `← ${date(r.validTo)}` : t('commercial.prices.openEnded')}</Typography>
              </TableCell>
              <TableCell align="center">{r.workers > 0 ? <Badge tone="success">{r.workers}</Badge> : '—'}</TableCell>
              <TableCell>
                <PackageState row={r} />
              </TableCell>
              {(onEdit || onToggle) && (
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {onEdit && (
                    <Tooltip title={t('common.edit')}>
                      <IconButton size="small" onClick={() => onEdit(r)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {onToggle && (
                    <Tooltip title={t(r.isActive ? 'commercial.prices.stop' : 'commercial.prices.activate')}>
                      <IconButton size="small" onClick={() => onToggle(r)}>
                        {r.isActive ? <PauseCircleOutlineIcon fontSize="small" /> : <PlayCircleOutlineIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Packages suggested from the old system's prices, with "create package" (prefilled) when no package covers them yet. */
export function SuggestionsTable({ rows, showProject, onCreate }: { rows: Suggestion[]; showProject?: boolean; onCreate?: (row: Suggestion) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar } = useCommercialFormat();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showProject && <TableCell>{t('commercial.col.project')}</TableCell>}
            <TableCell>{t('commercial.prices.col.who')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.currentPrice')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.salary')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.atPrice')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.otherPrices')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.missing')}</TableCell>
            <TableCell>{t('commercial.prices.col.state')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} hover>
              {showProject && (
                <TableCell sx={{ minWidth: 200, cursor: 'pointer' }} onClick={() => navigate(`/commercial/projects/${r.projectId}?tab=packages`)}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{r.projectName}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{r.customerName ?? t('commercial.noCustomer')}</Typography>
                </TableCell>
              )}
              <TableCell>
                <Who profession={ar ? r.professionAr : r.professionEn} nationality={ar ? r.nationalityAr : r.nationalityEn} />
              </TableCell>
              <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                <Typography component="span" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                  {r.feeAboveSalary !== null ? t('commercial.prices.salaryPlus', { fee: money(r.feeAboveSalary) }) : money(r.totalPrice)}
                </Typography>
                <PriceParts housing={r.housing} transport={r.transport} />
              </TableCell>
              <TableCell align="center">{money(r.salary)}</TableCell>
              <TableCell align="center">
                <Badge tone="success">{r.workers}</Badge>
              </TableCell>
              <TableCell align="center">{r.otherPrices > 0 ? <Badge tone="warning">{r.otherPrices}</Badge> : '—'}</TableCell>
              <TableCell align="center">{r.withoutPrice > 0 ? <Badge tone="danger">{r.withoutPrice}</Badge> : '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {r.coveredByNo ? (
                  <Badge tone="success">{t('commercial.prices.coveredBy', { no: r.coveredByNo })}</Badge>
                ) : onCreate && r.professionCode ? (
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onCreate(r)}>
                    {t('commercial.prices.createFromSuggestion')}
                  </Button>
                ) : (
                  <Badge tone="neutral">{t('commercial.prices.noPackageYet')}</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Workers' current prices in the old system (as its "تحديث سعر الخدمة" page), compared with the package that applies to them. */
export function WorkerPricesTable({ rows, showProject }: { rows: WorkerPrice[]; showProject?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ar, date } = useCommercialFormat();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('workforce.col.name')}</TableCell>
            {showProject && <TableCell>{t('commercial.col.project')}</TableCell>}
            <TableCell>{t('commercial.prices.col.who')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.salary')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.servicePrice')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.packagePrice')}</TableCell>
            <TableCell align="center">{t('commercial.prices.col.difference')}</TableCell>
            <TableCell>{t('commercial.prices.col.state')}</TableCell>
            <TableCell>{t('commercial.prices.col.workStart')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((w) => (
            <TableRow key={w.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/workforce/workers/${w.workerId}`)}>
              <TableCell sx={{ minWidth: 180 }}>
                <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                  {w.name}
                </Typography>
                <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                  {w.workerNo}
                </Typography>
              </TableCell>
              {showProject && <TableCell sx={{ minWidth: 180 }}>{w.projectName}</TableCell>}
              <TableCell>
                <Who profession={ar ? w.professionAr : w.professionEn} nationality={ar ? w.nationalityAr : w.nationalityEn} />
              </TableCell>
              <TableCell align="center">{money(w.salary)}</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: tokens.navy800 }}>
                {w.fromWorkerDefault ? (
                  <Tooltip title={t('commercial.prices.fromWorkerDefault')}>
                    <Box component="span" sx={{ borderBottom: `1px dashed ${tokens.gray500}` }}>
                      {money(w.servicePrice)}
                    </Box>
                  </Tooltip>
                ) : (
                  money(w.servicePrice)
                )}
                <PriceParts housing={w.housing} transport={w.transport} />
              </TableCell>
              <TableCell align="center">
                {money(w.packagePrice)}
                {w.packageNo && (
                  <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                    {w.packageNo}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="center" dir="ltr" sx={{ fontWeight: 700, color: !w.difference ? tokens.gray500 : w.difference > 0 ? '#1f9d55' : tokens.danger }}>
                {w.difference ? `${w.difference > 0 ? '+' : ''}${money(w.difference)}` : '—'}
              </TableCell>
              <TableCell>
                <Badge tone={statusTone[w.status]}>{t(`commercial.prices.status.${w.status}`)}</Badge>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Typography dir="ltr" sx={{ fontSize: 12.5, textAlign: 'start' }}>
                  {w.workStartNo ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{date(w.startedOn)}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** What a new package starts with: from a suggestion, or a project's page. */
export interface PackageDraft {
  projectId?: string | null;
  professionCode?: string | null;
  nationalityCode?: string | null;
  salary?: number;
  serviceFee?: number;
  housing?: number;
  transport?: number;
}

/** A new package's amounts from a suggestion: the old price split into salary, fee, housing and transport. */
export function draftFromSuggestion(s: Suggestion): PackageDraft {
  const above = s.feeAboveSalary ?? s.totalPrice - s.salary;
  return {
    projectId: s.projectId,
    professionCode: s.professionCode,
    nationalityCode: s.nationalityCode,
    salary: s.salary,
    serviceFee: Math.max(0, above - s.housing - s.transport),
    housing: s.housing,
    transport: s.transport,
  };
}

const optionLabel = (ar: boolean) => (o: Option) => `${ar ? o.nameAr : o.nameEn}${o.code ? ` (${o.code})` : ''}`;

/** Add or edit a package: who it prices (project or general, profession, nationality or any), its amounts and validity. */
export function PackageDialog({ package: edited, draft, onClose, onSaved }: { package?: PackageRow; draft?: PackageDraft; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { ar } = useCommercialFormat();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [options, setOptions] = useState<PackageOptions | null>(null);
  const [found, setFound] = useState<Option[]>([]);
  const [general, setGeneral] = useState(edited ? edited.projectId === null : draft ? !draft.projectId : false);
  const [projectId, setProjectId] = useState<string | null>(edited?.projectId ?? draft?.projectId ?? null);
  const [profession, setProfession] = useState<string | null>(edited?.professionCode ?? draft?.professionCode ?? null);
  const [nationality, setNationality] = useState<string | null>(edited?.nationalityCode ?? draft?.nationalityCode ?? null);
  const [salary, setSalary] = useState(String(edited?.salary ?? draft?.salary ?? ''));
  const [fee, setFee] = useState(String(edited?.serviceFee ?? draft?.serviceFee ?? ''));
  const [housing, setHousing] = useState(String(edited?.housing ?? draft?.housing ?? 0));
  const [housingBillable, setHousingBillable] = useState(edited?.housingBillable ?? false);
  const [transport, setTransport] = useState(String(edited?.transport ?? draft?.transport ?? 0));
  const [transportBillable, setTransportBillable] = useState(edited?.transportBillable ?? false);
  const [validFrom, setValidFrom] = useState(edited?.validFrom ?? today());
  const [validTo, setValidTo] = useState(edited?.validTo ?? '');
  const [notes, setNotes] = useState(edited?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    commercialApi.priceOptions().then(setOptions).catch((failure: unknown) => setError(errorKey(failure)));
  }, []);

  const num = (value: string) => (value.trim() === '' ? 0 : Number(value));
  const total = num(salary) + num(fee) + num(housing) + num(transport);
  const professions = useMemo(() => {
    const all = [...(options?.professions ?? []), ...found];
    return all.filter((o, i) => all.findIndex((x) => x.code === o.code) === i);
  }, [options, found]);
  const project = options?.projects.find((p) => p.id === projectId) ?? null;
  const valid = !!profession && (general || !!projectId) && total > 0 && [salary, fee, housing, transport].every((v) => num(v) >= 0 && !Number.isNaN(num(v)));

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: PackageInput = {
      projectId: general ? null : projectId,
      professionCode: profession!,
      nationalityCode: nationality,
      salary: num(salary),
      serviceFee: num(fee),
      housing: num(housing),
      housingBillable,
      transport: num(transport),
      transportBillable,
      validFrom,
      validTo: validTo || null,
      notes: notes.trim() || null,
    };
    try {
      await (edited ? commercialApi.updatePackage(edited.id, input) : commercialApi.createPackage(input));
      onSaved();
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  const amount = (label: string, value: string, set: (v: string) => void, helper?: string) => (
    <TextField
      label={label}
      value={value}
      onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ''))}
      helperText={helper}
      slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' }, input: { endAdornment: <InputAdornment position="end">{t('commercial.prices.sar')}</InputAdornment> } }}
      fullWidth
    />
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={phone}>
      <DialogTitle>{edited ? `${t('common.edit')} — ${edited.packageNo}` : t('commercial.prices.new')}</DialogTitle>
      <DialogContent dividers>
        <ErrorMessage messageKey={error} />
        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, mb: 0.5 }}>{t('commercial.prices.scope')}</Typography>
            <RadioGroup row value={general ? 'general' : 'project'} onChange={(e) => setGeneral(e.target.value === 'general')}>
              <FormControlLabel value="project" control={<Radio />} label={t('commercial.prices.forProject')} />
              <FormControlLabel value="general" control={<Radio />} label={t('commercial.prices.forAllProjects')} />
            </RadioGroup>
            {!general && (
              <Autocomplete
                options={options?.projects ?? []}
                value={project}
                onChange={(_, v) => setProjectId(v?.id ?? null)}
                getOptionLabel={(p) => `${p.name} (${p.code})`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(params) => <TextField {...params} label={t('commercial.col.project')} required />}
              />
            )}
            {!general && project?.contractType === 'CostPlus' && (
              <Alert severity="info" sx={{ mt: 1 }}>
                {t('commercial.prices.costPlusHint')}
              </Alert>
            )}
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Autocomplete
              fullWidth
              options={professions}
              value={professions.find((o) => o.code === profession) ?? null}
              onChange={(_, v) => setProfession(v?.code ?? null)}
              onInputChange={(_, text, reason) => {
                if (reason === 'input' && text.trim().length >= 2) {
                  commercialApi.priceOptions(text.trim()).then((o) => setFound(o.professions)).catch(() => undefined);
                }
              }}
              getOptionLabel={optionLabel(ar)}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              renderInput={(params) => <TextField {...params} label={t('workforce.col.profession')} required helperText={t('commercial.prices.professionHint')} />}
            />
            <Autocomplete
              fullWidth
              options={[{ code: '', nameAr: t('commercial.prices.anyNationality'), nameEn: t('commercial.prices.anyNationality') }, ...(options?.nationalities ?? [])]}
              value={nationality ? (options?.nationalities.find((o) => o.code === nationality) ?? null) : { code: '', nameAr: t('commercial.prices.anyNationality'), nameEn: t('commercial.prices.anyNationality') }}
              onChange={(_, v) => setNationality(v?.code ? v.code : null)}
              getOptionLabel={(o) => (o.code ? optionLabel(ar)(o) : o.nameAr)}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              renderInput={(params) => <TextField {...params} label={t('workforce.col.nationality')} />}
            />
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {amount(t('commercial.prices.col.salary'), salary, setSalary)}
            {amount(t('commercial.prices.col.serviceFee'), fee, setFee, t('commercial.prices.feeHint'))}
            <Box>
              {amount(t('commercial.prices.col.housing'), housing, setHousing)}
              <FormControlLabel control={<Switch size="small" checked={housingBillable} onChange={(e) => setHousingBillable(e.target.checked)} />} label={t('commercial.prices.billable')} />
            </Box>
            <Box>
              {amount(t('commercial.prices.col.transport'), transport, setTransport)}
              <FormControlLabel control={<Switch size="small" checked={transportBillable} onChange={(e) => setTransportBillable(e.target.checked)} />} label={t('commercial.prices.billable')} />
            </Box>
          </Box>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50 }}>
            <Typography sx={{ fontWeight: 700, color: tokens.navy700 }}>{t('commercial.prices.col.total')}</Typography>
            <Typography dir="ltr" sx={{ fontSize: 20, fontWeight: 800, color: tokens.navy800 }}>
              {money(total)} {t('commercial.prices.sar')}
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <DateField label={t('commercial.prices.validFrom')} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} fullWidth required slotProps={{ inputLabel: { shrink: true } }} />
            <DateField
              label={t('commercial.prices.validTo')}
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              fullWidth
              helperText={t('commercial.prices.validToHint')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
          <TextField label={t('commercial.prices.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || !valid || !validFrom}>
          {busy ? t('common.loading') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
