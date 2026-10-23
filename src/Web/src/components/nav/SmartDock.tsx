import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { Box, ButtonBase, ClickAwayListener, IconButton, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { currentModule, currentPath, magnification, modulePaths, openTrail, type DockItem, type DockModule } from './dockModel';

/** The Dock's colours (docs/02-target-architecture/21 §5): dark navy with gold accents. */
export const dock = {
  bg: '#0B2D43',
  secondary: '#123C54',
  iconBg: '#19435D',
  iconHover: '#356E8B',
  activeBg: '#665124',
  activeIcon: '#D6A849',
  activeText: '#F5D48B',
  submenuText: '#D8B976',
  selectedBg: '#34627C',
  selectedText: '#FFFFFF',
  gold: '#D7AB52',
  text: '#E4EDF4',
  muted: '#9CB6C6',
  divider: '#31516A',
};

export const dockWidth = { expanded: 260, compact: 76 };

const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface SmartDockProps {
  modules: DockModule[];
  /** Icons only (the user's choice); a module with items opens the full Dock over the page for a moment. */
  compact?: boolean;
  onToggleCompact?: () => void;
  /** After a page is chosen (e.g. to close the phone's drawer). */
  onNavigate?: () => void;
  /** The cursor's magnification (off on touch screens and with reduced motion anyway). */
  magnify?: boolean;
  brand: ReactNode;
  title: string;
  subtitle: string;
}

/**
 * «Smart ERP Dock Navigation» (the user's design, 2026-10-23; docs/02-target-architecture/21): a vertical Dock of the
 * modules — the icons magnified by the cursor's nearness as on macOS — whose items open as an accordion right under
 * their module (one module open at a time), in navy and gold. Compact, it is a rail of icons with tooltips; a module
 * with items opens the full Dock over the page until a page is chosen.
 */
export function SmartDock({ modules, compact = false, onToggleCompact, onNavigate, magnify = true, brand, title, subtitle }: SmartDockProps) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const { pathname } = useLocation();
  const path = useMemo(() => currentPath(modules, pathname), [modules, pathname]);
  const holder = useMemo(() => currentModule(modules, pathname), [modules, pathname]);
  const [open, setOpen] = useState<string | undefined>(holder);
  const [nested, setNested] = useState<Set<string>>(() => new Set());
  const [peek, setPeek] = useState(false);
  const labels = !compact || peek;

  // Compact: the mouse resting on the rail a moment opens the full Dock over the page, leaving it folds it (as the old
  // rail did, the user's request, 2026-10-23); just after a page is chosen it stays folded until the mouse leaves.
  const hoverTimer = useRef(0);
  const picked = useRef(false);
  const enter = () => {
    if (!compact || picked.current) return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setPeek(true), 140);
  };
  const leave = () => {
    window.clearTimeout(hoverTimer.current);
    picked.current = false;
    if (compact) setPeek(false);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // The page changed (a click, Back, Forward, a refresh): its module and nested items open.
  useEffect(() => {
    setOpen(holder);
    const module = modules.find((m) => m.key === holder);
    setNested(new Set(openTrail(module?.items, path).map((k) => `${holder}:${k}`)));
  }, [holder, path, modules]);

  const chosen = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    picked.current = true;
    setPeek(false);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onNavigate?.();
  }, [onNavigate]);

  const toggleModule = (module: DockModule) => {
    if (compact && !peek) {
      setPeek(true);
      setOpen(module.key);
      return;
    }
    setOpen((key) => (key === module.key ? undefined : module.key));
  };

  // ---------------------------------------------------------------- The Dock's magnification
  const navRef = useRef<HTMLElement>(null);
  const icons = useRef(new Map<string, HTMLElement>());
  const centers = useRef<{ el: HTMLElement; y: number }[] | null>(null);
  const frame = useRef(0);
  const pointerY = useRef(0);
  const [canMagnify, setCanMagnify] = useState(false);
  useEffect(() => {
    if (!magnify || typeof window.matchMedia !== 'function') return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const touch = window.matchMedia('(hover: none), (pointer: coarse)');
    const update = () => setCanMagnify(!still.matches && !touch.matches);
    update();
    still.addEventListener('change', update);
    touch.addEventListener('change', update);
    return () => {
      still.removeEventListener('change', update);
      touch.removeEventListener('change', update);
    };
  }, [magnify]);

  // Positions are measured once per hover and again only when the layout changes (scroll, an accordion, the width).
  const forget = useCallback(() => {
    centers.current = null;
  }, []);
  useEffect(forget, [open, nested, compact, peek, forget]);
  useEffect(() => {
    window.addEventListener('resize', forget);
    return () => window.removeEventListener('resize', forget);
  }, [forget]);

  const paint = useCallback(() => {
    frame.current = 0;
    if (!centers.current) {
      centers.current = [...icons.current.values()].map((el) => {
        const slot = el.parentElement!.getBoundingClientRect();
        return { el, y: slot.top + slot.height / 2 };
      });
    }
    for (const { el, y } of centers.current) {
      const scale = magnification(pointerY.current - y);
      el.style.transform = scale === 1 ? '' : `scale(${scale.toFixed(3)})`;
      el.dataset.near = scale > 1.2 ? 'true' : 'false';
    }
  }, []);
  const onMove = (y: number) => {
    if (!canMagnify) return;
    pointerY.current = y;
    if (!frame.current) frame.current = window.requestAnimationFrame(paint);
  };
  const rest = () => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    centers.current = null;
    icons.current.forEach((el) => {
      el.style.transform = '';
      el.dataset.near = 'false';
    });
  };
  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  // ---------------------------------------------------------------- Keyboard: arrows move between the visible entries
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && peek) {
      setPeek(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const entries = [...(navRef.current?.querySelectorAll<HTMLElement>('[data-nav]') ?? [])].filter((el) => !el.closest('[inert]'));
    if (entries.length === 0) return;
    event.preventDefault();
    const at = entries.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? entries.length - 1
      : event.key === 'ArrowDown' ? (at + 1) % entries.length
      : (at - 1 + entries.length) % entries.length;
    entries[next]?.focus();
  };

  const width = labels ? dockWidth.expanded : dockWidth.compact;
  const panel = (
    <Box
      onMouseEnter={enter}
      onMouseLeave={leave}
      sx={{
        position: 'absolute',
        insetBlock: 0,
        insetInlineStart: 0,
        zIndex: 2,
        width,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        bgcolor: dock.bg,
        color: dock.text,
        overflow: 'hidden',
        boxShadow: peek ? '0 24px 60px rgba(4,18,31,.45)' : '0 10px 30px rgba(4,18,31,.22)',
        transition: `width 220ms ${ease}, box-shadow 220ms`,
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      {/* DockHeader: the brand and the compact / expanded switch. */}
      <Box sx={{ display: 'flex', flexDirection: labels ? 'row' : 'column', alignItems: 'center', gap: 1.25, px: labels ? 1.75 : 0, pt: 2.25, pb: 1.75, bgcolor: dock.secondary, borderBottom: `1px solid ${dock.divider}` }}>
        {brand}
        {labels && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, color: '#fff' }}>{title}</Typography>
            <Typography noWrap sx={{ fontSize: 11.5, color: dock.muted }}>{subtitle}</Typography>
          </Box>
        )}
        {onToggleCompact && (
          <Tooltip title={compact ? t('menu.expand') : t('menu.compact')} placement={rtl ? 'left' : 'right'}>
            <IconButton
              onClick={() => {
                setPeek(false);
                onToggleCompact();
              }}
              aria-label={compact ? t('menu.expand') : t('menu.compact')}
              aria-pressed={!compact}
              size="small"
              sx={{ width: 32, height: 32, color: dock.text, bgcolor: 'rgba(255,255,255,.08)', '&:hover': { bgcolor: dock.iconHover }, '&:focus-visible': { outline: `2px solid ${dock.gold}`, outlineOffset: 2 } }}
            >
              {compact ? <MenuIcon sx={{ fontSize: 19 }} /> : <MenuOpenIcon sx={{ fontSize: 19, transform: rtl ? 'scaleX(-1)' : 'none' }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        component="nav"
        ref={navRef}
        aria-label={t('menu.label')}
        onMouseMove={(e) => onMove(e.clientY)}
        onMouseLeave={rest}
        onScroll={forget}
        onKeyDown={onKeyDown}
        sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', px: 1.25, py: 1.25, scrollbarWidth: 'thin', scrollbarColor: `${dock.divider} transparent` }}
      >
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {modules.map((module, index) => (
            <Module
              key={module.key}
              module={module}
              first={index === 0}
              sectionStart={index > 0 && !!module.items && !modules[index - 1]?.items}
              labels={labels}
              expanded={labels && open === module.key && !!module.items}
              holdsPage={holder === module.key}
              path={path}
              rtl={rtl}
              iconRef={(el) => {
                if (el) icons.current.set(module.key, el);
                else icons.current.delete(module.key);
              }}
              onToggle={() => toggleModule(module)}
              onChosen={chosen}
              nested={nested}
              onNested={(key) =>
                setNested((s) => {
                  const next = new Set(s);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
            />
          ))}
        </Box>
      </Box>
    </Box>
  );

  return peek ? <ClickAwayListener onClickAway={() => setPeek(false)}>{panel}</ClickAwayListener> : panel;
}

interface ModuleProps {
  module: DockModule;
  first: boolean;
  sectionStart: boolean;
  labels: boolean;
  expanded: boolean;
  holdsPage: boolean;
  path: string | undefined;
  rtl: boolean;
  iconRef: (el: HTMLElement | null) => void;
  onToggle: () => void;
  onChosen: () => void;
  nested: Set<string>;
  onNested: (key: string) => void;
}

/** DockModule: the icon (magnified by the Dock), the title, the badge and, with items, the accordion under it. */
function Module({ module, first, sectionStart, labels, expanded, holdsPage, path, rtl, iconRef, onToggle, onChosen, nested, onNested }: ModuleProps) {
  const { t } = useTranslation();
  const label = t(module.labelKey);
  const page = module.path !== undefined && module.path === path;
  // Gold: the open module, or (folded, or compact) the one holding the current page.
  const gold = expanded || page || (holdsPage && !labels);
  const subId = `dock-sub-${module.key.replace(/[^a-z0-9]/gi, '-')}`;
  const badge = module.badge && module.badge > 0 ? module.badge : 0;

  const content = (
    <>
      <Box
        sx={{ position: 'relative', flex: '0 0 auto', width: 40, height: 40 }}
      >
        <Box
          ref={iconRef}
          className="dock-icon"
          data-near="false"
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: gold ? dock.activeIcon : dock.iconBg,
            color: gold ? dock.bg : dock.text,
            boxShadow: holdsPage && !gold ? `inset 0 0 0 2px ${dock.gold}` : 'none',
            transformOrigin: 'center',
            transition: `transform 180ms ${ease}, background-color 150ms`,
            willChange: 'transform',
            position: 'relative',
            zIndex: 1,
            '&[data-near="true"]': { boxShadow: '0 6px 14px rgba(0,0,0,.28)', zIndex: 3 },
            '& svg': { fontSize: 22 },
            '@media (prefers-reduced-motion: reduce)': { transition: 'background-color 150ms' },
          }}
        >
          {module.icon}
        </Box>
        {badge > 0 && !labels && (
          <Box component="span" aria-hidden sx={{ position: 'absolute', top: -4, insetInlineEnd: -4, zIndex: 4, minWidth: 18, height: 18, px: 0.5, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800, bgcolor: dock.gold, color: dock.bg }}>
            {badge > 99 ? '99+' : badge}
          </Box>
        )}
      </Box>
      {labels && (
        <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: gold ? 700 : 500, lineHeight: 1.35, color: gold ? dock.activeText : holdsPage ? dock.activeText : 'inherit', overflowWrap: 'anywhere' }}>
          {label}
        </Box>
      )}
      {labels && badge > 0 && (
        <Box component="span" aria-label={t('tasks.waiting', { count: badge })} sx={{ flex: '0 0 auto', minWidth: 22, px: 0.75, borderRadius: 999, fontSize: 11, fontWeight: 800, textAlign: 'center', bgcolor: dock.gold, color: dock.bg }}>
          {badge}
        </Box>
      )}
      {labels && module.items && (
        <ExpandMoreIcon aria-hidden sx={{ flex: '0 0 auto', fontSize: 19, color: expanded ? dock.activeText : dock.muted, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
      )}
    </>
  );

  const row = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: labels ? 'flex-start' : 'center',
    gap: 1.25,
    width: '100%',
    minHeight: 48,
    px: labels ? 0.75 : 0,
    py: 0.5,
    borderRadius: '12px',
    textAlign: 'start',
    color: dock.text,
    bgcolor: expanded || (page && labels) ? dock.activeBg : 'transparent',
    transition: 'background-color 150ms, color 150ms',
    '&:hover': { color: '#fff', bgcolor: expanded || (page && labels) ? dock.activeBg : 'rgba(255,255,255,.04)' },
    '&:hover .dock-icon': gold ? {} : { bgcolor: dock.iconHover },
    '&:focus-visible': { outline: `2px solid ${dock.gold}`, outlineOffset: -2 },
    // The gold accent line of the open module, on its start edge.
    '&::after': expanded || (page && labels) ? { content: '""', position: 'absolute', insetBlock: 10, insetInlineStart: 0, width: 3, borderRadius: 3, bgcolor: dock.gold } : undefined,
  } as const;

  const button = module.items ? (
    <ButtonBase data-nav onClick={onToggle} aria-expanded={labels ? expanded : undefined} aria-controls={labels ? subId : undefined} aria-label={labels ? undefined : label} sx={row}>
      {content}
    </ButtonBase>
  ) : (
    <ButtonBase data-nav component={RouterLink} to={module.path ?? '/'} onClick={onChosen} aria-current={page ? 'page' : undefined} aria-label={labels ? undefined : label} sx={row}>
      {content}
    </ButtonBase>
  );

  return (
    <Box component="li" sx={{ mt: first ? 0 : sectionStart ? 1.5 : 0.25, position: 'relative', '&::before': sectionStart ? { content: '""', position: 'absolute', top: -8, insetInline: 8, height: '1px', bgcolor: dock.divider } : undefined }}>
      {labels ? button : (
        <Tooltip title={label} placement={rtl ? 'left' : 'right'}>
          {button}
        </Tooltip>
      )}
      {module.items && labels && (
        <Accordion open={expanded} id={subId} label={label}>
          <SubList items={module.items} depth={0} moduleKey={module.key} prefix="" path={path} onChosen={onChosen} nested={nested} onNested={onNested} />
        </Accordion>
      )}
    </Box>
  );
}

/** The accordion: grid rows from 0fr to 1fr (no height: auto animation); closed, its links leave the tab order. */
function Accordion({ open, id, label, children }: { open: boolean; id: string; label: string; children: ReactNode }) {
  return (
    <Box
      id={id}
      role="region"
      aria-label={label}
      inert={!open}
      sx={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        opacity: open ? 1 : 0,
        transition: open ? 'grid-template-rows 220ms ease-out, opacity 220ms ease-out' : 'grid-template-rows 180ms ease-in, opacity 180ms ease-in',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Box sx={{ overflow: 'hidden', minHeight: 0 }}>{children}</Box>
    </Box>
  );
}

interface SubListProps {
  items: DockItem[];
  depth: number;
  moduleKey: string;
  prefix: string;
  path: string | undefined;
  onChosen: () => void;
  nested: Set<string>;
  onNested: (key: string) => void;
}

/** The items under a module (and under a nested item), with the gold line joining them to their parent. */
function SubList({ items, depth, moduleKey, prefix, path, onChosen, nested, onNested }: SubListProps) {
  const { t } = useTranslation();
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        py: 0.5,
        position: 'relative',
        paddingInlineStart: depth === 0 ? '44px' : '16px',
        paddingInlineEnd: 0,
        // The connector, under the parent's icon (its centre is 26px from the row's start).
        '&::before': { content: '""', position: 'absolute', top: 2, bottom: 8, insetInlineStart: depth === 0 ? '25px' : '6px', width: 2, borderRadius: 2, bgcolor: dock.activeIcon, opacity: 0.7 },
      }}
    >
      {items.map((item, index) => {
        const key = `${prefix}${index}`;
        const label = t(item.labelKey);
        const badge = item.badge && item.badge > 0 ? item.badge : 0;
        const selected = !!item.path && item.path === path;
        const entry = {
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1,
          width: '100%',
          minHeight: 40,
          px: 1.25,
          py: 0.75,
          my: 0.25,
          borderRadius: '8px',
          fontSize: 13.5,
          lineHeight: 1.35,
          textAlign: 'start',
          fontWeight: selected ? 600 : 500,
          color: selected ? dock.selectedText : dock.submenuText,
          bgcolor: selected ? dock.selectedBg : 'transparent',
          transition: 'background-color 150ms, color 150ms',
          '&:hover': { bgcolor: selected ? dock.selectedBg : 'rgba(53,110,139,.32)', color: selected ? dock.selectedText : '#EACB86' },
          '&:focus-visible': { outline: `2px solid ${dock.gold}`, outlineOffset: -2 },
          '& > svg': { flex: '0 0 auto', fontSize: 18, opacity: 0.85 },
          // The selected item's small gold mark, on the connector.
          '&::before': selected ? { content: '""', position: 'absolute', insetInlineStart: depth === 0 ? '-23px' : '-14px', top: '50%', width: 8, height: 8, mt: '-4px', borderRadius: '50%', bgcolor: dock.gold, boxShadow: `0 0 0 3px ${dock.bg}` } : undefined,
        } as const;
        const text = (
          <>
            {item.icon}
            <Box component="span" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              {label}
            </Box>
            {badge > 0 && (
              <Box component="span" aria-label={t('tasks.waiting', { count: badge })} sx={{ flex: '0 0 auto', minWidth: 20, px: 0.6, borderRadius: 999, fontSize: 10.5, fontWeight: 800, textAlign: 'center', bgcolor: dock.gold, color: dock.bg }}>
                {badge}
              </Box>
            )}
          </>
        );

        if (item.children?.length) {
          const id = `${moduleKey}:${key}`;
          const isOpen = nested.has(id);
          const subId = `dock-sub-${moduleKey.replace(/[^a-z0-9]/gi, '-')}-${key.replace(/\./g, '-')}`;
          return (
            <Box component="li" key={key}>
              <ButtonBase data-nav onClick={() => onNested(id)} aria-expanded={isOpen} aria-controls={subId} sx={entry}>
                {text}
                <ExpandMoreIcon aria-hidden sx={{ fontSize: 17, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
              </ButtonBase>
              <Accordion open={isOpen} id={subId} label={label}>
                <SubList items={item.children} depth={depth + 1} moduleKey={moduleKey} prefix={`${key}.`} path={path} onChosen={onChosen} nested={nested} onNested={onNested} />
              </Accordion>
            </Box>
          );
        }

        return (
          <Box component="li" key={key}>
            <ButtonBase data-nav component={RouterLink} to={item.path ?? '/'} onClick={onChosen} aria-current={selected ? 'page' : undefined} sx={entry}>
              {text}
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}

/** Whether a module holds a page (for the shell's breadcrumbs and tests). */
export function holdsPath(module: DockModule, path: string) {
  return modulePaths(module).includes(path);
}
