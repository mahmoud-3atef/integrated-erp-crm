import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SignInFlowProvider } from '../auth/SignInFlow';
import { directionOf, type Language } from '../i18n';
import { ChooseCompanyPage } from '../pages/ChooseCompanyPage';
import { CrmSyncPage } from '../pages/admin/CrmSyncPage';
import { CustomerDetailPage } from '../pages/commercial/CustomerDetailPage';
import { CustomersPage } from '../pages/commercial/CustomersPage';
import { PricesPage } from '../pages/commercial/PricesPage';
import { ProjectDetailPage } from '../pages/commercial/ProjectDetailPage';
import { ProjectsPage } from '../pages/commercial/ProjectsPage';
import { WorkerDetailPage } from '../pages/workforce/WorkerDetailPage';
import { WorkersPage } from '../pages/workforce/WorkersPage';
import { RolesPage } from '../pages/admin/RolesPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { HomePage } from '../pages/HomePage';
import { RequestDetailPage } from '../pages/workflow/RequestDetailPage';
import { RequestsPage } from '../pages/workflow/RequestsPage';
import { ApprovalDetailPage } from '../pages/workflow/ApprovalDetailPage';
import { InboxPage, MonitorPage, MyApprovalsPage } from '../pages/workflow/InboxPage';
import { ProcessEditorPage } from '../pages/workflow/ProcessEditorPage';
import { ProcessesPage } from '../pages/workflow/ProcessesPage';
import { BranchesPage } from '../pages/setup/BranchesPage';
import { LegalEntitiesPage } from '../pages/setup/LegalEntitiesPage';
import { ModulesPage } from '../pages/setup/ModulesPage';
import { ReferenceListsPage } from '../pages/setup/ReferenceListsPage';
import { LoginPage } from '../pages/LoginPage';
import { MfaSetupPage } from '../pages/MfaSetupPage';
import { MfaVerifyPage } from '../pages/MfaVerifyPage';
import { NoCompanyPage } from '../pages/NoCompanyPage';
import { RecoveryCodesPage } from '../pages/RecoveryCodesPage';
import { AppShell } from './AppShell';
import { buildTheme, ltrCache, rtlCache } from './theme';

export function App() {
  const { i18n } = useTranslation();
  const direction = directionOf(i18n.language as Language);
  const theme = useMemo(() => buildTheme(direction), [direction]);

  return (
    <CacheProvider value={direction === 'rtl' ? rtlCache : ltrCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <SignInFlowProvider>
            <Routes>
              {/* Signed-in area: header + menu by permission. */}
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/roles" element={<RolesPage />} />
                <Route path="/admin/crm-sync" element={<CrmSyncPage />} />
                <Route path="/workforce/workers" element={<WorkersPage key="workers" kind="Worker" />} />
                <Route path="/workforce/workers/:id" element={<WorkerDetailPage kind="Worker" />} />
                <Route path="/workforce/staff" element={<WorkersPage key="staff" kind="Staff" />} />
                <Route path="/workforce/staff/:id" element={<WorkerDetailPage kind="Staff" />} />
                <Route path="/commercial/projects" element={<ProjectsPage />} />
                <Route path="/commercial/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/commercial/customers" element={<CustomersPage />} />
                <Route path="/commercial/customers/:id" element={<CustomerDetailPage />} />
                <Route path="/commercial/prices" element={<PricesPage />} />
                <Route path="/setup/legal-entities" element={<LegalEntitiesPage />} />
                <Route path="/setup/branches" element={<BranchesPage />} />
                <Route path="/setup/reference-lists/:list?" element={<ReferenceListsPage />} />
                <Route path="/setup/modules" element={<ModulesPage />} />
                <Route path="/workflow/inbox" element={<InboxPage />} />
                <Route path="/workflow/my-requests" element={<MyApprovalsPage />} />
                <Route path="/workflow/monitor" element={<MonitorPage />} />
                <Route path="/workflow/approvals/:id" element={<ApprovalDetailPage />} />
                <Route path="/workflow/processes" element={<ProcessesPage />} />
                <Route path="/workflow/processes/:id" element={<ProcessEditorPage />} />
                <Route path="/workflow/requests" element={<RequestsPage />} />
                <Route path="/workflow/requests/:id" element={<RequestDetailPage />} />
              </Route>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login/mfa-setup" element={<MfaSetupPage />} />
              <Route path="/login/recovery-codes" element={<RecoveryCodesPage />} />
              <Route path="/login/mfa" element={<MfaVerifyPage />} />
              <Route path="/login/company" element={<ChooseCompanyPage />} />
              <Route path="/login/no-access" element={<NoCompanyPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SignInFlowProvider>
        </BrowserRouter>
      </ThemeProvider>
    </CacheProvider>
  );
}
