import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import MultipleStopOutlinedIcon from '@mui/icons-material/MultipleStopOutlined';
import Add from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Button, ButtonBase, InputAdornment, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../../api/auth';
import { movementsApi, movementTypes } from '../../../api/movements';
import { useSession } from '../../../app/session';
import { tokens } from '../../../app/theme';
import { ErrorMessage } from '../../../auth/AuthLayout';
import { PillTabs } from '../../../components/ui';
import { useCommercialFormat } from '../../commercial/ProjectsPage';
import { ActionDialog } from './ActionDialog';
import { gradient, MovementStatusBadge, rise, Transition, TypeIcon, typeLook, useStateName } from './movementMeta';
import { ListHero, StageLine, useCurrentStages } from '../../../components/ListLayout';
/** Every worker movement: the eight kinds as cards (each a filter), then the movements as "from → to" rows. */
export function MovementsPage({ creating = false } = {}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { ar, date } = useCommercialFormat();
    const stateName = useStateName();
    const [params, setParams] = useSearchParams();
    const type = (params.get('type') ?? '');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [acting, setActing] = useState(creating);
    const canManage = can('operations.movements.manage', true);
    const reload = useCallback(async () => {
        try {
            setData(await movementsApi.list({ type, status, search: query }));
            setError(null);
        }
        catch (failure) {
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
    const pick = (value) => setParams(type === value ? {} : { type: value }, { replace: true });
    const stages = useCurrentStages('operations.movement', (data?.rows ?? []).map((x) => x.id));
    return (_jsxs(Box, { children: [_jsx(ListHero, { tone: "movement", icon: _jsx(MultipleStopOutlinedIcon, {}), title: t('movements.title'), subtitle: t('movements.intro'), actions: _jsxs(_Fragment, { children: [_jsxs(Stack, { direction: "row", sx: { gap: 2.5, alignItems: 'center', marginInlineEnd: 1 }, children: [_jsxs(Box, { sx: { textAlign: 'center' }, children: [_jsx(Typography, { sx: { fontSize: 24, fontWeight: 800, lineHeight: 1 }, children: data?.open ?? '–' }), _jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.85 }, children: t('movements.openCount') })] }), _jsxs(Box, { sx: { textAlign: 'center' }, children: [_jsx(Typography, { sx: { fontSize: 24, fontWeight: 800, lineHeight: 1 }, children: data?.executed ?? '–' }), _jsx(Typography, { sx: { fontSize: 11.5, opacity: 0.85 }, children: t('movements.executedCount') })] })] }), canManage && (_jsx(Button, { variant: "contained", startIcon: _jsx(Add, {}), onClick: () => setActing(true), children: t('movements.new') }))] }) }), _jsx(ErrorMessage, { messageKey: error }), _jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', xl: 'repeat(8, 1fr)' }, gap: 1.5, mb: 2.5 }, children: movementTypes.map((m, n) => {
                    const count = data?.types.find((x) => x.type === m);
                    const active = type === m;
                    return (_jsxs(ButtonBase, { onClick: () => pick(m), sx: {
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
                        }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx(TypeIcon, { type: m, size: 40 }), (count?.open ?? 0) > 0 && (_jsx(Box, { sx: { minWidth: 24, height: 24, px: 0.75, borderRadius: 99, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', background: gradient(m) }, children: count.open }))] }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: tokens.navy800, lineHeight: 1.3 }, children: t(`movements.types.${m}`) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: t('movements.totalOf', { count: count?.total ?? 0 }) })] })] }, m));
                }) }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2 }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 1.5, alignItems: { md: 'center' }, mb: 1.5 }, children: [_jsx(Box, { sx: { flex: 1 }, children: _jsx(PillTabs, { value: status, onChange: setStatus, options: [
                                        { value: '', label: t('movements.filter.all') },
                                        { value: 'Open', label: t('movements.filter.open') },
                                        { value: 'Executed', label: t('movements.filter.executed') },
                                        { value: 'Closed', label: t('movements.filter.closed') },
                                    ] }) }), _jsx(TextField, { size: "small", sx: { minWidth: 300 }, placeholder: t('movements.search'), value: search, onChange: (e) => setSearch(e.target.value), slotProps: { input: { startAdornment: _jsx(InputAdornment, { position: "start", children: _jsx(SearchIcon, { fontSize: "small" }) }) } } })] }), !data && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), _jsxs(Stack, { spacing: 1, children: [data?.rows.map((r, n) => (_jsxs(ButtonBase, { onClick: () => navigate(`/operations/movements/${r.id}`), sx: {
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
                                }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, minWidth: 0 }, children: [_jsx(TypeIcon, { type: r.type, size: 38 }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 800, color: tokens.navy800, textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: r.workerName }), _jsxs(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: r.workerNo }), " \u00B7 ", t(`movements.types.${r.type}`), " \u00B7 ", _jsx("span", { dir: "ltr", children: r.movementNo })] })] })] }), _jsx(Transition, { from: r.fromPlacement, fromLabel: stateName(r.fromPlacement), fromSub: r.fromProjectName, to: r.opensPeriod, toLabel: stateName(r.opensPeriod), toSub: r.projectName }), _jsxs(Box, { children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800 }, children: date(r.effectiveOn) }), _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: r.createdByName })] }), _jsxs(Box, { children: [_jsx(MovementStatusBadge, { status: r.status }), _jsx(StageLine, { stage: stages[r.id] })] }), _jsx(ChevronLeftIcon, { sx: { color: tokens.gray300, transform: ar ? 'none' : 'scaleX(-1)', display: { xs: 'none', md: 'block' } } })] }, r.id))), data && data.rows.length === 0 && (_jsx(Box, { sx: { py: 6, textAlign: 'center', color: tokens.gray500 }, children: _jsx(Typography, { sx: { fontSize: 14 }, children: t('movements.empty') }) }))] })] }), acting && (_jsx(ActionDialog, { workerId: creating ? (params.get('worker') ?? undefined) : undefined, onClose: () => (creating ? navigate('/operations/movements') : setActing(false)), onSent: () => void reload() }))] }));
}
