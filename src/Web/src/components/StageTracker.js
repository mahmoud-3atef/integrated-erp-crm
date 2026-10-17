import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import ReplyIcon from '@mui/icons-material/Reply';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import ViewWeekOutlinedIcon from '@mui/icons-material/ViewWeekOutlined';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tokens } from '../app/theme';
// The portal's stage bar (.cp-flow): one circle per stage, linked by arrows that say how long each stage took.
const flow = {
    done: '#23a455',
    doneBg: '#e9f8ef',
    current: '#1f6fd1',
    currentBg: '#e8f1fc',
    rejected: '#e03434',
    rejectedBg: '#fdeeee',
    returned: tokens.warning,
    returnedBg: '#fdf3e1',
    unknown: '#33444f',
    muted: tokens.gray500,
    mutedBg: tokens.gray100,
};
const pulse = keyframes `
  0% { box-shadow: 0 0 0 0 rgba(31, 111, 209, .45); }
  70% { box-shadow: 0 0 0 12px rgba(31, 111, 209, 0); }
  100% { box-shadow: 0 0 0 0 rgba(31, 111, 209, 0); }
`;
const colors = {
    Done: { main: flow.done, soft: flow.doneBg },
    Submitted: { main: flow.done, soft: flow.doneBg },
    Current: { main: flow.current, soft: flow.currentBg },
    Rejected: { main: flow.rejected, soft: flow.rejectedBg },
    Returned: { main: flow.returned, soft: flow.returnedBg },
    Canceled: { main: flow.muted, soft: flow.mutedBg },
    Future: { main: flow.unknown, soft: '#fff' },
};
const badges = {
    Done: _jsx(CheckIcon, {}),
    Submitted: _jsx(SendOutlinedIcon, {}),
    Rejected: _jsx(CloseIcon, {}),
    Returned: _jsx(ReplyIcon, {}),
    Current: _jsx(HourglassEmptyIcon, {}),
};
function initials(name) {
    return (name
        .split(/\s+/)
        .filter((part) => /\p{L}/u.test(part))
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || '·');
}
/**
 * Where an approval stands, as in the old portal: the submission, every stage (who, when, the decision), the current
 * stage highlighted with its actions, and a "next stage" placeholder while it runs. Horizontal above the record, or
 * vertical.
 */
export function StageTracker({ status, actions, footer }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const [vertical, setVertical] = useState(() => {
        try {
            return localStorage.getItem('erp.tracker') === 'vertical';
        }
        catch {
            return false;
        }
    });
    const choose = (value) => {
        setVertical(value);
        try {
            localStorage.setItem('erp.tracker', value ? 'vertical' : 'horizontal');
        }
        catch {
            // Remembering the layout is only a convenience.
        }
    };
    const date = (value) => new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const nodes = [
        {
            key: 'submitted',
            state: 'Submitted',
            name: t('tracker.submitted'),
            owner: status.submittedBy,
            others: [],
            date: status.submittedAt,
            started: status.submittedAt,
            ended: status.submittedAt,
        },
        ...status.stages.map((stage, index) => ({
            key: `${stage.stepId}-${index}`,
            state: stage.state,
            name: ar ? stage.nameAr : stage.nameEn,
            owner: stage.decidedBy ?? stage.assignees[0] ?? '—',
            onBehalfOf: stage.onBehalfOf,
            others: stage.decidedBy ? [] : stage.assignees.slice(1),
            date: stage.decidedAt ?? stage.openedAt,
            started: stage.openedAt,
            ended: stage.decidedAt,
            comment: stage.comment,
        })),
    ];
    const running = status.status === 'InProgress';
    if (running) {
        nodes.push({ key: 'future', state: 'Future', name: t('tracker.future'), owner: t('tracker.futureHint'), others: [], date: '', started: '', ended: null });
    }
    const stages = status.stages.length;
    const finished = status.stages.filter((s) => s.state === 'Done').length;
    const complete = status.status === 'Approved';
    const pill = status.status === 'Approved'
        ? colors.Done
        : status.status === 'Rejected' || status.status === 'Failed'
            ? colors.Rejected
            : status.status === 'Returned'
                ? colors.Returned
                : status.status === 'Canceled'
                    ? colors.Canceled
                    : colors.Current;
    return (_jsxs(Box, { sx: {
            mb: `${tokens.gap}px`,
            p: '16px 18px 12px',
            border: `1px solid ${complete ? '#bfe6cc' : tokens.border}`,
            borderRadius: `${tokens.radiusLg}px`,
            background: complete ? 'linear-gradient(180deg, #f3fbf6 0%, #fff 60%)' : '#fff',
            boxShadow: tokens.shadowSm,
        }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 1.25, flexWrap: 'wrap', mb: 0.75 }, children: [_jsxs(Box, { sx: { display: 'inline-flex', alignItems: 'center', gap: 1, color: tokens.navy800, fontSize: 15, fontWeight: 800 }, children: [_jsx(RouteOutlinedIcon, { sx: { color: tokens.navy700 } }), t('tracker.title')] }), _jsxs(Typography, { sx: { fontSize: 12.5, color: tokens.gray500 }, children: [ar ? status.processNameAr : status.processNameEn, " \u2014 ", t('tracker.count', { done: finished, total: stages })] }), _jsx(Box, { sx: { px: 1.25, py: 0.25, borderRadius: 999, fontSize: 12, fontWeight: 700, color: pill.main, bgcolor: pill.soft, border: `1px solid ${pill.main}33` }, children: t(`approval.instance.${status.status}`) }), _jsx(Box, { sx: { flex: 1 } }), _jsx(Tooltip, { title: t('tracker.horizontal'), children: _jsx(IconButton, { size: "small", "aria-pressed": !vertical, onClick: () => choose(false), sx: { color: vertical ? tokens.gray500 : tokens.navy700 }, children: _jsx(ViewWeekOutlinedIcon, { fontSize: "small" }) }) }), _jsx(Tooltip, { title: t('tracker.vertical'), children: _jsx(IconButton, { size: "small", "aria-pressed": vertical, onClick: () => choose(true), sx: { color: vertical ? tokens.navy700 : tokens.gray500 }, children: _jsx(TableRowsOutlinedIcon, { fontSize: "small" }) }) })] }), _jsx(Box, { component: "ol", sx: {
                    listStyle: 'none',
                    m: 0,
                    p: vertical ? '8px 4px 4px' : '14px 4px 10px',
                    display: 'flex',
                    flexDirection: vertical ? 'column' : 'row',
                    alignItems: vertical ? 'stretch' : 'flex-start',
                    overflowX: vertical ? 'visible' : 'auto',
                }, children: nodes.map((node, index) => (_jsxs(Box, { component: "li", sx: { display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: vertical ? 'stretch' : 'flex-start', flex: '0 0 auto' }, children: [index > 0 && _jsx(Link, { vertical: vertical, node: node }), _jsx(StageNode, { node: node, vertical: vertical, date: date, actions: node.state === 'Current' ? actions : undefined })] }, node.key))) }), footer] }));
}
/** The arrow between two stages, with the time the second one took (or has been open). */
function Link({ vertical, node }) {
    const { t } = useTranslation();
    const future = node.state === 'Future';
    const color = future ? tokens.gray300 : colors[node.state].main;
    const label = future || !node.started ? '' : duration(t, node.started, node.ended);
    if (vertical) {
        return (_jsxs(Box, { sx: { display: 'flex', alignItems: 'center', gap: 1, marginInlineStart: '25px', minHeight: 30 }, children: [_jsx(Box, { sx: { width: 3, alignSelf: 'stretch', minHeight: 30, bgcolor: color, borderRadius: 2, opacity: future ? 1 : 0.85, ...(future && { background: `repeating-linear-gradient(180deg, ${color} 0 6px, transparent 6px 10px)` }) } }), label && _jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, fontWeight: 600 }, children: label })] }));
    }
    return (_jsxs(Box, { sx: { position: 'relative', width: 70, flex: '0 0 auto', mt: '22px' }, children: [label && (_jsx(Typography, { sx: { position: 'absolute', insetInline: 0, top: -20, textAlign: 'center', fontSize: 11.5, color: tokens.gray500, fontWeight: 600, whiteSpace: 'nowrap' }, children: label })), _jsx(Box, { sx: {
                    height: 3,
                    borderRadius: 2,
                    bgcolor: future ? 'transparent' : color,
                    ...(future && { background: `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 10px)` }),
                } }), _jsx(Box, { sx: {
                    position: 'absolute',
                    top: -4,
                    insetInlineEnd: -1,
                    width: 0,
                    height: 0,
                    borderTop: '5.5px solid transparent',
                    borderBottom: '5.5px solid transparent',
                    borderInlineStart: `8px solid ${color}`,
                } })] }));
}
function StageNode({ node, vertical, date, actions }) {
    const { t } = useTranslation();
    const color = colors[node.state];
    const current = node.state === 'Current';
    const future = node.state === 'Future';
    const size = current ? 54 : 46;
    const hasActions = current && (actions?.onApprove || actions?.onReject);
    const circle = (_jsx(Tooltip, { title: future ? ('') : (_jsxs(Box, { sx: { fontSize: 12, lineHeight: 1.7 }, children: [node.others.length > 0 && _jsx("div", { children: t('approval.with', { names: [node.owner, ...node.others].join('، ') }) }), node.onBehalfOf && _jsx("div", { children: t('tracker.onBehalf', { name: node.onBehalfOf }) }), node.comment && _jsxs("div", { children: ["\u00AB", node.comment, "\u00BB"] }), !node.others.length && !node.onBehalfOf && !node.comment && _jsx("div", { children: node.owner })] })), children: _jsxs(Box, { sx: { position: 'relative', flex: '0 0 auto', width: size, height: size }, children: [_jsx(Box, { sx: {
                        display: 'grid',
                        placeItems: 'center',
                        width: size,
                        height: size,
                        borderRadius: '50%',
                        fontWeight: 800,
                        fontSize: size * 0.34,
                        ...(future
                            ? { border: `2px dashed ${flow.unknown}`, color: flow.unknown, bgcolor: '#fff' }
                            : current
                                ? { bgcolor: color.main, color: '#fff', animation: `${pulse} 1.8s infinite` }
                                : { bgcolor: color.soft, color: color.main, border: `2px solid ${color.main}` }),
                    }, children: future ? '?' : initials(node.owner) }), badges[node.state] && (_jsx(Box, { "aria-hidden": true, sx: {
                        position: 'absolute',
                        bottom: -2,
                        insetInlineStart: -2,
                        display: 'grid',
                        placeItems: 'center',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: color.main,
                        color: '#fff',
                        border: '2px solid #fff',
                        '& svg': { fontSize: 12 },
                    }, children: badges[node.state] })), node.others.length > 0 && (_jsxs(Box, { sx: { position: 'absolute', top: -4, insetInlineEnd: -6, px: 0.6, borderRadius: 999, fontSize: 10.5, fontWeight: 800, bgcolor: tokens.navy700, color: '#fff', border: '2px solid #fff' }, children: ["+", node.others.length] }))] }) }));
    const text = (_jsxs(Box, { sx: { minWidth: 0, textAlign: vertical ? 'start' : 'center' }, children: [_jsx(Typography, { sx: { fontSize: 13.5, fontWeight: 800, color: future ? flow.unknown : tokens.navy800, lineHeight: 1.35 }, children: node.name }), future ? (_jsx(Typography, { sx: { fontSize: 11.5, color: tokens.gray500, mt: 0.25 }, children: node.owner })) : (_jsxs(_Fragment, { children: [_jsxs(Meta, { icon: _jsx(PersonOutlinedIcon, {}), vertical: vertical, children: [node.owner, node.others.length > 0 ? ` +${node.others.length}` : ''] }), _jsx(Meta, { icon: _jsx(CalendarTodayOutlinedIcon, {}), vertical: vertical, children: date(node.date) }), !hasActions && (_jsx(Box, { sx: { display: 'inline-block', mt: 0.5, px: 1.1, py: 0.1, borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: color.main, bgcolor: color.soft }, children: t(`tracker.state.${node.state}`) }))] })), hasActions && (_jsxs(Box, { sx: { mt: 1 }, children: [_jsxs(Stack, { direction: "row", sx: { gap: 0.75, justifyContent: vertical ? 'flex-start' : 'center', alignItems: 'center', flexWrap: 'wrap' }, children: [actions?.onApprove && (_jsx(Button, { size: "small", variant: "contained", color: "success", startIcon: _jsx(CheckIcon, {}), onClick: actions.onApprove, children: t('approval.approve') })), _jsx(Box, { sx: { px: 1.25, py: 0.4, borderRadius: 999, fontSize: 12, fontWeight: 700, color: flow.current, bgcolor: flow.currentBg }, children: t('tracker.state.Current') }), actions?.onReject && (_jsx(Button, { size: "small", variant: "contained", color: "error", startIcon: _jsx(CloseIcon, {}), onClick: actions.onReject, children: t('approval.reject') }))] }), _jsx(Typography, { sx: { mt: 0.75, fontSize: 11.5, color: tokens.gray500 }, children: t('tracker.openSince', { time: duration(t, node.started, null) }) })] }))] }));
    if (vertical) {
        return (_jsxs(Box, { sx: { display: 'flex', gap: 1.5, alignItems: 'flex-start', p: current ? 1.25 : 0, borderRadius: '14px', bgcolor: current ? flow.currentBg : 'transparent' }, children: [circle, text] }));
    }
    return (_jsxs(Stack, { sx: { alignItems: 'center', gap: 0.75, width: hasActions ? 340 : 150, flex: '0 0 auto', px: 0.5 }, children: [circle, text] }));
}
function Meta({ icon, children, vertical }) {
    return (_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', justifyContent: vertical ? 'flex-start' : 'center', gap: 0.5, mt: 0.25, color: tokens.gray600, fontSize: 12, '& svg': { fontSize: 13, color: tokens.gray500 } }, children: [icon, _jsx("span", { children: children })] }));
}
/** "less than a minute", "5 min", "2 h", "11 days". */
function duration(t, from, to) {
    const minutes = Math.max(0, ((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60000);
    if (minutes < 1) {
        return t('tracker.lessThanMinute');
    }
    if (minutes < 60) {
        return t('tracker.minutes', { count: Math.floor(minutes) });
    }
    if (minutes < 60 * 24) {
        return t('tracker.hours', { count: Math.floor(minutes / 60) });
    }
    return t('tracker.days', { count: Math.floor(minutes / 60 / 24) });
}
