import { createElement as _createElement } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, TextField, Typography, } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../api/auth';
import { buildingTypes, housingApi } from '../../api/housing';
import { tokens } from '../../app/theme';
import { ErrorMessage } from '../../auth/AuthLayout';
import { isoToday } from '../operations/delivery';
import { DateField } from '../../components/DateField';
/** How full a room or building is: a bar and "occupied / capacity". */
export function Occupancy({ occupied, capacity }) {
    const { t } = useTranslation();
    const ratio = capacity > 0 ? Math.min(100, (occupied / capacity) * 100) : 0;
    const color = occupied >= capacity && capacity > 0 ? tokens.danger : ratio >= 80 ? tokens.warning : tokens.success;
    return (_jsxs(Box, { sx: { minWidth: 120 }, children: [_jsx(LinearProgress, { variant: "determinate", value: ratio, sx: { height: 8, borderRadius: 4, bgcolor: tokens.navy50, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 } } }), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray600, mt: 0.5 }, children: t('housing.occupancy', { occupied, capacity, free: Math.max(0, capacity - occupied) }) })] }));
}
/** Add or change a building. */
export function BuildingDialog({ building, onClose, onSaved }) {
    const { t } = useTranslation();
    const [input, setInput] = useState({
        name: building?.name ?? '',
        type: building?.type ?? 'Company',
        city: building?.city ?? '',
        address: building?.address ?? '',
        projectId: building?.projectId ?? null,
        notes: building?.notes ?? '',
    });
    const [projects, setProjects] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (input.type === 'Project' && projects.length === 0) {
            housingApi.projects().then(setProjects).catch((failure) => setError(errorKey(failure)));
        }
    }, [input.type, projects.length]);
    const save = async () => {
        setBusy(true);
        setError(null);
        const body = { ...input, city: input.city?.trim() || null, address: input.address?.trim() || null, notes: input.notes?.trim() || null, projectId: input.type === 'Project' ? input.projectId : null };
        try {
            if (building) {
                await housingApi.updateBuilding(building.id, body);
                onSaved(building.id);
            }
            else {
                onSaved((await housingApi.createBuilding(body)).id);
            }
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: building ? t('housing.editBuilding') : t('housing.newBuilding') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [_jsx(TextField, { label: t('housing.buildingName'), value: input.name, onChange: (e) => setInput({ ...input, name: e.target.value }), required: true, autoFocus: true, slotProps: { htmlInput: { maxLength: 200 } } }), _jsx(TextField, { select: true, label: t('housing.type'), value: input.type, onChange: (e) => setInput({ ...input, type: e.target.value }), children: buildingTypes.map((type) => (_jsx(MenuItem, { value: type, children: t(`housing.types.${type}`) }, type))) }), input.type === 'Project' && (_jsx(Autocomplete, { options: projects, value: projects.find((p) => p.id === input.projectId) ?? null, onChange: (_, v) => setInput({ ...input, projectId: v?.id ?? null }), getOptionLabel: (p) => `${p.name} (${p.code})`, isOptionEqualToValue: (a, b) => a.id === b.id, renderInput: (params) => _jsx(TextField, { ...params, label: t('commercial.col.project'), required: true }) })), _jsxs(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 2, children: [_jsx(TextField, { sx: { flex: 1 }, label: t('housing.city'), value: input.city ?? '', onChange: (e) => setInput({ ...input, city: e.target.value }), slotProps: { htmlInput: { maxLength: 100 } } }), _jsx(TextField, { sx: { flex: 2 }, label: t('housing.address'), value: input.address ?? '', onChange: (e) => setInput({ ...input, address: e.target.value }), slotProps: { htmlInput: { maxLength: 500 } } })] }), _jsx(TextField, { label: t('operations.delivery.notes'), value: input.notes ?? '', onChange: (e) => setInput({ ...input, notes: e.target.value }), multiline: true, minRows: 2, slotProps: { htmlInput: { maxLength: 2000 } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !input.name.trim() || (input.type === 'Project' && !input.projectId), onClick: () => void save(), children: t('common.save') })] })] }));
}
/** Add or change a room of a building. */
export function RoomDialog({ buildingId, room, onClose, onSaved }) {
    const { t } = useTranslation();
    const [input, setInput] = useState({ number: room?.number ?? '', floor: room?.floor ?? '', capacity: room?.capacity ?? 4, notes: room?.notes ?? '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const save = async () => {
        setBusy(true);
        setError(null);
        const body = { ...input, floor: input.floor?.trim() || null, notes: input.notes?.trim() || null };
        try {
            await (room ? housingApi.updateRoom(room.id, body) : housingApi.createRoom(buildingId, body));
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "xs", children: [_jsx(DialogTitle, { children: room ? t('housing.editRoom', { no: room.number }) : t('housing.newRoom') }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [_jsx(TextField, { label: t('housing.roomNo'), value: input.number, onChange: (e) => setInput({ ...input, number: e.target.value }), required: true, autoFocus: true, helperText: t('housing.roomNoHint'), slotProps: { htmlInput: { maxLength: 100 } } }), _jsxs(Stack, { direction: "row", spacing: 2, children: [_jsx(TextField, { sx: { flex: 1 }, label: t('housing.floor'), value: input.floor ?? '', onChange: (e) => setInput({ ...input, floor: e.target.value }), slotProps: { htmlInput: { maxLength: 50 } } }), _jsx(TextField, { sx: { flex: 1 }, type: "number", label: t('housing.capacity'), value: input.capacity, onChange: (e) => setInput({ ...input, capacity: Number(e.target.value) }), required: true, helperText: room && room.occupants.length > 0 ? t('housing.capacityHint', { count: room.occupants.length }) : undefined, slotProps: { htmlInput: { min: Math.max(1, room?.occupants.length ?? 1), max: 500 } } })] }), _jsx(TextField, { label: t('operations.delivery.notes'), value: input.notes ?? '', onChange: (e) => setInput({ ...input, notes: e.target.value }), slotProps: { htmlInput: { maxLength: 1000 } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !input.number.trim() || !(input.capacity >= 1), onClick: () => void save(), children: t('common.save') })] })] }));
}
/**
 * House a worker in a room. Given a worker (from the "without a room" list or an occupant to move), choose the room;
 * given a room, choose the worker among those in housing without a room.
 */
export function AssignDialog({ worker, room, onClose, onSaved }) {
    const { t } = useTranslation();
    const [rooms, setRooms] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [roomId, setRoomId] = useState(room?.id ?? null);
    const [workerId, setWorkerId] = useState(worker?.id ?? null);
    const [from, setFrom] = useState(isoToday());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!room)
            housingApi.rooms().then(setRooms).catch((failure) => setError(errorKey(failure)));
        if (!worker)
            housingApi.withoutRoom().then(setWorkers).catch((failure) => setError(errorKey(failure)));
    }, [room, worker]);
    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await housingApi.assign(workerId, roomId, from || null);
            onSaved();
        }
        catch (failure) {
            setError(errorKey(failure));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm", children: [_jsx(DialogTitle, { children: worker ? t('housing.assignWorker', { name: worker.name }) : t('housing.assignRoom', { room: room?.label }) }), _jsxs(DialogContent, { dividers: true, children: [_jsx(ErrorMessage, { messageKey: error }), _jsxs(Stack, { spacing: 2, children: [worker ? (_jsx(Autocomplete, { options: rooms, value: rooms.find((r) => r.id === roomId) ?? null, onChange: (_, v) => setRoomId(v?.id ?? null), getOptionLabel: (r) => r.label, getOptionDisabled: (r) => r.free === 0, groupBy: (r) => r.buildingName, isOptionEqualToValue: (a, b) => a.id === b.id, renderOption: (props, r) => (_createElement("li", { ...props, key: r.id },
                                    _jsxs(Stack, { direction: "row", sx: { width: '100%', justifyContent: 'space-between', gap: 2 }, children: [_jsx("span", { children: r.roomNo }), _jsx(Typography, { component: "span", sx: { fontSize: 12.5, color: r.free === 0 ? tokens.danger : tokens.gray500 }, children: r.free === 0 ? t('housing.full') : t('housing.freeCount', { count: r.free }) })] }))), renderInput: (params) => _jsx(TextField, { ...params, label: t('housing.room'), required: true, autoFocus: true }) })) : (_jsx(Autocomplete, { options: workers, value: workers.find((w) => w.id === workerId) ?? null, onChange: (_, v) => setWorkerId(v?.id ?? null), getOptionLabel: (w) => `${w.workerNo} — ${w.name}`, isOptionEqualToValue: (a, b) => a.id === b.id, renderInput: (params) => _jsx(TextField, { ...params, label: t('housing.workerWithoutRoom'), required: true, autoFocus: true, helperText: t('housing.workerWithoutRoomHint', { count: workers.length }) }) })), _jsx(DateField, { label: t('housing.from'), value: from, onChange: (e) => setFrom(e.target.value), required: true, slotProps: { inputLabel: { shrink: true } } })] })] }), _jsxs(DialogActions, { children: [_jsx(Button, { onClick: onClose, children: t('common.cancel') }), _jsx(Button, { variant: "contained", disabled: busy || !roomId || !workerId || !from, onClick: () => void save(), children: t('housing.assign') })] })] }));
}
