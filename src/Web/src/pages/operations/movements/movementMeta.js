import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AirplanemodeActiveOutlinedIcon from '@mui/icons-material/AirplanemodeActiveOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import ExitToAppOutlinedIcon from '@mui/icons-material/ExitToAppOutlined';
import FlightLandOutlinedIcon from '@mui/icons-material/FlightLandOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import HotelOutlinedIcon from '@mui/icons-material/HotelOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import NewReleasesOutlinedIcon from '@mui/icons-material/NewReleasesOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutlined';
import { keyframes } from '@emotion/react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui';
/** Each movement's look: its icon and its two-color gradient. */
export const typeLook = {
    Arrival: { icon: _jsx(FlightLandOutlinedIcon, {}), from: '#0f9b8e', to: '#2bc0a8' },
    VacationDeparture: { icon: _jsx(AirplanemodeActiveOutlinedIcon, {}), from: '#3b6fd8', to: '#5b9cf5' },
    VacationReturn: { icon: _jsx(UndoOutlinedIcon, {}), from: '#6a4fd1', to: '#9b7cf0' },
    Absconding: { icon: _jsx(PersonOffOutlinedIcon, {}), from: '#c23a3a', to: '#ec6a5e' },
    AbscondingReturn: { icon: _jsx(PersonSearchOutlinedIcon, {}), from: '#b4561b', to: '#ec9447' },
    Suspension: { icon: _jsx(BlockOutlinedIcon, {}), from: '#5d6b7f', to: '#8d9bb0' },
    SuspensionLift: { icon: _jsx(LockOpenOutlinedIcon, {}), from: '#2f8f4e', to: '#5cc27c' },
    FinalExit: { icon: _jsx(ExitToAppOutlinedIcon, {}), from: '#1d2f48', to: '#40597a' },
};
/** Where a worker can be: the colors and icon of each state (period kinds and the old system's placements). */
export const stateLook = {
    Working: { color: '#1f7a4d', bg: '#e6f6ec', icon: _jsx(WorkOutlineIcon, {}) },
    Work: { color: '#1f7a4d', bg: '#e6f6ec', icon: _jsx(WorkOutlineIcon, {}) },
    Housing: { color: '#0d6e8c', bg: '#e3f3f9', icon: _jsx(HotelOutlinedIcon, {}) },
    New: { color: '#0f9b8e', bg: '#e2f6f3', icon: _jsx(NewReleasesOutlinedIcon, {}) },
    Vacation: { color: '#3b6fd8', bg: '#e8effc', icon: _jsx(AirplanemodeActiveOutlinedIcon, {}) },
    ClientVacation: { color: '#6a4fd1', bg: '#efeafc', icon: _jsx(AirplanemodeActiveOutlinedIcon, {}) },
    Absconded: { color: '#c23a3a', bg: '#fdecea', icon: _jsx(PersonOffOutlinedIcon, {}) },
    Suspended: { color: '#5d6b7f', bg: '#eef1f5', icon: _jsx(BlockOutlinedIcon, {}) },
    Out: { color: '#1d2f48', bg: '#e7ebf1', icon: _jsx(ExitToAppOutlinedIcon, {}) },
    Exited: { color: '#1d2f48', bg: '#e7ebf1', icon: _jsx(ExitToAppOutlinedIcon, {}) },
    Other: { color: '#7a6a3a', bg: '#f6f1e3', icon: _jsx(HelpOutlineIcon, {}) },
    Inactive: { color: '#7a6a3a', bg: '#f6f1e3', icon: _jsx(ConstructionOutlinedIcon, {}) },
};
const fallback = { color: '#7a6a3a', bg: '#f6f1e3', icon: _jsx(HelpOutlineIcon, {}) };
/** A state's look (an unknown state looks like "other"). */
export const lookOf = (state) => stateLook[state] ?? fallback;
export const gradient = (type) => `linear-gradient(135deg, ${typeLook[type].from} 0%, ${typeLook[type].to} 100%)`;
export const rise = keyframes `
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;
export const slideFrom = (dir) => keyframes `
  from { opacity: 0; transform: translateX(${dir * 28}px); }
  to { opacity: 1; transform: translateX(0); }
`;
const flow = keyframes `
  from { background-position: 0 0; }
  to { background-position: 24px 0; }
`;
const pulse = keyframes `
  0% { box-shadow: 0 0 0 0 rgba(255,255,255,.55); }
  70% { box-shadow: 0 0 0 12px rgba(255,255,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
`;
/** The movement type's round icon on its gradient. */
export function TypeIcon({ type, size = 44, glow = false }) {
    return (_jsx(Box, { sx: {
            width: size,
            height: size,
            flexShrink: 0,
            borderRadius: '30%',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: gradient(type),
            boxShadow: `0 8px 18px ${typeLook[type].from}40`,
            '& svg': { fontSize: size * 0.5 },
            animation: glow ? `${pulse} 2.2s infinite` : undefined,
        }, children: typeLook[type].icon }));
}
/** A state as a soft bubble: icon and name. */
export function StateBubble({ state, label, sub, big = false }) {
    const look = lookOf(state);
    return (_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }, children: [_jsx(Box, { sx: {
                    width: big ? 52 : 36,
                    height: big ? 52 : 36,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    color: look.color,
                    bgcolor: look.bg,
                    border: `2px solid ${look.color}30`,
                    '& svg': { fontSize: big ? 26 : 19 },
                }, children: look.icon }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsx(Typography, { sx: { fontSize: big ? 15 : 13, fontWeight: 800, color: look.color, lineHeight: 1.25 }, children: label }), sub && _jsx(Typography, { sx: { fontSize: big ? 12.5 : 11.5, color: '#6b7a90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: sub })] })] }));
}
/** From where the worker is to where the movement puts them, with a moving dashed arrow between. */
export function Transition({ from, fromLabel, fromSub, to, toLabel, toSub, big = false }) {
    return (_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: big ? 2 : 1.25, minWidth: 0 }, children: [_jsx(StateBubble, { state: from, label: fromLabel, sub: fromSub, big: big }), _jsx(Box, { "aria-hidden": true, sx: {
                    flex: 1,
                    minWidth: big ? 60 : 28,
                    height: 2,
                    position: 'relative',
                    backgroundImage: `linear-gradient(90deg, #b6c3d3 50%, transparent 50%)`,
                    backgroundSize: '12px 2px',
                    animation: `${flow} 1.1s linear infinite`,
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        insetInlineEnd: -2,
                        top: -4,
                        width: 0,
                        height: 0,
                        borderTop: '5px solid transparent',
                        borderBottom: '5px solid transparent',
                        borderInlineStart: '8px solid #b6c3d3',
                    },
                } }), _jsx(StateBubble, { state: to, label: toLabel, sub: toSub, big: big })] }));
}
const statusTone = { InApproval: 'warning', Returned: 'info', Rejected: 'danger', Executed: 'success', Canceled: 'neutral', CanceledAfterApproval: 'danger' };
export function MovementStatusBadge({ status }) {
    const { t } = useTranslation();
    return _jsx(Badge, { tone: statusTone[status], children: t(`movements.status.${status}`) });
}
/** The name of a state (a period kind, or the old system's placement). */
export function useStateName() {
    const { t } = useTranslation();
    return (state) => t(`movements.states.${state}`, { defaultValue: state });
}
