import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AddIcon from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Tooltip, Typography, } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { errorKey } from '../../api/auth';
import { housingApi } from '../../api/housing';
import { useSession } from '../../app/session';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { Badge } from '../../components/ui';
import { useCommercialFormat } from '../commercial/ProjectsPage';
import { isoToday } from '../operations/delivery';
import { AssignDialog, BuildingDialog, Occupancy, RoomDialog } from './housing';
import { DateField } from '../../components/DateField';
/** One building: its details and occupancy, and its rooms with who lives in each. */
export function BuildingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const { can } = useSession();
    const { ar, date } = useCommercialFormat();
    const [data, setData] = useState(null);
    const [editing, setEditing] = useState(false);
    const [room, setRoom] = useState(null);
    const [assignTo, setAssignTo] = useState(null);
    const [moving, setMoving] = useState(null);
    const [leaving, setLeaving] = useState(null);
    const [leaveOn, setLeaveOn] = useState(isoToday());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const canManage = can('housing.manage', true);
    const canAssign = can('housing.assign', true);
    const reload = useCallback(async () => {
        try {
            setData(await housingApi.building(id));
        }
        catch (failure) {
            setError(errorKey(failure));
        }
    }, [id]);
    useEffect(() => {
        void reload();
    }, [reload]);
    if (!data) {
        return _jsx(ErrorMessage, { messageKey: error });
    }
    const b = data.building;
    const act = async (action) => {
        setBusy(true);
        setError(null);
        try {
            await action();
            await reload();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Box, { children: [_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2.5, mb: `${tokens.gap}px` }, children: [_jsxs(Stack, { direction: { xs: 'column', md: 'row' }, sx: { gap: 2, alignItems: { md: 'center' } }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }, children: [_jsx(Box, { sx: { display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: '18px', bgcolor: tokens.navy700, color: '#fff' }, children: _jsx(ApartmentOutlinedIcon, {}) }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1 }, children: [_jsx(Typography, { component: "h1", sx: { fontSize: 21, fontWeight: 800, color: tokens.navy800 }, children: b.name }), _jsx(Badge, { tone: b.isActive ? 'primary' : 'neutral', children: b.isActive ? t(`housing.types.${b.type}`) : t('housing.inactive') })] }), _jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600 }, children: [b.city, b.address, b.type === 'Project' ? b.projectName : null].filter(Boolean).join(' · ') || '—' }), b.notes && _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: b.notes })] })] }), _jsxs(Box, { sx: { minWidth: 240 }, children: [_jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500, mb: 0.5 }, children: t('housing.cards.rooms', { count: b.rooms }) }), _jsx(Occupancy, { occupied: b.occupied, capacity: b.capacity })] }), _jsx(Button, { startIcon: _jsx(ArrowBackIcon, { sx: { transform: ar ? 'scaleX(-1)' : 'none' } }), onClick: () => navigate('/housing'), children: t('common.back') })] }), canManage && (_jsxs(Stack, { direction: "row", sx: { flexWrap: 'wrap', gap: 1.25, mt: 2 }, children: [_jsx(Button, { variant: "contained", startIcon: _jsx(AddIcon, {}), onClick: () => setRoom('new'), children: t('housing.newRoom') }), _jsx(Button, { variant: "outlined", startIcon: _jsx(EditOutlinedIcon, {}), onClick: () => setEditing(true), children: t('common.edit') }), _jsx(Button, { color: b.isActive ? 'error' : 'primary', disabled: busy, onClick: () => void act(() => housingApi.setBuildingActive(b.id, !b.isActive)), children: b.isActive ? t('housing.deactivate') : t('housing.activate') })] }))] }), _jsx(ErrorMessage, { messageKey: error }), data.rooms.length === 0 ? (_jsx(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 5, textAlign: 'center', color: tokens.gray500 }, children: t('housing.noRooms') })) : (_jsx(Box, { sx: { display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: `${tokens.gap}px` }, children: [...data.rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' })).map((r) => {
                    const full = r.occupants.length >= r.capacity;
                    return (_jsxs(Box, { sx: { bgcolor: '#fff', borderRadius: `${tokens.radiusLg}px`, boxShadow: tokens.shadowSm, p: 2, opacity: r.isActive ? 1 : 0.6 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, mb: 1 }, children: [_jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { dir: "auto", sx: { fontSize: 15, fontWeight: 800, color: tokens.navy800 }, children: r.number }), _jsxs(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: [r.floor ? t('housing.floorN', { floor: r.floor }) : '—', !r.isActive && ` · ${t('housing.inactive')}`] })] }), canManage && (_jsx(Tooltip, { title: t('common.edit'), children: _jsx(IconButton, { size: "small", onClick: () => setRoom(r), children: _jsx(EditOutlinedIcon, { fontSize: "small" }) }) }))] }), _jsx(Occupancy, { occupied: r.occupants.length, capacity: r.capacity }), _jsx(Stack, { spacing: 0.5, sx: { mt: 1.5 }, children: r.occupants.map((o) => (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: '8px', bgcolor: '#fafbfd', '&:hover .actions': { opacity: 1 } }, children: [_jsxs(Box, { sx: { flex: 1, minWidth: 0, cursor: 'pointer' }, onClick: () => navigate(`/workforce/workers/${o.workerId}`), children: [_jsx(Typography, { dir: "ltr", noWrap: true, sx: { fontSize: 12.5, fontWeight: 700, color: tokens.navy800, textAlign: 'start' }, children: o.name }), _jsxs(Typography, { sx: { fontSize: 11, color: tokens.gray500 }, children: [_jsx("span", { dir: "ltr", children: o.workerNo }), " \u00B7 ", t('housing.since', { date: date(o.since) }), o.sourceNo && ` · ${o.sourceNo}`] })] }), canAssign && (_jsxs(Stack, { className: "actions", direction: "row", sx: { opacity: { xs: 1, md: 0.35 }, transition: 'opacity .15s' }, children: [_jsx(Tooltip, { title: t('housing.move'), children: _jsx(IconButton, { size: "small", onClick: () => setMoving(o), children: _jsx(SwapHorizIcon, { sx: { fontSize: 18 } }) }) }), _jsx(Tooltip, { title: t('housing.leave'), children: _jsx(IconButton, { size: "small", onClick: () => (setLeaveOn(isoToday()), setLeaving(o)), children: _jsx(LogoutOutlinedIcon, { sx: { fontSize: 18 } }) }) })] }))] }, o.assignmentId))) }), canAssign && r.isActive && b.isActive && (_jsx(Button, { size: "small", startIcon: _jsx(PersonAddAlt1OutlinedIcon, {}), disabled: full, onClick: () => setAssignTo(r), sx: { mt: 1 }, children: full ? t('housing.full') : t('housing.addOccupant') })), canManage && r.occupants.length === 0 && (_jsx(Button, { size: "small", color: r.isActive ? 'error' : 'primary', disabled: busy, onClick: () => void act(() => housingApi.setRoomActive(r.id, !r.isActive)), sx: { mt: 1, marginInlineStart: 1 }, children: r.isActive ? t('housing.deactivate') : t('housing.activate') }))] }, r.id));
                }) })), editing && (_jsx(BuildingDialog, { building: b, onClose: () => setEditing(false), onSaved: () => {
                    setEditing(false);
                    void reload();
                } })), room && (_jsx(RoomDialog, { buildingId: b.id, room: room === 'new' ? null : room, onClose: () => setRoom(null), onSaved: () => {
                    setRoom(null);
                    void reload();
                } })), assignTo && (_jsx(AssignDialog, { room: { id: assignTo.id, buildingId: b.id, buildingName: b.name, roomNo: assignTo.number, capacity: assignTo.capacity, occupied: assignTo.occupants.length, isActive: true, free: assignTo.capacity - assignTo.occupants.length, label: `${b.name} — ${assignTo.number}` }, onClose: () => setAssignTo(null), onSaved: () => {
                    setAssignTo(null);
                    void reload();
                } })), moving && (_jsx(AssignDialog, { worker: { id: moving.workerId, workerNo: moving.workerNo, name: moving.name }, onClose: () => setMoving(null), onSaved: () => {
                    setMoving(null);
                    void reload();
                } })), leaving && (_jsxs(Dialog, { open: true, onClose: () => setLeaving(null), fullWidth: true, maxWidth: "xs", children: [_jsx(DialogTitle, { children: t('housing.leaveTitle', { name: leaving.name }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(Typography, { sx: { fontSize: 13, color: tokens.gray600, mb: 2 }, children: t('housing.leaveHint') }), _jsx(DateField, { fullWidth: true, label: t('housing.leaveOn'), value: leaveOn, onChange: (e) => setLeaveOn(e.target.value), slotProps: { inputLabel: { shrink: true } } })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: () => setLeaving(null), children: t('common.cancel') }), _jsx(Button, { variant: "contained", color: "error", disabled: busy || !leaveOn, onClick: () => void act(async () => {
                                    await housingApi.leave(leaving.workerId, leaveOn);
                                    setLeaving(null);
                                }), children: t('housing.leave') })] })] }))] }));
}
