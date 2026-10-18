import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SignInFlowProvider } from '../auth/SignInFlow';
import { directionOf, type Language } from '../i18n';
import { ChooseCompanyPage } from '../pages/ChooseCompanyPage';
import { CrmSyncPage } from '../pages/admin/CrmSyncPage';
import { DeliveryOrderDetailPage } from '../pages/operations/DeliveryOrderDetailPage';
import { DeliveryOrdersPage } from '../pages/operations/DeliveryOrdersPage';
import { HistoryIssuesPage } from '../pages/workforce/HistoryIssuesPage';
import { NumberingPage } from '../pages/admin/NumberingPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { AgingPage } from '../pages/billing/AgingPage';
import { MovementPage } from '../pages/operations/movements/MovementPage';
import { MovementsPage } from '../pages/operations/movements/MovementsPage';
import { BankAccountsPage } from '../pages/billing/BankAccountsPage';
import { InvoicePage } from '../pages/billing/InvoicePage';
import { ReceiptPage } from '../pages/billing/ReceiptPage';
import { ReceiptsPage } from '../pages/billing/ReceiptsPage';
import { StatementPage } from '../pages/billing/StatementPage';
import { InvoicePrintPage } from '../pages/billing/InvoicePrintPage';
import { InvoicesPage } from '../pages/billing/InvoicesPage';
import { TimesheetPage } from '../pages/billing/TimesheetPage';
import { TimesheetsPage } from '../pages/billing/TimesheetsPage';
import { BuildingPage } from '../pages/housing/BuildingPage';
import { HousingPage } from '../pages/housing/HousingPage';
import { InvoiceCheckPage } from '../pages/workforce/InvoiceCheckPage';
import { ReturnOrderDetailPage } from '../pages/operations/ReturnOrderDetailPage';
import { ReturnOrdersPage } from '../pages/operations/ReturnOrdersPage';
import { TransferOrderDetailPage } from '../pages/operations/TransferOrderDetailPage';
import { TransferOrdersPage } from '../pages/operations/TransferOrdersPage';
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
                <Route path="/alerts" element={<AlertsPage />} />
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
                <Route path="/operations/delivery-orders" element={<DeliveryOrdersPage />} />
                <Route path="/operations/delivery-orders/new" element={<DeliveryOrdersPage key="new" creating />} />
                <Route path="/operations/delivery-orders/:id" element={<DeliveryOrderDetailPage />} />
                <Route path="/operations/delivery-orders/:id/edit" element={<DeliveryOrderDetailPage key="edit" editing />} />
                <Route path="/operations/return-orders" element={<ReturnOrdersPage />} />
                <Route path="/workforce/history-issues" element={<HistoryIssuesPage />} />
                <Route path="/housing" element={<HousingPage />} />
                <Route path="/admin/numbering" element={<NumberingPage />} />
                <Route path="/billing/timesheets" element={<TimesheetsPage />} />
                <Route path="/billing/timesheets/:id" element={<TimesheetPage />} />
                <Route path="/billing/invoices" element={<InvoicesPage />} />
                <Route path="/billing/invoices/:id" element={<InvoicePage />} />
                <Route path="/billing/receipts" element={<ReceiptsPage />} />
                <Route path="/billing/receipts/new" element={<ReceiptsPage key="new" creating />} />
                <Route path="/billing/receipts/:id" element={<ReceiptPage />} />
                <Route path="/billing/receipts/:id/edit" element={<ReceiptPage key="edit" editing />} />
                <Route path="/billing/aging" element={<AgingPage />} />
                <Route path="/billing/statements/:id" element={<StatementPage />} />
                <Route path="/billing/bank-accounts" element={<BankAccountsPage />} />
                <Route path="/housing/buildings/:id" element={<BuildingPage />} />
                <Route path="/workforce/invoice-check" element={<InvoiceCheckPage />} />
                <Route path="/operations/return-orders/new" element={<ReturnOrdersPage key="new" creating />} />
                <Route path="/operations/return-orders/:id" element={<ReturnOrderDetailPage />} />
                <Route path="/operations/return-orders/:id/edit" element={<ReturnOrderDetailPage key="edit" editing />} />
                <Route path="/operations/transfer-orders" element={<TransferOrdersPage />} />
                <Route path="/operations/movements" element={<MovementsPage />} />
                <Route path="/operations/movements/new" element={<MovementsPage key="new" creating />} />
                <Route path="/operations/movements/:id" element={<MovementPage />} />
                <Route path="/operations/movements/:id/edit" element={<MovementPage key="edit" editing />} />
                <Route path="/operations/transfer-orders/new" element={<TransferOrdersPage key="new" creating />} />
                <Route path="/operations/transfer-orders/:id" element={<TransferOrderDetailPage />} />
                <Route path="/operations/transfer-orders/:id/edit" element={<TransferOrderDetailPage key="edit" editing />} />
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
              <Route path="/billing/invoices/:id/print" element={<InvoicePrintPage />} />
              <Route path="/billing/statements/:id/print" element={<StatementPage print />} />
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
