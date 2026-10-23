import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { Box, ButtonBase, ClickAwayListener, IconButton, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { currentModule, currentPath, magnification, modulePaths, openTrail } from './dockModel';
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
/**
 * «Smart ERP Dock Navigation» (the user's design, 2026-10-23; docs/02-target-architecture/21): a vertical Dock of the
 * modules — the icons magnified by the cursor's nearness as on macOS — whose items open as an accordion right under
 * their module (one module open at a time), in navy and gold. Compact, it is a rail of icons with tooltips; a module
 * with items opens the full Dock over the page until a page is chosen.
 */
export function SmartDock({ modules, compact = false, onToggleCompact, onNavigate, magnify = true, brand, title, subtitle }) {
    const { t, i18n } = useTranslation();
    const rtl = i18n.dir() === 'rtl';
    const { pathname } = useLocation();
    const path = useMemo(() => currentPath(modules, pathname), [modules, pathname]);
    const holder = useMemo(() => currentModule(modules, pathname), [modules, pathname]);
    const [open, setOpen] = useState(holder);
    const [nested, setNested] = useState(() => new Set());
    const [peek, setPeek] = useState(false);
    const labels = !compact || peek;
    // The page changed (a click, Back, Forward, a refresh): its module and nested items open.
    useEffect(() => {
        setOpen(holder);
        const module = modules.find((m) => m.key === holder);
        setNested(new Set(openTrail(module?.items, path).map((k) => `${holder}:${k}`)));
    }, [holder, path, modules]);
    const chosen = useCallback(() => {
        setPeek(false);
        if (document.activeElement instanceof HTMLElement)
            document.activeElement.blur();
        onNavigate?.();
    }, [onNavigate]);
    const toggleModule = (module) => {
        if (compact && !peek) {
            setPeek(true);
            setOpen(module.key);
            return;
        }
        setOpen((key) => (key === module.key ? undefined : module.key));
    };
    // ---------------------------------------------------------------- The Dock's magnification
    const navRef = useRef(null);
    const icons = useRef(new Map());
    const centers = useRef(null);
    const frame = useRef(0);
    const pointerY = useRef(0);
    const [canMagnify, setCanMagnify] = useState(false);
    useEffect(() => {
        if (!magnify || typeof window.matchMedia !== 'function')
            return;
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
                const slot = el.parentElement.getBoundingClientRect();
                return { el, y: slot.top + slot.height / 2 };
            });
        }
        for (const { el, y } of centers.current) {
            const scale = magnification(pointerY.current - y);
            el.style.transform = scale === 1 ? '' : `scale(${scale.toFixed(3)})`;
            el.dataset.near = scale > 1.2 ? 'true' : 'false';
        }
    }, []);
    const onMove = (y) => {
        if (!canMagnify)
            return;
        pointerY.current = y;
        if (!frame.current)
            frame.current = window.requestAnimationFrame(paint);
    };
    const rest = () => {
        if (frame.current)
            window.cancelAnimationFrame(frame.current);
        frame.current = 0;
        centers.current = null;
        icons.current.forEach((el) => {
            el.style.transform = '';
            el.dataset.near = 'false';
        });
    };
    useEffect(() => () => window.cancelAnimationFrame(frame.current), []);
    // ---------------------------------------------------------------- Keyboard: arrows move between the visible entries
    const onKeyDown = (event) => {
        if (event.key === 'Escape' && peek) {
            setPeek(false);
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
            return;
        const entries = [...(navRef.current?.querySelectorAll('[data-nav]') ?? [])].filter((el) => !el.closest('[inert]'));
        if (entries.length === 0)
            return;
        event.preventDefault();
        const at = entries.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0
            : event.key === 'End' ? entries.length - 1
                : event.key === 'ArrowDown' ? (at + 1) % entries.length
                    : (at - 1 + entries.length) % entries.length;
        entries[next]?.focus();
    };
    const width = labels ? dockWidth.expanded : dockWidth.compact;
    const panel = (_jsxs(Box, { sx: {
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
        }, children: [_jsxs(Box, { sx: { display: 'flex', flexDirection: labels ? 'row' : 'column', alignItems: 'center', gap: 1.25, px: labels ? 1.75 : 0, pt: 2.25, pb: 1.75, bgcolor: dock.secondary, borderBottom: `1px solid ${dock.divider}` }, children: [brand, labels && (_jsxs(Box, { sx: { minWidth: 0, flex: 1 }, children: [_jsx(Typography, { noWrap: true, sx: { fontWeight: 700, fontSize: 15, lineHeight: 1.25, color: '#fff' }, children: title }), _jsx(Typography, { noWrap: true, sx: { fontSize: 11.5, color: dock.muted }, children: subtitle })] })), onToggleCompact && (_jsx(Tooltip, { title: compact ? t('menu.expand') : t('menu.compact'), placement: rtl ? 'left' : 'right', children: _jsx(IconButton, { onClick: () => {
                                setPeek(false);
                                onToggleCompact();
                            }, "aria-label": compact ? t('menu.expand') : t('menu.compact'), "aria-pressed": !compact, size: "small", sx: { width: 32, height: 32, color: dock.text, bgcolor: 'rgba(255,255,255,.08)', '&:hover': { bgcolor: dock.iconHover }, '&:focus-visible': { outline: `2px solid ${dock.gold}`, outlineOffset: 2 } }, children: compact ? _jsx(MenuIcon, { sx: { fontSize: 19 } }) : _jsx(MenuOpenIcon, { sx: { fontSize: 19, transform: rtl ? 'scaleX(-1)' : 'none' } }) }) }))] }), _jsx(Box, { component: "nav", ref: navRef, "aria-label": t('menu.label'), onMouseMove: (e) => onMove(e.clientY), onMouseLeave: rest, onScroll: forget, onKeyDown: onKeyDown, sx: { flex: 1, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', px: 1.25, py: 1.25, scrollbarWidth: 'thin', scrollbarColor: `${dock.divider} transparent` }, children: _jsx(Box, { component: "ul", sx: { listStyle: 'none', m: 0, p: 0 }, children: modules.map((module, index) => (_jsx(Module, { module: module, first: index === 0, sectionStart: index > 0 && !!module.items && !modules[index - 1]?.items, labels: labels, expanded: labels && open === module.key && !!module.items, holdsPage: holder === module.key, path: path, rtl: rtl, iconRef: (el) => {
                            if (el)
                                icons.current.set(module.key, el);
                            else
                                icons.current.delete(module.key);
                        }, onToggle: () => toggleModule(module), onChosen: chosen, nested: nested, onNested: (key) => setNested((s) => {
                            const next = new Set(s);
                            if (next.has(key))
                                next.delete(key);
                            else
                                next.add(key);
                            return next;
                        }) }, module.key))) }) })] }));
    return peek ? _jsx(ClickAwayListener, { onClickAway: () => setPeek(false), children: panel }) : panel;
}
/** DockModule: the icon (magnified by the Dock), the title, the badge and, with items, the accordion under it. */
function Module({ module, first, sectionStart, labels, expanded, holdsPage, path, rtl, iconRef, onToggle, onChosen, nested, onNested }) {
    const { t } = useTranslation();
    const label = t(module.labelKey);
    const page = module.path !== undefined && module.path === path;
    // Gold: the open module, or (folded, or compact) the one holding the current page.
    const gold = expanded || page || (holdsPage && !labels);
    const subId = `dock-sub-${module.key.replace(/[^a-z0-9]/gi, '-')}`;
    const badge = module.badge && module.badge > 0 ? module.badge : 0;
    const content = (_jsxs(_Fragment, { children: [_jsxs(Box, { sx: { position: 'relative', flex: '0 0 auto', width: 40, height: 40 }, children: [_jsx(Box, { ref: iconRef, className: "dock-icon", "data-near": "false", sx: {
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
                        }, children: module.icon }), badge > 0 && !labels && (_jsx(Box, { component: "span", "aria-hidden": true, sx: { position: 'absolute', top: -4, insetInlineEnd: -4, zIndex: 4, minWidth: 18, height: 18, px: 0.5, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800, bgcolor: dock.gold, color: dock.bg }, children: badge > 99 ? '99+' : badge }))] }), labels && (_jsx(Box, { component: "span", sx: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: gold ? 700 : 500, lineHeight: 1.35, color: gold ? dock.activeText : holdsPage ? dock.activeText : 'inherit', overflowWrap: 'anywhere' }, children: label })), labels && badge > 0 && (_jsx(Box, { component: "span", "aria-label": t('tasks.waiting', { count: badge }), sx: { flex: '0 0 auto', minWidth: 22, px: 0.75, borderRadius: 999, fontSize: 11, fontWeight: 800, textAlign: 'center', bgcolor: dock.gold, color: dock.bg }, children: badge })), labels && module.items && (_jsx(ExpandMoreIcon, { "aria-hidden": true, sx: { flex: '0 0 auto', fontSize: 19, color: expanded ? dock.activeText : dock.muted, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' } }))] }));
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
    };
    const button = module.items ? (_jsx(ButtonBase, { "data-nav": true, onClick: onToggle, "aria-expanded": labels ? expanded : undefined, "aria-controls": labels ? subId : undefined, "aria-label": labels ? undefined : label, sx: row, children: content })) : (_jsx(ButtonBase, { "data-nav": true, component: RouterLink, to: module.path ?? '/', onClick: onChosen, "aria-current": page ? 'page' : undefined, "aria-label": labels ? undefined : label, sx: row, children: content }));
    return (_jsxs(Box, { component: "li", sx: { mt: first ? 0 : sectionStart ? 1.5 : 0.25, position: 'relative', '&::before': sectionStart ? { content: '""', position: 'absolute', top: -8, insetInline: 8, height: '1px', bgcolor: dock.divider } : undefined }, children: [labels ? button : (_jsx(Tooltip, { title: label, placement: rtl ? 'left' : 'right', children: button })), module.items && labels && (_jsx(Accordion, { open: expanded, id: subId, label: label, children: _jsx(SubList, { items: module.items, depth: 0, moduleKey: module.key, prefix: "", path: path, onChosen: onChosen, nested: nested, onNested: onNested }) }))] }));
}
/** The accordion: grid rows from 0fr to 1fr (no height: auto animation); closed, its links leave the tab order. */
function Accordion({ open, id, label, children }) {
    return (_jsx(Box, { id: id, role: "region", "aria-label": label, inert: !open, sx: {
            display: 'grid',
            gridTemplateRows: open ? '1fr' : '0fr',
            opacity: open ? 1 : 0,
            transition: open ? 'grid-template-rows 220ms ease-out, opacity 220ms ease-out' : 'grid-template-rows 180ms ease-in, opacity 180ms ease-in',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }, children: _jsx(Box, { sx: { overflow: 'hidden', minHeight: 0 }, children: children }) }));
}
/** The items under a module (and under a nested item), with the gold line joining them to their parent. */
function SubList({ items, depth, moduleKey, prefix, path, onChosen, nested, onNested }) {
    const { t } = useTranslation();
    return (_jsx(Box, { component: "ul", sx: {
            listStyle: 'none',
            m: 0,
            py: 0.5,
            position: 'relative',
            paddingInlineStart: depth === 0 ? '44px' : '16px',
            paddingInlineEnd: 0,
            // The connector, under the parent's icon (its centre is 26px from the row's start).
            '&::before': { content: '""', position: 'absolute', top: 2, bottom: 8, insetInlineStart: depth === 0 ? '25px' : '6px', width: 2, borderRadius: 2, bgcolor: dock.activeIcon, opacity: 0.7 },
        }, children: items.map((item, index) => {
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
            };
            const text = (_jsxs(_Fragment, { children: [item.icon, _jsx(Box, { component: "span", sx: { flex: 1, minWidth: 0, overflowWrap: 'anywhere' }, children: label }), badge > 0 && (_jsx(Box, { component: "span", "aria-label": t('tasks.waiting', { count: badge }), sx: { flex: '0 0 auto', minWidth: 20, px: 0.6, borderRadius: 999, fontSize: 10.5, fontWeight: 800, textAlign: 'center', bgcolor: dock.gold, color: dock.bg }, children: badge }))] }));
            if (item.children?.length) {
                const id = `${moduleKey}:${key}`;
                const isOpen = nested.has(id);
                const subId = `dock-sub-${moduleKey.replace(/[^a-z0-9]/gi, '-')}-${key.replace(/\./g, '-')}`;
                return (_jsxs(Box, { component: "li", children: [_jsxs(ButtonBase, { "data-nav": true, onClick: () => onNested(id), "aria-expanded": isOpen, "aria-controls": subId, sx: entry, children: [text, _jsx(ExpandMoreIcon, { "aria-hidden": true, sx: { fontSize: 17, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' } })] }), _jsx(Accordion, { open: isOpen, id: subId, label: label, children: _jsx(SubList, { items: item.children, depth: depth + 1, moduleKey: moduleKey, prefix: `${key}.`, path: path, onChosen: onChosen, nested: nested, onNested: onNested }) })] }, key));
            }
            return (_jsx(Box, { component: "li", children: _jsx(ButtonBase, { "data-nav": true, component: RouterLink, to: item.path ?? '/', onClick: onChosen, "aria-current": selected ? 'page' : undefined, sx: entry, children: text }) }, key));
        }) }));
}
/** Whether a module holds a page (for the shell's breadcrumbs and tests). */
export function holdsPath(module, path) {
    return modulePaths(module).includes(path);
}
