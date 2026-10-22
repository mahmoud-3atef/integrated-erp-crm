import { jsx as _jsx } from "react/jsx-runtime";
import NotificationImportantOutlinedIcon from '@mui/icons-material/NotificationImportantOutlined';
import { Badge as MuiBadge, IconButton, Tooltip } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { alertsApi } from '../api/alerts';
const refreshMs = 5 * 60_000;
/** The top bar's alerts button: how many alerts need attention (critical in red), refreshed every few minutes and on each page. */
export function AlertsButton() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [counts, setCounts] = useState(null);
    const load = useCallback(async () => {
        try {
            setCounts(await alertsApi.count());
        }
        catch {
            // Keep the last counts.
        }
    }, []);
    useEffect(() => {
        void load();
        const timer = window.setInterval(() => void load(), refreshMs);
        return () => window.clearInterval(timer);
    }, [load, location.pathname]);
    const urgent = (counts?.critical ?? 0) + (counts?.warning ?? 0);
    return (_jsx(Tooltip, { title: t('alerts.button', { count: urgent }), children: _jsx(IconButton, { onClick: () => navigate('/alerts'), "aria-label": t('alerts.title'), children: _jsx(MuiBadge, { badgeContent: urgent, color: (counts?.critical ?? 0) > 0 ? 'error' : 'warning', max: 99, children: _jsx(NotificationImportantOutlinedIcon, {}) }) }) }));
}
