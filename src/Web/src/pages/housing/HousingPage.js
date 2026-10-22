import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import { Box, Button, ButtonBase, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { housingApi } from '../../api/housing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Badge, PageHeader, PillTabs } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { AssignDialog, BuildingDialog, Occupancy } from './housing';
/** The company's housing: the buildings with their occupancy, and the workers in housing who have no room yet. */
export function HousingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { can } = useSession();
    const { ar, date } = useCommercialFormat();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'without' ? 'without' : 'buildings';
    const [data, setData] = useState(null);
    const [without, setWithout] = useState(null);
    const [text, setText] = useState('');
    const [adding, setAdding] = useState(false);
    const [assigning, setAssigning] = useState(null);
    const [error, setError] = useState(null);
    const canManage = can('housing.manage', true);
    const canAssign = can('housing.assign', true);
    const reload = useCallback(async () => {
        try {
            setData(await housingApi.overview());
            setWithout(await housingApi.withoutRoom());
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);
    const shown = useMemo(() => {
        const q = text.trim().toUpperCase();
        return (without ?? []).filter((w) => !q || [w.workerNo, w.name, w.iqamaNo, w.projectName].some((v) => v?.toUpperCase().includes(q)));
    }, [without, text]);
    const totals = data?.totals;
    return (_jsxs(Box, { children: [_jsx(PageHeader, { title: t('housing.title'), subtitle: t('housing.intro'), actions: canManage ? (_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setAdding(true), children: t('housing.newBuilding') })) : undefined }), _jsx(ErrorMessage, { messageKey: error }), _jsxs(KpiGrid, { count: 5, children: [_jsx(KpiCard, { label: t('housing.cards.buildings'), value: String(totals?.buildings ?? 0), foot: t('housing.cards.rooms', { count: totals?.rooms ?? 0 }), icon: _jsx(ApartmentOutlinedIcon, {}), tone: tokens.navy700 }), _jsx(KpiCard, { label: t('housing.cards.capacity'), value: (totals?.capacity ?? 0).toLocaleString('en-US'), foot: t('housing.cards.capacityFoot'), icon: _jsx(BedOutlinedIcon, {}), tone: "#6b7a90" }), _jsx(KpiCard, { label: t('housing.cards.occupied'), value: (totals?.occupied ?? 0).toLocaleString('en-US'), foot: t('housing.cards.occupiedFoot'), icon: _jsx(HotelOutlinedIcon, {}), tone: "#1f9d55" }), _jsx(KpiCard, { label: t('housing.cards.free'), value: Math.max(0, (totals?.capacity ?? 0) - (totals?.occupied ?? 0)).toLocaleString('en-US'), foot: t('housing.cards.freeFoot'), icon: _jsx(MeetingRoomOutlinedIcon, {}), tone: "#2b7bd9" }), _jsx(KpiCard, { label: t('housing.cards.withoutRoom'), value: (totals?.withoutRoom ?? 0).toLocaleString('en-US'), foot: tab === 'without' ? `✓ ${t('workforce.currentFilter')}` : t('housing.cards.withoutRoomFoot', { count: totals?.inHousing ?? 0 }), icon: _jsx(PersonSearchOutlinedIcon, {}), tone: "#d9822b", active: tab === 'without', onClick: () => setParams(tab === 'without' ? {} : { tab: 'without' }, { replace: true }) })] }), _jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5 }, children: [_jsx(PillTabs, { value: tab, onChange: (v) => setParams(v === 'without' ? { tab: 'without' } : {}, { replace: true }), options: [
                            { value: 'buildings', label: t('housing.tabs.buildings', { count: data?.buildings.length ?? 0 }) },
                            { value: 'without', label: t('housing.tabs.without', { count: without?.length ?? 0 }) },
                        ] }), !data && !error && _jsx(LinearProgress, { sx: { mb: 1, borderRadius: 2 } }), tab === 'buildings' ? (data && data.buildings.length === 0 ? (_jsxs(Stack, { sx: { alignItems: 'center', py: 6, gap: 1.5, color: tokens.gray500 }, children: [_jsx(ApartmentOutlinedIcon, { sx: { fontSize: 44 } }), _jsx(Typography, { children: t('housing.noBuildings') }), canManage && (_jsx(Button, { variant: "outlined", startIcon: _jsx(AddIcon, {}), onClick: () => setAdding(true), children: t('housing.newBuilding') }))] })) : (_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.5 }, children: data?.buildings.map((b) => (_jsxs(ButtonBase, { onClick: () => navigate(`/housing/buildings/${b.id}`), sx: { display: 'block', textAlign: 'start', p: 2, borderRadius: `${tokens.radius}px`, border: `1px solid ${tokens.navy50}`, bgcolor: b.isActive ? '#fff' : '#f6f7f9', opacity: b.isActive ? 1 : 0.7, '&:hover': { boxShadow: tokens.shadowSm } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, mb: 1.25 }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: '12px', bgcolor: tokens.navy50, color: tokens.navy700 }, children: _jsx(ApartmentOutlinedIcon, {}) }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: 15, fontWeight: 800, color: tokens.navy800 }, children: b.name }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: [b.city, b.type === 'Project' ? b.projectName : null].filter(Boolean).join(' · ') || '—' })] }), _jsx(Badge, { tone: b.isActive ? (b.type === 'Company' ? 'primary' : b.type === 'Rented' ? 'info' : 'warning') : 'neutral', children: b.isActive ? t(`housing.types.${b.type}`) : t('housing.inactive') })] }), _jsxs(Stack, { direction: "row", sx: { gap: 2, alignItems: 'flex-end' }, children: [_jsx(Box, { sx: { flex: 1 }, children: _jsx(Occupancy, { occupied: b.occupied, capacity: b.capacity }) }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600, whiteSpace: 'nowrap' }, children: t('housing.cards.rooms', { count: b.rooms }) })] })] }, b.id))) }))) : (_jsxs(_Fragment, { children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.5, mb: 1.5 }, children: [_jsx(TextField, { size: "small", sx: { flex: 1, maxWidth: 420 }, placeholder: t('housing.searchWorker'), value: text, onChange: (e) => setText(e.target.value) }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: t('housing.withoutHint') })] }), _jsx(TableContainer, { children: _jsxs(Table, { size: "small", children: [_jsx(TableHead, { children: _jsxs(TableRow, { children: [_jsx(TableCell, { children: t('workforce.col.name') }), canAssign && _jsx(TableCell, {}), _jsx(TableCell, { children: t('operations.delivery.col.iqama') }), _jsx(TableCell, { children: t('commercial.prices.col.who') }), _jsx(TableCell, { children: t('workforce.col.status') }), _jsx(TableCell, { children: t('operations.delivery.available.lastProject') })] }) }), _jsxs(TableBody, { children: [shown.map((w) => (_jsxs(TableRow, { hover: true, children: [_jsxs(TableCell, { sx: { minWidth: 180, cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${w.id}`), children: [_jsx(Typography, { dir: "ltr", sx: { fontSize: 13, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: w.name }), _jsx(Typography, { dir: "ltr", sx: { fontSize: 11.5, color: tokens.gray500, textAlign: 'start' }, children: w.workerNo })] }), canAssign && (_jsx(TableCell, { children: _jsx(Button, { size: "small", variant: "outlined", startIcon: _jsx(HotelOutlinedIcon, {}), onClick: () => setAssigning(w), children: t('housing.assign') }) })), _jsx(TableCell, { dir: "ltr", children: w.iqamaNo ?? '—' }), _jsxs(TableCell, { children: [(ar ? w.professionAr : w.professionEn) ?? '—', _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: (ar ? w.nationalityAr : w.nationalityEn) ?? '—' })] }), _jsx(TableCell, { children: _jsx(Badge, { tone: w.placement === 'New' ? 'info' : 'success', children: (ar ? w.statusAr : w.statusEn) ?? t(`workforce.placement.${w.placement}`) }) }), _jsxs(TableCell, { children: [w.projectName ?? '—', w.projectJoinedOn && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500 }, children: date(w.projectJoinedOn) })] })] }, w.id))), without && shown.length === 0 && (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: 6, align: "center", sx: { py: 5, color: tokens.gray500 }, children: t('housing.allHoused') }) }))] })] }) })] }))] }), adding && _jsx(BuildingDialog, { building: null, onClose: () => setAdding(false), onSaved: (id) => navigate(`/housing/buildings/${id}`) }), assigning && (_jsx(AssignDialog, { worker: assigning, onClose: () => setAssigning(null), onSaved: () => {
                    setAssigning(null);
                    void reload();
                } }))] }));
}
