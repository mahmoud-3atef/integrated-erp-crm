import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Checkbox,
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
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { operationsApi, type AvailableWorker, type WorkerCard } from '../../api/operations';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge, PillTabs } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { sar } from './delivery';

type Place = 'all' | 'Housing' | 'New';

/**
 * The workers that can be delivered (in housing or new), listed at once: filter by text (or several numbers),
 * status, profession and nationality, tick them, and add them to the order.
 */
export function AvailableWorkers({ orderId, onOrder, onAdd }: { orderId?: string; onOrder: string[]; onAdd: (workers: WorkerCard[]) => void }) {
  const { t } = useTranslation();
  const { ar } = useCommercialFormat();
  const [workers, setWorkers] = useState<AvailableWorker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [place, setPlace] = useState<Place>('all');
  const [profession, setProfession] = useState('');
  const [nationality, setNationality] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    operationsApi
      .availableWorkers(orderId)
      .then(setWorkers)
      .catch((failure: unknown) => setError(errorKey(failure)));
  }, [orderId]);

  const name = (a: string | null, e: string | null) => (ar ? a : e) ?? '—';
  const options = (key: (w: AvailableWorker) => [string | null, string | null, string | null]) => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const w of workers ?? []) {
      const [code, a, e] = key(w);
      const id = code ?? '';
      const entry = counts.get(id) ?? { label: code ? name(a, e) : '—', count: 0 };
      entry.count++;
      counts.set(id, entry);
    }
    return [...counts.entries()].sort((x, y) => y[1].count - x[1].count);
  };
  const professions = options((w) => [w.worker.professionCode, w.worker.professionAr, w.worker.professionEn]);
  const nationalities = options((w) => [w.worker.nationalityCode, w.worker.nationalityAr, w.worker.nationalityEn]);

  const shown = useMemo(() => {
    const tokens = text.split(/[\s,،;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
    return (workers ?? []).filter(({ worker: w }) => {
      if (place !== 'all' && w.placement !== place) return false;
      if (profession && (w.professionCode ?? '') !== profession) return false;
      if (nationality && (w.nationalityCode ?? '') !== nationality) return false;
      if (tokens.length > 1) return tokens.includes(w.workerNo.toUpperCase()) || (!!w.iqamaNo && tokens.includes(w.iqamaNo.toUpperCase()));
      if (tokens.length === 1) {
        const q = tokens[0]!;
        return [w.workerNo, w.name, w.iqamaNo, w.professionAr, w.professionEn, w.nationalityAr, w.nationalityEn].some((v) => v?.toUpperCase().includes(q));
      }
      return true;
    });
  }, [workers, text, place, profession, nationality]);

  const selectable = shown.filter((w) => !w.busyOrderNo && !onOrder.includes(w.worker.id));
  const allPicked = selectable.length > 0 && selectable.every((w) => picked.includes(w.worker.id));
  const counts = { all: workers?.length ?? 0, Housing: workers?.filter((w) => w.worker.placement === 'Housing').length ?? 0, New: workers?.filter((w) => w.worker.placement === 'New').length ?? 0 };
  const filtered = text || place !== 'all' || profession || nationality;

  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.5, color: tokens.navy800, '& svg': { color: tokens.navy700 } }}>
        <GroupAddOutlinedIcon />
        <Typography sx={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{t('operations.delivery.available.title', { count: counts.all })}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: tokens.gray500, mb: 2 }}>{t('operations.delivery.availableHint')}</Typography>
      <ErrorMessage messageKey={error} />

      <PillTabs
        value={place}
        onChange={setPlace}
        options={[
          { value: 'all', label: t('operations.delivery.available.all', { count: counts.all }) },
          { value: 'Housing', label: t('operations.delivery.available.housing', { count: counts.Housing }) },
          { value: 'New', label: t('operations.delivery.available.new', { count: counts.New }) },
        ]}
      />
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, mb: 1.5 }}>
        <TextField
          size="small"
          sx={{ flex: 2 }}
          placeholder={t('operations.delivery.workerSearch')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        <TextField select size="small" sx={{ flex: 1, minWidth: 180 }} label={t('workforce.col.profession')} value={profession} onChange={(e) => setProfession(e.target.value)}>
          <MenuItem value="">{t('operations.delivery.available.any')}</MenuItem>
          {professions.map(([code, o]) => (
            <MenuItem key={code || 'none'} value={code}>
              {o.label} ({o.count})
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" sx={{ flex: 1, minWidth: 180 }} label={t('workforce.col.nationality')} value={nationality} onChange={(e) => setNationality(e.target.value)}>
          <MenuItem value="">{t('operations.delivery.available.any')}</MenuItem>
          {nationalities.map(([code, o]) => (
            <MenuItem key={code || 'none'} value={code}>
              {o.label} ({o.count})
            </MenuItem>
          ))}
        </TextField>
        {filtered && (
          <Button startIcon={<FilterAltOffOutlinedIcon />} onClick={() => (setText(''), setPlace('all'), setProfession(''), setNationality(''))}>
            {t('workforce.reset')}
          </Button>
        )}
      </Stack>

      {!workers && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}
      <TableContainer sx={{ maxHeight: 440, border: `1px solid ${tokens.navy50}`, borderRadius: `${tokens.radius}px` }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allPicked}
                  indeterminate={!allPicked && selectable.some((w) => picked.includes(w.worker.id))}
                  disabled={selectable.length === 0}
                  onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...selectable.map((w) => w.worker.id)])] : picked.filter((id) => !selectable.some((w) => w.worker.id === id)))}
                />
              </TableCell>
              <TableCell>{t('workforce.col.name')}</TableCell>
              <TableCell>{t('operations.delivery.col.iqama')}</TableCell>
              <TableCell>{t('commercial.prices.col.who')}</TableCell>
              <TableCell>{t('workforce.col.status')}</TableCell>
              <TableCell>{t('operations.delivery.available.lastProject')}</TableCell>
              <TableCell align="center">{t('commercial.prices.col.salary')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map(({ worker: w, busyOrderNo }) => {
              const added = onOrder.includes(w.id);
              const disabled = added || !!busyOrderNo;
              const checked = added || picked.includes(w.id);
              return (
                <TableRow
                  key={w.id}
                  hover={!disabled}
                  selected={checked && !added}
                  sx={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 }}
                  onClick={() => !disabled && setPicked((p) => (p.includes(w.id) ? p.filter((x) => x !== w.id) : [...p, w.id]))}
                >
                  <TableCell padding="checkbox">
                    <Checkbox checked={checked} disabled={disabled} />
                  </TableCell>
                  <TableCell sx={{ minWidth: 190 }}>
                    <Typography dir="ltr" sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }}>
                      {w.name}
                    </Typography>
                    <Typography dir="ltr" sx={{ fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }}>
                      {w.workerNo}
                    </Typography>
                  </TableCell>
                  <TableCell dir="ltr">{w.iqamaNo ?? '—'}</TableCell>
                  <TableCell>
                    {name(w.professionAr, w.professionEn)}
                    <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{name(w.nationalityAr, w.nationalityEn)}</Typography>
                  </TableCell>
                  <TableCell>
                    {added ? (
                      <Badge tone="primary">{t('operations.delivery.available.added')}</Badge>
                    ) : busyOrderNo ? (
                      <Badge tone="warning">{t('operations.delivery.busy', { no: busyOrderNo })}</Badge>
                    ) : (
                      <Badge tone={w.placement === 'New' ? 'info' : 'success'}>{(ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`)}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{w.projectName ?? '—'}</TableCell>
                  <TableCell align="center">{sar(w.totalSalary)}</TableCell>
                </TableRow>
              );
            })}
            {workers && shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: tokens.gray500 }}>
                  {t('operations.delivery.noWorkersFound')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mt: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<PersonAddAlt1OutlinedIcon />}
          disabled={picked.length === 0}
          onClick={() => {
            onAdd((workers ?? []).filter((w) => picked.includes(w.worker.id)).map((w) => w.worker));
            setPicked([]);
          }}
        >
          {t('operations.delivery.addPicked', { count: picked.length })}
        </Button>
        <Typography sx={{ fontSize: 12.5, color: tokens.gray500 }}>{t('operations.delivery.available.shown', { shown: shown.length, all: counts.all })}</Typography>
      </Stack>
    </Box>
  );
}
