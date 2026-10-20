import CloseIcon from '@mui/icons-material/Close';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FiberNewOutlinedIcon from '@mui/icons-material/FiberNewOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { Alert, Box, Button, Chip, Drawer, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { movementApi, type ArrivalRow, type MoveRow, type Movement, type MovementDrill, type MovementList, type ReturnRow, type WaitingRow } from '../../api/reports';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Columns, RankedBars } from '../../components/charts';
import { accents, appear, card, CardTitle, Empty, Hero, Kpi, Legend, Loading, PrintStyles, ReportBar, Ticker, useFormat, useMark, usePeriodChoice } from './reportKit';

type Open = { list: MovementList; title: string; drill: MovementDrill };

/**
 * The workforce movement report (docs/03-migration-plan/14, phase B): the starts and the returns against the period
 * before, the new workers and their delivery, how long the returning workers stayed, why they came back and who waits in
 * housing; every figure comes from the server and opens the list behind it, as Excel too.
 */
export function MovementReportPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const choice = usePeriodChoice();
  const { from, to } = choice;
  const [data, setData] = useState<Movement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Open | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    movementApi.overview(from, to).then(setData).catch((f) => setError(errorKey(f)));
  }, [from, to]);

  if (!can('reports.movement.view', true)) {
    return <Alert severity="warning">{t('movement.noAccess')}</Alert>;
  }

  return (
    <Box>
      <PrintStyles />
      <ReportBar tabs={[{ key: 'moves', label: t('movement.tab'), icon: <SwapHorizOutlinedIcon /> }]} tab="moves" onTab={() => undefined} choice={choice} period={data?.period} />
      <ErrorMessage messageKey={error} />
      {data ? <Body key={`${from}-${to}`} data={data} onOpen={setOpen} /> : !error && <Loading />}
      {open && <ListDrawer from={from} to={to} {...open} onClose={() => setOpen(null)} />}
    </Box>
  );
}

function Body({ data, onOpen }: { data: Movement; onOpen: (open: Open) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const months = data.months.map((m) => f.monthName(m.month));
  const inHousing = (data.arrivals.value ?? 0) - data.arrivalsDelivered;
  return (
    <Box>
      <Hero>
        <Kpi index={0} label={t('movement.kpi.starts')} icon={<TrendingUpOutlinedIcon />} figure={data.starts} unit={t('exec.worker')} good="up" spark={data.months.map((m) => m.starts)} onClick={() => onOpen({ list: 'moves', title: t('movement.kpi.starts'), drill: { kind: 'Work' } })} />
        <Kpi index={1} label={t('movement.kpi.returns')} icon={<KeyboardReturnOutlinedIcon />} figure={data.returns} unit={t('exec.worker')} good="down" spark={data.months.map((m) => m.returns)} onClick={() => onOpen({ list: 'moves', title: t('movement.kpi.returns'), drill: { kind: 'Housing' } })} />
        <Kpi index={2} label={t('movement.kpi.arrivals')} icon={<FiberNewOutlinedIcon />} figure={data.arrivals} unit={t('exec.worker')} spark={data.months.map((m) => m.arrivals)} note={t('movement.kpi.arrivalsNote', { delivered: f.n(data.arrivalsDelivered), housing: f.n(inHousing) })} onClick={() => onOpen({ list: 'arrivals', title: t('movement.kpi.arrivals'), drill: {} })} />
        <Kpi index={3} label={t('movement.kpi.net')} icon={<SyncAltOutlinedIcon />} figure={data.net} good="up" spark={data.months.map((m) => m.starts - m.returns)} />
        <Kpi index={4} label={t('movement.kpi.stint')} icon={<TimerOutlinedIcon />} figure={data.averageStint} unit={t('movement.daysUnit')} spark={data.months.map((m) => m.averageStint)} note={t('movement.kpi.stintNote')} />
        <Kpi
          index={5}
          label={t('movement.kpi.waiting')}
          icon={<HourglassBottomOutlinedIcon />}
          value={data.waiting}
          unit={t('exec.worker')}
          note={data.oldestWaitingDays !== null ? t('movement.kpi.oldest', { days: f.n(data.oldestWaitingDays) }) : undefined}
          onClick={() => onOpen({ list: 'waiting', title: t('movement.kpi.waiting'), drill: {} })}
        />
      </Hero>
      <Summary data={data} />
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, mb: 1.75 }}>
        <Box sx={{ ...card, ...appear(0.35) }}>
          <CardTitle icon={<HistoryOutlinedIcon />} title={t('movement.months.title')} hint={t('exec.moves.hint')} />
          <Columns
            categories={months}
            series={[
              { key: 'starts', label: t('exec.moves.starts'), color: tokens.navy700 },
              { key: 'returns', label: t('exec.moves.returns'), color: accents.amber },
            ]}
            values={[data.months.map((m) => m.starts), data.months.map((m) => m.returns)]}
            onPick={(i) => onOpen({ list: 'moves', title: t('exec.drill.month', { month: f.monthLong(data.months[i]!.month) }), drill: { month: data.months[i]!.month } })}
          />
          <Legend items={[[t('exec.moves.starts'), tokens.navy700], [t('exec.moves.returns'), accents.amber]]} />
        </Box>
        <Box sx={{ ...card, ...appear(0.43) }}>
          <CardTitle icon={<ManageAccountsOutlinedIcon />} title={t('exec.managers.title')} hint={t('exec.managers.hint')} />
          {data.startsByManager.length === 0 ? (
            <Empty />
          ) : (
            <RankedBars items={data.startsByManager.slice(0, 8).map((r) => ({ key: r.key, label: r.name, value: r.count }))} onClick={(key) => onOpen({ list: 'moves', title: t('exec.drill.manager', { name: key }), drill: { manager: key, kind: 'Work' } })} />
          )}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(0, 1fr)' } }}>
        <Box sx={{ ...card, ...appear(0.51) }}>
          <CardTitle
            icon={<FiberNewOutlinedIcon />}
            title={t('movement.arrivals.title')}
            hint={t('movement.arrivals.hint', { count: f.n(data.newWorkersTotal) })}
            action={
              data.newWorkersTotal > 8 ? (
                <Button size="small" onClick={() => onOpen({ list: 'arrivals', title: t('movement.kpi.arrivals'), drill: {} })}>
                  {t('movement.showAll')}
                </Button>
              ) : undefined
            }
          />
          {data.newWorkers.length === 0 ? <Empty /> : <ArrivalsTable rows={data.newWorkers.slice(0, 8)} />}
        </Box>
        <Box sx={{ ...card, ...appear(0.59) }}>
          <CardTitle icon={<KeyboardReturnOutlinedIcon />} title={t('movement.reasons.title')} hint={t('movement.reasons.hint')} />
          {data.reasons.length === 0 ? (
            <Empty />
          ) : (
            <RankedBars
              color={accents.amber}
              items={data.reasons.map((r) => ({ key: r.key, label: t(`operations.return.reasons.${r.key}`), value: r.count }))}
              onClick={(key) => onOpen({ list: 'returns', title: t('movement.drill.reason', { reason: t(`operations.return.reasons.${key}`) }), drill: { reason: key } })}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

/** The summary for management, written from the figures. */
function Summary({ data }: { data: Movement }) {
  const { t } = useTranslation();
  const f = useFormat();
  const mark = useMark();
  const lines: string[] = [];
  const s = data.starts.value ?? 0;
  const ps = data.starts.previous;
  lines.push(ps === null ? mark('exec.ins.starts', { count: f.n(s) }) : mark(s >= ps ? 'exec.ins.startsUp' : 'exec.ins.startsDown', { count: f.n(s), diff: f.n(Math.abs(s - ps)) }));
  if (data.startsByProject[0]) lines.push(mark('movement.ins.topProject', { name: data.startsByProject[0].name, count: f.n(data.startsByProject[0].count) }));
  const r = data.returns.value ?? 0;
  const top = data.reasons[0];
  lines.push(top ? mark('movement.ins.returnsReason', { count: f.n(r), top: f.n(top.count), reason: t(`operations.return.reasons.${top.key}`) }) : mark('movement.ins.returns', { count: f.n(r) }));
  if (data.averageStint.value !== null) lines.push(mark('movement.ins.stint', { days: f.n(data.averageStint.value) }));
  const a = data.arrivals.value ?? 0;
  if (a > 0) lines.push(mark('movement.ins.arrivals', { count: f.n(a), delivered: f.n(data.arrivalsDelivered), waiting: f.n(a - data.arrivalsDelivered) }));
  if (data.waiting > 0) lines.push(mark('movement.ins.waiting', { count: f.n(data.waiting), days: f.n(data.oldestWaitingDays ?? 0) }));
  return <Ticker lines={lines} />;
}

function WorkerCell({ name, no }: { name: string; no: string }) {
  return (
    <>
      <Typography dir="auto" sx={{ fontSize: 12.5, fontWeight: 600, unicodeBidi: 'plaintext', textAlign: 'start' }}>
        {name}
      </Typography>
      <Typography sx={{ fontSize: 11, color: tokens.gray500 }}>
        <bdi>{no}</bdi>
      </Typography>
    </>
  );
}

const head = { '& th': { bgcolor: tokens.navy800, color: '#fff', fontWeight: 700 } } as const;

function ArrivalsTable({ rows, full }: { rows: ArrivalRow[]; full?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <TableContainer sx={full ? { maxHeight: 'calc(100vh - 120px)' } : undefined}>
      <Table size="small" stickyHeader={full}>
        <TableHead sx={head}>
          <TableRow>
            <TableCell>{t('exec.drill.worker')}</TableCell>
            <TableCell>{t('movement.arrivals.arrived')}</TableCell>
            <TableCell>{t('movement.arrivals.firstWork')}</TableCell>
            <TableCell>{t('exec.fin.project')}</TableCell>
            <TableCell>{t('movement.arrivals.days')}</TableCell>
            {full && <TableCell>{t('movement.arrivals.workDays')}</TableCell>}
            {full && <TableCell>{t('movement.arrivals.housingDays')}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.workerNo} hover>
              <TableCell>
                <WorkerCell name={r.name} no={r.workerNo} />
              </TableCell>
              <TableCell>
                <bdi>{f.day(r.arrivedOn)}</bdi>
              </TableCell>
              <TableCell>{r.firstWorkOn ? <bdi>{f.day(r.firstWorkOn)}</bdi> : '—'}</TableCell>
              <TableCell>{r.firstWorkOn ? (r.firstProject ?? '—') : <Chip size="small" label={t('movement.arrivals.inHousing')} sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, height: 22 }} />}</TableCell>
              <TableCell>{t('exec.daysCount', { count: r.days })}</TableCell>
              {full && <TableCell>{f.n(r.workDays)}</TableCell>}
              {full && <TableCell>{f.n(r.housingDays)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

type Rows = { list: 'moves'; rows: MoveRow[] } | { list: 'arrivals'; rows: ArrivalRow[] } | { list: 'returns'; rows: ReturnRow[] } | { list: 'waiting'; rows: WaitingRow[] };

/** The list behind a clicked figure, with its Excel. */
function ListDrawer({ from, to, list, title, drill, onClose }: Open & { from: string; to: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<Rows | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    setData(null);
    movementApi
      .list<never>(list, from, to, drill)
      .then((rows) => setData({ list, rows } as Rows))
      .catch((e) => setError(errorKey(e)));
  }, [list, from, to, drill]);
  useEffect(load, [load]);
  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', md: 760 }, p: 2 } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: tokens.navy50, color: tokens.navy700, display: 'grid', placeItems: 'center' }}>
          <EngineeringOutlinedIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800, fontSize: 16 }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 12, color: tokens.gray500 }}>{data ? t('exec.drill.count', { count: data.rows.length }) : ' '}</Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} component="a" href={movementApi.excel(list, from, to, drill)}>
          {t('exec.excel')}
        </Button>
        <IconButton onClick={onClose} aria-label={t('common.close')}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <ErrorMessage messageKey={error} />
      {!data ? !error && <LinearProgress /> : data.rows.length === 0 ? <Empty /> : <ListTable data={data} />}
    </Drawer>
  );
}

function ListTable({ data }: { data: Rows }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (data.list === 'arrivals') return <ArrivalsTable rows={data.rows} full />;
  const columns: string[] =
    data.list === 'moves'
      ? [t('exec.drill.worker'), t('exec.drill.kind'), t('exec.drill.on'), t('exec.fin.project'), t('exec.fin.manager')]
      : data.list === 'returns'
        ? [t('exec.drill.worker'), t('movement.drill.enteredOn'), t('movement.drill.reasonCol'), t('exec.fin.project'), t('exec.fin.manager'), t('movement.drill.housing')]
        : [t('exec.drill.worker'), t('movement.drill.since'), t('movement.drill.days'), t('movement.drill.lastProject'), t('exec.fin.manager'), t('movement.drill.housing')];
  const rows: { key: string; cells: ReactNode[] }[] =
    data.list === 'moves'
      ? data.rows.map((m, i) => ({ key: `${m.workerNo}-${m.on}-${i}`, cells: [<WorkerCell name={m.name} no={m.workerNo} />, t(`exec.drill.${m.kind}`), <bdi>{f.day(m.on)}</bdi>, m.project ?? '—', m.manager ?? '—'] }))
      : data.list === 'returns'
        ? data.rows.map((r, i) => ({ key: `${r.workerNo}-${r.on}-${i}`, cells: [<WorkerCell name={r.name} no={r.workerNo} />, <bdi>{f.day(r.on)}</bdi>, t(`operations.return.reasons.${r.reason}`), r.project ?? '—', r.manager ?? '—', r.housing ?? '—'] }))
        : data.rows.map((w) => ({ key: w.workerNo, cells: [<WorkerCell name={w.name} no={w.workerNo} />, <bdi>{f.day(w.since)}</bdi>, f.n(w.days), w.fromProject ?? '—', w.manager ?? '—', w.housing ?? '—'] }));
  return (
    <TableContainer sx={{ maxHeight: 'calc(100vh - 120px)' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c}>{c}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} hover>
              {r.cells.map((c, i) => (
                <TableCell key={i}>{c}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
