import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import { Box, ButtonBase, Typography } from '@mui/material';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { tokens } from './theme';
// Pages reached from another menu page rather than having their own (a project's statement from the aging, an
// approval from the tasks, a building from the housing).
const parents = {
    '/billing/statements': '/billing/aging',
    '/workflow/approvals': '/workflow/inbox',
    '/housing/buildings': '/housing',
    '/payroll/staff-settings': '/payroll/staff',
    '/hr/deductions-settings': '/hr/advances',
};
const named = { new: 'crumbs.new', edit: 'crumbs.edit', print: 'crumbs.print' };
// Two contexts: the labels change while pages come and go; the setter never does, so a page naming its crumb does not
// re-render (and re-name it) whenever a label changes.
const LabelsContext = createContext({});
const SetLabelContext = createContext(null);
export function CrumbProvider({ children }) {
    const [labels, setLabels] = useState({});
    const set = useCallback((path, label) => setLabels((current) => {
        if ((current[path] ?? null) === label) {
            return current;
        }
        const next = { ...current };
        if (label) {
            next[path] = label;
        }
        else {
            delete next[path];
        }
        return next;
    }), []);
    return (_jsx(SetLabelContext.Provider, { value: set, children: _jsx(LabelsContext.Provider, { value: labels, children: children }) }));
}
/**
 * Names a record's crumb (its number instead of "Details") while the page is open. The path defaults to the current
 * page; an edit page names its record's path.
 */
export function useCrumb(label, path) {
    const set = useContext(SetLabelContext);
    const location = useLocation();
    const key = path ?? location.pathname;
    useEffect(() => {
        if (!set || !label) {
            return undefined;
        }
        set(key, label);
        return () => set(key, null);
    }, [set, key, label]);
}
/** Where the page sits — home, the menu section, the menu page, then the record and what is done to it — each clickable. */
export function Breadcrumbs({ sections }) {
    const { t, i18n } = useTranslation();
    const rtl = i18n.dir() === 'rtl';
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const labels = useContext(LabelsContext);
    const crumbs = [];
    const pages = sections.flatMap((section) => section.items.map((item) => ({ section, item })));
    const parent = Object.keys(parents).find((prefix) => pathname.startsWith(`${prefix}/`));
    const match = pages
        .filter(({ item }) => item.path !== '/' && (pathname === item.path || pathname.startsWith(`${item.path}/`) || parents[parent ?? ''] === item.path))
        .sort((a, b) => b.item.path.length - a.item.path.length)[0];
    if (match) {
        const first = match.section.items[0];
        if (match.section.titleKey && first) {
            crumbs.push({ label: t(match.section.titleKey), to: first.path });
        }
        crumbs.push({ label: t(match.item.labelKey), to: match.item.path });
        const base = parent && parents[parent] === match.item.path ? parent : match.item.path;
        let path = base;
        for (const segment of pathname.slice(base.length).split('/').filter(Boolean)) {
            path = `${path}/${segment}`;
            crumbs.push({ label: labels[path] ?? t(named[segment] ?? 'crumbs.details'), to: path });
        }
    }
    else if (pathname !== '/') {
        const page = pages.find(({ item }) => item.path === pathname);
        crumbs.push({ label: page ? t(page.item.labelKey) : t('app.name') });
    }
    const last = crumbs.length - 1;
    return (_jsxs(Box, { component: "nav", "aria-label": t('crumbs.label'), sx: { display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }, children: [_jsx(ButtonBase, { onClick: () => navigate('/'), "aria-label": t('menu.home'), sx: { flex: '0 0 auto', display: { xs: last < 0 ? 'inline-flex' : 'none', md: 'inline-flex' }, width: 34, height: 34, borderRadius: '10px', color: last < 0 ? tokens.navy700 : tokens.gray500, '&:hover': { bgcolor: tokens.tint, color: tokens.navy700 } }, children: _jsx(HomeOutlinedIcon, { fontSize: "small" }) }), last < 0 && _jsx(Typography, { sx: { fontSize: 17, fontWeight: 700, color: tokens.navy700 }, children: t('menu.home') }), crumbs.map((crumb, index) => {
                const current = index === last;
                return (_jsxs(Box, { sx: { display: { xs: current ? 'flex' : 'none', md: 'flex' }, alignItems: 'center', minWidth: current ? 0 : undefined, flexShrink: current ? 1 : 0 }, children: [_jsx(ChevronLeftIcon, { sx: { display: { xs: 'none', md: 'block' }, fontSize: 18, color: tokens.gray300, transform: rtl ? 'none' : 'scaleX(-1)' } }), current ? (_jsx(Typography, { noWrap: true, "aria-current": "page", sx: { px: 0.5, fontSize: 15.5, fontWeight: 800, color: tokens.navy800 }, children: crumb.label })) : (_jsx(ButtonBase, { onClick: () => crumb.to && navigate(crumb.to), sx: { px: 0.75, py: 0.4, borderRadius: '8px', fontSize: 13.5, fontWeight: 600, color: tokens.gray500, whiteSpace: 'nowrap', fontFamily: 'inherit', '&:hover': { bgcolor: tokens.tint, color: tokens.navy700 } }, children: crumb.label }))] }, `${index}-${crumb.to ?? ''}`));
            })] }));
}
