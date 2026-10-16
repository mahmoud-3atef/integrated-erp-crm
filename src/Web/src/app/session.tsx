import { Box, CircularProgress } from '@mui/material';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { authApi, type Me } from '../api/auth';

interface Session {
  me: Me;
  /** For showing or hiding menu items and buttons only — the server enforces every permission itself. */
  can: (permission: string, companyWide?: boolean) => boolean;
  reload: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/** Loads the signed-in user; without a session, goes to the sign-in page. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setMe(await authApi.me());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<Session | null>(
    () =>
      me
        ? { me, can: (permission, companyWide = false) => (companyWide ? me.companyWidePermissions : me.permissions).includes(permission), reload }
        : null,
    [me, reload],
  );

  if (failed) {
    return <Navigate to="/login" replace />;
  }

  if (!value) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return session;
}
