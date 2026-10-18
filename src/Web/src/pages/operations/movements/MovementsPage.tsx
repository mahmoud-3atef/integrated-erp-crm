import Add from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, ButtonBase, InputAdornment, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { movementsApi, movementTypes, type MovementList, type MovementType } from '../../../api/movements';
import { useSession } from '../../../app/session';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { PillTabs } from '../../../components/ui';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { ActionDialog } from './ActionDialog';
import { gradient, MovementStatusBadge, rise, Transition, TypeIcon, typeLook, useStateName } from './movementMeta';

type StatusFilter = '' | 'Open' | 'Executed' | 'Closed';

/** Every worker movement: the eight kinds as cards (each a filter), then the movements as "from → to" rows. */
export function MovementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useSession();
  const { ar, date } = useCommercialFormat();
  const stateName = useStateName();
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') ?? '') as MovementType | '';
  const [status, setStatus] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<MovementList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const canManage = can('operations.movements.manage', true);

  const reload = useCallback(async () => {
    try {
      setData(await movementsApi.list({ type, status, search: query }));
      setError(null);
    } catch (failure) {
      setError(errorKey(failure));
    }
  }, [type, status, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const pick = (value: MovementType) => setParams(type === value ? {} : { type: value }, { replace: true });

  return (
    <Box>
      {/* The page's banner. */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: `${tokens.radiusLg}px`,
          p: { xs: 2.5, md: 3.5 },
          mb: 2.5,
          color: '#fff',
          background: 'linear-gradient(120deg, #0b3954 0%, #0d6e8c 55%, #1aa39a 100%)',
          boxShadow: '0 14px 34px rgba(11,57,84,.25)',
          animation: `${rise} .45s ease both`,
          '&::before': { content: '""', position: 'absolute', width: 340, height: 340, borderRadius: '50%', top: -170, insetInlineEnd: -90, background: 'rgba(255,255,255,.08)' },
          '&::after': { content: '""', position: 'absolute', width: 220, height: 220, borderRadius: '50%', bottom: -120, insetInlineEnd: 160, background: 'rgba(255,255,255,.06)' },
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ position: 'relative', zIndex: 1, gap: 2, alignItems: { md: 'center' } }}>
          <Box sx={{ flex: 1 }}>
            <Typography component="h1" sx={{ fontSize: 24, fontWeight: 800 }}>
              {t('movements.title')}
            </Typography>
            <Typography sx={{ fontSize: 13.5, opacity: 0.85, maxWidth: 720, mt: 0.5 }}>{t('movements.intro')}</Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 3, alignItems: 'center' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{data?.open ?? '–'}</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>{t('movements.openCount')}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{data?.executed ?? '–'}</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.8 }}>{t('movements.executedCount')}</Typography>
            </Box>
            {canManage && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setActing(true)}
                sx={{ bgcolor: '#fff', color: '#0b3954', fontWeight: 800, px: 2.5, '&:hover': { bgcolor: '#eef6f9' } }}
              >
                {t('movements.new')}
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      <ErrorMessage messageKey={error} />

      {/* The eight kinds: each a filter, with its open count. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', xl: 'repeat(8, 1fr)' }, gap: 1.5, mb: 2.5 }}>
        {movementTypes.map((m, n) => {
          const count = data?.types.find((x) => x.type === m);
          const active = type === m;
          return (
            <ButtonBase
              key={m}
              onClick={() => pick(m)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                textAlign: 'start',
                gap: 1.25,
                p: 1.75,
                borderRadius: `${tokens.radius + 4}px`,
                bgcolor: '#fff',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: active ? `0 0 0 2px ${typeLook[m].from}, 0 12px 26px ${typeLook[m].from}33` : tokens.shadowSm,
                transform: active ? 'translateY(-3px)' : 'none',
                transition: 'transform .2s ease, box-shadow .2s ease',
                animation: `${rise} .4s ease both`,
                animationDelay: `${n * 40}ms`,
                '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 12px 26px ${typeLook[m].from}2e` },
                '&::after': active ? { content: '""', position: 'absolute', inset: 0, background: gradient(m), opacity: 0.06 } : undefined,
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <TypeIcon type={m} size={40} />
                {(count?.open ?? 0) > 0 && (
                  <Box sx={{ minWidth: 24, height: 24, px: 0.75, borderRadius: 99, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', background: gradient(m) }}>
                    {count!.open}
                  </Box>
                )}
              </Stack>
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.navy800, lineHeight: 1.3 }}>{t(`movements.types.${m}`)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>{t('movements.totalOf', { count: count?.total ?? 0 })}</Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <PillTabs<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: t('movements.filter.all') },
                { value: 'Open', label: t('movements.filter.open') },
                { value: 'Executed', label: t('movements.filter.executed') },
                { value: 'Closed', label: t('movements.filter.closed') },
              ]}
            />
          </Box>
          <TextField
            size="small"
            sx={{ minWidth: 300 }}
            placeholder={t('movements.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
        </Stack>
        {!data && !error && <LinearProgress sx={{ mb: 1, borderRadius: 2 }} />}

        <Stack spacing={1}>
          {data?.rows.map((r, n) => (
            <ButtonBase
              key={r.id}
              onClick={() => navigate(`/operations/movements/${r.id}`)}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1.1fr) minmax(320px, 2fr) 140px 130px 24px' },
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                textAlign: 'start',
                borderRadius: `${tokens.radius}px`,
                border: `1px solid ${tokens.gray100}`,
                borderInlineStart: `4px solid ${typeLook[r.type].from}`,
                transition: 'background-color .15s, transform .15s, box-shadow .15s',
                animation: `${rise} .35s ease both`,
                animationDelay: `${Math.min(n, 12) * 30}ms`,
                '&:hover': { bgcolor: tokens.gray50, transform: 'translateX(0) translateY(-1px)', boxShadow: tokens.shadowSm },
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <TypeIcon type={r.type} size={38} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: tokens.navy800, textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.workerName}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: tokens.gray500 }}>
                    <span dir="ltr">{r.workerNo}</span> · {t(`movements.types.${r.type}`)} · <span dir="ltr">{r.movementNo}</span>
                  </Typography>
                </Box>
              </Stack>
              <Transition
                from={r.fromPlacement}
                fromLabel={stateName(r.fromPlacement)}
                fromSub={r.fromProjectName}
                to={r.opensPeriod}
                toLabel={stateName(r.opensPeriod)}
                toSub={r.projectName}
              />
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.navy800 }}>{date(r.effectiveOn)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: tokens.gray500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.createdByName}</Typography>
              </Box>
              <Box>
                <MovementStatusBadge status={r.status} />
              </Box>
              <ChevronLeftIcon sx={{ color: tokens.gray300, transform: ar ? 'none' : 'scaleX(-1)', display: { xs: 'none', md: 'block' } }} />
            </ButtonBase>
          ))}
          {data && data.rows.length === 0 && (
            <Box sx={{ py: 6, textAlign: 'center', color: tokens.gray500 }}>
              <Typography sx={{ fontSize: 14 }}>{t('movements.empty')}</Typography>
            </Box>
          )}
        </Stack>
      </Box>
      {acting && <ActionDialog onClose={() => setActing(false)} onSent={() => void reload()} />}
    </Box>
  );
}
