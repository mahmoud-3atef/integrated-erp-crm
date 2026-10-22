import { jsx as _jsx } from "react/jsx-runtime";
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
/** The specialty's icon (the company's own specialties get a generic one). */
export function specialtyIcon(code) {
    switch (code) {
        case 'WAITER':
            return _jsx(RoomServiceOutlinedIcon, {});
        case 'HOUSEKEEPING':
            return _jsx(BedOutlinedIcon, {});
        case 'HOSPITALITY':
            return _jsx(HandshakeOutlinedIcon, {});
        case 'CLEANER':
            return _jsx(CleaningServicesOutlinedIcon, {});
        case 'KITCHEN_HELPER':
            return _jsx(SoupKitchenOutlinedIcon, {});
        case 'COOK':
            return _jsx(RestaurantMenuOutlinedIcon, {});
        case 'BARISTA':
            return _jsx(LocalCafeOutlinedIcon, {});
        case 'RECEPTIONIST':
            return _jsx(DeskOutlinedIcon, {});
        case 'DRIVER':
            return _jsx(DirectionsCarOutlinedIcon, {});
        case 'LABORER':
            return _jsx(ConstructionOutlinedIcon, {});
        case null:
        case undefined:
            return _jsx(HelpOutlineOutlinedIcon, {});
        default:
            return _jsx(WorkOutlineOutlinedIcon, {});
    }
}
// A soft backdrop per nationality for a worker without a photo, so the grid does not read as one block.
const tints = ['#0d4a6c', '#0e7c86', '#1d4ed8', '#7c3aed', '#be185d', '#b45309', '#047857', '#4338ca'];
export function tintOf(code) {
    const n = (code ?? '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return tints[n % tints.length];
}
export function initialsOf(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}
/** Names in the page's language, and the worker's experience in words. */
export function useShowroomText() {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const name = (c) => (c ? (ar ? c.nameAr : c.nameEn) : '');
    const nationality = (w) => (ar ? w.nationalityAr : w.nationalityEn) ?? t('showroom.noNationality');
    const months = (days) => Math.max(1, Math.round(days / 30));
    const experience = (w) => (w.isNew || w.workDays === 0 ? t('showroom.card.newArrival') : t('showroom.card.months', { count: months(w.workDays) }));
    const list = (items) => items.map(name).join(ar ? '، ' : ', ');
    return { ar, name, nationality, months, experience, list };
}
