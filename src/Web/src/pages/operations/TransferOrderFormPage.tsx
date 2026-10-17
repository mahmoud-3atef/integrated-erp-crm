import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { transfersApi, type ProjectOption, type TransferInput, type WorkerCard, type WorkerPriceQuote } from '../../api/operations';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { AvailableWorkers } from './AvailableWorkers';
import { isoToday, sar } from './delivery';

interface Line {
  workerId: string;
  special: boolean;
  specialPrice: string;
  specialReason: string;
}

const daysAgo = (iso: string) => Math.floor((Date.parse(isoToday()) - Date.parse(iso)) / 86400000);
const onJob = { load: (orderId?: string) => transfersApi.onJobWorkers(orderId), titleKey: 'operations.transfer.picker.title', hintKey: 'operations.transfer.picker.hint' };

function Section({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 2, color: tokens.navy800, '& svg': { color: tokens.navy700 } }}>
        {icon}
        <Typography sx={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

/** New or returned transfer order: the new project and the transfer date, then the workers on the job with the new project's prices. */
export function TransferOrderFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { ar, date } = useCommercialFormat();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [transferOn, setTransferOn] = useState(isoToday());
  const [receiverName, setReceiverName] = useState('');
  const [receiverTitle, setReceiverTitle] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [quotes, setQuotes] = useState<Record<string, WorkerPriceQuote>>({});
  const [cards, setCards] = useState<Record<string, WorkerCard>>({});
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    transfersApi.projects().then(setProjects).catch((failure: unknown) => setError(errorKey(failure)));
    if (id) {
      transfersApi
        .get(id)
        .then((o) => {
          setOrderNo(o.summary.orderNo);
          setProjectId(o.summary.projectId);
          setTransferOn(o.summary.transferOn);
          setReceiverName(o.receiverName ?? '');
          setReceiverTitle(o.receiverTitle ?? '');
          setDelayReason(o.delayReason ?? '');
          setNotes(o.notes ?? '');
          setLines(o.lines.map((l) => ({ workerId: l.workerId, special: l.isSpecialPrice, specialPrice: l.isSpecialPrice ? String(l.totalPrice) : '', specialReason: l.specialReason ?? '' })));
        })
        .catch((failure: unknown) => setError(errorKey(failure)));
    }
  }, [id]);

  // The new project's package price of every worker on the order, again whenever the project, the date or the workers change.
  const workerKey = lines.map((l) => l.workerId).join(',');
  useEffect(() => {
    if (!projectId || !workerKey || !transferOn) {
      setQuotes({});
      return;
    }
    let cancelled = false;
    transfersApi
      .prices(projectId, workerKey.split(','), transferOn)
      .then((list) => !cancelled && setQuotes(Object.fromEntries(list.map((q) => [q.worker.id, q]))))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)));
    return () => {
      cancelled = true;
    };
  }, [projectId, workerKey, transferOn]);

  const project = projects.find((p) => p.id === projectId) ?? null;
  const late = transferOn && daysAgo(transferOn) > 2;
  const add = (workers: WorkerCard[]) => {
    setCards((current) => ({ ...current, ...Object.fromEntries(workers.map((w) => [w.id, w])) }));
    setLines((current) => [
      ...current,
      ...workers.filter((w) => !current.some((l) => l.workerId === w.id)).map((w) => ({ workerId: w.id, special: false, specialPrice: '', specialReason: '' })),
    ]);
  };
  const change = (workerId: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.workerId === workerId ? { ...l, ...patch } : l)));
  const cardOf = (workerId: string) => quotes[workerId]?.worker ?? cards[workerId];

  const priceOf = (line: Line) => (line.special ? Number(line.specialPrice) || 0 : quotes[line.workerId]?.totalPrice ?? null);
  const total = lines.reduce((sum, l) => sum + (priceOf(l) ?? 0), 0);
  const missingPrice = lines.some((l) => !l.special && quotes[l.workerId]?.totalPrice === null);
  const sameProject = !!project && lines.some((l) => cardOf(l.workerId)?.projectCrmId === project.crmId);
  const valid = !!projectId && !!transferOn && lines.length > 0 && !sameProject && (!late || delayReason.trim() !== '');

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: TransferInput = {
      projectId: projectId!,
      transferOn,
      receiverName: receiverName.trim() || null,
      receiverTitle: receiverTitle.trim() || null,
      delayReason: late ? delayReason.trim() || null : null,
      notes: notes.trim() || null,
      lines: lines.map((l) => ({
        workerId: l.workerId,
        specialPrice: l.special && l.specialPrice ? Number(l.specialPrice) : null,
        specialReason: l.special ? l.specialReason.trim() || null : null,
      })),
    };
    try {
      // Saving starts the approval: the creator's confirmation task comes first.
      const saved = id ? await transfersApi.update(id, input) : await transfersApi.create(input);
      navigate(`/operations/transfer-orders/${saved.id}${saved.approvalError ? `?error=errors.${saved.approvalError.replace('.', '_')}` : ''}`);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 2, bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: '16px 20px', mb: `${tokens.gap}px` }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: '16px', bgcolor: tokens.navy700, color: '#fff' }}>
          <SwapHorizIcon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{orderNo ? t('operations.transfer.editOrder', { no: orderNo }) : t('operations.transfer.new')}</Typography>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 800, color: tokens.navy800 }}>
            {project?.name ?? t('operations.transfer.title')}
          </Typography>
        </Box>
        <Button startIcon={<ArrowBackIcon sx={{ transform: ar ? 'scaleX(-1)' : 'none' }} />} onClick={() => navigate(-1)}>
          {t('common.back')}
        </Button>
      </Stack>
      <ErrorMessage messageKey={error} />

      <Section title={t('operations.transfer.sections.order')} icon={<SwapHorizIcon />}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
          <Autocomplete
            options={projects}
            value={project}
            onChange={(_, v) => setProjectId(v?.id ?? null)}
            getOptionLabel={(p) => `${p.name} (${p.code})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label={t('operations.transfer.newProject')} required />}
          />
          <TextField
            type="date"
            label={t('operations.transfer.col.transferOn')}
            value={transferOn}
            onChange={(e) => setTransferOn(e.target.value)}
            required
            helperText={t('operations.transfer.dateHint')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {project && (
            <Stack direction="row" sx={{ gridColumn: '1 / -1', flexWrap: 'wrap', gap: 2.5, px: 1.5, py: 1, borderRadius: `${tokens.radius}px`, bgcolor: tokens.navy50, fontSize: 13, color: tokens.navy700 }}>
              <span>
                {t('commercial.col.customer')}: <b>{project.customerName ?? t('commercial.noCustomer')}</b>
              </span>
              <span>
                {t('commercial.col.manager')}: <b>{project.manager ?? '—'}</b>
              </span>
              <span>
                {t('commercial.col.contractType')}: <b>{project.contractType ? t(`commercial.contractType.${project.contractType}`) : '—'}</b>
              </span>
            </Stack>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, gridColumn: '1 / -1' }}>
            <TextField label={t('operations.transfer.receiverName')} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
            <TextField label={t('operations.delivery.receiverTitle')} value={receiverTitle} onChange={(e) => setReceiverTitle(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
            <TextField label={t('operations.delivery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          </Box>
          {late && (
            <TextField
              sx={{ gridColumn: '1 / -1' }}
              label={t('operations.delivery.delayReason')}
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              required
              helperText={t('operations.transfer.delayHint')}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
          )}
        </Box>
      </Section>

      <AvailableWorkers orderId={id} onOrder={lines.map((l) => l.workerId)} onAdd={add} onJob={onJob} targetProjectCrmId={project?.crmId ?? null} />

      <Section
        title={t('operations.transfer.sections.workers', { count: lines.length })}
        icon={<SwapHorizIcon />}
        action={
          lines.length > 0 ? (
            <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: tokens.navy50, color: tokens.navy700, fontWeight: 800, fontSize: 13 }}>
              {t('operations.delivery.monthlyTotal')}: {sar(total)} {t('commercial.prices.sar')}
            </Box>
          ) : undefined
        }
      >
        {!projectId && lines.length > 0 && <Alert severity="info" sx={{ mb: 1.5 }}>{t('operations.transfer.chooseProject')}</Alert>}
        {sameProject && <Alert severity="error" sx={{ mb: 1.5 }}>{t('errors.validation_transfer_same_project')}</Alert>}
        {missingPrice && <Alert severity="warning" sx={{ mb: 1.5 }}>{t('operations.delivery.missingPackage')}</Alert>}
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t('operations.transfer.flowHint')}
        </Alert>
        {lines.length === 0 ? (
          <Typography sx={{ py: 3, textAlign: 'center', color: tokens.gray500 }}>{t('operations.transfer.noLines')}</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('workforce.col.name')}</TableCell>
                  <TableCell>{t('commercial.prices.col.who')}</TableCell>
                  <TableCell>{t('operations.transfer.col.from')}</TableCell>
                  <TableCell>{t('commercial.prices.col.package')}</TableCell>
                  <TableCell align="center">{t('operations.transfer.col.newPrice')}</TableCell>
                  <TableCell>{t('operations.delivery.col.specialPrice')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line) => {
                  const q = quotes[line.workerId];
                  const w = cardOf(line.workerId);
                  return (
                    <TableRow key={line.workerId}>
                      <TableCell sx={{ minWidth: 170 }}>
                        <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                          {w?.name ?? '…'}
                        </Typography>
                        <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                          {w?.workerNo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {(ar ? w?.professionAr : w?.professionEn) ?? '—'}
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{(ar ? w?.nationalityAr : w?.nationalityEn) ?? '—'}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        {w?.projectName ?? '—'}
                        {w?.projectJoinedOn && <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('operations.transfer.since', { date: date(w.projectJoinedOn) })}</Typography>}
                      </TableCell>
                      <TableCell>
                        {q?.packageNo ? (
                          <Tooltip title={q.packageForProject ? t('operations.delivery.projectPackage') : t('commercial.prices.general')}>
                            <span>
                              <Badge tone="success">{q.packageNo}</Badge>
                            </span>
                          </Tooltip>
                        ) : q ? (
                          <Badge tone="danger">{t('commercial.prices.status.NoPackage')}</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Typography sx={{ fontWeight: 800, color: tokens.navy800 }}>{sar(priceOf(line))}</Typography>
                        {q && (
                          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                            {t('operations.delivery.breakdown', { salary: sar(q.salary), fee: q.packageNo && !line.special ? sar(q.serviceFee) : '—' })}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                          <Checkbox size="small" checked={line.special} onChange={(e) => change(line.workerId, { special: e.target.checked })} />
                          {line.special ? (
                            <Stack spacing={0.75} sx={{ flex: 1 }}>
                              <TextField
                                size="small"
                                placeholder={t('commercial.prices.col.total')}
                                value={line.specialPrice}
                                onChange={(e) => change(line.workerId, { specialPrice: e.target.value.replace(/[^\d.]/g, '') })}
                                slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal' } }}
                              />
                              <TextField size="small" placeholder={t('operations.delivery.specialReason')} value={line.specialReason} onChange={(e) => change(line.workerId, { specialReason: e.target.value })} />
                            </Stack>
                          ) : (
                            <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('operations.delivery.useSpecial')}</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => setLines((current) => current.filter((l) => l.workerId !== line.workerId))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
          <Button onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          <Button variant="contained" startIcon={<SendOutlinedIcon />} disabled={busy || !valid} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </Stack>
      </Section>
    </Box>
  );
}
