import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import DeskOutlinedIcon from '@mui/icons-material/DeskOutlined';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import LocalCafeOutlinedIcon from '@mui/icons-material/LocalCafeOutlined';
import RestaurantMenuOutlinedIcon from '@mui/icons-material/RestaurantMenuOutlined';
import RoomServiceOutlinedIcon from '@mui/icons-material/RoomServiceOutlined';
import SoupKitchenOutlinedIcon from '@mui/icons-material/SoupKitchenOutlined';
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined';
import { useTranslation } from 'react-i18next';
import type { NamedCode, ShowroomWorker } from '../../../api/showroom';

/** The specialty's icon (the company's own specialties get a generic one). */
export function specialtyIcon(code: string | null | undefined) {
  switch (code) {
    case 'WAITER':
      return <RoomServiceOutlinedIcon />;
    case 'HOUSEKEEPING':
      return <BedOutlinedIcon />;
    case 'HOSPITALITY':
      return <HandshakeOutlinedIcon />;
    case 'CLEANER':
      return <CleaningServicesOutlinedIcon />;
    case 'KITCHEN_HELPER':
      return <SoupKitchenOutlinedIcon />;
    case 'COOK':
      return <RestaurantMenuOutlinedIcon />;
    case 'BARISTA':
      return <LocalCafeOutlinedIcon />;
    case 'RECEPTIONIST':
      return <DeskOutlinedIcon />;
    case 'DRIVER':
      return <DirectionsCarOutlinedIcon />;
    case 'LABORER':
      return <ConstructionOutlinedIcon />;
    case null:
    case undefined:
      return <HelpOutlineOutlinedIcon />;
    default:
      return <WorkOutlineOutlinedIcon />;
  }
}

// A soft backdrop per nationality for a worker without a photo, so the grid does not read as one block.
const tints = ['#0d4a6c', '#0e7c86', '#1d4ed8', '#7c3aed', '#be185d', '#b45309', '#047857', '#4338ca'];
export function tintOf(code: string | null) {
  const n = (code ?? '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return tints[n % tints.length]!;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

/** Names in the page's language, and the worker's experience in words. */
export function useShowroomText() {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const name = (c: { nameAr: string; nameEn: string } | null | undefined) => (c ? (ar ? c.nameAr : c.nameEn) : '');
  const nationality = (w: ShowroomWorker) => (ar ? w.nationalityAr : w.nationalityEn) ?? t('showroom.noNationality');
  const months = (days: number) => Math.max(1, Math.round(days / 30));
  const experience = (w: ShowroomWorker) => (w.isNew || w.workDays === 0 ? t('showroom.card.newArrival') : t('showroom.card.months', { count: months(w.workDays) }));
  const list = (items: NamedCode[]) => items.map(name).join(ar ? '، ' : ', ');
  return { ar, name, nationality, months, experience, list };
}
