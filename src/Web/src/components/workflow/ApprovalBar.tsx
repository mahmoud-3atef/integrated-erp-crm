import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ReplyIcon from '@mui/icons-material/Reply';
import { Box, Button, IconButton, ListItemIcon, Menu, MenuItem, Skeleton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Fragment, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApprovalStatus } from '../../api/workflow';
import { fit, pathNodes, stageNodes, type BarItem, type StageNode, type StageState } from './approvalModel';

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

export const stateLook: Record<StageState, { main: string; soft: string; icon: ReactNode | null }> = {
  Submitted: { main: flow.green, soft: flow.greenSoft, icon: <CheckIcon /> },
  Done: { main: flow.green, soft: flow.greenSoft, icon: <CheckIcon /> },
  Current: { main: flow.blue, soft: flow.blueSoft, icon: null },
  Rejected: { main: flow.red, soft: flow.redSoft, icon: <CloseIcon /> },
  Returned: { main: flow.amber, soft: flow.amberSoft, icon: <ReplyIcon /> },
  Canceled: { main: flow.muted, soft: flow.mutedSoft, icon: <BlockIcon /> },
  Planned: { main: flow.muted, soft: '#fff', icon: null },
};

export interface BarMenuAction {
  key: string;
  label: string;
  icon: ReactNode;
  color?: string;
  onClick: () => void;
}

/** What the current user may do on the current stage, from the server's available actions only. */
export interface BarActions {
  onApprove?: () => void;
  onReject?: () => void;
  /** Less frequent actions (return, delegate, cancel), in the ⋯ menu beside the current stage. */
  more?: BarMenuAction[];
}

/** Day and time, and how long ago, in the reader's language (Riyadh time). */
export function useWhen() {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  const short = (value: string) =>
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const day = (value: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(value));
  const ago = (value: string) => {
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
  return (node: StageNode) => (node.state === 'Submitted' ? t('approvalBar.submitted') : i18n.language === 'ar' ? node.nameAr : node.nameEn);
}

/**
 * GlobalCompactApprovalBar (spec 16 §3.1): one row under the page header. Done stages carry a green check, the
 * current one is blue with «اعتماد» on its visual right and «رفض» on its visual left (in Arabic; mirrored in English),
 * the ones ahead are muted, and distant stages fold into chips. Without actions it is read-only; once the approval
 * ended it shows the outcome. «عرض كل المراحل» opens the history drawer.
 */
export function GlobalCompactApprovalBar({
  status,
  actions,
  loadingActions,
  onViewAll,
}: {
  status: ApprovalStatus;
  actions?: BarActions;
  /** The user's actions are still loading: a placeholder keeps the row from jumping. */
  loadingActions?: boolean;
  onViewAll: () => void;
}) {
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
  const [list, setList] = useState<HTMLElement | null>(null);
  const [tighten, setTighten] = useState(0);
  useEffect(() => setTighten(0), [space.width]);
  const items = fit(nodes, space.width - (phone ? 60 : 190) - (ended ? 130 : 0) - tighten * 120, (canAct || !!loadingActions) && !phone, tighten > 0);
  useLayoutEffect(() => {
    if (list && list.scrollWidth > list.clientWidth + 1 && tighten < 8) {
      setTighten((n) => n + 1);
    }
  });
  const endedAt = [...status.history].reverse().find((h) => h.kind === 'Completed')?.at;

  return (
    <Box
      component="section"
      ref={space.ref}
      aria-label={t('approvalBar.label')}
      sx={{
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
      }}
    >
      <Box
        component="ol"
        ref={setList}
        sx={{ listStyle: 'none', m: 0, p: 0, flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'thin', py: 0.25 }}
      >
        {items.map((item, index) => (
          <Fragment key={item.kind === 'node' ? item.node.key : `more-${item.side}`}>
            {index > 0 && <Connector done={doneBefore(items[index - 1])} />}
            {item.kind === 'more' ? (
              <MoreChip item={item} onClick={onViewAll} compact={phone} />
            ) : item.node.state === 'Current' && (canAct || loadingActions) && !phone ? (
              // Approve / current stage / reject on one row (approve first in reading order: right in Arabic).
              <Stack component="li" direction="row" sx={{ alignItems: 'center', gap: 1, flex: '0 0 auto' }}>
                {loadingActions && !canAct ? (
                  <>
                    <Skeleton variant="rounded" width={84} height={34} />
                    <Node node={item.node} status={status} />
                    <Skeleton variant="rounded" width={72} height={34} />
                  </>
                ) : (
                  <>
                    {actions?.onApprove && <ApproveButton onClick={actions.onApprove} />}
                    <Node node={item.node} status={status} />
                    {actions?.onReject && <RejectButton onClick={actions.onReject} />}
                    {!!actions?.more?.length && <MoreMenu items={actions.more} />}
                  </>
                )}
              </Stack>
            ) : (
              <Box component="li" sx={{ flex: '0 0 auto' }}>
                <Node node={item.node} status={status} />
              </Box>
            )}
          </Fragment>
        ))}
      </Box>

      {ended && (
        <Box
          role="status"
          sx={{
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
          }}
        >
          {outcomeLook(status.status).icon}
          {t(`approval.instance.${status.status}`)}
          {endedAt && <bdi>{day(endedAt)}</bdi>}
        </Box>
      )}

      <Box aria-hidden sx={{ alignSelf: 'stretch', width: '1px', bgcolor: flow.border, my: 0.5, display: { xs: 'none', sm: 'block' } }} />
      <Button
        variant="outlined"
        size="small"
        onClick={onViewAll}
        aria-label={t('approvalBar.viewAll')}
        startIcon={phone ? undefined : <FormatListBulletedIcon />}
        sx={{
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
        }}
      >
        {phone ? <FormatListBulletedIcon fontSize="small" /> : t('approvalBar.viewAll')}
      </Button>

      {/* On a phone the decision stays in reach: a sticky area at the bottom of the screen. */}
      {phone && canAct && (
        <Box
          sx={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: theme.zIndex.appBar,
            bgcolor: '#fff',
            borderTop: `1px solid ${flow.border}`,
            boxShadow: '0 -4px 14px rgba(15, 39, 71, .08)',
            px: 2,
            py: 1.25,
          }}
        >
          <Decisions actions={actions!} />
        </Box>
      )}
    </Box>
  );
}

/** Unicode first-strong isolation, so names keep their own direction inside a sentence. */
const isolate = (text: string) => String.fromCharCode(0x2068) + text + String.fromCharCode(0x2069);

/** The width of an element, kept up to date (1200px until measured). */
/** The element's width, measured once it is on the page (it may mount after a loading state) and on every resize. */
function useWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null);
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
const doneBefore = (item: BarItem | undefined) => {
  const node = item?.kind === 'node' ? item.node : item?.nodes.at(-1);
  return node?.state === 'Done' || node?.state === 'Submitted';
};

function outcomeLook(status: ApprovalStatus['status']) {
  return status === 'Approved'
    ? stateLook.Done
    : status === 'Rejected'
      ? stateLook.Rejected
      : status === 'Returned'
        ? stateLook.Returned
        : stateLook.Canceled;
}

/** The decisions on a phone: approve, reject and the menu side by side at full touch size. */
function Decisions({ actions }: { actions: BarActions }) {
  return (
    <Stack direction="row" sx={{ gap: 1, '& > .MuiButton-root': { flex: 1, height: 44 } }}>
      {actions.onApprove && <ApproveButton onClick={actions.onApprove} />}
      {actions.onReject && <RejectButton onClick={actions.onReject} />}
      {!!actions.more?.length && <MoreMenu items={actions.more} large />}
    </Stack>
  );
}

function ApproveButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="contained"
      disableElevation
      onClick={onClick}
      startIcon={<CheckIcon />}
      sx={{ height: 34, px: 2, borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', bgcolor: flow.green, '&:hover': { bgcolor: '#047857' } }}
    >
      {t('approval.approve')}
    </Button>
  );
}

function RejectButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="outlined"
      onClick={onClick}
      startIcon={<CloseIcon />}
      sx={{ height: 34, px: 1.75, borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap', color: flow.red, borderColor: '#F3B4B4', '&:hover': { borderColor: flow.red, bgcolor: flow.redSoft } }}
    >
      {t('approval.reject')}
    </Button>
  );
}

function MoreMenu({ items, large }: { items: BarMenuAction[]; large?: boolean }) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title={t('approvalBar.moreActions')}>
        <IconButton
          aria-label={t('approvalBar.moreActions')}
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ width: large ? 44 : 34, height: large ? 44 : 34, border: `1px solid ${flow.border}`, borderRadius: '8px', color: flow.text }}
        >
          <MoreHorizIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {items.map((item) => (
          <MenuItem
            key={item.key}
            onClick={() => {
              setAnchor(null);
              item.onClick();
            }}
            sx={{ fontSize: 13.5, color: item.color }}
          >
            <ListItemIcon sx={{ color: item.color ?? 'inherit', '& svg': { fontSize: 19 } }}>{item.icon}</ListItemIcon>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** The line between two stages: green after a done stage, grey toward what is ahead. */
function Connector({ done }: { done: boolean }) {
  return <Box component="li" aria-hidden sx={{ flex: '1 1 0', minWidth: 20, height: 2, mx: 1, borderRadius: 2, bgcolor: done ? '#8FD9BC' : flow.border }} />;
}

/** A chip standing for stages folded away («+3 مراحل»); it opens the drawer with all of them. */
function MoreChip({ item, onClick, compact }: { item: Extract<BarItem, { kind: 'more' }>; onClick: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const name = useStageName();
  const allDone = item.nodes.every((n) => n.state === 'Done' || n.state === 'Submitted');
  const label = allDone ? t('approvalBar.moreDone', { count: item.nodes.length }) : t('approvalBar.moreStages', { count: item.nodes.length });
  return (
    <Box component="li" sx={{ flex: '0 0 auto' }}>
      <Tooltip title={item.nodes.map(name).join(' ← ')}>
        <Box
          component="button"
          type="button"
          onClick={onClick}
          aria-label={label}
          sx={{
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
          }}
        >
          {compact ? `+${item.nodes.length}` : label}
        </Box>
      </Tooltip>
    </Box>
  );
}

/** One stage: its mark (check, number, cross…), name and a line on who and when. */
function Node({ node, status }: { node: StageNode; status: ApprovalStatus }) {
  const { t } = useTranslation();
  const name = useStageName()(node);
  const { short, ago } = useWhen();
  const look = stateLook[node.state];
  const current = node.state === 'Current';
  const planned = node.state === 'Planned';
  const waiting = status.waitingFor.length ? status.waitingFor : node.assignees;

  // Each part isolated in its own <bdi>: Arabic names beside English times (and the reverse) keep their order.
  const names = waiting.slice(0, 2).join('، ') + (waiting.length > 2 ? ` +${waiting.length - 2}` : '');
  const parts: string[] = current
    ? [`${t('approvalBar.waitingFor')} ${isolate(names)}`, node.openedAt ? ago(node.openedAt) : '']
    : planned
      ? [t('approvalBar.notStarted')]
      : node.state === 'Canceled'
        ? [t('approvalBar.state.Canceled')]
        : [node.decidedBy ?? '', node.decidedAt ? short(node.decidedAt) : ''];
  const detail = parts.filter(Boolean);

  return (
    <Tooltip
      title={
        <Box sx={{ fontSize: 12, lineHeight: 1.7 }}>
          <div>
            <b>{name}</b> — {t(`approvalBar.state.${node.state}`)}
          </div>
          {node.assignees.length > 0 && !planned && <div>{node.assignees.join('، ')}</div>}
          {node.rule === 'All' && node.state !== 'Submitted' && <div>{t('approvalBar.ruleAll')}</div>}
          {node.round > 1 && <div>{t('approvalBar.round', { round: node.round })}</div>}
          {planned && <div>{t('approvalBar.plannedHint')}</div>}
          {node.comment && <div>«{node.comment}»</div>}
        </Box>
      }
    >
      <Stack
        direction="row"
        tabIndex={0}
        aria-label={`${name} — ${t(`approvalBar.state.${node.state}`)}${detail.length ? ` — ${detail.join(' · ')}` : ''}`}
        aria-current={current ? 'step' : undefined}
        sx={{ alignItems: 'center', gap: 1, minWidth: 0, borderRadius: '8px', '&:focus-visible': { outline: `2px solid ${flow.blue}`, outlineOffset: 2 } }}
      >
        <Box
          aria-hidden
          sx={{
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
          }}
        >
          {look.icon ?? node.order}
        </Box>
        <Box sx={{ minWidth: 0, maxWidth: current ? 230 : 170 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: current ? flow.blue : planned ? flow.textMuted : flow.text,
            }}
          >
            {name}
            {node.round > 1 && (
              <Box component="span" sx={{ ml: 0.75, fontSize: 11, fontWeight: 700, color: flow.amber }}>
                {t('approvalBar.round', { round: node.round })}
              </Box>
            )}
          </Typography>
          {detail.length > 0 && (
            <Typography sx={{ fontSize: 11.5, lineHeight: 1.35, color: flow.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {detail.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 && ' · '}
                  <bdi>{part}</bdi>
                </Fragment>
              ))}
            </Typography>
          )}
        </Box>
      </Stack>
    </Tooltip>
  );
}
