import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { Alert, Autocomplete, Box, Checkbox, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { transfersApi, type ProjectOption, type TransferInput, type WorkerCard, type WorkerPriceQuote } from '../../api/operations';
import { tokens } from '../../app/theme';
import { recordTones } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { WizardAside, WizardCard, WizardDialog, WizardFact } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { AvailableWorkers } from './AvailableWorkers';
import { isoToday, sar } from './delivery';
import { DateField } from '../../components/DateField';

interface Line {
  workerId: string;
  special: boolean;
  specialPrice: string;
  specialReason: string;
}

const daysAgo = (iso: string) => Math.floor((Date.parse(isoToday()) - Date.parse(iso)) / 86400000);
const onJob = { load: (orderId?: string) => transfersApi.onJobWorkers(orderId), titleKey: 'operations.transfer.picker.title', hintKey: 'operations.transfer.picker.hint' };

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((part) => /\p{L}/u.test(part))
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '·'
  );
}

/**
 * A new or returned transfer order, in four steps: the transfer (new project, date, receiver), the workers on the job,
 * their new prices, then a review before it goes for approval. Saving starts the approval (the creator confirms first).
 */
export function TransferOrderWizard({ id, onClose, onSaved }: { id?: string; onClose: () => void; onSaved: (id: string, approvalError: string | null) => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const [step, setStep] = useState(0);
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
  const late = !!transferOn && daysAgo(transferOn) > 2;
  const add = (workers: WorkerCard[]) => {
    setCards((current) => ({ ...current, ...Object.fromEntries(workers.map((w) => [w.id, w])) }));
    setLines((current) => [
      ...current,
      ...workers.filter((w) => !current.some((l) => l.workerId === w.id)).map((w) => ({ workerId: w.id, special: false, specialPrice: '', specialReason: '' })),
    ]);
  };
  const change = (workerId: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.workerId === workerId ? { ...l, ...patch } : l)));
  const remove = (workerId: string) => setLines((current) => current.filter((l) => l.workerId !== workerId));
  const toggle = (workers: WorkerCard[], on: boolean) => (on ? add(workers) : setLines((current) => current.filter((l) => !workers.some((w) => w.id === l.workerId))));
  const cardOf = (workerId: string) => quotes[workerId]?.worker ?? cards[workerId];

  const priceOf = (line: Line) => (line.special ? Number(line.specialPrice) || 0 : quotes[line.workerId]?.totalPrice ?? null);
  const total = lines.reduce((sum, l) => sum + (priceOf(l) ?? 0), 0);
  const missingPrice = lines.some((l) => !l.special && quotes[l.workerId]?.totalPrice === null);
  const sameProject = !!project && lines.some((l) => cardOf(l.workerId)?.projectCrmId === project.crmId);
  const orderReady = !!projectId && !!transferOn && (!late || delayReason.trim() !== '');
  const pricesReady = lines.every((l) => !l.special || (Number(l.specialPrice) > 0 && l.specialReason.trim() !== ''));
  const ready = [orderReady, lines.length > 0 && !sameProject, pricesReady, orderReady && lines.length > 0 && !sameProject && pricesReady];

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
      const saved = id ? await transfersApi.update(id, input) : await transfersApi.create(input);
      onSaved(saved.id, saved.approvalError);
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };

  const steps = [
    { key: 'order', label: t('operations.transfer.wizard.order') },
    { key: 'workers', label: t('operations.transfer.wizard.workers') },
    { key: 'prices', label: t('operations.transfer.wizard.prices') },
    { key: 'review', label: t('operations.transfer.wizard.review') },
  ];

  const workerCell = (workerId: string) => {
    const w = cardOf(workerId);
    const q = quotes[workerId];
    return (
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: recordTones.transfer.soft, color: recordTones.transfer.main, fontSize: 11.5, fontWeight: 800 }}>
          {initials(w?.name ?? '')}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{w?.name ?? '…'}</Typography>
          <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
            <span dir="ltr">{w?.workerNo}</span>
            {q?.busy && (
              <Box component="span" sx={{ color: tokens.danger, marginInlineStart: 1 }}>
                {t('operations.delivery.busy', { no: q.busyOrderNo })}
              </Box>
            )}
          </Typography>
        </Box>
      </Stack>
    );
  };

  return (
    <WizardDialog
      tone="transfer"
      icon={<SwapHorizIcon />}
      title={orderNo ? t('operations.transfer.editOrder', { no: orderNo }) : t('operations.transfer.new')}
      subtitle={project ? `${project.name}${project.customerName ? ` · ${project.customerName}` : ''}` : t('operations.transfer.wizard.hint')}
      steps={steps}
      step={step}
      onStep={setStep}
      canNext={ready[step] ?? false}
      onClose={onClose}
      onFinish={() => void save()}
      finishLabel={t('operations.delivery.submit')}
      busy={busy}
      error={error}
      aside={
        <WizardAside tone="transfer" title={t('operations.transfer.wizard.summary')}>
          <WizardFact icon={<ApartmentOutlinedIcon />} label={t('operations.transfer.newProject')} value={project?.name} sub={project?.customerName} />
          <WizardFact icon={<EventOutlinedIcon />} label={t('operations.transfer.col.transferOn')} value={transferOn ? date(transferOn) : null} />
          <WizardFact icon={<BadgeOutlinedIcon />} label={t('operations.transfer.receiverName')} value={receiverName.trim()} sub={receiverTitle.trim() || null} />
          <WizardFact icon={<GroupsOutlinedIcon />} label={t('operations.delivery.col.workers')} value={lines.length ? t('operations.delivery.workersCount', { count: lines.length }) : null} />
          <WizardFact icon={<PaymentsOutlinedIcon />} label={t('operations.transfer.newMonthlyTotal')} value={lines.length && projectId ? `${sar(total)} ${t('operations.delivery.sarUnit')}` : null} />
        </WizardAside>
      }
    >
      {step === 0 && (
        <WizardCard title={t('operations.transfer.sections.order')} icon={<SwapHorizIcon />}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
            <Autocomplete
              options={projects}
              value={project}
              onChange={(_, v) => setProjectId(v?.id ?? null)}
              getOptionLabel={(p) => `${p.name} (${p.code})`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label={t('operations.transfer.newProject')} required autoFocus />}
            />
            <DateField
              label={t('operations.transfer.col.transferOn')}
              value={transferOn}
              onChange={(e) => setTransferOn(e.target.value)}
              required
              helperText={t('operations.transfer.dateHint')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {project && (
              <Stack direction="row" sx={{ gridColumn: '1 / -1', flexWrap: 'wrap', gap: 2.5, px: 1.5, py: 1, borderRadius: `${tokens.radius}px`, bgcolor: recordTones.transfer.soft, fontSize: 13, color: tokens.navy700 }}>
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
        </WizardCard>
      )}

      {step === 1 && (
        <>
          {lines.length > 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {t('operations.transfer.wizard.picked', { count: lines.length })}
            </Alert>
          )}
          {sameProject && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {t('errors.validation_transfer_same_project')}
            </Alert>
          )}
          <AvailableWorkers orderId={id} onOrder={lines.map((l) => l.workerId)} onToggle={toggle} onJob={onJob} targetProjectCrmId={project?.crmId ?? null} />
        </>
      )}

      {step === 2 && (
        <WizardCard
          title={t('operations.transfer.sections.workers', { count: lines.length })}
          icon={<PaymentsOutlinedIcon />}
          action={
            <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: recordTones.transfer.soft, color: recordTones.transfer.main, fontWeight: 800, fontSize: 13 }}>
              {t('operations.transfer.newMonthlyTotal')}: {sar(total)}
            </Box>
          }
        >
          {missingPrice && <Alert severity="warning" sx={{ mb: 1.5 }}>{t('operations.delivery.missingPackage')}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('workforce.col.name')}</TableCell>
                  <TableCell>{t('commercial.prices.col.package')}</TableCell>
                  <TableCell align="center">{t('commercial.prices.col.total')}</TableCell>
                  <TableCell>{t('operations.delivery.col.specialPrice')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line) => {
                  const q = quotes[line.workerId];
                  return (
                    <TableRow key={line.workerId}>
                      <TableCell sx={{ minWidth: 190 }}>
                        {workerCell(line.workerId)}
                        <Typography sx={{ fontSize: 11.5, color: tokens.gray500, mt: 0.5 }}>
                          {t('operations.transfer.col.from')}: {cardOf(line.workerId)?.projectName ?? '—'}
                        </Typography>
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
                        <IconButton size="small" onClick={() => remove(line.workerId)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </WizardCard>
      )}

      {step === 3 && (
        <>
          <WizardCard title={t('operations.transfer.wizard.review')} icon={<FactCheckOutlinedIcon />}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
              {[
                [t('operations.transfer.newProject'), project?.name ?? '—'],
                [t('operations.transfer.col.transferOn'), date(transferOn)],
                [t('operations.transfer.receiverName'), receiverName.trim() ? (receiverTitle.trim() ? `${receiverName} — ${receiverTitle}` : receiverName) : '—'],
                [t('operations.delivery.col.workers'), t('operations.delivery.workersCount', { count: lines.length })],
                [t('operations.transfer.newMonthlyTotal'), `${sar(total)} ${t('operations.delivery.sarUnit')}`],
              ].map(([label, value]) => (
                <Box key={label} sx={{ p: 1.25, borderRadius: `${tokens.radius}px`, bgcolor: tokens.gray50, border: `1px solid ${tokens.gray100}` }}>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800 }}>{value}</Typography>
                </Box>
              ))}
            </Box>
            <Stack spacing={0.75}>
              {lines.map((line) => (
                <Stack key={line.workerId} direction="row" sx={{ alignItems: 'center', gap: 1, py: 0.75, borderBottom: `1px dashed ${tokens.gray100}` }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>{workerCell(line.workerId)}</Box>
                  {line.special && <Badge tone="warning">{t('commercial.prices.status.Special')}</Badge>}
                  <Typography sx={{ fontWeight: 800, color: tokens.navy800, minWidth: 70, textAlign: 'end' }}>{sar(priceOf(line))}</Typography>
                </Stack>
              ))}
            </Stack>
          </WizardCard>
          <Alert severity="info">{t('operations.transfer.flowHint')}</Alert>
        </>
      )}
    </WizardDialog>
  );
}
