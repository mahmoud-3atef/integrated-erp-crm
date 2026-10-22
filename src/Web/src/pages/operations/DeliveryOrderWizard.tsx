import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { Alert, Autocomplete, Box, Checkbox, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { operationsApi, type DeliveryInput, type ProjectOption, type WorkerCard, type WorkerPriceQuote } from '../../api/operations';
import { tokens } from '../../app/theme';
import { recordTones } from '../../components/RecordLayout';
import { Badge } from '../../components/ui';
import { WizardAside, WizardCard, WizardDialog, WizardFact } from '../../components/WizardDialog';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { AvailableWorkers } from './AvailableWorkers';
import { isoToday, sar } from './delivery';

/** The least monthly service price a worker can have (as the server checks it). */
const minimumPrice = 1000;
import { DateField } from '../../components/DateField';

interface Line {
  workerId: string;
  startOn: string;
  special: boolean;
  specialPrice: string;
  specialReason: string;
}

const daysAgo = (iso: string) => Math.floor((Date.parse(isoToday()) - Date.parse(iso)) / 86400000);

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
 * A new or returned delivery order, in four steps: the order (project, dates, receiver), the workers, their prices and
 * start dates, then a review before it goes for approval. Saving starts the approval (the creator confirms first).
 */
export function DeliveryOrderWizard({ id, initialWorkerIds, onClose, onSaved }: { id?: string; initialWorkerIds?: string[]; onClose: () => void; onSaved: (id: string, approvalError: string | null) => void }) {
  const { t } = useTranslation();
  const { date } = useCommercialFormat();
  const [step, setStep] = useState(0);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [deliverOn, setDeliverOn] = useState(isoToday());
  const [startOn, setStartOn] = useState(isoToday());
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
    operationsApi.projects().then(setProjects).catch((failure: unknown) => setError(errorKey(failure)));
    if (id) {
      operationsApi
        .get(id)
        .then((o) => {
          setOrderNo(o.summary.orderNo);
          setProjectId(o.summary.projectId);
          setDeliverOn(o.summary.deliverOn ?? isoToday());
          setStartOn(o.summary.startOn ?? isoToday());
          setReceiverName(o.summary.receiverName);
          setReceiverTitle(o.receiverTitle ?? '');
          setDelayReason(o.delayReason ?? '');
          setNotes(o.notes ?? '');
          setLines(
            o.lines
              .filter((l) => l.workerId)
              .map((l) => ({ workerId: l.workerId!, startOn: l.startOn ?? o.summary.startOn ?? '', special: l.isSpecialPrice, specialPrice: l.isSpecialPrice ? String(l.totalPrice) : '', specialReason: l.specialReason ?? '' })),
          );
        })
        .catch((failure: unknown) => setError(errorKey(failure)));
    }
  }, [id]);

  // The package price of every worker on the order, again whenever the project, the date or the workers change.
  const workerKey = lines.map((l) => l.workerId).join(',');
  useEffect(() => {
    if (!projectId || !workerKey) {
      setQuotes({});
      return;
    }
    let cancelled = false;
    operationsApi
      .prices(projectId, workerKey.split(','), startOn || deliverOn, id)
      .then((list) => !cancelled && setQuotes(Object.fromEntries(list.map((q) => [q.worker.id, q]))))
      .catch((failure: unknown) => !cancelled && setError(errorKey(failure)));
    return () => {
      cancelled = true;
    };
  }, [projectId, workerKey, startOn, deliverOn, id]);

  // Workers chosen in the showroom start the new order.
  const initial = (initialWorkerIds ?? []).join(',');
  useEffect(() => {
    if (id || !initial) return;
    operationsApi
      .availableWorkers()
      .then((list) => {
        const ids = initial.split(',');
        add(list.filter((a) => ids.includes(a.worker.id) && !a.busyOrderNo).map((a) => a.worker));
      })
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [id, initial]);

  const project = projects.find((p) => p.id === projectId) ?? null;
  const late = !!deliverOn && daysAgo(deliverOn) > 2;
  const add = (workers: WorkerCard[]) => {
    setCards((current) => ({ ...current, ...Object.fromEntries(workers.map((w) => [w.id, w])) }));
    setLines((current) => [
      ...current,
      ...workers.filter((w) => !current.some((l) => l.workerId === w.id)).map((w) => ({ workerId: w.id, startOn, special: false, specialPrice: '', specialReason: '' })),
    ]);
  };
  const toggle = (workers: WorkerCard[], on: boolean) => (on ? add(workers) : setLines((current) => current.filter((l) => !workers.some((w) => w.id === l.workerId))));
  // The order's start moves the workers' starts that followed it.
  const changeStart = (value: string) => {
    setLines((current) => current.map((l) => (!l.startOn || l.startOn === startOn ? { ...l, startOn: value } : l)));
    setStartOn(value);
  };
  const change = (workerId: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.workerId === workerId ? { ...l, ...patch } : l)));
  const remove = (workerId: string) => setLines((current) => current.filter((l) => l.workerId !== workerId));
  const cardOf = (workerId: string) => quotes[workerId]?.worker ?? cards[workerId];

  const priceOf = (line: Line) => (line.special ? Number(line.specialPrice) || 0 : quotes[line.workerId]?.totalPrice ?? null);
  const total = lines.reduce((sum, l) => sum + (priceOf(l) ?? 0), 0);
  const missingPrice = lines.some((l) => !l.special && quotes[l.workerId]?.totalPrice === null);
  const orderReady = !!projectId && !!deliverOn && !!startOn && startOn >= deliverOn && receiverName.trim() !== '' && (!late || delayReason.trim() !== '');
  // Every worker has a service price (the package's, or a special one with its reason) and a start on or after the delivery.
  const priceProblem = (l: Line) => {
    const price = priceOf(l);
    if (price === null || price <= 0) return 'none';
    if (price < minimumPrice) return 'minimum';
    if (l.special && l.specialReason.trim() === '') return 'reason';
    return null;
  };
  const startProblem = (l: Line) => !l.startOn || l.startOn < deliverOn;
  const pricesReady = lines.length > 0 && lines.every((l) => priceProblem(l) === null && !startProblem(l));
  const ready = [orderReady, lines.length > 0, pricesReady, orderReady && lines.length > 0 && pricesReady];

  const save = async () => {
    setBusy(true);
    setError(null);
    const input: DeliveryInput = {
      projectId: projectId!,
      deliverOn,
      startOn,
      receiverName,
      receiverTitle: receiverTitle.trim() || null,
      delayReason: late ? delayReason.trim() || null : null,
      notes: notes.trim() || null,
      lines: lines.map((l) => ({
        workerId: l.workerId,
        startOn: l.startOn && l.startOn !== startOn ? l.startOn : null,
        specialPrice: l.special && l.specialPrice ? Number(l.specialPrice) : null,
        specialReason: l.special ? l.specialReason.trim() || null : null,
      })),
    };
    try {
      const saved = id ? await operationsApi.update(id, input) : await operationsApi.create(input);
      onSaved(saved.id, saved.approvalError);
    } catch (failure) {
      setError(errorKey(failure));
      setBusy(false);
    }
  };

  const steps = [
    { key: 'order', label: t('operations.delivery.wizard.order') },
    { key: 'workers', label: t('operations.delivery.wizard.workers') },
    { key: 'prices', label: t('operations.delivery.wizard.prices') },
    { key: 'review', label: t('operations.delivery.wizard.review') },
  ];

  const workerCell = (workerId: string) => {
    const w = cardOf(workerId);
    const q = quotes[workerId];
    return (
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
        <Box sx={{ flex: '0 0 auto', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: recordTones.delivery.soft, color: recordTones.delivery.main, fontSize: 11.5, fontWeight: 800 }}>
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
      tone="delivery"
      icon={<LocalShippingOutlinedIcon />}
      title={orderNo ? t('operations.delivery.editOrder', { no: orderNo }) : t('operations.delivery.new')}
      subtitle={project ? `${project.name}${project.customerName ? ` · ${project.customerName}` : ''}` : t('operations.delivery.wizard.hint')}
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
        <WizardAside tone="delivery" title={t('operations.delivery.summaryTitle')}>
          <WizardFact icon={<ApartmentOutlinedIcon />} label={t('commercial.col.project')} value={project?.name} sub={project?.customerName} />
          <WizardFact icon={<EventOutlinedIcon />} label={t('operations.delivery.col.deliverOn')} value={deliverOn ? date(deliverOn) : null} sub={startOn ? `${t('operations.delivery.col.startOn')}: ${date(startOn)}` : null} />
          <WizardFact icon={<BadgeOutlinedIcon />} label={t('operations.delivery.receiverName')} value={receiverName.trim()} sub={receiverTitle.trim() || null} />
          <WizardFact icon={<GroupsOutlinedIcon />} label={t('operations.delivery.col.workers')} value={lines.length ? t('operations.delivery.workersCount', { count: lines.length }) : null} />
          <WizardFact icon={<PaymentsOutlinedIcon />} label={t('operations.delivery.monthlyTotal')} value={lines.length && projectId ? `${sar(total)} ${t('operations.delivery.sarUnit')}` : null} />
        </WizardAside>
      }
    >
      {step === 0 && (
        <WizardCard title={t('operations.delivery.sections.order')} icon={<LocalShippingOutlinedIcon />}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2 }}>
            <Autocomplete
              options={projects}
              value={project}
              onChange={(_, v) => setProjectId(v?.id ?? null)}
              getOptionLabel={(p) => `${p.name} (${p.code})`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label={t('commercial.col.project')} required autoFocus />}
            />
            <DateField label={t('operations.delivery.col.deliverOn')} value={deliverOn} onChange={(e) => setDeliverOn(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} />
            <DateField
              label={t('operations.delivery.col.startOn')}
              value={startOn}
              onChange={(e) => changeStart(e.target.value)}
              required
              error={!!startOn && !!deliverOn && startOn < deliverOn}
              helperText={startOn && deliverOn && startOn < deliverOn ? t('errors.validation_delivery_start_before') : undefined}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {project && (
              <Stack direction="row" sx={{ gridColumn: '1 / -1', flexWrap: 'wrap', gap: 2.5, px: 1.5, py: 1, borderRadius: `${tokens.radius}px`, bgcolor: recordTones.delivery.soft, fontSize: 13, color: tokens.navy700 }}>
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
            <TextField label={t('operations.delivery.receiverName')} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} required slotProps={{ htmlInput: { maxLength: 200 } }} />
            <TextField label={t('operations.delivery.receiverTitle')} value={receiverTitle} onChange={(e) => setReceiverTitle(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
            <TextField label={t('operations.delivery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
            {late && (
              <TextField
                sx={{ gridColumn: '1 / -1' }}
                label={t('operations.delivery.delayReason')}
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                required
                helperText={t('operations.delivery.delayHint')}
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
              {t('operations.delivery.wizard.picked', { count: lines.length })}
            </Alert>
          )}
          <AvailableWorkers orderId={id} onOrder={lines.map((l) => l.workerId)} onToggle={toggle} />
        </>
      )}

      {step === 2 && (
        <WizardCard
          title={t('operations.delivery.sections.workers', { count: lines.length })}
          icon={<PaymentsOutlinedIcon />}
          action={
            <Box sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: recordTones.delivery.soft, color: recordTones.delivery.main, fontWeight: 800, fontSize: 13 }}>
              {t('operations.delivery.monthlyTotal')}: {sar(total)}
            </Box>
          }
        >
          {missingPrice && <Alert severity="error" sx={{ mb: 1.5 }}>{t('operations.delivery.missingPackage')}</Alert>}
          {!pricesReady && !missingPrice && lines.length > 0 && <Alert severity="warning" sx={{ mb: 1.5 }}>{t('operations.delivery.pricesNeeded')}</Alert>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('workforce.col.name')}</TableCell>
                  <TableCell>{t('commercial.prices.col.package')}</TableCell>
                  <TableCell align="center">{t('commercial.prices.col.total')}</TableCell>
                  <TableCell>{t('operations.delivery.col.specialPrice')}</TableCell>
                  <TableCell>{t('operations.delivery.col.workerStart')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line) => {
                  const q = quotes[line.workerId];
                  return (
                    <TableRow key={line.workerId}>
                      <TableCell sx={{ minWidth: 190 }}>{workerCell(line.workerId)}</TableCell>
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
                        <Typography sx={{ fontWeight: 800, color: priceProblem(line) ? tokens.danger : tokens.navy800 }}>{sar(priceOf(line))}</Typography>
                        {priceProblem(line) && (
                          <Typography sx={{ fontSize: 11.5, color: tokens.danger }}>{t(`operations.delivery.priceProblem.${priceProblem(line)}`)}</Typography>
                        )}
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
                        <DateField
                          size="small"
                          value={line.startOn}
                          required
                          error={startProblem(line)}
                          onChange={(e) => change(line.workerId, { startOn: e.target.value })}
                          helperText={startProblem(line) ? t('errors.validation_delivery_start_before') : line.startOn === startOn ? t('operations.delivery.sameAsOrder') : undefined}
                          sx={{ width: 150 }}
                          slotProps={{ inputLabel: { shrink: true } }}
                        />
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
          <WizardCard title={t('operations.delivery.wizard.review')} icon={<FactCheckOutlinedIcon />}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
              {[
                [t('commercial.col.project'), project?.name ?? '—'],
                [t('operations.delivery.col.deliverOn'), date(deliverOn)],
                [t('operations.delivery.col.startOn'), date(startOn)],
                [t('operations.delivery.receiverName'), receiverTitle.trim() ? `${receiverName} — ${receiverTitle}` : receiverName],
                [t('operations.delivery.col.workers'), t('operations.delivery.workersCount', { count: lines.length })],
                [t('operations.delivery.monthlyTotal'), `${sar(total)} ${t('operations.delivery.sarUnit')}`],
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
          <Alert severity="info">{t('operations.delivery.flowHint')}</Alert>
        </>
      )}
    </WizardDialog>
  );
}
