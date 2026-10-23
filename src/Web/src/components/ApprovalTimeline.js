import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ForwardIcon from '@mui/icons-material/Forward';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import ReplyIcon from '@mui/icons-material/Reply';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { tokens } from '../app/theme';
import { Badge } from './ui';
const look = {
    Submitted: { icon: _jsx(SendOutlinedIcon, {}), color: tokens.navy700 },
    StageOpened: { icon: _jsx(HourglassEmptyIcon, {}), color: tokens.info },
    Approved: { icon: _jsx(CheckIcon, {}), color: tokens.success },
    Rejected: { icon: _jsx(CloseIcon, {}), color: tokens.danger },
    Returned: { icon: _jsx(ReplyIcon, {}), color: tokens.warning },
    Delegated: { icon: _jsx(ForwardIcon, {}), color: tokens.teal },
    Reassigned: { icon: _jsx(SwapHorizIcon, {}), color: tokens.gold },
    ConditionEvaluated: { icon: _jsx(AccountTreeOutlinedIcon, {}), color: tokens.gold },
    RecordUpdated: { icon: _jsx(EditNoteOutlinedIcon, {}), color: tokens.teal },
    ActionRun: { icon: _jsx(BoltOutlinedIcon, {}), color: '#7C3AED' },
    Notified: { icon: _jsx(NotificationsNoneOutlinedIcon, {}), color: tokens.info },
    Completed: { icon: _jsx(FlagOutlinedIcon, {}), color: tokens.navy800 },
    Canceled: { icon: _jsx(BlockIcon, {}), color: tokens.gray500 },
    Failed: { icon: _jsx(ErrorOutlinedIcon, {}), color: tokens.danger },
    Retried: { icon: _jsx(ReplayIcon, {}), color: tokens.navy600 },
};
export const statusTone = {
    InProgress: 'info',
    Approved: 'success',
    Rejected: 'danger',
    Returned: 'warning',
    Canceled: 'neutral',
    Failed: 'danger',
};
/** The approval's full history, oldest first: every submission, stage, decision, update and notification. */
export function ApprovalTimeline({ status, fieldName }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const when = (value) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    return (_jsxs(Box, { children: [_jsxs(Stack, { direction: "row", sx: { gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }, children: [_jsx(Badge, { tone: statusTone[status.status] ?? 'neutral', children: t(`approval.instance.${status.status}`) }), _jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: [ar ? status.processNameAr : status.processNameEn, " \u2014 ", t('routes.version', { version: status.processVersion })] })] }), status.status === 'InProgress' && status.waitingFor.length > 0 && (_jsxs(Box, { sx: { mb: 2, p: 1.25, borderRadius: '10px', bgcolor: tokens.navy50 }, children: [_jsx(Typography, { sx: { fontSize: 13, fontWeight: 600, color: tokens.navy800 }, children: ar ? status.currentStepAr : status.currentStepEn }), _jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: t('approval.with', { names: status.waitingFor.join('، ') }) })] })), _jsx(Box, { component: "ol", sx: { listStyle: 'none', m: 0, p: 0 }, children: status.history.map((entry, index) => (_jsx(Entry, { entry: entry, last: index === status.history.length - 1, when: when, ar: ar, fieldName: fieldName }, entry.sequence))) })] }));
}
function Entry({ entry, last, when, ar, fieldName }) {
    const { t } = useTranslation();
    const style = look[entry.kind] ?? { icon: null, color: tokens.gray300 };
    const step = ar ? entry.stepNameAr : entry.stepNameEn;
    return (_jsxs(Box, { component: "li", sx: { display: 'flex', gap: 1.5, position: 'relative', pb: last ? 0 : 2 }, children: [!last && _jsx(Box, { "aria-hidden": true, sx: { position: 'absolute', insetInlineStart: 12, top: 26, bottom: 0, width: 2, bgcolor: tokens.gray200 } }), _jsx(Box, { "aria-hidden": true, sx: { flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: '50%', bgcolor: style.color, color: '#fff', zIndex: 1, '& svg': { fontSize: 15 } }, children: style.icon }), _jsxs(Box, { sx: { minWidth: 0 }, children: [_jsxs(Typography, { sx: { fontSize: 13.5, fontWeight: 600, color: tokens.navy800 }, children: [t(`approval.event.${entry.kind}`, { defaultValue: entry.kind }), step ? ` — ${step}` : '', entry.kind === 'Completed' && entry.outcome ? ` (${t(`approval.instance.${entry.outcome}`)})` : '', entry.kind === 'Returned' && (ar ? entry.returnToAr : entry.returnToEn) ? ` ${t('approval.returnedTo', { name: ar ? entry.returnToAr : entry.returnToEn })}` : ''] }), entry.actor && (_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray600 }, children: entry.onBehalfOf ? t('approval.byOnBehalf', { name: entry.actor, original: entry.onBehalfOf }) : t('approval.by', { name: entry.actor }) })), _jsx(Typography, { sx: { fontSize: 12, color: tokens.gray500 }, children: when(entry.at) }), entry.changes && (_jsx(Box, { sx: { mt: 0.5, fontSize: 12.5, color: tokens.gray700 }, children: Object.entries(entry.changes).map(([key, value]) => (_jsxs("div", { children: [fieldName ? fieldName(key) : key, ": ", _jsx("b", { children: value ?? '—' })] }, key))) })), entry.comment && (_jsx(Typography, { sx: { mt: 0.5, px: 1.25, py: 0.75, fontSize: 12.5, borderRadius: '8px', bgcolor: tokens.gray50, border: `1px solid ${tokens.border}`, whiteSpace: 'pre-wrap' }, children: entry.comment }))] })] }));
}
/**
 * The approval's history as a feed (newest first): a tinted icon on a thin line, what happened and by whom, and the
 * day and time at the end of the row.
 */
export function ApprovalFeed({ status, fieldName, fieldValue, }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const locale = ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
    const day = (value) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const time = (value) => new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const entries = [...status.history].reverse();
    return (_jsx(Box, { component: "ol", sx: { listStyle: 'none', m: 0, p: 0 }, children: entries.map((entry, index) => {
            const style = look[entry.kind] ?? { icon: null, color: tokens.gray300 };
            const step = ar ? entry.stepNameAr : entry.stepNameEn;
            const last = index === entries.length - 1;
            const by = entry.actor ? (entry.onBehalfOf ? t('approval.byOnBehalf', { name: entry.actor, original: entry.onBehalfOf }) : t('approval.by', { name: entry.actor })) : null;
            return (_jsxs(Box, { component: "li", sx: { display: 'flex', gap: 1.5, alignItems: 'flex-start', position: 'relative', py: 1.1 }, children: [!last && _jsx(Box, { "aria-hidden": true, sx: { position: 'absolute', insetInlineStart: 13, top: 38, bottom: -6, width: 2, bgcolor: tokens.gray100 } }), _jsx(Box, { "aria-hidden": true, sx: { flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: '50%', bgcolor: `${style.color}1f`, color: style.color, zIndex: 1, '& svg': { fontSize: 16 } }, children: style.icon }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Typography, { sx: { fontSize: 13.5, fontWeight: 700, color: tokens.navy800 }, children: [t(`approval.event.${entry.kind}`, { defaultValue: entry.kind }), step ? ` — ${step}` : '', entry.kind === 'Completed' && entry.outcome ? ` (${t(`approval.instance.${entry.outcome}`)})` : '', entry.kind === 'Returned' && (ar ? entry.returnToAr : entry.returnToEn) ? ` ${t('approval.returnedTo', { name: ar ? entry.returnToAr : entry.returnToEn })}` : ''] }), (by || entry.comment) && (_jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: [by, by && entry.comment ? ' — ' : '', entry.comment ? `«${entry.comment}»` : ''] })), entry.changes && (_jsx(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: Object.entries(entry.changes)
                                    .map(([key, value]) => `${fieldName ? fieldName(key) : key}: ${fieldValue ? fieldValue(key, value) : (value ?? '—')}`)
                                    .join(' · ') }))] }), _jsxs(Stack, { direction: "row", sx: { flex: '0 0 auto', gap: 2, fontSize: 12, color: tokens.gray500, whiteSpace: 'nowrap', pt: 0.25 }, children: [_jsx("span", { children: day(entry.at) }), _jsx(Box, { component: "span", sx: { minWidth: 58, textAlign: 'end' }, children: time(entry.at) })] })] }, entry.sequence));
        }) }));
}
