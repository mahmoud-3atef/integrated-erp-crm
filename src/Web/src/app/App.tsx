import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import 'dayjs/locale/ar';
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
import { PayrollRunPage } from '../pages/payroll/PayrollRunPage';
import { PayrollRunsPage } from '../pages/payroll/PayrollRunsPage';
import { GosiPage } from '../pages/payroll/gosi/GosiPage';
import { CeoReportPage } from '../pages/reports/CeoReportPage';
import { MovementReportPage } from '../pages/reports/MovementReportPage';
import { ManagementDashboardPage } from '../pages/reports/management/ManagementDashboardPage';
import { PayslipsPrintPage } from '../pages/payroll/PayslipsPrintPage';
import { StaffPaySettingsPage } from '../pages/payroll/staff/StaffPaySettingsPage';
import { StaffRunPage } from '../pages/payroll/staff/StaffRunPage';
import { StaffRunsPage } from '../pages/payroll/staff/StaffRunsPage';
import { SettlementsPage } from '../pages/settlements/SettlementsPage';
import { SettlementPage } from '../pages/settlements/SettlementPage';
import { SettlementPrintPage } from '../pages/settlements/SettlementPrintPage';
import { CatalogPage } from '../pages/staff/CatalogPage';
import { OrgStructurePage } from '../pages/staff/OrgStructurePage';
import { StaffDirectoryPage } from '../pages/staff/StaffDirectoryPage';
import { StaffProfilePage } from '../pages/staff/StaffProfilePage';
import { StaffActionPage, StaffActionsPage } from '../pages/staff/StaffActions';
import { AttendanceMonthPage } from '../pages/attendance/AttendanceMonthPage';
import { ShiftsPage } from '../pages/attendance/ShiftsPage';
import { AttendanceMonthLink, OvertimePage } from '../pages/attendance/Overtime';
import { LeavePage, LeaveRequestPage } from '../pages/leave/LeavePages';
import { LeaveBalancesPage, LeaveTypesPage } from '../pages/leave/LeaveSetupPages';
import { AdvancePage, AdvancesPage } from '../pages/deductions/advances';
import { PenaltiesPage, PenaltyPage } from '../pages/deductions/penalties';
import { DeductionSettingsPage } from '../pages/deductions/settings';
import { PermissionPage } from '../pages/leave/permissions';
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
import { ShowroomPage } from '../pages/operations/showroom/ShowroomPage';
import { SupplierCostsPage } from '../pages/workforce/SupplierCostsPage';
import { ExpensesPage } from '../pages/expenses/ExpensesPage';
import { ShowroomPrintPage } from '../pages/operations/showroom/ShowroomPrintPage';
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
import { EnglishScope } from '../components/workflow/EnglishScope';
import { AppShell } from './AppShell';
import { buildTheme, ltrCache, rtlCache } from './theme';

export function App() {
  const { t, i18n } = useTranslation();
  const direction = directionOf(i18n.language as Language);
  const theme = useMemo(() => buildTheme(direction), [direction]);
  // The calendars' own words, from the screen's language (DateField).
  const pickerText = useMemo(
    () => ({
      todayButtonLabel: t('calendar.today'),
      clearButtonLabel: t('calendar.clear'),
      okButtonLabel: t('calendar.ok'),
      cancelButtonLabel: t('common.cancel'),
      previousMonth: t('calendar.previousMonth'),
      nextMonth: t('calendar.nextMonth'),
      datePickerToolbarTitle: t('calendar.pickDay'),
      openDatePickerDialogue: () => t('calendar.open'),
      fieldYearPlaceholder: () => t('calendar.yyyy'),
      fieldMonthPlaceholder: () => t('calendar.mm'),
      fieldDayPlaceholder: () => t('calendar.dd'),
    }),
    [t],
  );

  return (
    <CacheProvider value={direction === 'rtl' ? rtlCache : ltrCache}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={i18n.language === 'ar' ? 'ar' : 'en'} localeText={pickerText}>
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
                <Route path="/housing/showroom" element={<ShowroomPage />} />
                <Route path="/workforce/supplier-costs" element={<SupplierCostsPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/housing/showroom/print" element={<ShowroomPrintPage />} />
                <Route path="/operations/showroom" element={<Navigate to="/housing/showroom" replace />} />
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
                <Route path="/payroll/runs" element={<PayrollRunsPage />} />
                <Route path="/payroll/runs/new" element={<PayrollRunsPage key="new" creating />} />
                <Route path="/payroll/runs/:id" element={<PayrollRunPage />} />
                <Route path="/payroll/staff" element={<StaffRunsPage />} />
                <Route path="/payroll/staff/:id" element={<StaffRunPage />} />
                <Route path="/payroll/staff-settings" element={<StaffPaySettingsPage />} />
                <Route path="/payroll/gosi" element={<GosiPage />} />
                <Route path="/reports/management" element={<ManagementDashboardPage />} />
                <Route path="/reports/executive" element={<CeoReportPage />} />
                <Route path="/reports/movement" element={<MovementReportPage />} />
                <Route path="/hr/employees" element={<StaffDirectoryPage />} />
                <Route path="/hr/employees/new" element={<StaffDirectoryPage key="new" creating />} />
                <Route path="/hr/employees/:id" element={<StaffProfilePage />} />
                <Route path="/hr/structure" element={<OrgStructurePage />} />
                <Route path="/hr/catalog" element={<CatalogPage />} />
                <Route path="/hr/actions" element={<StaffActionsPage />} />
                <Route path="/hr/actions/:id" element={<StaffActionPage />} />
                <Route path="/hr/attendance" element={<AttendanceMonthPage />} />
                <Route path="/hr/shifts" element={<ShiftsPage />} />
                <Route path="/hr/attendance/months/:id" element={<AttendanceMonthLink />} />
                <Route path="/hr/overtime/:id" element={<OvertimePage />} />
                <Route path="/hr/leave" element={<LeavePage />} />
                <Route path="/hr/leave/:id" element={<LeaveRequestPage />} />
                <Route path="/hr/leave-balances" element={<LeaveBalancesPage />} />
                <Route path="/hr/leave-types" element={<LeaveTypesPage />} />
                <Route path="/hr/permissions/:id" element={<PermissionPage />} />
                <Route path="/hr/advances" element={<AdvancesPage />} />
                <Route path="/hr/settlements" element={<SettlementsPage />} />
                <Route path="/hr/settlements/:id" element={<SettlementPage />} />
                <Route path="/hr/advances/:id" element={<AdvancePage />} />
                <Route path="/hr/penalties" element={<PenaltiesPage />} />
                <Route path="/hr/penalties/:id" element={<PenaltyPage />} />
                <Route path="/hr/deductions-settings" element={<DeductionSettingsPage />} />
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
                <Route path="/workflow/processes" element={<EnglishScope><ProcessesPage /></EnglishScope>} />
                <Route path="/workflow/processes/:id" element={<EnglishScope><ProcessEditorPage /></EnglishScope>} />
                <Route path="/workflow/requests" element={<RequestsPage />} />
                <Route path="/workflow/requests/:id" element={<RequestDetailPage />} />
              </Route>
              <Route path="/billing/invoices/:id/print" element={<InvoicePrintPage />} />
              <Route path="/billing/statements/:id/print" element={<StatementPage print />} />
              <Route path="/payroll/staff/:id/payslips" element={<PayslipsPrintPage kind="staff" />} />
              <Route path="/hr/settlements/:id/print" element={<SettlementPrintPage />} />
              <Route path="/payroll/runs/:id/payslips" element={<PayslipsPrintPage kind="workers" />} />
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
        </LocalizationProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
