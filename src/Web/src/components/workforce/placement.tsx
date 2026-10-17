import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import BeachAccessOutlinedIcon from '@mui/icons-material/BeachAccessOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import FlightTakeoffOutlinedIcon from '@mui/icons-material/FlightTakeoffOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import type { ReactNode } from 'react';
import type { Placement } from '../../api/workforce';

/** The old employee pages' status colours (.cp-ed-fact-status.is-*) and icons. */
export const placementLook: Record<Placement, { tone: string; soft: string; icon: ReactNode }> = {
  Working: { tone: '#0e7c86', soft: '#e8f4f5', icon: <WorkOutlineOutlinedIcon /> },
  New: { tone: '#1b6a92', soft: '#eaf3f8', icon: <PersonAddAltOutlinedIcon /> },
  Housing: { tone: '#b38a0f', soft: '#faf5e8', icon: <BedOutlinedIcon /> },
  Vacation: { tone: '#2b8fd6', soft: '#eaf4fc', icon: <BeachAccessOutlinedIcon /> },
  Suspended: { tone: '#d9822b', soft: '#fdf2e6', icon: <BlockOutlinedIcon /> },
  Exited: { tone: '#c0392b', soft: '#fdeeee', icon: <FlightTakeoffOutlinedIcon /> },
  Absconded: { tone: '#7a2e8e', soft: '#f5ecf7', icon: <PersonOffOutlinedIcon /> },
  Other: { tone: '#66798a', soft: '#edf2f6', icon: <HelpOutlineOutlinedIcon /> },
};

/** The six status cards of the old employees page, in its order. */
export const placementCards: Placement[] = ['Working', 'New', 'Housing', 'Vacation', 'Suspended', 'Exited'];
