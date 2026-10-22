import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import 'dayjs/locale/ar';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SignInFlowProvider } from '../auth/SignInFlow';
import { directionOf } from '../i18n';
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
    const direction = directionOf(i18n.language);
    const theme = useMemo(() => buildTheme(direction), [direction]);
    // The calendars' own words, from the screen's language (DateField).
    const pickerText = useMemo(() => ({
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
    }), [t]);
    return (_jsx(CacheProvider, { value: direction === 'rtl' ? rtlCache : ltrCache, children: _jsx(ThemeProvider, { theme: theme, children: _jsxs(LocalizationProvider, { dateAdapter: AdapterDayjs, adapterLocale: i18n.language === 'ar' ? 'ar' : 'en', localeText: pickerText, children: [_jsx(CssBaseline, {}), _jsx(BrowserRouter, { children: _jsx(SignInFlowProvider, { children: _jsxs(Routes, { children: [_jsxs(Route, { element: _jsx(AppShell, {}), children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/alerts", element: _jsx(AlertsPage, {}) }), _jsx(Route, { path: "/admin/users", element: _jsx(UsersPage, {}) }), _jsx(Route, { path: "/admin/roles", element: _jsx(RolesPage, {}) }), _jsx(Route, { path: "/admin/crm-sync", element: _jsx(CrmSyncPage, {}) }), _jsx(Route, { path: "/workforce/workers", element: _jsx(WorkersPage, { kind: "Worker" }, "workers") }), _jsx(Route, { path: "/workforce/workers/:id", element: _jsx(WorkerDetailPage, { kind: "Worker" }) }), _jsx(Route, { path: "/workforce/staff", element: _jsx(WorkersPage, { kind: "Staff" }, "staff") }), _jsx(Route, { path: "/workforce/staff/:id", element: _jsx(WorkerDetailPage, { kind: "Staff" }) }), _jsx(Route, { path: "/commercial/projects", element: _jsx(ProjectsPage, {}) }), _jsx(Route, { path: "/commercial/projects/:id", element: _jsx(ProjectDetailPage, {}) }), _jsx(Route, { path: "/commercial/customers", element: _jsx(CustomersPage, {}) }), _jsx(Route, { path: "/commercial/customers/:id", element: _jsx(CustomerDetailPage, {}) }), _jsx(Route, { path: "/commercial/prices", element: _jsx(PricesPage, {}) }), _jsx(Route, { path: "/operations/delivery-orders", element: _jsx(DeliveryOrdersPage, {}) }), _jsx(Route, { path: "/operations/delivery-orders/new", element: _jsx(DeliveryOrdersPage, { creating: true }, "new") }), _jsx(Route, { path: "/housing/showroom", element: _jsx(ShowroomPage, {}) }), _jsx(Route, { path: "/workforce/supplier-costs", element: _jsx(SupplierCostsPage, {}) }), _jsx(Route, { path: "/expenses", element: _jsx(ExpensesPage, {}) }), _jsx(Route, { path: "/housing/showroom/print", element: _jsx(ShowroomPrintPage, {}) }), _jsx(Route, { path: "/operations/showroom", element: _jsx(Navigate, { to: "/housing/showroom", replace: true }) }), _jsx(Route, { path: "/operations/delivery-orders/:id", element: _jsx(DeliveryOrderDetailPage, {}) }), _jsx(Route, { path: "/operations/delivery-orders/:id/edit", element: _jsx(DeliveryOrderDetailPage, { editing: true }, "edit") }), _jsx(Route, { path: "/operations/return-orders", element: _jsx(ReturnOrdersPage, {}) }), _jsx(Route, { path: "/workforce/history-issues", element: _jsx(HistoryIssuesPage, {}) }), _jsx(Route, { path: "/housing", element: _jsx(HousingPage, {}) }), _jsx(Route, { path: "/admin/numbering", element: _jsx(NumberingPage, {}) }), _jsx(Route, { path: "/billing/timesheets", element: _jsx(TimesheetsPage, {}) }), _jsx(Route, { path: "/billing/timesheets/:id", element: _jsx(TimesheetPage, {}) }), _jsx(Route, { path: "/billing/invoices", element: _jsx(InvoicesPage, {}) }), _jsx(Route, { path: "/billing/invoices/:id", element: _jsx(InvoicePage, {}) }), _jsx(Route, { path: "/billing/receipts", element: _jsx(ReceiptsPage, {}) }), _jsx(Route, { path: "/billing/receipts/new", element: _jsx(ReceiptsPage, { creating: true }, "new") }), _jsx(Route, { path: "/billing/receipts/:id", element: _jsx(ReceiptPage, {}) }), _jsx(Route, { path: "/billing/receipts/:id/edit", element: _jsx(ReceiptPage, { editing: true }, "edit") }), _jsx(Route, { path: "/billing/aging", element: _jsx(AgingPage, {}) }), _jsx(Route, { path: "/billing/statements/:id", element: _jsx(StatementPage, {}) }), _jsx(Route, { path: "/billing/bank-accounts", element: _jsx(BankAccountsPage, {}) }), _jsx(Route, { path: "/payroll/runs", element: _jsx(PayrollRunsPage, {}) }), _jsx(Route, { path: "/payroll/runs/new", element: _jsx(PayrollRunsPage, { creating: true }, "new") }), _jsx(Route, { path: "/payroll/runs/:id", element: _jsx(PayrollRunPage, {}) }), _jsx(Route, { path: "/payroll/staff", element: _jsx(StaffRunsPage, {}) }), _jsx(Route, { path: "/payroll/staff/:id", element: _jsx(StaffRunPage, {}) }), _jsx(Route, { path: "/payroll/staff-settings", element: _jsx(StaffPaySettingsPage, {}) }), _jsx(Route, { path: "/payroll/gosi", element: _jsx(GosiPage, {}) }), _jsx(Route, { path: "/reports/management", element: _jsx(ManagementDashboardPage, {}) }), _jsx(Route, { path: "/reports/executive", element: _jsx(CeoReportPage, {}) }), _jsx(Route, { path: "/reports/movement", element: _jsx(MovementReportPage, {}) }), _jsx(Route, { path: "/hr/employees", element: _jsx(StaffDirectoryPage, {}) }), _jsx(Route, { path: "/hr/employees/new", element: _jsx(StaffDirectoryPage, { creating: true }, "new") }), _jsx(Route, { path: "/hr/employees/:id", element: _jsx(StaffProfilePage, {}) }), _jsx(Route, { path: "/hr/structure", element: _jsx(OrgStructurePage, {}) }), _jsx(Route, { path: "/hr/catalog", element: _jsx(CatalogPage, {}) }), _jsx(Route, { path: "/hr/actions", element: _jsx(StaffActionsPage, {}) }), _jsx(Route, { path: "/hr/actions/:id", element: _jsx(StaffActionPage, {}) }), _jsx(Route, { path: "/hr/attendance", element: _jsx(AttendanceMonthPage, {}) }), _jsx(Route, { path: "/hr/shifts", element: _jsx(ShiftsPage, {}) }), _jsx(Route, { path: "/hr/attendance/months/:id", element: _jsx(AttendanceMonthLink, {}) }), _jsx(Route, { path: "/hr/overtime/:id", element: _jsx(OvertimePage, {}) }), _jsx(Route, { path: "/hr/leave", element: _jsx(LeavePage, {}) }), _jsx(Route, { path: "/hr/leave/:id", element: _jsx(LeaveRequestPage, {}) }), _jsx(Route, { path: "/hr/leave-balances", element: _jsx(LeaveBalancesPage, {}) }), _jsx(Route, { path: "/hr/leave-types", element: _jsx(LeaveTypesPage, {}) }), _jsx(Route, { path: "/hr/permissions/:id", element: _jsx(PermissionPage, {}) }), _jsx(Route, { path: "/hr/advances", element: _jsx(AdvancesPage, {}) }), _jsx(Route, { path: "/hr/settlements", element: _jsx(SettlementsPage, {}) }), _jsx(Route, { path: "/hr/settlements/:id", element: _jsx(SettlementPage, {}) }), _jsx(Route, { path: "/hr/advances/:id", element: _jsx(AdvancePage, {}) }), _jsx(Route, { path: "/hr/penalties", element: _jsx(PenaltiesPage, {}) }), _jsx(Route, { path: "/hr/penalties/:id", element: _jsx(PenaltyPage, {}) }), _jsx(Route, { path: "/hr/deductions-settings", element: _jsx(DeductionSettingsPage, {}) }), _jsx(Route, { path: "/housing/buildings/:id", element: _jsx(BuildingPage, {}) }), _jsx(Route, { path: "/workforce/invoice-check", element: _jsx(InvoiceCheckPage, {}) }), _jsx(Route, { path: "/operations/return-orders/new", element: _jsx(ReturnOrdersPage, { creating: true }, "new") }), _jsx(Route, { path: "/operations/return-orders/:id", element: _jsx(ReturnOrderDetailPage, {}) }), _jsx(Route, { path: "/operations/return-orders/:id/edit", element: _jsx(ReturnOrderDetailPage, { editing: true }, "edit") }), _jsx(Route, { path: "/operations/transfer-orders", element: _jsx(TransferOrdersPage, {}) }), _jsx(Route, { path: "/operations/movements", element: _jsx(MovementsPage, {}) }), _jsx(Route, { path: "/operations/movements/new", element: _jsx(MovementsPage, { creating: true }, "new") }), _jsx(Route, { path: "/operations/movements/:id", element: _jsx(MovementPage, {}) }), _jsx(Route, { path: "/operations/movements/:id/edit", element: _jsx(MovementPage, { editing: true }, "edit") }), _jsx(Route, { path: "/operations/transfer-orders/new", element: _jsx(TransferOrdersPage, { creating: true }, "new") }), _jsx(Route, { path: "/operations/transfer-orders/:id", element: _jsx(TransferOrderDetailPage, {}) }), _jsx(Route, { path: "/operations/transfer-orders/:id/edit", element: _jsx(TransferOrderDetailPage, { editing: true }, "edit") }), _jsx(Route, { path: "/setup/legal-entities", element: _jsx(LegalEntitiesPage, {}) }), _jsx(Route, { path: "/setup/branches", element: _jsx(BranchesPage, {}) }), _jsx(Route, { path: "/setup/reference-lists/:list?", element: _jsx(ReferenceListsPage, {}) }), _jsx(Route, { path: "/setup/modules", element: _jsx(ModulesPage, {}) }), _jsx(Route, { path: "/workflow/inbox", element: _jsx(InboxPage, {}) }), _jsx(Route, { path: "/workflow/my-requests", element: _jsx(MyApprovalsPage, {}) }), _jsx(Route, { path: "/workflow/monitor", element: _jsx(MonitorPage, {}) }), _jsx(Route, { path: "/workflow/approvals/:id", element: _jsx(ApprovalDetailPage, {}) }), _jsx(Route, { path: "/workflow/processes", element: _jsx(EnglishScope, { children: _jsx(ProcessesPage, {}) }) }), _jsx(Route, { path: "/workflow/processes/:id", element: _jsx(EnglishScope, { children: _jsx(ProcessEditorPage, {}) }) }), _jsx(Route, { path: "/workflow/requests", element: _jsx(RequestsPage, {}) }), _jsx(Route, { path: "/workflow/requests/:id", element: _jsx(RequestDetailPage, {}) })] }), _jsx(Route, { path: "/billing/invoices/:id/print", element: _jsx(InvoicePrintPage, {}) }), _jsx(Route, { path: "/billing/statements/:id/print", element: _jsx(StatementPage, { print: true }) }), _jsx(Route, { path: "/payroll/staff/:id/payslips", element: _jsx(PayslipsPrintPage, { kind: "staff" }) }), _jsx(Route, { path: "/hr/settlements/:id/print", element: _jsx(SettlementPrintPage, {}) }), _jsx(Route, { path: "/payroll/runs/:id/payslips", element: _jsx(PayslipsPrintPage, { kind: "workers" }) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/login/mfa-setup", element: _jsx(MfaSetupPage, {}) }), _jsx(Route, { path: "/login/recovery-codes", element: _jsx(RecoveryCodesPage, {}) }), _jsx(Route, { path: "/login/mfa", element: _jsx(MfaVerifyPage, {}) }), _jsx(Route, { path: "/login/company", element: _jsx(ChooseCompanyPage, {}) }), _jsx(Route, { path: "/login/no-access", element: _jsx(NoCompanyPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) })] }) }) }));
}
