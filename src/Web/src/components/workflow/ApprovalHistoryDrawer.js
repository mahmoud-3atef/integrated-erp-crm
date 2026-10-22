import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplyIcon from '@mui/icons-material/Reply';
import { Box, Button, Collapse, Drawer, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApprovalFeed } from '../ApprovalTimeline';
import { flow, stateLook, useStageName, useWhen } from './ApprovalBar';
import { stageNodes } from './approvalModel';
/**
 * ApprovalHistoryDrawer (spec 16 §3.2): every stage of the approval from the start side, earlier rounds included,
 * with its rule, approvers, dates and comments, the stages still planned, then the full event log. It overlays the
 * page (the grid keeps its width) and, being modal, is the only drawer open; focus returns to the button that opened it.
 */
export function ApprovalHistoryDrawer({ open, onClose, status, title, actions, canReturn, onReturn, fieldName, fieldValue, }) {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const { short } = useWhen();
    const [log, setLog] = useState(false);
    const nodes = stageNodes(status);
    return (_jsxs(Drawer, { anchor: "left", open: open, onClose: onClose, slotProps: { paper: { sx: { width: { xs: '100%', sm: 520 }, maxWidth: '100%' } } }, children: [_jsxs(Box, { component: "header", sx: { display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2.5, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${flow.border}` }, children: [_jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsx(Typography, { component: "h2", id: "approval-drawer-title", sx: { fontSize: 18, fontWeight: 700, color: flow.text }, children: t('approvalBar.drawerTitle') }), _jsxs(Typography, { sx: { fontSize: 12.5, color: flow.textMuted, mt: 0.25 }, children: [title ? (_jsxs(_Fragment, { children: [_jsx("bdi", { children: title }), " \u00B7", ' '] })) : null, ar ? status.processNameAr : status.processNameEn, " \u00B7 ", t('approvalBar.startedBy', { date: short(status.submittedAt), name: status.submittedBy })] }), _jsxs(Box, { sx: {
                                    display: 'inline-block',
                                    mt: 1,
                                    px: 1.1,
                                    py: 0.2,
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: status.status === 'InProgress' ? flow.blue : status.status === 'Approved' ? flow.green : status.status === 'Returned' ? flow.amber : status.status === 'Canceled' ? flow.textMuted : flow.red,
                                    bgcolor: status.status === 'InProgress' ? flow.blueSoft : status.status === 'Approved' ? flow.greenSoft : status.status === 'Returned' ? flow.amberSoft : status.status === 'Canceled' ? flow.mutedSoft : flow.redSoft,
                                }, children: [t(`approval.instance.${status.status}`), status.status === 'InProgress' && (ar ? status.currentStepAr : status.currentStepEn) ? ` — ${ar ? status.currentStepAr : status.currentStepEn}` : ''] })] }), _jsx(Tooltip, { title: t('approvalBar.close'), children: _jsx(IconButton, { onClick: onClose, "aria-label": t('approvalBar.close'), sx: { border: `1px solid ${flow.border}`, borderRadius: '8px' }, children: _jsx(CloseIcon, { fontSize: "small" }) }) })] }), _jsxs(Box, { sx: { flex: 1, overflowY: 'auto', px: 2.5, py: 2 }, children: [_jsx(Box, { component: "ol", "aria-labelledby": "approval-drawer-title", sx: { listStyle: 'none', m: 0, p: 0 }, children: nodes.map((node, index) => (_jsx(StageEntry, { node: node, last: index === nodes.length - 1, actions: node.state === 'Current' ? actions : undefined, canReturn: node.state === 'Current' && canReturn, onReturn: onReturn }, node.key))) }), status.history.length > 0 && (_jsxs(Box, { sx: { mt: 2.5, pt: 1.5, borderTop: `1px solid ${flow.border}` }, children: [_jsx(Button, { onClick: () => setLog(!log), "aria-expanded": log, endIcon: _jsx(ExpandMoreIcon, { sx: { transition: 'transform .2s', transform: log ? 'rotate(180deg)' : 'none' } }), sx: { color: flow.text, fontWeight: 700, px: 0.5 }, children: t('approvalBar.eventLog', { count: status.history.length }) }), _jsx(Collapse, { in: log, unmountOnExit: true, children: _jsx(Box, { sx: { pt: 1 }, children: _jsx(ApprovalFeed, { status: status, fieldName: fieldName, fieldValue: fieldValue }) }) })] }))] })] }));
}
function StageEntry({ node, last, actions, canReturn, onReturn, }) {
    const { t } = useTranslation();
    const name = useStageName()(node);
    const { short } = useWhen();
    const look = stateLook[node.state];
    const current = node.state === 'Current';
    const planned = node.state === 'Planned';
    const decidedLabel = node.state === 'Rejected' ? 'approvalBar.rejectedOn' : node.state === 'Returned' ? 'approvalBar.returnedOn' : node.state === 'Submitted' ? 'approvalBar.sentOn' : 'approvalBar.approvedOn';
    return (_jsxs(Box, { component: "li", "aria-current": current ? 'step' : undefined, sx: { display: 'flex', gap: 1.5, position: 'relative', pb: last ? 0 : 2.25, opacity: node.superseded ? 0.85 : 1 }, children: [!last && _jsx(Box, { "aria-hidden": true, sx: { position: 'absolute', insetInlineStart: 13, top: 32, bottom: 2, width: 2, bgcolor: flow.border } }), _jsx(Box, { "aria-hidden": true, sx: {
                    flex: '0 0 auto',
                    zIndex: 1,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    '& svg': { fontSize: 16 },
                    ...(current
                        ? { bgcolor: flow.blue, color: '#fff', boxShadow: `0 0 0 4px ${flow.blueSoft}` }
                        : planned
                            ? { bgcolor: '#fff', color: flow.muted, border: `1.5px solid ${flow.border}` }
                            : { bgcolor: look.soft, color: look.main }),
                }, children: look.icon ?? (node.order || '•') }), _jsxs(Box, { sx: { flex: 1, minWidth: 0 }, children: [_jsxs(Stack, { direction: "row", sx: { alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }, children: [_jsx(Typography, { sx: { fontSize: 14, fontWeight: 700, color: current ? flow.blue : planned ? flow.textMuted : flow.text }, children: name }), _jsx(Tag, { color: look.main, soft: planned ? flow.mutedSoft : look.soft, children: t(`approvalBar.state.${node.state}`) }), node.superseded && _jsx(Tag, { color: flow.amber, soft: flow.amberSoft, children: t('approvalBar.earlierRound') }), node.round > 1 && _jsx(Tag, { color: flow.amber, soft: flow.amberSoft, children: t('approvalBar.round', { round: node.round }) })] }), planned ? (_jsxs(Typography, { sx: { fontSize: 12.5, color: flow.textMuted, mt: 0.25 }, children: [t('approvalBar.plannedHint'), node.rule === 'All' ? ` · ${t('approvalBar.ruleAll')}` : ''] })) : (_jsxs(_Fragment, { children: [node.state !== 'Submitted' && (_jsxs(Typography, { sx: { fontSize: 12.5, color: flow.textMuted, mt: 0.25 }, children: [node.assignees.join('، '), node.assignees.length > 1 || node.rule === 'All' ? ` · ${t(node.rule === 'All' ? 'approvalBar.ruleAll' : 'approvalBar.ruleAny')}` : ''] })), _jsxs(Typography, { sx: { fontSize: 12, color: flow.textMuted, mt: 0.25 }, children: [node.state !== 'Submitted' && node.openedAt && (_jsxs(_Fragment, { children: [t('approvalBar.assignedOn', { date: short(node.openedAt) }), node.decidedAt || current ? ' · ' : ''] })), current && t('approvalBar.awaitingDecision'), node.decidedAt && node.state !== 'Canceled' && (_jsxs(_Fragment, { children: [t(decidedLabel, { date: short(node.decidedAt) }), node.decidedBy ? ` — ${node.decidedBy}` : ''] })), node.onBehalfOf && ` (${t('tracker.onBehalf', { name: node.onBehalfOf })})`] })] })), node.comment && (_jsx(Typography, { sx: { mt: 0.75, px: 1.25, py: 0.75, fontSize: 12.5, borderRadius: '8px', bgcolor: '#F6F8FC', border: `1px solid ${flow.border}`, color: flow.text, whiteSpace: 'pre-wrap' }, children: node.comment })), current && (actions?.onApprove || actions?.onReject || canReturn) && (_jsxs(Stack, { direction: "row", sx: { gap: 1, mt: 1.25, flexWrap: 'wrap' }, children: [actions?.onApprove && (_jsx(Button, { variant: "contained", disableElevation: true, startIcon: _jsx(CheckIcon, {}), onClick: actions.onApprove, sx: { height: 34, borderRadius: '8px', fontWeight: 700, bgcolor: flow.green, '&:hover': { bgcolor: '#047857' } }, children: t('approval.approve') })), actions?.onReject && (_jsx(Button, { variant: "outlined", startIcon: _jsx(CloseIcon, {}), onClick: actions.onReject, sx: { height: 34, borderRadius: '8px', fontWeight: 700, color: flow.red, borderColor: '#F3B4B4', '&:hover': { borderColor: flow.red, bgcolor: flow.redSoft } }, children: t('approval.reject') })), canReturn && onReturn && (_jsx(Button, { variant: "outlined", startIcon: _jsx(ReplyIcon, {}), onClick: onReturn, sx: { height: 34, borderRadius: '8px', fontWeight: 700, color: flow.text, borderColor: flow.border }, children: t('approval.return') }))] }))] })] }));
}
function Tag({ color, soft, children }) {
    return (_jsx(Box, { component: "span", sx: { px: 0.9, py: 0.1, borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color, bgcolor: soft }, children: children }));
}
