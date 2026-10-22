import { jsx as _jsx } from "react/jsx-runtime";
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import FlightTakeoffOutlinedIcon from '@mui/icons-material/FlightTakeoffOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
/** The old employee pages' status colours (.cp-ed-fact-status.is-*) and icons. */
export const placementLook = {
    Working: { tone: '#0e7c86', soft: '#e8f4f5', icon: _jsx(WorkOutlineOutlinedIcon, {}) },
    New: { tone: '#1b6a92', soft: '#eaf3f8', icon: _jsx(PersonAddAltOutlinedIcon, {}) },
    Housing: { tone: '#b38a0f', soft: '#faf5e8', icon: _jsx(BedOutlinedIcon, {}) },
    Vacation: { tone: '#2b8fd6', soft: '#eaf4fc', icon: _jsx(BeachAccessOutlinedIcon, {}) },
    Suspended: { tone: '#d9822b', soft: '#fdf2e6', icon: _jsx(BlockOutlinedIcon, {}) },
    Exited: { tone: '#c0392b', soft: '#fdeeee', icon: _jsx(FlightTakeoffOutlinedIcon, {}) },
    Absconded: { tone: '#7a2e8e', soft: '#f5ecf7', icon: _jsx(PersonOffOutlinedIcon, {}) },
    Other: { tone: '#66798a', soft: '#edf2f6', icon: _jsx(HelpOutlineOutlinedIcon, {}) },
    Inactive: { tone: '#8aa1b1', soft: '#edf2f6', icon: _jsx(HelpOutlineOutlinedIcon, {}) },
};
/** The status cards of each list: the old workers page's six; staff are never in workers' housing. */
export const placementCards = {
    Worker: ['Working', 'New', 'Housing', 'Vacation', 'Suspended', 'Exited'],
    Staff: ['Working', 'New', 'Vacation', 'Suspended', 'Exited'],
};
