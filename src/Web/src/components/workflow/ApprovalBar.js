import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ReplyIcon from '@mui/icons-material/Reply';
import { Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Skeleton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fit, pathNodes, stageNodes } from './approvalModel';
/**
 * The approval colours (spec 16 §6, HR tokens): blue for the current stage and links, green for done, muted for what
 * is ahead. Used by the bar and its drawer only; the pages keep their own record colours.
 */
export const flow = {
    blue: '#2563EB',
    blueSoft: '#E8EFFE',
    green: '#059669',
    greenSoft: '#E3F5EE',
    red: '#DC2626',
    redSoft: '#FDECEC',
    amber: '#D97706',
    amberSoft: '#FDF1E1',
    muted: '#94A3B8',
    mutedSoft: '#F1F5F9',
    text: '#0F2747',
    textMuted: '#64748B',
    border: '#E2E8F0',
};
export const stateLook = {
    Submitted: { main: flow.green, soft: flow.greenSoft, icon: _jsx(CheckIcon, {}) },
    Done: { main: flow.green, soft: flow.greenSoft, icon: _jsx(CheckIcon, {}) },
    Current: { main: flow.blue, soft: flow.blueSoft, icon: null },
    Rejected: { main: flow.red, soft: flow.redSoft, icon: _jsx(CloseIcon, {}) },
    Returned: { main: flow.amber, soft: flow.amberSoft, icon: _jsx(ReplyIcon, {}) },
    Canceled: { main: flow.muted, soft: flow.mutedSoft, icon: _jsx(BlockIcon, {}) },
    Planned: { main: flow.muted, soft: '#fff', icon: null },
};
/** Day and time, and how long ago, in the reader's language (Riyadh time). */
export function useWhen() {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
    const short = (value) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const day = (value) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(value));
    const ago = (value) => {
        const minutes = (Date.now() - new Date(value).getTime()) / 60000;
        const format = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
        if (minutes < 60) {
            return format.format(-Math.max(1, Math.round(minutes)), 'minute');
        }
        if (minutes < 60 * 24) {
            return format.format(-Math.round(minutes / 60), 'hour');
        }
        return format.format(-Math.round(minutes / 60 / 24), 'day');
    };
    return { short, day, ago };
}
/** A stage's name in the reader's language (the submission has its own label). */
export function useStageName() {
    const { t, i18n } = useTranslation();
    return (node) => (node.state === 'Submitted' ? t('approvalBar.submitted') : i18n.language === 'ar' ? node.nameAr : node.nameEn);
}
/**
 * GlobalCompactApprovalBar (spec 16 §3.1): one row under the page header. Done stages carry a green check, the
 * current one is blue with «اعتماد» on its visual right and «رفض» on its visual left (in Arabic; mirrored in English),
 * the ones ahead are muted, and distant stages fold into chips. Without actions it is read-only; once the approval
 * ended it shows the outcome. «عرض كل المراحل» opens the history drawer.
 */
export function GlobalCompactApprovalBar({ status, actions, loadingActions, onViewAll, }) {
    const { t } = useTranslation();
    const theme = useTheme();
    const phone = !useMediaQuery(theme.breakpoints.up('sm'));
    const { day } = useWhen();
    const nodes = pathNodes(stageNodes(status));
    const running = status.status === 'InProgress';
    const canAct = running && !!(actions?.onApprove || actions?.onReject || actions?.more?.length);
    const ended = status.status !== 'InProgress' && status.status !== 'Failed';
    // Fold distant stages by the room the bar really has (beside the menu, «عرض كل المراحل» and the outcome).
    const space = useWidth();
    // The widths are estimates: when the stages still overflow once drawn, fold one more step (again on each resize).
    const [list, setList] = useState(null);
    const [tighten, setTighten] = useState(0);
    useEffect(() => setTighten(0), [space.width]);
    const items = fit(nodes, space.width - (phone ? 60 : 190) - (ended ? 130 : 0) - tighten * 120, (canAct || !!loadingActions) && !phone, tighten > 0);
    useLayoutEffect(() => {
        if (list && list.scrollWidth > list.clientWidth + 1 && tighten < 8) {
            setTighten((n) => n + 1);
        }
    });
    const endedAt = [...status.history].reverse().find((h) => h.kind === 'Completed')?.at;
    return (_jsxs(Box, { component: "section", ref: space.ref, "aria-label": t('approvalBar.label'), sx: {
            mb: 1.75,
            bgcolor: '#fff',
            border: `1px solid ${flow.border}`,
            borderRadius: '12px',
            boxShadow: '0 1px 2px rgba(15, 39, 71, .05)',
            px: { xs: 1.5, md: 2 },
            py: 1,
            minHeight: 58,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
        }, children: [_jsx(Box, { component: "ol", ref: setList, sx: { listStyle: 'none', m: 0, p: 0, flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'thin', py: 0.25 }, children: items.map((item, index) => (_jsxs(Fragment, { children: [index > 0 && _jsx(Connector, { done: doneBefore(items[index - 1]) }), item.kind === 'more' ? (_jsx(MoreChip, { item: item, onClick: onViewAll, compact: phone })) : item.node.state === 'Current' && (canAct || loadingActions) && !phone ? (_jsx(Stack, { component: "li", direction: "row", sx: { alignItems: 'center', gap: 1, flex: '0 0 auto' }, children: loadingActions && !canAct ? (_jsxs(_Fragment, { children: [_jsx(Skeleton, { variant: "rounded", width: 84, height: 34 }), _jsx(Node, { node: item.node, status: status }), _jsx(Skeleton, { variant: "rounded", width: 72, height: 34 })] })) : (_jsxs(_Fragment, { children: [actions?.onApprove && _jsx(ApproveButton, { onClick: actions.onApprove }), _jsx(Node, { node: item.node, status: status }), actions?.onReject && _jsx(RejectButton, { onClick: actions.onReject }), !!actions?.more?.length && _jsx(MoreMenu, { items: actions.more })] })) })) : (_jsx(Box, { component: "li", sx: { flex: '0 0 auto' }, children: _jsx(Node, { node: item.node, status: status }) }))] }, item.kind === 'node' ? item.node.key : `more-${item.side}`))) }), ended && (_jsxs(Box, { role: "status", sx: {
                    flex: '0 0 auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1.25,
                    py: 0.4,
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    color: outcomeLook(status.status).main,
                    bgcolor: outcomeLook(status.status).soft,
                    '& svg': { fontSize: 16 },
                }, children: [outcomeLook(status.status).icon, t(`approval.instance.${status.status}`), endedAt && _jsx("bdi", { children: day(endedAt) })] })), _jsx(Box, { "aria-hidden": true, sx: { alignSelf: 'stretch', width: '1px', bgcolor: flow.border, my: 0.5, display: { xs: 'none', sm: 'block' } } }), _jsx(Button, { variant: "outlined", size: "small", onClick: onViewAll, "aria-label": t('approvalBar.viewAll'), startIcon: phone ? undefined : _jsx(FormatListBulletedIcon, {}), sx: {
                    flex: '0 0 auto',
                    height: 34,
                    borderRadius: '8px',
                    borderColor: flow.border,
                    color: flow.blue,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    '&:hover': { borderColor: flow.blue, bgcolor: flow.blueSoft },
                    minWidth: phone ? 40 : undefined,
                    px: phone ? 1 : undefined,
                }, children: phone ? _jsx(FormatListBulletedIcon, { fontSize: "small" }) : t('approvalBar.viewAll') }), phone && canAct && (_jsx(Box, { sx: {
                    position: 'fixed',
                    insetInline: 0,
                    bottom: 0,
                    zIndex: theme.zIndex.appBar,
                    bgcolor: '#fff',
                    borderTop: `1px solid ${flow.border}`,
                    boxShadow: '0 -4px 14px rgba(15, 39, 71, .08)',
                    px: 2,
                    py: 1.25,
                }, children: _jsx(Decisions, { actions: actions }) }))] }));
}
/** Unicode first-strong isolation, so names keep their own direction inside a sentence. */
const isolate = (text) => String.fromCharCode(0x2068) + text + String.fromCharCode(0x2069);
/** The width of an element, kept up to date (1200px until measured). */
/** The element's width, measured once it is on the page (it may mount after a loading state) and on every resize. */
function useWidth() {
    const [element, setElement] = useState(null);
    const [width, setWidth] = useState(1200);
    useEffect(() => {
        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }
        const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 1200));
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);
    return { ref: setElement, width };
}
/** Whether the line after this item leads on from a done stage (green). */
const doneBefore = (item) => {
    const node = item?.kind === 'node' ? item.node : item?.nodes.at(-1);
    return node?.state === 'Done' || node?.state === 'Submitted';
};
function outcomeLook(status) {
    return status === 'Approved'
        ? stateLook.Done
        : status === 'Rejected'
            ? stateLook.Rejected
            : status === 'Returned'
                ? stateLook.Returned
                : stateLook.Canceled;
}
/** The decisions on a phone: approve, reject and the menu side by side at full touch size. */
function Decisions({ actions }) {
    return (_jsxs(Stack, { direction: "row", sx: { gap: 1, '& > .MuiButton-root': { flex: 1, height: 44 } }, children: [actions.onApprove && _jsx(ApproveButton, { onClick: actions.onApprove }), actions.onReject && _jsx(RejectButton, { onClick: actions.onReject }), !!actions.more?.length && _jsx(MoreMenu, { items: actions.more, large: true })] }));
}
function ApproveButton({ onClick }) {
    const { t } = useTranslation();
    return (_jsx(Button, { variant: "contained", disableElevation: true, onClick: onClick, startIcon: _jsx(CheckIcon, {}), sx: { height: 34, px: 2, borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', bgcolor: flow.green, '&:hover': { bgcolor: '#047857' } }, children: t('approval.approve') }));
}
function RejectButton({ onClick }) {
    const { t } = useTranslation();
    return (_jsx(Button, { variant: "outlined", onClick: onClick, startIcon: _jsx(CloseIcon, {}), sx: { height: 34, px: 1.75, borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', color: flow.red, borderColor: '#F3B4B4', '&:hover': { borderColor: flow.red, bgcolor: flow.redSoft } }, children: t('approval.reject') }));
}
function MoreMenu({ items, large }) {
    const { t } = useTranslation();
    const [anchor, setAnchor] = useState(null);
    return (_jsxs(_Fragment, { children: [_jsx(Tooltip, { title: t('approvalBar.moreActions'), children: _jsx(IconButton, { "aria-label": t('approvalBar.moreActions'), "aria-haspopup": "menu", "aria-expanded": !!anchor, onClick: (e) => setAnchor(e.currentTarget), sx: { width: large ? 44 : 34, height: large ? 44 : 34, border: `1px solid ${flow.border}`, borderRadius: '8px', color: flow.text }, children: _jsx(MoreHorizIcon, { fontSize: "small" }) }) }), _jsx(Menu, { anchorEl: anchor, open: !!anchor, onClose: () => setAnchor(null), children: items.map((item) => (_jsxs(MenuItem, { onClick: () => {
                        setAnchor(null);
                        item.onClick();
                    }, sx: { fontSize: 13.5, color: item.color }, children: [_jsx(ListItemIcon, { sx: { color: item.color ?? 'inherit', '& svg': { fontSize: 19 } }, children: item.icon }), item.label] }, item.key))) })] }));
}
/** The line between two stages: green after a done stage, grey toward what is ahead. */
function Connector({ done }) {
    return _jsx(Box, { component: "li", "aria-hidden": true, sx: { flex: '1 1 0', minWidth: 20, height: 2, mx: 1, borderRadius: 2, bgcolor: done ? '#8FD9BC' : flow.border } });
}
/** A chip standing for stages folded away («+3 مراحل»); it opens the drawer with all of them. */
function MoreChip({ item, onClick, compact }) {
    const { t } = useTranslation();
    const name = useStageName();
    const allDone = item.nodes.every((n) => n.state === 'Done' || n.state === 'Submitted');
    const label = allDone ? t('approvalBar.moreDone', { count: item.nodes.length }) : t('approvalBar.moreStages', { count: item.nodes.length });
    return (_jsx(Box, { component: "li", sx: { flex: '0 0 auto' }, children: _jsx(Tooltip, { title: item.nodes.map(name).join(' ← '), children: _jsx(Box, { component: "button", type: "button", onClick: onClick, "aria-label": label, sx: {
                    border: 0,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 12,
                    fontWeight: 600,
                    color: flow.textMuted,
                    bgcolor: flow.mutedSoft,
                    borderRadius: 999,
                    px: 1.25,
                    py: 0.4,
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: '#E2E8F0' },
                    '&:focus-visible': { outline: `2px solid ${flow.blue}`, outlineOffset: 2 },
                }, children: compact ? `+${item.nodes.length}` : label }) }) }));
}
/** One stage: its mark (check, number, cross…), name and a line on who and when. */
function Node({ node, status }) {
    const { t } = useTranslation();
    const name = useStageName()(node);
    const { short, ago } = useWhen();
    const look = stateLook[node.state];
    const current = node.state === 'Current';
    const planned = node.state === 'Planned';
    const waiting = status.waitingFor.length ? status.waitingFor : node.assignees;
    // Each part isolated in its own <bdi>: Arabic names beside English times (and the reverse) keep their order.
    const names = waiting.slice(0, 2).join('، ') + (waiting.length > 2 ? ` +${waiting.length - 2}` : '');
    const parts = current
        ? [`${t('approvalBar.waitingFor')} ${isolate(names)}`, node.openedAt ? ago(node.openedAt) : '']
        : planned
            ? [t('approvalBar.notStarted')]
            : node.state === 'Canceled'
                ? [t('approvalBar.state.Canceled')]
                : [node.decidedBy ?? '', node.decidedAt ? short(node.decidedAt) : ''];
    const detail = parts.filter(Boolean);
    return (_jsx(Tooltip, { title: _jsxs(Box, { sx: { fontSize: 12, lineHeight: 1.7 }, children: [_jsxs("div", { children: [_jsx("b", { children: name }), " \u2014 ", t(`approvalBar.state.${node.state}`)] }), node.assignees.length > 0 && !planned && _jsx("div", { children: node.assignees.join('، ') }), node.rule === 'All' && node.state !== 'Submitted' && _jsx("div", { children: t('approvalBar.ruleAll') }), node.round > 1 && _jsx("div", { children: t('approvalBar.round', { round: node.round }) }), planned && _jsx("div", { children: t('approvalBar.plannedHint') }), node.comment && _jsxs("div", { children: ["\u00AB", node.comment, "\u00BB"] })] }), children: _jsxs(Stack, { direction: "row", tabIndex: 0, "aria-label": `${name} — ${t(`approvalBar.state.${node.state}`)}${detail.length ? ` — ${detail.join(' · ')}` : ''}`, "aria-current": current ? 'step' : undefined, sx: { alignItems: 'center', gap: 1, minWidth: 0, borderRadius: '8px', '&:focus-visible': { outline: `2px solid ${flow.blue}`, outlineOffset: 2 } }, children: [_jsx(Box, { "aria-hidden": true, sx: {
                        flex: '0 0 auto',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        '& svg': { fontSize: 16 },
                        ...(current
                            ? { bgcolor: flow.blue, color: '#fff', boxShadow: `0 0 0 4px ${flow.blueSoft}` }
                            : planned
                                ? { bgcolor: '#fff', color: flow.muted, border: `1.5px solid ${flow.border}` }
                                : { bgcolor: look.soft, color: look.main }),
                    }, children: look.icon ?? node.order }), _jsxs(Box, { sx: { minWidth: 0, maxWidth: current ? 230 : 170 }, children: [_jsxs(Typography, { sx: {
                                fontSize: 13,
                                fontWeight: 700,
                                lineHeight: 1.35,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: current ? flow.blue : planned ? flow.textMuted : flow.text,
                            }, children: [name, node.round > 1 && (_jsx(Box, { component: "span", sx: { ml: 0.75, fontSize: 11, fontWeight: 700, color: flow.amber }, children: t('approvalBar.round', { round: node.round }) }))] }), detail.length > 0 && (_jsx(Typography, { sx: { fontSize: 11.5, lineHeight: 1.35, color: flow.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, children: detail.map((part, index) => (_jsxs(Fragment, { children: [index > 0 && ' · ', _jsx("bdi", { children: part })] }, index))) }))] })] }) }));
}
