import { jsx as _jsx } from "react/jsx-runtime";
import { Box, CircularProgress } from '@mui/material';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { authApi } from '../api/auth';
const SessionContext = createContext(null);
/** Loads the signed-in user; without a session, goes to the sign-in page. */
export function SessionProvider({ children }) {
    const { t } = useTranslation();
    const [me, setMe] = useState(null);
    const [failed, setFailed] = useState(false);
    const reload = useCallback(async () => {
        try {
            setMe(await authApi.me());
        }
        catch {
            setFailed(true);
        }
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);
    const value = useMemo(() => me
        ? { me, can: (permission, companyWide = false) => (companyWide ? me.companyWidePermissions : me.permissions).includes(permission), reload }
        : null, [me, reload]);
    if (failed) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    if (!value) {
        return (_jsx(Box, { sx: { minHeight: '100dvh', display: 'grid', placeItems: 'center' }, children: _jsx(CircularProgress, { "aria-label": t('common.loading') }) }));
    }
    return _jsx(SessionContext.Provider, { value: value, children: children });
}
export function useSession() {
    const session = useContext(SessionContext);
    if (!session) {
        throw new Error('useSession must be used inside SessionProvider');
    }
    return session;
}
