const defaultMenu = [
  { id: "esp", name: "Espresso", category: "Kopi", price: 18000, printLabel: true },
  { id: "cap", name: "Cappuccino", category: "Kopi", price: 28000, printLabel: true },
  { id: "lat", name: "Cafe Latte", category: "Kopi", price: 30000, printLabel: true },
  { id: "aren", name: "Kopi Susu Aren", category: "Kopi", price: 26000, printLabel: true },
  { id: "matcha", name: "Matcha Latte", category: "Non Kopi", price: 32000, printLabel: true },
  { id: "choco", name: "Iced Chocolate", category: "Non Kopi", price: 29000, printLabel: true },
  { id: "croissant", name: "Butter Croissant", category: "Snack", price: 24000, printLabel: false },
  { id: "toast", name: "Smoked Beef Toast", category: "Snack", price: 36000, printLabel: false },
  { id: "pb-classic", name: "Photobooth Classic", category: "Photobooth", price: 45000, boothPackage: "classic", printLabel: false },
  { id: "pb-premium", name: "Photobooth Premium", category: "Photobooth", price: 75000, boothPackage: "premium", printLabel: false },
];

const storageKeys = {
  menu: "kopishop-pos-menu",
  history: "kopishop-pos-history",
  booth: "kopishop-pos-booth-sessions",
  boothLegacy: "pb_sessions",
  auth: "kasir-migi-auth",
  employee: "kasir-migi-employee",
  employees: "kasir-migi-employees",
  employeeLeaves: "kasir-migi-employee-leaves",
  employeeRoles: "kasir-migi-employee-roles",
  deletedEmployees: "kasir-migi-deleted-employees",
  sessionShift: "kasir-migi-session-shift",
  activeShift: "kasir-migi-active-shift",
  inventory: "kopishop-pos-inventory",
  inventoryDirty: "kopishop-pos-inventory-dirty",
  purchases: "kopishop-pos-purchases",
  recipes: "kopishop-pos-recipes",
  orderDrafts: "kopishop-pos-order-drafts",
  cashflowExpenses: "kopishop-pos-cashflow-expenses",
  discountVouchers: "kasir-migi-discount-vouchers",
  pendingDeletes: "kopishop-pos-pending-deletes",
  deletedTransactions: "kopishop-pos-deleted-transactions",
  activeView: "kasir-migi-active-view",
  shiftActions: "kasir-migi-shift-actions",
  shiftAssignments: "kasir-migi-shift-assignments",
  dailyCashReports: "kasir-migi-daily-cash-reports",
  juneRecoverySynced: "kasir-migi-june-recovery-synced-v1",
  wifiReceipt: "kasir-migi-wifi-receipt",
  settingsDirty: "kasir-migi-settings-dirty",
  deviceId: "kasir-migi-device-id",
  lastDeviceWarning: "kasir-migi-last-device-warning",
  logoutSignal: "kasir-migi-logout-signal",
  lastRemoteLogout: "kasir-migi-last-remote-logout",
};

const sessionTtlMs = 10 * 60 * 60 * 1000;

const defaultIngredientCategories = [
  "Bean Kopi",
  "Sirup",
  "Bubuk / Powder",
  "Susu / Creamer",
  "Gula",
  "Packaging",
  "Lainnya",
];

const boothPackagePhotoCounts = {
  single: 1,
  couple: 1,
  classic: 2,
  premium: 4,
};

const boothSyncChannel = "BroadcastChannel" in window ? new BroadcastChannel("photobooth-sync") : null;

const state = {
  cart: [],
  category: "Semua",
  search: "",
  payment: "Tunai",
  orderType: "normal",
  serviceType: "dine_in",
  discountType: "none",
  discountValue: 0,
  discountNote: "",
  discountVoucherId: "",
  pendingDiscountVoucherId: "",
  orderChannel: "Kasir",
  orderStatus: "unpaid",
  paidOrderCategory: "Semua",
  chartRange: "daily",
  activeDraftId: "",
  pendingBoothCode: "",
  boothPhotos: [],
  boothStream: null,
  activeCashier: { online: false, employee: "" },
  menuEditCategory: "Semua",
  menuEditSearch: "",
  stockCategory: "Semua",
  pendingEmployeeDelete: "",
  editingTransactionId: "",
  editingTransactionItems: [],
  menuSaving: false,
  wifiEditing: false,
  reportShareText: "",
  analyticsPeriodKey: "",
  analyticsPeriodTransactions: [],
  analyticsPeriodLoading: false,
  analyticsPeriodRequestId: 0,
  analyticsLoadError: "",
  analyticsLoadErrorPeriodKey: "",
  cashflowSalesPeriodKey: "",
  cashflowSalesTransactions: [],
  cashflowSalesRequestId: 0,
  logoutAfterOrder: false,
  shiftTransitionHandled: "",
  pendingLogin: null,
  orderProcessing: false,
  pendingSyncCount: 0,
  printerDevice: null,
  printerCharacteristic: null,
  labelPrinterDevice: null,
  labelPrinterCharacteristic: null,
};

// Semua sumber cetak label (checkout, cetak ulang, dan test) wajib melewati
// antrean yang sama agar byte raster tidak pernah saling berselingan.
let labelPrintQueue = Promise.resolve();

const bleServiceUuids = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

const bleCharacteristicUuids = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
];

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const offlineDbName = "kasir-migi-offline";
const offlineStoreName = "transactions";
let offlineDbPromise = null;

const els = {
  tabs: document.querySelectorAll(".nav-tab"),
  views: document.querySelectorAll(".view-panel"),
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  toggleLoginPassword: document.querySelector("#toggleLoginPassword"),
  toggleLoginPasswordIcon: document.querySelector("#toggleLoginPasswordIcon"),
  loginShift: document.querySelector("#loginShift"),
  loginEmployee: document.querySelector("#loginEmployee"),
  loginDutyRoleWrap: document.querySelector("#loginDutyRoleWrap"),
  loginDutyRole: document.querySelector("#loginDutyRole"),
  loginSubmitBtn: document.querySelector("#loginSubmitBtn"),
  loginHint: document.querySelector("#loginHint"),
  orderModal: document.querySelector("#orderModal"),
  orderForm: document.querySelector("#orderForm"),
  modalOrderList: document.querySelector("#modalOrderList"),
  stockEditModal: document.querySelector("#stockEditModal"),
  stockEditForm: document.querySelector("#stockEditForm"),
  cancelStockEdit: document.querySelector("#cancelStockEdit"),
  stockEditCancelBtn: document.querySelector("#stockEditCancelBtn"),
  stockEditName: document.querySelector("#stockEditName"),
  stockEditUnit: document.querySelector("#stockEditUnit"),
  stockEditCurrent: document.querySelector("#stockEditCurrent"),
  stockEditSlider: document.querySelector("#stockEditSlider"),
  stockEditInput: document.querySelector("#stockEditInput"),
  stockEditSummary: document.querySelector("#stockEditSummary"),
  billOrderBtn: document.querySelector("#billOrderBtn"),
  orderCustomerName: document.querySelector("#orderCustomerName"),
  orderTableNumber: document.querySelector("#orderTableNumber"),
  orderShift: document.querySelector("#orderShift"),
  orderChannels: document.querySelector("#orderChannels"),
  cancelOrderModal: document.querySelector("#cancelOrderModal"),
  todayLabel: document.querySelector("#todayLabel"),
  clockLabel: document.querySelector("#clockLabel"),
  activeEmployeeCard: document.querySelector("#activeEmployeeCard"),
  activeEmployeeHeader: document.querySelector("#activeEmployeeHeader"),
  employeeName: document.querySelector("#employeeName"),
  employeeStatusBadge: document.querySelector("#employeeStatusBadge"),
  employeeActiveNote: document.querySelector("#employeeActiveNote"),
  employeeAddForm: document.querySelector("#employeeAddForm"),
  employeeNewName: document.querySelector("#employeeNewName"),
  employeeList: document.querySelector("#employeeList"),
  roleAddForm: document.querySelector("#roleAddForm"),
  roleNewName: document.querySelector("#roleNewName"),
  roleList: document.querySelector("#roleList"),
  employeeDeleteModal: document.querySelector("#employeeDeleteModal"),
  employeeDeleteForm: document.querySelector("#employeeDeleteForm"),
  employeeDeleteName: document.querySelector("#employeeDeleteName"),
  cancelEmployeeDelete: document.querySelector("#cancelEmployeeDelete"),
  employeeDeleteCancelBtn: document.querySelector("#employeeDeleteCancelBtn"),
  dailyCashModal: document.querySelector("#dailyCashModal"),
  dailyCashForm: document.querySelector("#dailyCashForm"),
  dailyCashAmount: document.querySelector("#dailyCashAmount"),
  dailyCashDateLabel: document.querySelector("#dailyCashDateLabel"),
  inputDailyCashBtn: document.querySelector("#inputDailyCashBtn"),
  cancelDailyCash: document.querySelector("#cancelDailyCash"),
  dailyCashCancelBtn: document.querySelector("#dailyCashCancelBtn"),
  wifiSettingsForm: document.querySelector("#wifiSettingsForm"),
  wifiReceiptEnabled: document.querySelector("#wifiReceiptEnabled"),
  wifiName: document.querySelector("#wifiName"),
  wifiPassword: document.querySelector("#wifiPassword"),
  toggleWifiPassword: document.querySelector("#toggleWifiPassword"),
  toggleWifiPasswordIcon: document.querySelector("#toggleWifiPasswordIcon"),
  wifiDisplayInfo: document.querySelector("#wifiDisplayInfo"),
  wifiDisplaySsid: document.querySelector("#wifiDisplaySsid"),
  wifiDisplayPassword: document.querySelector("#wifiDisplayPassword"),
  btnEditWifi: document.querySelector("#btnEditWifi"),
  wifiFieldsContainer: document.querySelector("#wifiFieldsContainer"),
  checkoutWifiLine: document.querySelector("#checkoutWifiLine"),
  checkoutWifiReceipt: document.querySelector("#checkoutWifiReceipt"),
  transactionEditModal: document.querySelector("#transactionEditModal"),
  transactionEditForm: document.querySelector("#transactionEditForm"),
  transactionEditCloseBtn: document.querySelector("#transactionEditCloseBtn"),
  transactionEditCancelBtn: document.querySelector("#transactionEditCancelBtn"),
  transactionEditCode: document.querySelector("#transactionEditCode"),
  transactionEditOldTotal: document.querySelector("#transactionEditOldTotal"),
  transactionEditNewTotal: document.querySelector("#transactionEditNewTotal"),
  transactionEditItems: document.querySelector("#transactionEditItems"),
  transactionEditAddMenu: document.querySelector("#transactionEditAddMenu"),
  transactionEditAddBtn: document.querySelector("#transactionEditAddBtn"),
  transactionEditPayment: document.querySelector("#transactionEditPayment"),
  transactionEditReason: document.querySelector("#transactionEditReason"),
  logoutBtn: document.querySelector("#logoutBtn"),
  fullscreenToggle: document.querySelector("#fullscreenToggle"),
  printerToggle: document.querySelector("#printerToggle"),
  printerDropdown: document.querySelector("#printerDropdown"),
  printerStatus: document.querySelector("#printerStatus"),
  printerPaperSize: document.querySelector("#printerPaperSize"),
  connectPrinter: document.querySelector("#connectPrinter"),
  receiptPrinterWarningBtn: document.querySelector("#receiptPrinterWarningBtn"),
  labelPrinterWarningBtn: document.querySelector("#labelPrinterWarningBtn"),
  testLogoPrint: document.querySelector("#testLogoPrint"),
  printerHint: document.querySelector("#printerHint"),
  printerBadge: document.querySelector("#printerBadge"),
  printerTabKasir: document.querySelector("#printerTabKasir"),
  printerTabLabel: document.querySelector("#printerTabLabel"),
  printerPanelKasir: document.querySelector("#printerPanelKasir"),
  printerPanelLabel: document.querySelector("#printerPanelLabel"),
  labelPrinterStatus: document.querySelector("#labelPrinterStatus"),
  labelPrinterCheckoutWarning: null, // dipindahkan ke header icon #labelPrinterWarningBtn
  labelPrinterPrintEngine: document.querySelector("#labelPrinterPrintEngine"),
  labelPrinterPaperSize: document.querySelector("#labelPrinterPaperSize"),
  labelPrinterFeedMethod: document.querySelector("#labelPrinterFeedMethod"),
  labelPrinterManualSettings: document.querySelector("#labelPrinterManualSettings"),
  labelPrinterPitch: document.querySelector("#labelPrinterPitch"),
  labelPrinterLineSpacing: document.querySelector("#labelPrinterLineSpacing"),
  labelPrinterDelay: document.querySelector("#labelPrinterDelay"),
  labelPrinterMargin: document.querySelector("#labelPrinterMargin"),
  labelPrinterSpaces: document.querySelector("#labelPrinterSpaces"),
  labelPreviewPaper: document.querySelector("#labelPreviewPaper"),
  labelPreviewSticker: document.querySelector("#labelPreviewSticker"),
  labelPreviewLogo: document.querySelector("#labelPreviewLogo"),
  labelPreviewCustomImage: document.querySelector("#labelPreviewCustomImage"),
  labelStickerOffsetX: document.querySelector("#labelStickerOffsetX"),
  labelStickerOffsetXVal: document.querySelector("#labelStickerOffsetXVal"),

  openLabelSettingsBtn: document.querySelector("#openLabelSettingsBtn"),
  closeLabelSettingsBtn: document.querySelector("#closeLabelSettingsBtn"),
  saveLabelSettingsBtn: document.querySelector("#saveLabelSettingsBtn"),
  labelSettingsModal: document.querySelector("#labelSettingsModal"),

  labelPreviewDrinkName: document.querySelector("#labelPreviewDrinkName"),
  labelDrinkNameEnabled: document.querySelector("#labelDrinkNameEnabled"),
  labelDrinkNameBold: document.querySelector("#labelDrinkNameBold"),
  labelDrinkNameFontSize: document.querySelector("#labelDrinkNameFontSize"),
  labelDrinkNameFontSizeVal: document.querySelector("#labelDrinkNameFontSizeVal"),
  labelDrinkNameHeight: document.querySelector("#labelDrinkNameHeight"),
  labelDrinkNameHeightVal: document.querySelector("#labelDrinkNameHeightVal"),
  labelDrinkNameWidth: document.querySelector("#labelDrinkNameWidth"),

  labelPreviewNotes: document.querySelector("#labelPreviewNotes"),
  labelNotesEnabled: document.querySelector("#labelNotesEnabled"),
  labelNotesBold: document.querySelector("#labelNotesBold"),
  labelNotesFontSize: document.querySelector("#labelNotesFontSize"),
  labelNotesFontSizeVal: document.querySelector("#labelNotesFontSizeVal"),
  labelNotesWidth: document.querySelector("#labelNotesWidth"),

  labelPreviewOrderCode: document.querySelector("#labelPreviewOrderCode"),
  labelOrderCodeEnabled: document.querySelector("#labelOrderCodeEnabled"),
  labelOrderCodeBold: document.querySelector("#labelOrderCodeBold"),
  labelOrderCodeFontSize: document.querySelector("#labelOrderCodeFontSize"),
  labelOrderCodeFontSizeVal: document.querySelector("#labelOrderCodeFontSizeVal"),
  labelOrderCodeWidth: document.querySelector("#labelOrderCodeWidth"),

  labelPreviewCustomer: document.querySelector("#labelPreviewCustomer"),
  labelPreviewServiceType: document.querySelector("#labelPreviewServiceType"),
  labelCustomerEnabled: document.querySelector("#labelCustomerEnabled"),
  labelCustomerBold: document.querySelector("#labelCustomerBold"),
  labelCustomerFontSize: document.querySelector("#labelCustomerFontSize"),
  labelCustomerFontSizeVal: document.querySelector("#labelCustomerFontSizeVal"),
  labelCustomerWidth: document.querySelector("#labelCustomerWidth"),

  labelPreviewCounter: document.querySelector("#labelPreviewCounter"),
  labelCounterEnabled: document.querySelector("#labelCounterEnabled"),
  labelCounterBold: document.querySelector("#labelCounterBold"),
  labelCounterFontSize: document.querySelector("#labelCounterFontSize"),
  labelCounterFontSizeVal: document.querySelector("#labelCounterFontSizeVal"),
  labelCounterWidth: document.querySelector("#labelCounterWidth"),

  labelPreviewCustomText: document.querySelector("#labelPreviewCustomText"),
  labelCustomTextEnabled: document.querySelector("#labelCustomTextEnabled"),
  labelCustomTextValue: document.querySelector("#labelCustomTextValue"),
  labelCustomTextBold: document.querySelector("#labelCustomTextBold"),
  labelCustomTextFontSize: document.querySelector("#labelCustomTextFontSize"),
  labelCustomTextFontSizeVal: document.querySelector("#labelCustomTextFontSizeVal"),
  labelCustomTextWidth: document.querySelector("#labelCustomTextWidth"),

  labelPreviewBarcode: document.querySelector("#labelPreviewBarcode"),
  labelLogoEnabled: document.querySelector("#labelLogoEnabled"),
  labelLogoWidth: document.querySelector("#labelLogoWidth"),
  labelServiceTypeEnabled: document.querySelector("#labelServiceTypeEnabled"),
  labelServiceTypeFontSize: document.querySelector("#labelServiceTypeFontSize"),
  labelServiceTypeFontSizeVal: document.querySelector("#labelServiceTypeFontSizeVal"),
  labelBarcodeEnabled: document.querySelector("#labelBarcodeEnabled"),
  labelBarcodeWidth: document.querySelector("#labelBarcodeWidth"),
  labelCustomImageEnabled: document.querySelector("#labelCustomImageEnabled"),
  labelCustomImageFile: document.querySelector("#labelCustomImageFile"),
  labelCustomImageHint: document.querySelector("#labelCustomImageHint"),
  removeLabelCustomImage: document.querySelector("#removeLabelCustomImage"),
  connectLabelPrinter: document.querySelector("#connectLabelPrinter"),
  testLabelPrint: document.querySelector("#testLabelPrint"),
  labelPrinterHint: document.querySelector("#labelPrinterHint"),
  itemCustomModal: document.querySelector("#itemCustomModal"),
  itemCustomForm: document.querySelector("#itemCustomForm"),
  customItemName: document.querySelector("#customItemName"),
  closeItemCustom: document.querySelector("#closeItemCustom"),
  itemCustomSaveBtn: document.querySelector("#itemCustomSaveBtn"),
  itemCustomNoteOptions: document.querySelector("#itemCustomNoteOptions"),

  customTemp: document.querySelector("#customTemp"),
  customIce: document.querySelector("#customIce"),
  customIceGroup: document.querySelector("#customIceGroup"),
  customSugar: document.querySelector("#customSugar"),
  customSize: document.querySelector("#customSize"),
  customTextNote: document.querySelector("#customTextNote"),
  categoryTabs: document.querySelector("#categoryTabs"),
  menuGrid: document.querySelector("#menuGrid"),
  menuSearch: document.querySelector("#menuSearch"),
  resetFilter: document.querySelector("#resetFilter"),
  openCustomOrder: document.querySelector("#openCustomOrder"),
  customOrderModal: document.querySelector("#customOrderModal"),
  customOrderForm: document.querySelector("#customOrderForm"),
  cancelCustomOrder: document.querySelector("#cancelCustomOrder"),
  customOrderCancelBtn: document.querySelector("#customOrderCancelBtn"),
  customOrderPrice: document.querySelector("#customOrderPrice"),
  customOrderIngredient: document.querySelector("#customOrderIngredient"),
  customOrderIngredientQty: document.querySelector("#customOrderIngredientQty"),
  customOrderIngredientUnit: document.querySelector("#customOrderIngredientUnit"),
  customOrderInfo: document.querySelector("#customOrderInfo"),
  checkoutPanel: document.querySelector(".checkout-panel"),
  cartList: document.querySelector("#cartList"),
  cartTitle: document.querySelector("#cartTitle"),
  subtotal: document.querySelector("#subtotal"),
  discountLine: document.querySelector("#discountLine"),
  discountTotal: document.querySelector("#discountTotal"),
  grandTotal: document.querySelector("#grandTotal"),
  cartSubtotal: document.querySelector("#cartSubtotal"),
  cartGrandTotal: document.querySelector("#cartGrandTotal"),
  orderTypeTabs: document.querySelector("#orderTypeTabs"),
  dineTakeBox: document.querySelector("#dineTakeBox"),
  dineTakeTabs: document.querySelector("#dineTakeTabs"),
  staffDrinkInfo: document.querySelector("#staffDrinkInfo"),
  discountBox: document.querySelector("#discountBox"),
  discountVoucherSelect: document.querySelector("#discountVoucherSelect"),
  applyDiscountVoucher: document.querySelector("#applyDiscountVoucher"),
  clearDiscountVoucher: document.querySelector("#clearDiscountVoucher"),
  voucherDiscountInfo: document.querySelector("#voucherDiscountInfo"),
  monthDiscountTotal: document.querySelector("#monthDiscountTotal"),
  monthDiscountCount: document.querySelector("#monthDiscountCount"),
  discountAnalyticsList: document.querySelector("#discountAnalyticsList"),
  discountVoucherForm: document.querySelector("#discountVoucherForm"),
  voucherCode: document.querySelector("#voucherCode"),
  voucherType: document.querySelector("#voucherType"),
  voucherValue: document.querySelector("#voucherValue"),
  voucherNote: document.querySelector("#voucherNote"),
  discountVoucherList: document.querySelector("#discountVoucherList"),
  paidAmountLabel: document.querySelector("#paidAmountLabel"),
  paidAmount: document.querySelector("#paidAmount"),
  changeDue: document.querySelector("#changeDue"),
  clearCart: document.querySelector("#clearCart"),
  clearCartPanel: document.querySelector("#clearCartPanel"),
  paymentMethods: document.querySelector("#paymentMethods"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  receiptPaper: document.querySelector("#receiptPaper"),
  customerName: document.querySelector("#customerName"),
  tableNumber: document.querySelector("#tableNumber"),
  boothPackage: document.querySelector("#boothPackage"),
  latestBoothCode: document.querySelector("#latestBoothCode"),
  shiftTotal: document.querySelector("#shiftTotal"),
  shiftCount: document.querySelector("#shiftCount"),
  activeShiftLabel: document.querySelector("#activeShiftLabel"),
  closeShiftBtn: document.querySelector("#closeShiftBtn"),
  historyList: document.querySelector("#historyList"),
  dailySummary: document.querySelector("#dailySummary"),
  dailyReportText: document.querySelector("#dailyReportText"),
  copyDailyReport: document.querySelector("#copyDailyReport"),
  shareDailyReport: document.querySelector("#shareDailyReport"),
  downloadDailyPdf: document.querySelector("#downloadDailyPdf"),
  dailyReportShareStatus: document.querySelector("#dailyReportShareStatus"),
  orderStatusTabs: document.querySelector("#orderStatusTabs"),
  orderList: document.querySelector("#orderList"),
  unpaidOrderCount: document.querySelector("#unpaidOrderCount"),
  kitchenOrderCount: document.querySelector("#kitchenOrderCount"),
  paidOrderCount: document.querySelector("#paidOrderCount"),
  paidOrderDate: document.querySelector("#paidOrderDate"),
  paidOrderCategoryTabs: document.querySelector("#paidOrderCategoryTabs"),
  connectionStatus: document.querySelector("#connectionStatus"),
  pendingSyncCount: document.querySelector("#pendingSyncCount"),
  manualSyncBtn: document.querySelector("#manualSyncBtn"),
  manualSyncOrdersBtn: document.querySelector("#manualSyncOrdersBtn"),
  pendingSyncList: document.querySelector("#pendingSyncList"),
  analyticsMonth: document.querySelector("#analyticsMonth"),
  analyticsDate: document.querySelector("#analyticsDate"),
  analyticsYear: document.querySelector("#analyticsYear"),
  chartRangeTabs: document.querySelector("#chartRangeTabs"),
  analyticsRevenueLabel: document.querySelector("#analyticsRevenueLabel"),
  analyticsTunaiLabel: document.querySelector("#analyticsTunaiLabel"),
  analyticsQrisLabel: document.querySelector("#analyticsQrisLabel"),
  analyticsAverageLabel: document.querySelector("#analyticsAverageLabel"),
  analyticsDiscountLabel: document.querySelector("#analyticsDiscountLabel"),
  monthRevenue: document.querySelector("#monthRevenue"),
  monthTunaiRevenue: document.querySelector("#monthTunaiRevenue"),
  monthQrisRevenue: document.querySelector("#monthQrisRevenue"),
  avgDailyRevenue: document.querySelector("#avgDailyRevenue"),
  monthTransactions: document.querySelector("#monthTransactions"),
  monthItems: document.querySelector("#monthItems"),
  revenueChart: document.querySelector("#revenueChart"),
  bestsellerList: document.querySelector("#bestsellerList"),
  insightList: document.querySelector("#insightList"),
  ingredientOutList: document.querySelector("#ingredientOutList"),
  menuForm: document.querySelector("#menuForm"),
  menuSubmitBtn: document.querySelector("#menuSubmitBtn"),
  menuId: document.querySelector("#menuId"),
  menuName: document.querySelector("#menuName"),
  menuCategorySelect: document.querySelector("#menuCategorySelect"),
  menuCategoryCustom: document.querySelector("#menuCategoryCustom"),
  menuCategory: document.querySelector("#menuCategory"),
  menuPrice: document.querySelector("#menuPrice"),
  menuImageFile: document.querySelector("#menuImageFile"),
  menuImage: document.querySelector("#menuImage"),
  menuImagePreview: document.querySelector("#menuImagePreview"),
  menuPrintLabel: document.querySelector("#menuPrintLabel"),
  cancelMenuEdit: document.querySelector("#cancelMenuEdit"),
  menuTable: document.querySelector("#menuTable"),
  menuEditSearch: document.querySelector("#menuEditSearch"),
  purchaseForm: document.querySelector("#purchaseForm"),
  purchaseMenuId: document.querySelector("#purchaseMenuId"),
  ingredientCategorySelect: document.querySelector("#ingredientCategorySelect"),
  ingredientCategoryCustom: document.querySelector("#ingredientCategoryCustom"),
  ingredientCategory: document.querySelector("#ingredientCategory"),
  purchaseQty: document.querySelector("#purchaseQty"),
  ingredientUnit: document.querySelector("#ingredientUnit"),
  purchaseCost: document.querySelector("#purchaseCost"),
  purchaseNote: document.querySelector("#purchaseNote"),
  stockCategoryTabs: document.querySelector("#stockCategoryTabs"),
  stockAvailabilityList: document.querySelector("#stockAvailabilityList"),
  stockAlert: document.querySelector("#stockAlert"),
  stockTable: document.querySelector("#stockTable"),
  priceListToggle: document.querySelector("#priceListToggle"),
  priceListContent: document.querySelector("#priceListContent"),
  syncTodayStockBtn: document.querySelector("#syncTodayStockBtn"),
  purchaseHistory: document.querySelector("#purchaseHistory"),
  recipeIngredientRows: document.querySelector("#recipeIngredientRows"),
  addRecipeIngredient: document.querySelector("#addRecipeIngredient"),
  menuEditCategoryTabs: document.querySelector("#menuEditCategoryTabs"),
  cashflowExpenseForm: document.querySelector("#cashflowExpenseForm"),
  cfExpenseNote: document.querySelector("#cfExpenseNote"),
  cfIngredientQtyWrap: document.querySelector("#cfIngredientQtyWrap"),
  cfExpenseQty: document.querySelector("#cfExpenseQty"),
  cfExpenseUnit: document.querySelector("#cfExpenseUnit"),
  cfExpenseAmount: document.querySelector("#cfExpenseAmount"),
  cfExpenseCategory: document.querySelector("#cfExpenseCategory"),
  cashflowList: document.querySelector("#cashflowList"),
  cashflowSearch: document.querySelector("#cashflowSearch"),
  cfTotalIn: document.querySelector("#cfTotalIn"),
  cfTotalOut: document.querySelector("#cfTotalOut"),
  cfNet: document.querySelector("#cfNet"),
  cfInCount: document.querySelector("#cfInCount"),
  cfOutCount: document.querySelector("#cfOutCount"),
  cfNetLabel: document.querySelector("#cfNetLabel"),
  cfFilterTabs: document.querySelector("#cfFilterTabs"),
  cashflowPeriodTabs: document.querySelector("#cashflowPeriodTabs"),
  cashflowMonth: document.querySelector("#cashflowMonth"),
  cashflowDate: document.querySelector("#cashflowDate"),
  boothVideo: document.querySelector("#boothVideo"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  startCamera: document.querySelector("#startCamera"),
  capturePhoto: document.querySelector("#capturePhoto"),
  boothStatus: document.querySelector("#boothStatus"),
  boothCustomer: document.querySelector("#boothCustomer"),
  boothSessionPackage: document.querySelector("#boothSessionPackage"),
  photoCount: document.querySelector("#photoCount"),
  boothCanvas: document.querySelector("#boothCanvas"),
  resetBooth: document.querySelector("#resetBooth"),
  downloadBooth: document.querySelector("#downloadBooth"),
  boothQueue: document.querySelector("#boothQueue"),
  toast: document.querySelector("#toast"),
};

function money(value) {
  return rupiah.format(value || 0).replace(/\u00a0/g, " ");
}

function quantityLabel(value) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function parseRupiah(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

const jakartaOffsetHours = 7;

function dateKey(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  const jakartaTime = new Date(date.getTime() + jakartaOffsetHours * 60 * 60 * 1000);
  const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getUTCDate()).padStart(2, "0");
  return `${jakartaTime.getUTCFullYear()}-${month}-${day}`;
}

function monthKey(value = new Date()) {
  return dateKey(value).slice(0, 7);
}

function jakartaDateRange(startYear, startMonthIndex, startDay, endYear, endMonthIndex, endDay) {
  return {
    startDate: new Date(Date.UTC(startYear, startMonthIndex, startDay, -jakartaOffsetHours)).toISOString(),
    endDate: new Date(Date.UTC(endYear, endMonthIndex, endDay, -jakartaOffsetHours)).toISOString(),
  };
}

function dayDateRange(day = dateKey()) {
  const [year, monthNumber, dayNumber] = String(day || dateKey()).split("-").map(Number);
  return jakartaDateRange(year, monthNumber - 1, dayNumber, year, monthNumber - 1, dayNumber + 1);
}

function monthDateRange(month = monthKey()) {
  const [year, monthNumber] = String(month || monthKey()).split("-").map(Number);
  const start = { year, monthIndex: monthNumber - 1, day: 1 };
  const end = monthNumber === 12
    ? { year: year + 1, monthIndex: 0, day: 1 }
    : { year, monthIndex: monthNumber, day: 1 };
  return {
    ...jakartaDateRange(start.year, start.monthIndex, start.day, end.year, end.monthIndex, end.day),
  };
}

function selectedAnalyticsYear() {
  const year = Number(els.analyticsYear?.value || selectedMonth().slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function yearDateRange(year = selectedAnalyticsYear()) {
  return jakartaDateRange(year, 0, 1, year + 1, 0, 1);
}

function analyticsPeriodKey(range = state.chartRange) {
  return range === "daily" ? `month:${selectedMonth()}` : `year:${selectedAnalyticsYear()}`;
}

function analyticsDateRange(range = state.chartRange) {
  return range === "daily" ? monthDateRange(selectedMonth()) : yearDateRange(selectedAnalyticsYear());
}

function dayOrderPrefix(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return ["M", "S", "SS", "R", "K", "J", "SB"][date.getDay()];
}

function isOnlineChannel(channel) {
  return ["GoFood", "GrabFood", "ShopeeFood"].includes(channel);
}

function paymentReportMethods() {
  return ["Tunai", "QRIS", "GoFood", "GrabFood", "ShopeeFood"];
}

function paymentUiMeta(method = "Tunai") {
  const meta = {
    Tunai: { icon: "ph-money", tone: "cash" },
    QRIS: { icon: "ph-qr-code", tone: "qris" },
    GoFood: { icon: "ph-bowl-food", tone: "gofood" },
    GrabFood: { icon: "ph-car", tone: "grabfood" },
    ShopeeFood: { icon: "ph-shopping-bag", tone: "shopeefood" },
  };
  return meta[method] || { icon: "ph-wallet", tone: "default" };
}

function transactionPaymentMethod(transaction = {}) {
  if (isOnlineChannel(transaction.channel)) return transaction.channel;
  return transaction.payment || "Tunai";
}

function transactionPaymentTotal(transaction = {}) {
  return Number(transaction.grandTotal || 0);
}

function transactionPaymentBreakdownLabel(transaction = {}) {
  if (!transaction.paymentBreakdown || typeof transaction.paymentBreakdown !== "object" || Array.isArray(transaction.paymentBreakdown)) {
    return transactionPaymentMethod(transaction);
  }
  const lines = paymentReportMethods()
    .map((method) => [method, Number(transaction.paymentBreakdown[method] || 0)])
    .filter(([, amount]) => amount > 0)
    .map(([method, amount]) => `${method} ${money(amount)}`);
  return lines.length ? lines.join(" · ") : transactionPaymentMethod(transaction);
}

function paymentTotalsFor(transactions = []) {
  return revenueTransactions(transactions).reduce((map, entry) => {
    if (entry.paymentBreakdown && typeof entry.paymentBreakdown === "object" && !Array.isArray(entry.paymentBreakdown)) {
      paymentReportMethods().forEach((method) => {
        const amount = Number(entry.paymentBreakdown[method] || 0);
        if (amount) map.set(method, (map.get(method) || 0) + amount);
      });
      return map;
    }
    const method = transactionPaymentMethod(entry);
    map.set(method, (map.get(method) || 0) + transactionPaymentTotal(entry));
    return map;
  }, new Map());
}

function onlineChannelSuffix(channel) {
  if (channel === "GoFood") return "-G";
  if (channel === "GrabFood") return "-GB";
  if (channel === "ShopeeFood") return "-S";
  return isOnlineChannel(channel) ? "-O" : "";
}

function autoShiftName(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getHours() >= 17 ? "Shift 2" : "Shift 1";
}

function normalizeShift(value) {
  return value === "Shift 2" ? "Shift 2" : "Shift 1";
}

function getActiveShift(value = new Date()) {
  const auth = getAuth();
  const automaticShift = autoShiftName(value);
  const sessionShift = normalizeShift(auth?.shift || automaticShift);
  if (auth?.loggedIn && auth.role === "cashier" && state.logoutAfterOrder && sessionShift !== automaticShift) {
    return sessionShift;
  }
  return auth?.loggedIn && sessionShift !== automaticShift ? automaticShift : sessionShift;
}

function currentShiftName(value = new Date()) {
  return getActiveShift(value);
}

function shiftScheduleText(value = new Date()) {
  const shift = getActiveShift();
  return `${shift} · ${shift === "Shift 1" ? "10.00-17.00" : "17.00-22.00"}`;
}

function oppositeShift(shift) {
  return normalizeShift(shift) === "Shift 1" ? "Shift 2" : "Shift 1";
}

function transactionShift(transaction = {}) {
  if (transaction.recoveryImport || transaction.shift === "Recovery Harian") return "Recovery Harian";
  const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) return autoShiftName(createdAt);
  return normalizeShift(transaction.shift);
}

function isShiftOperating(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const hour = date.getHours();
  return hour >= 10 && hour < 22;
}

function isHelperDay(value = new Date()) {
  const day = (value instanceof Date ? value : new Date(value)).getDay();
  return day === 5 || day === 6 || day === 0;
}

function normalizeDutyRole(value, date = new Date()) {
  if (value === "helper") {
    return isHelperDay(date) ? "helper" : "karyawan";
  }
  return value || "karyawan";
}

function dutyRoleLabel(value = currentDutyRole()) {
  if (value === "helper") return "Helper";
  if (value === "karyawan") return "Crew";
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Crew";
}

function orderSequenceFromId(id, prefix) {
  const match = String(id || "").match(new RegExp(`^${prefix}-(\\d+)(?:-O|-G|-GB|-S)?$`));
  return match ? Number(match[1]) : 0;
}

function orderCodeForSequence(entry = {}) {
  return entry.orderCode || entry.displayCode || entry.id;
}

function nextDailyOrderCode(date = new Date(), channel = state.orderChannel) {
  const prefix = dayOrderPrefix(date);
  const today = dateKey(date);
  const existing = [...getHistory(), ...getOrderDrafts()].filter((entry) => dateKey(entry.createdAt) === today);
  const deleted = getDeletedTransactionTombstones().filter((entry) => dateKey(entry.createdAt) === today);
  const highest = [...existing, ...deleted].reduce((max, entry) => Math.max(max, orderSequenceFromId(orderCodeForSequence(entry), prefix)), 0);
  const number = String(highest + 1).padStart(3, "0");
  return `${prefix}-${number}${onlineChannelSuffix(channel)}`;
}

function sequentialPaidOrderCode(transaction, sequence) {
  const prefix = dayOrderPrefix(transaction?.createdAt || new Date());
  const number = String(sequence || 1).padStart(3, "0");
  return `${prefix}-${number}${onlineChannelSuffix(transaction?.channel)}`;
}

function paidOrderDisplayCodes(transactions = []) {
  return new Map(
    [...transactions]
      .filter(isPaidTransaction)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((transaction, index) => [transaction.id, sequentialPaidOrderCode(transaction, index + 1)]),
  );
}

function paidOrderDisplayCode(transaction, transactions = getHistory()) {
  if (!transaction) return "";
  const sameDay = transactions.filter((entry) => dateKey(entry.createdAt) === dateKey(transaction.createdAt));
  if (!sameDay.some((entry) => entry.id === transaction.id)) sameDay.push(transaction);
  return paidOrderDisplayCodes(sameDay).get(transaction.id) || transaction.id;
}

function receiptDisplayCode(transaction, kind = "paid") {
  return kind === "bill" ? transaction?.orderCode || transaction?.displayCode || transaction?.id || "" : paidOrderDisplayCode(transaction);
}

function transactionReportDate(transaction = {}) {
  const recoveryDate = String(transaction.id || "").match(/^RECOVERY-(\d{4}-\d{2}-\d{2})$/)?.[1];
  return recoveryDate || dateKey(transaction.createdAt);
}

function transactionReportMonth(transaction = {}) {
  return transactionReportDate(transaction).slice(0, 7);
}

function transactionReportYear(transaction = {}) {
  return transactionReportDate(transaction).slice(0, 4);
}

function receiptTableLabel(transaction, displayCode) {
  const value = String(transaction?.table || "").trim();
  if (!value || value === transaction?.id || /^[A-Z]+-\d{3}(?:-O|-G|-GB|-S)?$/.test(value)) return displayCode;
  return value;
}

function transactionCategories(transaction) {
  return [...new Set((transaction?.items || []).map((item) => item.category || "Lainnya"))];
}

function orderMatchesPaidCategory(transaction, category = "Semua") {
  return category === "Semua" || transactionCategories(transaction).includes(category);
}

function paidOrderCategories(transactions = []) {
  const categories = ["Semua", ...getMenuCategories()];
  const existing = new Set(categories);
  const transactionCategoriesToday = transactions
    .flatMap((transaction) => transactionCategories(transaction))
    .filter((category) => category && !existing.has(category))
    .sort((a, b) => a.localeCompare(b, "id-ID"));
  return [...categories, ...transactionCategoriesToday];
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function normalizeEmployeeRoster(value, fallback = []) {
  const names = Array.isArray(value)
    ? value
    : String(value || "")
        .split("\n")
        .map((name) => name.trim());
  const unique = [];
  names.forEach((name) => {
    if (name && !unique.some((entry) => entry.toLowerCase() === name.toLowerCase())) unique.push(name);
  });
  return unique.length ? unique : fallback;
}

function employeeDeleteKey(name) {
  return stableIdFromName(name || "");
}

function getDeletedEmployeeKeys() {
  const deleted = readJson(storageKeys.deletedEmployees, []);
  return new Set((Array.isArray(deleted) ? deleted : []).map((entry) => entry.key || employeeDeleteKey(entry.name)).filter(Boolean));
}

function filterDeletedEmployees(names) {
  const deleted = getDeletedEmployeeKeys();
  return normalizeEmployeeRoster(names).filter((name) => !deleted.has(employeeDeleteKey(name)));
}

function rememberDeletedEmployee(name) {
  if (!name) return;
  const deleted = readJson(storageKeys.deletedEmployees, []);
  const key = employeeDeleteKey(name);
  const next = (Array.isArray(deleted) ? deleted : []).filter((entry) => (entry.key || employeeDeleteKey(entry.name)) !== key);
  next.unshift({ name, key, deletedAt: new Date().toISOString() });
  writeJson(storageKeys.deletedEmployees, next.slice(0, 200));
}

function forgetDeletedEmployee(name) {
  const key = employeeDeleteKey(name);
  const deleted = readJson(storageKeys.deletedEmployees, []);
  writeJson(
    storageKeys.deletedEmployees,
    (Array.isArray(deleted) ? deleted : []).filter((entry) => (entry.key || employeeDeleteKey(entry.name)) !== key),
  );
}

function getEmployeeRoster() {
  return filterDeletedEmployees(readJson(storageKeys.employees, []));
}

function saveEmployeeRoster(names, { dirty = false } = {}) {
  const roster = filterDeletedEmployees(names);
  writeJson(storageKeys.employees, roster);
  if (dirty) markSettingsDirty();
  return roster;
}

// Khusus untuk data yang datang dari cloud — tulis langsung tanpa filter lokal
// karena cloud sudah mengembalikan data yang sudah bersih (active=true, deleted_at=null)
function applyCloudEmployeeRoster(names) {
  if (!Array.isArray(names) || !names.length) return;
  const unique = [...new Set(names.map((n) => String(n || "").trim()).filter(Boolean))];
  writeJson(storageKeys.employees, unique);
}


function getEmployeeRoles() {
  const roles = readJson(storageKeys.employeeRoles, []);
  return roles.length ? roles : ["karyawan", "helper"];
}

function saveEmployeeRoles(roles, { dirty = true } = {}) {
  const cleanRoles = [...new Set(roles.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean))];
  if (!cleanRoles.includes("karyawan")) {
    cleanRoles.unshift("karyawan");
  }
  writeJson(storageKeys.employeeRoles, cleanRoles);
  if (dirty) markSettingsDirty();
}

function renderEmployeeRolesControls() {
  if (!els.roleList) return;
  const roles = getEmployeeRoles();
  els.roleList.innerHTML = roles
    .map((role) => {
      const isDefault = role === "karyawan" || role === "helper";
      const displayLabel = role === "karyawan" ? "Crew" : role === "helper" ? "Helper" : (role.charAt(0).toUpperCase() + role.slice(1));
      const statusLabel = isDefault ? "Default" : "Kustom";
      const statusClass = isDefault ? "active" : "";
      
      return `
        <article class="employee-list-row ${isDefault ? "active" : ""} ${isDefault ? "leave" : ""}">
          <span>${escapeHtml(displayLabel)}</span>
          <div>
            <small class="employee-row-status ${statusClass}">${statusLabel}</small>
            <button class="secondary-button compact danger-text" data-delete-role="${encodeURIComponent(role)}" type="button" ${isDefault ? "disabled" : ""}>Hapus</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getEmployeeLeaveMap() {
  const value = readJson(storageKeys.employeeLeaves, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function saveEmployeeLeaveMap(map, { dirty = true } = {}) {
  writeJson(storageKeys.employeeLeaves, map && typeof map === "object" && !Array.isArray(map) ? map : {});
  if (dirty) markSettingsDirty();
}

function isEmployeeOnLeave(name) {
  const row = getEmployeeLeaveMap()[employeeDeleteKey(name)];
  return Boolean(row?.onLeave);
}

function setEmployeeLeaveStatus(name, onLeave) {
  const key = employeeDeleteKey(name);
  if (!key) return;
  const map = getEmployeeLeaveMap();
  if (onLeave) {
    map[key] = { name, onLeave: true, updatedAt: new Date().toISOString() };
  } else {
    delete map[key];
  }
  saveEmployeeLeaveMap(map);
}

function clearEmployeeLeaveStatus(name) {
  setEmployeeLeaveStatus(name, false);
}

function getShiftAssignments() {
  return readJson(storageKeys.shiftAssignments, []);
}

function saveShiftAssignments(assignments) {
  writeJson(storageKeys.shiftAssignments, assignments.slice(-120));
}

function assignmentEmployeeId(name) {
  if (!name) return "";
  return employeeIdFromName(name);
}

function todayShiftAssignments(today = dateKey()) {
  const assignments = getShiftAssignments().filter((entry) => entry.date === today);
  const transactionAssignments = getHistory()
    .filter((entry) => dateKey(entry.createdAt) === today && entry.employee && entry.employee !== "Owner" && entry.shift)
    .map((entry) => ({
      date: today,
      employee: entry.employee,
      employeeId: entry.employeeId || assignmentEmployeeId(entry.employee),
      shift: normalizeShift(entry.shift),
      source: "transaction",
    }));
  const byKey = new Map();
  // Proses transactionAssignments dulu (prioritas lebih rendah),
  // lalu assignments resmi (yang punya loginAt) — agar loginAt tidak tertimpa data transaksi yang kosong.
  [...transactionAssignments, ...assignments].forEach((entry) => {
    const employeeId = entry.employeeId || assignmentEmployeeId(entry.employee);
    if (!employeeId || !entry.employee || !entry.shift) return;
    byKey.set(`${employeeId}:${normalizeShift(entry.shift)}`, { ...entry, employeeId, shift: normalizeShift(entry.shift) });
  });
  return [...byKey.values()];
}

function usedShiftForEmployee(name, today = dateKey()) {
  if (!name) return "";
  const employeeId = assignmentEmployeeId(name);
  return todayShiftAssignments(today).find((entry) => entry.employeeId === employeeId)?.shift || "";
}

function isEmployeeUsedInOtherShift(name, shift = getActiveShift(), today = dateKey()) {
  return false;
}

function defaultLoginShift() {
  return getActiveShift();
}

function registerShiftAssignment(employee, shift, dutyRole = "karyawan") {
  if (!employee || employee === "Owner") return;
  const today = dateKey();
  const employeeId = assignmentEmployeeId(employee);
  const nextShift = normalizeShift(shift);
  const nextDutyRole = normalizeDutyRole(dutyRole);
  const assignments = getShiftAssignments().filter(
    (entry) => !(entry.date === today && (entry.employeeId || assignmentEmployeeId(entry.employee)) === employeeId && normalizeShift(entry.shift) === nextShift),
  );
  assignments.push({ date: today, employee, employeeId, shift: nextShift, dutyRole: nextDutyRole, loginAt: new Date().toISOString() });
  saveShiftAssignments(assignments);
}

function activeEmployeeName() {
  if (currentRole() === "owner") return "Owner";
  const saved = localStorage.getItem(storageKeys.employee) || "";
  if (saved && !isEmployeeOnLeave(saved) && getEmployeeRoster().includes(saved)) return saved;
  return getEmployeeRoster().find((name) => !isEmployeeOnLeave(name)) || "";
}

function getAuth() {
  return readJson(storageKeys.auth, null);
}

function currentRole() {
  return getAuth()?.role || "cashier";
}

function isAuthExpired(auth = getAuth(), now = Date.now()) {
  if (!auth?.loggedIn) return false;
  if (!auth.expiresAt) return true;
  return new Date(auth.expiresAt).getTime() <= now;
}

function createAuthSession({ employee, shift, role, dutyRole = "karyawan", token = "" }) {
  const loginAt = new Date();
  return {
    loggedIn: true,
    employee,
    shift: normalizeShift(shift),
    role,
    token,
    dutyRole: role === "cashier" ? normalizeDutyRole(dutyRole, loginAt) : "owner",
    at: loginAt.toISOString(),
    loginAt: loginAt.toISOString(),
    expiresAt: new Date(loginAt.getTime() + sessionTtlMs).toISOString(),
  };
}

function setLoginEmployeeStep(active) {
  state.pendingLogin = active ? state.pendingLogin : null;
  els.loginForm?.classList.toggle("employee-step", active);
  if (els.loginSubmitBtn) els.loginSubmitBtn.textContent = active ? "Masuk Dashboard" : "Masuk";
  if (els.loginHint) {
    els.loginHint.style.color = "";
    els.loginHint.textContent = active
      ? isHelperDay()
        ? "Pilih crew dan tugas Crew/Helper, lalu masuk dashboard."
        : "Pilih crew yang bertugas, lalu masuk dashboard."
      : "Shift mengikuti jam operasional.";
  }
}

function isOwner() {
  return currentRole() === "owner";
}

function isCashier() {
  return currentRole() === "cashier";
}

function currentDutyRole() {
  const auth = getAuth();
  return isCashier() ? normalizeDutyRole(auth?.dutyRole || "karyawan") : "owner";
}

function activeEmployeeDisplayName(name = activeEmployeeName(), dutyRole = currentDutyRole()) {
  if (!name) return "";
  if (!dutyRole || dutyRole === "karyawan" || dutyRole === "owner") return name;
  const label = dutyRole === "helper" ? "Helper" : (dutyRole.charAt(0).toUpperCase() + dutyRole.slice(1));
  return `${name} (${label})`;
}

function transactionEmployeeDisplay(transaction) {
  return activeEmployeeDisplayName(transaction?.employee || "", transaction?.dutyRole || "karyawan");
}

function renderEmployeeControls() {
  const roster = getEmployeeRoster();
  const availableRoster = roster.filter((name) => !isEmployeeOnLeave(name));
  const selectedLoginShift = els.loginShift?.value || defaultLoginShift();
  const helperDay = isHelperDay();
  const selectedDutyRole = normalizeDutyRole(els.loginDutyRole?.value || "karyawan");
  const activeCandidate = availableRoster.includes(activeEmployeeName()) ? activeEmployeeName() : availableRoster[0] || "";
  const active = activeCandidate;
  const owner = isLoggedIn() && isOwner();
  const displayName = owner
    ? state.activeCashier.employee || "Belum ada kasir aktif"
    : active
      ? activeEmployeeDisplayName(active, selectedDutyRole)
      : "Belum ada crew";
  const badgeLabel = owner
    ? state.activeCashier.online
      ? "Online"
      : "Offline"
    : !navigator.onLine || state.pendingSyncCount
      ? "Sync pending"
      : "Aktif";
  if (!isOwner() && active) localStorage.setItem(storageKeys.employee, active);
  if (!isOwner() && !active) localStorage.removeItem(storageKeys.employee);
  if (els.employeeName) els.employeeName.textContent = displayName;
  if (els.employeeStatusBadge) {
    els.employeeStatusBadge.textContent = badgeLabel;
    els.employeeStatusBadge.dataset.status = owner
      ? state.activeCashier.online
        ? "online"
        : "offline"
      : !navigator.onLine || state.pendingSyncCount
        ? "pending"
        : "active";
  }
  if (els.employeeActiveNote) {
    els.employeeActiveNote.textContent = owner
      ? "Status kasir aktif hanya dipantau oleh akun owner."
      : "Transaksi berikutnya akan memakai nama petugas aktif ini.";
  }
  if (els.employeeList) {
    els.employeeList.innerHTML = roster
      .map((name) => {
        const safeName = escapeHtml(name);
        const encodedName = encodeURIComponent(name);
        const onLeave = isEmployeeOnLeave(name);
        const rowActive = owner ? state.activeCashier.online && state.activeCashier.employee === name : name === active;
        const statusLabel = onLeave ? "Libur" : rowActive ? "Aktif" : "Tidak aktif";
        const statusClass = onLeave ? "leave" : rowActive ? "active" : "";
        return `
          <article class="employee-list-row ${rowActive ? "active" : ""} ${onLeave ? "leave" : ""}">
            <span>${safeName}</span>
            <div>
              <small class="employee-row-status ${statusClass}">${statusLabel}</small>
              <button class="secondary-button compact" data-toggle-employee-leave="${encodedName}" type="button">${onLeave ? "Aktifkan" : "Libur"}</button>
              <button class="secondary-button compact danger-text" data-delete-employee="${encodedName}" type="button" ${roster.length <= 1 ? "disabled" : ""}>Hapus</button>
            </div>
          </article>
        `;
      })
      .join("");
  }
  if (els.loginEmployee) {
    const options = roster.length
      ? roster.map((name) => {
          const usedShift = usedShiftForEmployee(name);
          const onLeave = isEmployeeOnLeave(name);
          const disabled = onLeave;
          const label = onLeave ? `${name} (libur)` : (usedShift && usedShift !== selectedLoginShift ? `${name} (${usedShift})` : name);
          const option = new Option(label, name);
          option.disabled = disabled;
          return option;
        })
      : [new Option("Belum ada crew", "")];
    if (!roster.length) options[0].disabled = true;
    els.loginEmployee.replaceChildren(...options);
    const selectable = options.find((option) => !option.disabled);
    els.loginEmployee.value = active || selectable?.value || "";
  }
  const roles = getEmployeeRoles();
  const showDutyRole = roles.length > 1;
  els.loginForm?.classList.toggle("helper-day", showDutyRole);
  if (els.loginDutyRoleWrap) els.loginDutyRoleWrap.hidden = !showDutyRole;
  if (els.loginDutyRole) {
    const options = roles.map((role) => {
      const label = role === "helper" ? "Helper" : role === "karyawan" ? "Crew" : (role.charAt(0).toUpperCase() + role.slice(1));
      return new Option(label, role);
    });
    const currentVal = els.loginDutyRole.value || selectedDutyRole;
    els.loginDutyRole.replaceChildren(...options);
    els.loginDutyRole.value = roles.includes(currentVal) ? currentVal : "karyawan";
    els.loginDutyRole.disabled = false;
  }
  if (els.loginShift && (!els.loginShift.value || document.activeElement !== els.loginShift)) els.loginShift.value = selectedLoginShift;
}

function initAuth() {
  const auth = getAuth();
  renderEmployeeControls();
  if (auth?.loggedIn && (!auth.token || isAuthExpired(auth))) {
    localStorage.removeItem(storageKeys.auth);
    setLoginEmployeeStep(false);
    document.body.classList.add("locked");
    setTimeout(() => els.loginUsername?.focus(), 50);
    toast("Sesi login habis. Silakan masuk lagi.");
  } else if (!auth?.loggedIn) {
    setLoginEmployeeStep(false);
    document.body.classList.add("locked");
    setTimeout(() => els.loginUsername?.focus(), 50);
  } else {
    if (auth.role !== "owner" && auth.employee) localStorage.setItem(storageKeys.employee, auth.employee);
    localStorage.setItem(storageKeys.activeShift, normalizeShift(auth.shift));
    renderEmployeeControls();
  }
  applyAccessControls();
}

function ensureDeviceId() {
  let deviceId = localStorage.getItem(storageKeys.deviceId);
  if (deviceId) return deviceId;
  deviceId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(storageKeys.deviceId, deviceId);
  return deviceId;
}

async function checkOtherActiveDevice(employee) {
  if (!navigator.onLine) return { otherActive: false };
  return postSupabaseAction("device-presence", {
    deviceId: ensureDeviceId(),
    employee,
    checkOnly: true,
  });
}

async function confirmLoginDevice(employee) {
  try {
    const result = await checkOtherActiveDevice(employee);
    if (!result?.otherActive) return true;
    const activeEmployee = result.activeDevice?.employee || "petugas lain";
    return window.confirm(`Kasir sedang aktif di device lain oleh ${activeEmployee}. Lanjutkan login di device ini?`);
  } catch {
    return true;
  }
}

async function preloadEmployeesForLogin() {
  if (!navigator.onLine) return false;
  try {
    const data = await postSupabaseAction("bootstrap-data");
    if (Array.isArray(data?.employees)) applyCloudEmployeeRoster(data.employees);
    if (data?.settingsFound && data.settings && typeof data.settings === "object") {
      applyCloudSettings(data.settings);
      clearSettingsDirty();
    }
    return Array.isArray(data?.employees) && data.employees.length > 0;
  } catch {}
  return false;
}

async function finishLogin(role, employee, shift, dutyRole = "karyawan", token = "") {
  const normalizedDutyRole = role === "cashier" ? normalizeDutyRole(dutyRole) : "owner";
  if (role === "cashier" && !employee) {
    toast("Pilih crew dulu. Jika kosong, tambahkan dari akun Owner.");
    return false;
  }
  if (role === "cashier" && isEmployeeOnLeave(employee)) {
    toast(`${employee} sedang libur. Pilih crew lain.`);
    renderEmployeeControls();
    return false;
  }
  if (role === "cashier" && isEmployeeUsedInOtherShift(employee, shift)) {
    toast(`${employee} sudah bertugas di ${usedShiftForEmployee(employee)} hari ini. Pilih crew lain.`);
    renderEmployeeControls();
    return false;
  }
  const confirmed = role === "owner" ? true : await confirmLoginDevice(employee);
  if (!confirmed) {
    els.loginPassword.value = "";
    toast("Login dibatalkan.");
    return false;
  }
  if (role === "cashier") localStorage.setItem(storageKeys.employee, employee);
  localStorage.setItem(storageKeys.activeShift, shift);
  writeJson(storageKeys.auth, createAuthSession({ employee, shift, role, dutyRole: normalizedDutyRole, token: token || state.pendingLogin?.token || getAuth()?.token || "" }));
  if (role === "cashier") registerShiftAssignment(employee, shift, normalizedDutyRole);
  setLoginEmployeeStep(false);
  renderEmployeeControls();
  applyAccessControls();
  document.body.classList.remove("locked");
  els.loginPassword.value = "";
  setActiveView("pos");
  toast(role === "owner" ? "Masuk sebagai Owner." : `Masuk sebagai ${activeEmployeeDisplayName(employee, normalizedDutyRole)} · ${shift}.`);
  updateDevicePresence().catch(() => null);
  if (role === "owner") refreshActiveCashierPresence().catch(() => null);
  syncCloudData();
  return true;
}

async function login(event) {
  event.preventDefault();
  if (state.pendingLogin?.role === "cashier") {
    const employee = els.loginEmployee?.value || getEmployeeRoster()[0] || "";
    await finishLogin("cashier", employee, els.loginShift?.value || defaultLoginShift(), els.loginDutyRole?.value || "karyawan", state.pendingLogin.token || "");
    return;
  }

  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  els.loginSubmitBtn.disabled = true;
  try {
    const loginResult = await postSupabaseAction("login", { username, password });
    const role = loginResult.role;
    const token = loginResult.token || "";
    const shift = autoShiftName();
    if (role === "owner") {
      await finishLogin("owner", "Owner", shift, "owner", token);
      return;
    }

    els.loginSubmitBtn.textContent = "Memuat crew...";
    state.pendingLogin = { role: "cashier", token, checkedAt: new Date().toISOString() };
    await preloadEmployeesForLogin();
    renderEmployeeControls();
    setLoginEmployeeStep(true);
    if (!els.loginEmployee?.value) {
      toast("Daftar crew belum tersedia. Tambahkan crew dari akun Owner.");
      renderEmployeeControls();
    }
    return;
  } catch {
    setLoginEmployeeStep(false);
    els.loginHint.textContent = "Username atau password salah.";
    els.loginHint.style.color = "var(--danger)";
    els.loginPassword.value = "";
    els.loginPassword.focus();
  } finally {
    els.loginSubmitBtn.disabled = false;
  }
}

async function recordLogoutSession(auth = getAuth()) {
  if (!navigator.onLine || !auth?.loggedIn) return;
  await postSupabaseAction("device-presence", {
    deviceId: ensureDeviceId(),
    employee: auth.employee || activeEmployeeName(),
    role: auth.role || currentRole(),
    logout: true,
  });
}

function logout({ remote = false } = {}) {
  const auth = getAuth();
  if (!remote) {
    recordLogoutSession(auth).catch(() => null);
    localStorage.setItem(storageKeys.logoutSignal, JSON.stringify({ at: new Date().toISOString(), employee: auth?.employee || "", role: auth?.role || "" }));
  }
  localStorage.removeItem(storageKeys.auth);
  setLoginEmployeeStep(false);
  document.body.classList.add("locked");
  els.loginPassword.value = "";
  renderEmployeeControls();
  applyAccessControls();
  setTimeout(() => els.loginUsername?.focus(), 50);
  toast("Kasir logout.");
}

function isLoggedIn() {
  const auth = getAuth();
  if (!auth?.loggedIn) return false;
  if (!auth.token) {
    localStorage.removeItem(storageKeys.auth);
    document.body.classList.add("locked");
    return false;
  }
  if (!isAuthExpired(auth)) return true;
  localStorage.removeItem(storageKeys.auth);
  document.body.classList.add("locked");
  return false;
}

function enforceCurrentEmployeeAvailability() {
  const auth = getAuth();
  if (!auth?.loggedIn || auth.role !== "cashier") return false;
  const employeeAvailable = auth.employee && getEmployeeRoster().includes(auth.employee) && !isEmployeeOnLeave(auth.employee);
  if (employeeAvailable) return false;
  const employee = auth.employee || "Crew";
  logout({ remote: true });
  toast(`${employee} dinonaktifkan atau dijadwalkan libur oleh Owner. Silakan login dengan petugas aktif.`);
  return true;
}

function updateAuthShift(shift) {
  const auth = getAuth();
  const nextShift = normalizeShift(shift);
  localStorage.setItem(storageKeys.activeShift, nextShift);
  if (!auth?.loggedIn || auth.shift === nextShift) return false;
  writeJson(storageKeys.auth, { ...auth, shift: nextShift, shiftedAt: new Date().toISOString() });
  return true;
}

function sessionStartedBeforeHour(auth, now, hour) {
  const boundary = new Date(now);
  boundary.setHours(hour, 0, 0, 0);
  const loginAt = new Date(auth?.loginAt || auth?.at || 0);
  return Number.isNaN(loginAt.getTime()) || loginAt < boundary;
}

function syncActiveShiftWithClock(now = new Date()) {
  const auth = getAuth();
  if (!auth?.loggedIn) return false;
  const automaticShift = autoShiftName(now);
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  if (
    auth.role === "cashier" &&
    normalizeShift(auth.shift) === "Shift 2" &&
    minuteOfDay >= 22 * 60 &&
    sessionStartedBeforeHour(auth, now, 22)
  ) {
    const closingKey = `${dateKey(now)}:tutup`;
    if (state.shiftTransitionHandled !== closingKey) {
      state.shiftTransitionHandled = closingKey;
      handleShiftAutoLogout({
        message: "Shift 2 selesai. Silakan login kembali jika toko masih beroperasi.",
      });
    }
    return false;
  }
  if (normalizeShift(auth.shift) === automaticShift) return false;
  localStorage.setItem(storageKeys.activeShift, automaticShift);
  if (auth.role === "cashier") {
    const transitionKey = `${dateKey(now)}:${automaticShift}`;
    if (state.shiftTransitionHandled !== transitionKey) {
      state.shiftTransitionHandled = transitionKey;
      handleShiftAutoLogout({
        message: `${normalizeShift(auth.shift)} selesai. Silakan login ulang dan pilih petugas ${automaticShift}.`,
      });
    }
    return false;
  }
  return updateAuthShift(automaticShift);
}

function shiftSummaryLines(shift = getActiveShift(), date = dateKey()) {
  const transactions = getHistory().filter((entry) => transactionReportDate(entry) === date && transactionShift(entry) === shift);
  const normal = revenueTransactions(transactions);
  const staffDrinks = transactions.filter(isStaffDrinkTransaction);
  const paymentTotals = paymentTotalsFor(normal);
  const discount = normal.reduce((sum, entry) => sum + Number(entry.discountTotal || 0), 0);
  return [
    `Summary ${shift}`,
    `Petugas: ${activeEmployeeName()}`,
    `Total transaksi: ${normal.length}`,
    ...paymentReportMethods().map((method) => `${method}: ${money(paymentTotals.get(method) || 0)}`),
    `Staff Drink: ${staffDrinks.length}`,
    `Diskon: ${money(discount)}`,
  ];
}

function dayTransactions(date = dateKey()) {
  const source = analyticsSourceForDate(date);
  return source.filter((entry) => transactionReportDate(entry) === date);
}

function shiftReportText(shift, reportDateValue = dateKey()) {
  const reportDate = new Date(`${reportDateValue}T12:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const transactions = dayTransactions(reportDateValue).filter((entry) => transactionShift(entry) === shift);
  const normal = revenueTransactions(transactions);
  const staffDrinks = transactions.filter(isStaffDrinkTransaction);
  const revenue = normal.reduce((sum, entry) => sum + Number(entry.grandTotal || 0), 0);
  const paymentTotals = paymentTotalsFor(normal);
  const discount = normal.reduce((sum, entry) => sum + Number(entry.discountTotal || 0), 0);
  const employees = [...new Set(transactions.map(transactionEmployeeDisplay).filter(Boolean))];
  const itemCount = normal.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const dailyCash = getDailyCashReport(reportDateValue);

  return [
    `Laporan ${shift}`,
    reportDate,
    "",
    `Petugas: ${employees.length ? employees.join(", ") : "-"}`,
    `Total Penjualan: ${money(revenue)}`,
    `Transaksi Normal: ${normal.length}`,
    `Item terjual: ${itemCount}`,
    ...paymentReportMethods().map((method) => `${method}: ${money(paymentTotals.get(method) || 0)}`),
    `Total Diskon: ${money(discount)}`,
    `Staff Drink: ${staffDrinks.length}`,
    ...(shift === "Shift 2" ? [`Kas Harian untuk Kembalian: ${dailyCash ? money(dailyCash.amount) : "-"}`] : []),
  ].join("\n");
}

function openWhatsAppReport(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(["*Kopi Migi*", "", text].join("\n"))}`, "_blank", "noopener");
}

function markReportReady(action, label, text) {
  if (!text?.trim() || !markShiftActionOnce(action)) return;
  state.reportShareText = text;
  if (els.dailyReportShareStatus) els.dailyReportShareStatus.textContent = `${label} siap dikirim`;
  if (els.shareDailyReport) els.shareDailyReport.title = label;
}

async function prepareActiveShiftReport() {
  const shift = currentShiftName();
  const text = shiftReportText(shift, dateKey());
  state.reportShareText = text;
  if (els.dailyReportText) els.dailyReportText.textContent = text;
  if (els.dailyReportShareStatus) els.dailyReportShareStatus.textContent = `Laporan ${shift} siap dikirim`;
  if (els.shareDailyReport) els.shareDailyReport.title = `Laporan ${shift}`;
  setActiveView("analytics");
  try {
    await navigator.clipboard.writeText(text);
    toast(`Laporan ${shift} dicopy.`);
  } catch {
    toast(`Laporan ${shift} siap di tab Analitik.`);
  }
}

async function prepareDailyClosingReport(reportDateValue = dateKey()) {
  if (navigator.onLine) {
    await syncPendingTransactions({ pull: false }).catch(() => null);
    await refreshAnalyticsPeriod({
      month: reportDateValue.slice(0, 7),
      range: "daily",
      render: false,
      silent: true,
    }).catch(() => false);
  }
  const text = dailyReportText(dayTransactions(reportDateValue), reportDateValue);
  state.reportShareText = text;
  if (els.dailyReportText) els.dailyReportText.textContent = text;
  if (els.dailyReportShareStatus) els.dailyReportShareStatus.textContent = "Laporan harian siap dikirim";
  if (els.shareDailyReport) els.shareDailyReport.title = "Laporan harian Shift 1 + Shift 2";
  setActiveView("analytics");
  try {
    await navigator.clipboard.writeText(text);
    toast("Laporan harian Shift 1 + Shift 2 dicopy.");
  } catch {
    toast("Laporan harian Shift 1 + Shift 2 siap di tab Analitik.");
  }
}

function openDailyCashModal(reportDateValue = selectedDailyDate()) {
  if (!isOwner()) return toast("Kas Harian hanya dapat diinput Owner.");
  const saved = getDailyCashReport(reportDateValue);
  els.dailyCashForm.dataset.reportDate = reportDateValue;
  if (els.dailyCashDateLabel) {
    els.dailyCashDateLabel.textContent = new Date(`${reportDateValue}T12:00:00`).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  els.dailyCashAmount.value = saved?.amount ? money(saved.amount) : "";
  els.dailyCashModal.classList.add("open");
  els.dailyCashModal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => els.dailyCashAmount.focus());
}

function closeDailyCashModal() {
  els.dailyCashModal.classList.remove("open");
  els.dailyCashModal.setAttribute("aria-hidden", "true");
}

function closeActiveShift() {
  if (currentShiftName() === "Shift 2") {
    prepareDailyClosingReport(dateKey());
    return;
  }
  if (!isOwner()) {
    toast("Kas Harian diisi saat menutup Shift 2.");
    return;
  }
  prepareActiveShiftReport();
}

function updateEmployeeHeaderState(now = new Date()) {
  if (!els.activeEmployeeCard) return;
  const active = isLoggedIn() && isCashier() && isShiftOperating(now);
  els.activeEmployeeCard.hidden = false;
  els.activeEmployeeCard.classList.toggle("shift-active", active);
  els.activeEmployeeCard.classList.toggle("owner-mode", isLoggedIn() && isOwner());
  els.activeEmployeeCard.classList.toggle("cashier-online", false);
  els.activeEmployeeCard.classList.toggle("cashier-offline", false);
  if (els.activeEmployeeHeader) els.activeEmployeeHeader.textContent = isCashier() ? activeEmployeeDisplayName() : activeEmployeeName();
  els.activeEmployeeCard.title = isOwner()
    ? "Owner"
    : active
      ? `${currentShiftName()} aktif`
      : "Di luar jam shift";
}

function applyAccessControls() {
  const owner = isLoggedIn() && isOwner();
  document.body.classList.toggle("role-owner", owner);
  document.body.classList.toggle("role-cashier", isLoggedIn() && isCashier());
  document.querySelector('[data-view="cashflow"]')?.classList.toggle("owner-only", !owner);
  document.querySelector("#view-cashflow")?.classList.toggle("owner-only", !owner);
  document.querySelector('[data-view="staff"]')?.classList.toggle("owner-only", !owner);
  document.querySelector("#view-stock .inventory-grid > .settings-panel")?.classList.toggle("owner-only", !owner);
  els.employeeAddForm?.classList.toggle("owner-only", !owner);
  els.employeeList?.classList.toggle("owner-only", !owner);

  // Blok akses ke view-cashflow dan view-staff jika bukan owner
  if (!owner) {
    if (document.querySelector("#view-cashflow")?.classList.contains("active")) setActiveView("pos");
    if (document.querySelector("#view-staff")?.classList.contains("active")) setActiveView("pos");
  }
}

function markShiftActionOnce(action, date = new Date()) {
  const key = `${dateKey(date)}:${action}`;
  const actions = readJson(storageKeys.shiftActions, {});
  if (actions[key]) return false;
  actions[key] = new Date().toISOString();
  writeJson(storageKeys.shiftActions, actions);
  return true;
}

function runShiftScheduleChecks(now = new Date()) {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const minuteOfDay = hour * 60 + minute;

  if (minuteOfDay >= 17 * 60 + 30 && minuteOfDay < 22 * 60) {
    markReportReady("shift-1-wa-report", "Laporan Shift 1", shiftReportText("Shift 1", dateKey(now)));
  }

  if (minuteOfDay >= 22 * 60 + 30) {
    markReportReady("daily-wa-report", "Laporan harian", dailyReportText(dayTransactions(dateKey(now)), dateKey(now)));
  }

  if (!isLoggedIn() || !isCashier()) return;
  const activeShift = normalizeShift(getAuth()?.shift || autoShiftName(now));

  if (activeShift === "Shift 1" && hour === 16 && minute === 50 && markShiftActionOnce("shift-1-warning", now)) {
    toast("Shift 1 hampir selesai. Siapkan tutup shift.");
  }

  if (activeShift === "Shift 1" && hour === 17 && minute === 0 && markShiftActionOnce("shift-1-auto-logout", now)) {
    handleShiftAutoLogout();
  }

  if (activeShift === "Shift 2" && hour === 21 && minute === 50 && markShiftActionOnce("shift-2-warning", now)) {
    toast("Shift 2 hampir selesai. Siapkan laporan tutup toko.");
  }

  if (
    activeShift === "Shift 2" &&
    hour === 22 &&
    minute === 0 &&
    sessionStartedBeforeHour(getAuth(), now, 22) &&
    markShiftActionOnce("shift-2-auto-logout", now)
  ) {
    handleShiftAutoLogout();
  }

}

function hasActiveOrderInProgress() {
  return state.cart.length > 0 || els.orderModal?.classList.contains("open");
}

function handleShiftAutoLogout({ message = "Shift selesai. Silakan login ulang untuk shift berikutnya." } = {}) {
  if (hasActiveOrderInProgress()) {
    state.logoutAfterOrder = true;
    toast("Selesaikan order aktif dulu. Setelah selesai, sesi akan logout otomatis.");
    return;
  }
  logout();
  toast(message);
}

function completeDeferredShiftLogout() {
  if (!state.logoutAfterOrder || hasActiveOrderInProgress()) return;
  state.logoutAfterOrder = false;
  logout();
  toast("Shift selesai. Silakan login ulang dan pilih petugas shift berikutnya.");
}

function updateClock() {
  const now = new Date();
  els.todayLabel.textContent = now.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" });
  els.clockLabel.textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (getAuth()?.loggedIn && isAuthExpired()) {
    logout({ remote: true });
    toast("Sesi login habis. Silakan masuk lagi.");
    return;
  }
  runShiftScheduleChecks(now);
  if (els.loginShift && !isLoggedIn() && document.activeElement !== els.loginShift && !els.loginShift.value) els.loginShift.value = defaultLoginShift();
  const shifted = syncActiveShiftWithClock(now);
  if (els.orderShift && !state.activeDraftId && !els.orderModal?.classList.contains("open")) {
    els.orderShift.value = currentShiftName();
  }
  if (shifted) {
    renderEmployeeControls();
    renderHistory();
    renderOrders();
    renderAnalytics();
    toast(`${currentShiftName(now)} otomatis aktif mengikuti jam.`);
  }
  updateEmployeeHeaderState(now);
}

function getMenu() {
  const saved = readJson(storageKeys.menu, null);
  if (saved?.length) return saved;
  writeJson(storageKeys.menu, defaultMenu);
  return defaultMenu;
}

function getMenuCategories() {
  return [...new Set(getMenu().map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id-ID"));
}

function getHistory() {
  return readJson(storageKeys.history, []);
}

function patchLocalHistoryTransaction(id, patch) {
  const history = getHistory();
  const index = history.findIndex((entry) => entry.id === id);
  if (index === -1) return;
  history[index] = { ...history[index], ...patch };
  writeJson(storageKeys.history, history.slice(0, 2000));
}

function patchAnalyticsPeriodTransaction(id, patch) {
  if (!Array.isArray(state.analyticsPeriodTransactions)) return;
  state.analyticsPeriodTransactions = state.analyticsPeriodTransactions.map((entry) => (
    entry.id === id ? { ...entry, ...patch } : entry
  ));
}

function getInventory() {
  return readJson(storageKeys.inventory, {});
}

function saveInventory(inventory) {
  writeJson(storageKeys.inventory, inventory);
}

function markInventoryDirty() {
  localStorage.setItem(storageKeys.inventoryDirty, "true");
}

function clearInventoryDirty() {
  localStorage.removeItem(storageKeys.inventoryDirty);
}

function hasDirtyInventory() {
  return localStorage.getItem(storageKeys.inventoryDirty) === "true";
}

function saveLocalInventoryChange(inventory) {
  saveInventory(inventory);
  markInventoryDirty();
}

function applyCloudInventory(inventory) {
  if (hasDirtyInventory()) return false;
  saveInventory(inventory || {});
  return true;
}

function getPurchases() {
  return readJson(storageKeys.purchases, []);
}

function getOrderDrafts() {
  return readJson(storageKeys.orderDrafts, []);
}

function dedupeTransactionsById(list = []) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    if (!entry?.id) return;
    map.set(entry.id, map.has(entry.id) ? { ...map.get(entry.id), ...entry } : entry);
  });
  return [...map.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function transactionUpdatedMs(transaction = {}) {
  return Math.max(
    ...["updatedAt", "editedAt", "paymentEditedAt", "stockSyncedAt", "kitchenCompletedAt", "createdAt"]
      .map((key) => new Date(transaction[key] || 0).getTime())
      .filter(Number.isFinite),
  );
}

function preferredTransaction(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;

  // Pembayaran adalah perubahan satu arah: respons cloud yang masih membawa bill
  // tidak boleh mengembalikan transaksi lokal yang sudah lunas ke Belum Bayar.
  const currentPaid = isPaidTransaction(current);
  const incomingPaid = isPaidTransaction(incoming);
  if (currentPaid !== incomingPaid) return currentPaid ? current : incoming;

  return transactionUpdatedMs(incoming) > transactionUpdatedMs(current) ? incoming : current;
}

function saveOrderDrafts(drafts) {
  writeJson(storageKeys.orderDrafts, dedupeTransactionsById(drafts).slice(0, 200));
}

function patchLocalOrderDraft(id, patch) {
  saveOrderDrafts(getOrderDrafts().map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
}

function openOfflineDb() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB tidak tersedia."));
  if (offlineDbPromise) return offlineDbPromise;
  offlineDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(offlineDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(offlineStoreName)) {
        const store = db.createObjectStore(offlineStoreName, { keyPath: "localId" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return offlineDbPromise;
}

async function offlineStore(mode = "readonly") {
  const db = await openOfflineDb();
  return db.transaction(offlineStoreName, mode).objectStore(offlineStoreName);
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOfflineTransaction(transaction, patch = {}) {
  const localId = transaction.localId || transaction.id;
  const existing = await idbRequest((await offlineStore("readonly")).get(localId)).catch(() => null);
  const record = {
    ...existing,
    ...transaction,
    ...patch,
    localId,
    idempotencyKey: transaction.idempotencyKey || localId,
    syncStatus: patch.syncStatus || existing?.syncStatus || "PENDING_SYNC",
    printStatus: patch.printStatus || existing?.printStatus || "PRINT_PENDING",
    updatedAt: new Date().toISOString(),
  };
  await idbRequest((await offlineStore("readwrite")).put(record));
  return record;
}

async function updateOfflineTransaction(localId, patch) {
  const existing = await idbRequest((await offlineStore("readonly")).get(localId));
  if (!existing) return null;
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await idbRequest((await offlineStore("readwrite")).put(next));
  return next;
}

async function getOfflineTransactions() {
  const store = await offlineStore("readonly");
  return idbRequest(store.getAll()).catch(() => []);
}

async function pendingOfflineTransactions() {
  return (await getOfflineTransactions()).filter((entry) => entry.syncStatus !== "SYNCED");
}

function getRecipes() {
  return readJson(storageKeys.recipes, {});
}

function saveRecipes(recipes) {
  writeJson(storageKeys.recipes, recipes);
}

function normalizeVoucherCode(code = "") {
  return String(code || "")
    .trim()
    .replace(/\s+/g, "-")
    .toUpperCase();
}

function getDiscountVouchers() {
  return readJson(storageKeys.discountVouchers, []);
}

function saveDiscountVouchers(vouchers, { dirty = true } = {}) {
  writeJson(storageKeys.discountVouchers, Array.isArray(vouchers) ? vouchers.slice(0, 100) : []);
  if (dirty) markSettingsDirty();
}

function activeDiscountVouchers() {
  return getDiscountVouchers().filter((voucher) => voucher && voucher.active !== false);
}

function voucherById(id = "") {
  return activeDiscountVouchers().find((voucher) => voucher.id === id) || null;
}

function voucherLabel(voucher) {
  if (!voucher) return "";
  const value = voucher.type === "percent" ? `${Number(voucher.value || 0)}%` : money(Number(voucher.value || 0));
  return `${voucher.code} - ${value}`;
}

function getSettingsPayload() {
  return {
    menu: getMenu(),
    recipes: getRecipes(),
    discountVouchers: getDiscountVouchers(),
    employeeLeaves: getEmployeeLeaveMap(),
    dailyCashReports: getDailyCashReports(),
    wifiReceipt: getWifiReceiptSettings(),
    employeeRoles: getEmployeeRoles(),
    labelPrinter: getLabelPrinterSettings(),
    employees: getEmployeeRoster(),
  };
}

function markSettingsDirty() {
  localStorage.setItem(storageKeys.settingsDirty, "true");
}

function clearSettingsDirty() {
  localStorage.removeItem(storageKeys.settingsDirty);
}

function hasDirtySettings() {
  return localStorage.getItem(storageKeys.settingsDirty) === "true";
}

function applyCloudSettings(settings) {
  if (!settings || typeof settings !== "object") return false;
  let changed = false;
  if (Array.isArray(settings.menu) && settings.menu.length) {
    writeJson(storageKeys.menu, settings.menu);
    changed = true;
  }
  if (settings.recipes && typeof settings.recipes === "object" && !Array.isArray(settings.recipes)) {
    saveRecipes(settings.recipes);
    changed = true;
  }
  if (Array.isArray(settings.discountVouchers)) {
    saveDiscountVouchers(settings.discountVouchers, { dirty: false });
    changed = true;
  }
  if (settings.employeeLeaves && typeof settings.employeeLeaves === "object" && !Array.isArray(settings.employeeLeaves)) {
    saveEmployeeLeaveMap(settings.employeeLeaves, { dirty: false });
    changed = true;
  }
  if (settings.dailyCashReports && typeof settings.dailyCashReports === "object" && !Array.isArray(settings.dailyCashReports)) {
    writeJson(storageKeys.dailyCashReports, settings.dailyCashReports);
    changed = true;
  }
  if (settings.wifiReceipt && typeof settings.wifiReceipt === "object" && !Array.isArray(settings.wifiReceipt)) {
    writeJson(storageKeys.wifiReceipt, settings.wifiReceipt);
    changed = true;
  }
  if (Array.isArray(settings.employeeRoles)) {
    saveEmployeeRoles(settings.employeeRoles, { dirty: false });
    changed = true;
  }
  if (settings.labelPrinter && typeof settings.labelPrinter === "object" && !Array.isArray(settings.labelPrinter)) {
    writeJson("kasir-migi-label-printer-settings", settings.labelPrinter);
    changed = true;
  }
  if (Array.isArray(settings.employees) && settings.employees.length > 0) {
    applyCloudEmployeeRoster(settings.employees);
    changed = true;
  }
  return changed;
}

function getWifiReceiptSettings() {
  const settings = readJson(storageKeys.wifiReceipt, {});
  return {
    enabled: settings?.enabled === true,
    ssid: String(settings?.ssid || "").trim(),
    password: String(settings?.password || ""),
    security: "WPA",
  };
}

function saveWifiReceiptSettings(settings) {
  writeJson(storageKeys.wifiReceipt, {
    enabled: settings.enabled === true,
    ssid: String(settings.ssid || "").trim(),
    password: String(settings.password || ""),
    security: "WPA",
  });
  markSettingsDirty();
}

function toggleWifiFields() {
  if (!els.wifiReceiptEnabled) return;
  const enabled = els.wifiReceiptEnabled.checked;
  const settings = getWifiReceiptSettings();
  const hasSettings = Boolean(settings.ssid && settings.password);

  if (!enabled) {
    els.wifiDisplayInfo?.classList.add("hidden-field");
    els.wifiFieldsContainer?.classList.add("hidden-field");
  } else {
    if (state.wifiEditing || !hasSettings) {
      els.wifiDisplayInfo?.classList.add("hidden-field");
      els.wifiFieldsContainer?.classList.remove("hidden-field");
    } else {
      els.wifiDisplayInfo?.classList.remove("hidden-field");
      if (els.wifiDisplaySsid) {
        els.wifiDisplaySsid.textContent = settings.ssid || "";
      }
      if (els.wifiDisplayPassword) {
        const masked = "•".repeat(Math.max(4, settings.password ? settings.password.length : 8));
        els.wifiDisplayPassword.textContent = `Password: ${masked}`;
      }
      els.wifiFieldsContainer?.classList.add("hidden-field");
    }
  }
}

function renderWifiReceiptSettings() {
  if (!els.wifiSettingsForm) return;
  const settings = getWifiReceiptSettings();
  els.wifiReceiptEnabled.checked = settings.enabled;
  els.wifiName.value = settings.ssid || "";
  els.wifiPassword.value = settings.password || "";

  // Reset password field to masked type on render
  if (els.wifiPassword) {
    els.wifiPassword.type = "password";
  }
  if (els.toggleWifiPasswordIcon) {
    els.toggleWifiPasswordIcon.className = "ph ph-eye";
  }
  if (els.toggleWifiPassword) {
    els.toggleWifiPassword.setAttribute("aria-label", "Tampilkan password");
  }

  toggleWifiFields();
}

function canPrintWifiReceipt() {
  const settings = getWifiReceiptSettings();
  return Boolean(settings.ssid && settings.password);
}

function syncCheckoutWifiOption({ reset = false } = {}) {
  if (!els.checkoutWifiLine || !els.checkoutWifiReceipt) return;
  const available = canPrintWifiReceipt();
  els.checkoutWifiLine.hidden = !available;
  els.checkoutWifiReceipt.disabled = !available;
  if (reset) els.checkoutWifiReceipt.checked = available && getWifiReceiptSettings().enabled;
}

function getDailyCashReports() {
  const reports = readJson(storageKeys.dailyCashReports, {});
  return reports && typeof reports === "object" && !Array.isArray(reports) ? reports : {};
}

function getDailyCashReport(reportDate = dateKey()) {
  return getDailyCashReports()[reportDate] || null;
}

function saveDailyCashReport(reportDate, amount) {
  const reports = getDailyCashReports();
  reports[reportDate] = {
    amount: Math.max(0, Number(amount || 0)),
    employee: activeEmployeeName(),
    shift: "Shift 2",
    createdAt: new Date().toISOString(),
  };
  writeJson(storageKeys.dailyCashReports, reports);
  markSettingsDirty();
  return reports[reportDate];
}

const recoverySalesJune2026 = [
  {
    date: "2026-06-01",
    total: 150000,
    payments: { QRIS: 138000, Tunai: 12000 },
    items: [
      ["Matcha Latte", 2, 13000],
      ["Butterscotch Creamy Coffee", 1, 17000],
      ["Vietnam Drip", 1, 10000],
      ["Fullwash Kemasan 250gr", 1, 85000],
      ["Classic Kopsus Migi", 1, 12000],
    ],
  },
  {
    date: "2026-06-02",
    total: 57000,
    payments: { QRIS: 30000, Tunai: 27000 },
    items: [
      ["Butterscotch Creamy Coffee", 1, 17000],
      ["Vietnam Drip", 1, 10000],
      ["Matcha Latte", 1, 13000],
      ["Coffee Hazelnut", 1, 17000],
    ],
  },
  {
    date: "2026-06-03",
    total: 360500,
    payments: { Tunai: 204500, QRIS: 156000 },
    items: [
      ["Butterscotch Creamy Coffee", 6, 17000],
      ["Classic Kopsus Migi", 1, 12000],
      ["Iced Americano Classic", 1, 12000],
      ["Arabica Wine 250 gram", 1, 117000],
      ["Vietnam Drip", 2, 10000],
      ["Single Shot Espresso", 1, 8000],
      ["Kopi Tubruk", 1, 8000],
      ["Smooth Red Velvet", 2, 13000],
      ["Matcha Latte", 2, 13000],
      ["mini Muffin", 3, 4000],
      ["Marmer Cake", 2, 5000],
      ["Choco Big Muffin", 1, 7500],
    ],
  },
  {
    date: "2026-06-04",
    total: 301000,
    payments: { Tunai: 145000, QRIS: 156000 },
    items: [
      ["Classic Kopsus Migi", 6, 12000],
      ["Butterscotch Creamy Coffee", 4, 17000],
      ["Signature Mazagran", 1, 20000],
      ["Hot Caffe Latte", 1, 17000],
      ["Iced Americano Classic", 1, 12000],
      ["Arabika Natural Komersil 500gr", 1, 75000],
      ["V60/Japanese", 1, 15000],
      ["Single Shot Espresso", 1, 8000],
      ["Classic Choco Latte", 2, 13000],
      ["Matcha Latte", 1, 13000],
    ],
  },
  {
    date: "2026-06-05",
    total: 235500,
    payments: { Tunai: 152500, QRIS: 83000 },
    items: [
      ["Classic Kopsus Migi", 2, 12000],
      ["Signature Mazagran", 1, 20000],
      ["Salted Creamy Caramel Coffee", 1, 17000],
      ["Coffee Hazelnut", 1, 17000],
      ["Coffee Aren", 1, 15000],
      ["Cleo Kecil", 1, 2500],
      ["Iced Americano Classic", 1, 12000],
      ["Arabica Wine 100 gram", 1, 50000],
      ["Single Shot Espresso", 2, 8000],
      ["Vietnam Drip", 1, 10000],
      ["Strawberry Latte", 1, 13000],
      ["Classic Choco Latte", 1, 13000],
      ["mini Muffin", 4, 4000],
      ["Classic Cookies", 1, 5000],
      ["Marmer Cake", 1, 5000],
    ],
  },
  {
    date: "2026-06-06",
    total: 490500,
    payments: { Tunai: 397500, QRIS: 93000 },
    items: [
      ["Butterscotch Creamy Coffee", 2, 17000],
      ["Coffee Aren", 2, 15000],
      ["Classic Kopsus Migi", 2, 12000],
      ["Signature Mazagran", 1, 20000],
      ["Coffee Hazelnut", 1, 17000],
      ["Cleo Kecil", 5, 2500],
      ["Iced Americano Fullwash", 3, 15000],
      ["Iced Americano Classic", 2, 12000],
      ["Arabika Natural Komersil 500gr", 1, 75000],
      ["Single Shot Espresso", 3, 8000],
      ["V60/Japanese", 2, 15000],
      ["Kopi Tubruk Fermentasion", 2, 10000],
      ["Matcha Latte", 6, 13000],
      ["Strawberry Latte", 2, 13000],
      ["Classic Choco Latte", 1, 13000],
      ["Classic Cookies", 3, 5000],
      ["mini Muffin", 2, 4000],
    ],
  },
  {
    date: "2026-06-07",
    total: 143000,
    payments: { Tunai: 83000, QRIS: 60000 },
    items: [
      ["Matcha Latte", 4, 13000],
      ["Coffee Aren", 3, 15000],
      ["Classic Kopsus Migi", 1, 12000],
      ["Coffee Hazelnut", 1, 17000],
      ["Butterscotch Creamy Coffee", 1, 17000],
    ],
  },
  {
    date: "2026-06-08",
    total: 500500,
    payments: { Tunai: 134000, QRIS: 366500 },
    items: [
      ["Classic Kopsus Migi", 6, 12000],
      ["Signature Mazagran", 4, 20000],
      ["Butterscotch Creamy Coffee", 4, 17000],
      ["Iced Caffe Latte", 2, 17000],
      ["Hot Cappucino", 1, 17000],
      ["Salted Creamy Caramel Coffee", 1, 17000],
      ["Cleo Kecil", 1, 2500],
      ["Iced Americano Classic", 5, 12000],
      ["Single Shot Espresso", 3, 8000],
      ["Vietnam Drip", 2, 10000],
      ["V60/Japanese", 1, 15000],
      ["Matcha Latte", 5, 13000],
      ["Strawberry Latte", 1, 13000],
      ["mini Muffin", 2, 4000],
      ["Marmer Cake", 1, 5000],
    ],
  },
  {
    date: "2026-06-09",
    total: 884000,
    payments: { Tunai: 699000, QRIS: 185000 },
    items: [
      ["Classic Kopsus Migi", 15, 12000],
      ["Butterscotch Creamy Coffee", 8, 17000],
      ["Coffee Hazelnut", 5, 17000],
      ["Coffee Aren", 5, 15000],
      ["Signature Mazagran", 3, 20000],
      ["Salted Creamy Caramel Coffee", 1, 17000],
      ["Iced Americano Fruity", 1, 15000],
      ["Iced Americano Classic", 1, 12000],
      ["V60/Japanese", 2, 15000],
      ["Single Shot Espresso", 2, 8000],
      ["Strawberry Latte", 6, 13000],
      ["Matcha Latte", 4, 13000],
      ["Classic Choco Latte", 3, 13000],
      ["Smooth Red Velvet", 2, 13000],
      ["mini Muffin", 7, 4000],
      ["Marmer Cake", 4, 5000],
      ["Classic Cookies", 3, 5000],
    ],
  },
  {
    date: "2026-06-10",
    total: 655500,
    payments: { Tunai: 446000, QRIS: 197500, GoFood: 12000 },
    items: [
      ["Classic Kopsus Migi", 7, 12000],
      ["Butterscotch Creamy Coffee", 6, 17000],
      ["Salted Creamy Caramel Coffee", 4, 17000],
      ["Signature Mazagran", 3, 20000],
      ["Hot Caffe Latte", 1, 17000],
      ["Iced Cappucino", 1, 17000],
      ["Coffee Aren", 1, 15000],
      ["Cleo Kecil", 5, 2500],
      ["Iced Americano Wine", 1, 15000],
      ["Arabika Fermentasi/Wine 100gr", 1, 50000],
      ["V60/Japanese", 1, 15000],
      ["Single Shot Espresso", 1, 8000],
      ["Smooth Red Velvet", 5, 13000],
      ["Strawberry Latte", 3, 13000],
      ["Classic Choco Latte", 2, 13000],
      ["Sweet Donut", 6, 5000],
      ["mini Muffin", 3, 4000],
      ["Marmer Cake", 2, 5000],
      ["Classic Cookies", 2, 5000],
    ],
  },
  {
    date: "2026-06-11",
    total: 587000,
    payments: { Tunai: 325500, QRIS: 153500, GoFood: 108000 },
    items: [
      ["Classic Kopsus Migi", 16, 12000],
      ["Signature Mazagran", 4, 20000],
      ["Butterscotch Creamy Coffee", 4, 17000],
      ["Hot Kopi Susu", 2, 10000],
      ["Coffee Hazelnut", 1, 17000],
      ["Cleo Kecil", 3, 2500],
      ["Vietnam Drip", 1, 10000],
      ["Single Shot Espresso", 1, 8000],
      ["Classic Choco Latte", 3, 13000],
      ["Strawberry Latte", 3, 13000],
      ["Smooth Red Velvet", 3, 13000],
      ["Milkshake", 1, 10000],
      ["Choco Big Muffin", 7, 7500],
      ["Marmer Cake", 1, 5000],
    ],
  },
  {
    date: "2026-06-12",
    total: 852500,
    payments: { Tunai: 205000, QRIS: 617500, GoFood: 30000 },
    items: [
      ["Classic Kopsus Migi", 12, 12000],
      ["Butterscotch Creamy Coffee", 4, 17000],
      ["Coffee Aren", 3, 15000],
      ["Signature Mazagran", 2, 20000],
      ["Iced Caffe Latte", 2, 17000],
      ["Coffee Hazelnut", 2, 17000],
      ["Hot Caffe Latte", 1, 17000],
      ["Cleo Kecil", 3, 2500],
      ["Iced Americano Classic", 2, 12000],
      ["Iced Americano Wine", 1, 15000],
      ["Arabika Natural Komersil 500gr", 2, 75000],
      ["V60/Japanese", 2, 15000],
      ["Single Shot Espresso", 1, 8000],
      ["Matcha Latte", 5, 13000],
      ["Classic Choco Latte", 4, 13000],
      ["Smooth Red Velvet", 2, 13000],
      ["Strawberry Latte", 1, 13000],
      ["Choco Big Muffin", 8, 7500],
      ["Classic Cookies", 3, 5000],
      ["Marmer Cake", 1, 5000],
    ],
  },
];

function recoveryMenuKey(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function recoveryMenuAliases(name = "") {
  const aliases = {
    "kopi susu": "Classic Kopsus Migi",
    "kopi gula aren": "Coffee Aren",
    "creamy butterscotch": "Butterscotch Creamy Coffee",
    "vietnamese drip": "Vietnam Drip",
    "vietnam drip": "Vietnam Drip",
    "fullwash kemasan 250gr": "Fullwash Kemasan 250gr",
    "arabica wine 250 gram": "Arabica Wine 250 gram",
    "arabica wine 100 gram": "Arabica Wine 100 gram",
    "arabika fermentasi wine 100gr": "Arabika Fermentasi/Wine 100gr",
  };
  return aliases[String(name).toLowerCase().replace(/[/-]+/g, " ").replace(/\s+/g, " ").trim()] || name;
}

function recoveryMenuItem(name, qty, price, menuByKey) {
  const alias = recoveryMenuAliases(name);
  const menuItem = menuByKey.get(recoveryMenuKey(alias)) || menuByKey.get(recoveryMenuKey(name));
  if (menuItem) {
    return { ...menuItem, price, qty, recoveryOriginalName: name };
  }
  return {
    id: `recovery-${stableIdFromName(alias)}`,
    name: alias,
    category: "Recovery",
    price,
    qty,
    recoveryUnmatched: true,
    recoveryOriginalName: name,
  };
}

function recoveryTransactionForDay(day, menuByKey) {
  const items = day.items.map(([name, qty, price]) => recoveryMenuItem(name, qty, price, menuByKey));
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
  const discountTotal = Math.max(0, subtotal - Number(day.total || 0));
  return {
    id: `RECOVERY-${day.date}`,
    orderCode: `REC-${day.date}`,
    createdAt: `${day.date}T12:00:00.000+07:00`,
    customer: "Recovery Omzet",
    table: `Recovery ${day.date}`,
    shift: "Recovery Harian",
    channel: "Kasir",
    status: "paid",
    employee: "Owner",
    employeeId: "owner",
    dutyRole: "karyawan",
    orderType: "recovery",
    payment: "Recovery",
    paymentBreakdown: day.payments,
    paid: day.total,
    change: 0,
    subtotal,
    originalTotal: subtotal,
    discountTotal,
    discountNote: discountTotal ? "Penyesuaian recovery agar omzet mengikuti catatan harian." : "",
    grandTotal: day.total,
    items,
    recoveryImport: true,
    recoverySource: "Rekap manual 1-12 Juni 2026",
  };
}

let juneRecoveryImportPromise = null;

async function ensureJuneRecoveryImported({ force = false } = {}) {
  if (!navigator.onLine || !isLoggedIn() || !isOwner()) return false;
  if (!force && localStorage.getItem(storageKeys.juneRecoverySynced) === "true") return true;
  if (juneRecoveryImportPromise) return juneRecoveryImportPromise;

  juneRecoveryImportPromise = (async () => {
    const menuByKey = new Map(getMenu().map((item) => [recoveryMenuKey(item.name), item]));
    const existingIds = new Set([...getHistory(), ...getOrderDrafts()].map((entry) => entry.id).filter(Boolean));
    const transactions = recoverySalesJune2026.map((day) => recoveryTransactionForDay(day, menuByKey));
    const toImport = transactions.filter((transaction) => !existingIds.has(transaction.id));

    if (toImport.length) {
      const nextHistory = dedupeTransactionsById([...toImport, ...getHistory()]);
      writeJson(storageKeys.history, nextHistory.slice(0, 2000));
    }

    for (const transaction of transactions) {
      await postSupabaseAction("sync-transaction", { transaction });
    }
    localStorage.setItem(storageKeys.juneRecoverySynced, "true");
    await pullTransactionsFromSupabase({ render: false }).catch(() => null);
    return true;
  })()
    .catch((error) => {
      localStorage.removeItem(storageKeys.juneRecoverySynced);
      throw error;
    })
    .finally(() => {
      juneRecoveryImportPromise = null;
    });

  return juneRecoveryImportPromise;
}

function getCashflowExpenses() {
  return readJson(storageKeys.cashflowExpenses, []);
}

function saveCashflowExpense(expense) {
  const expenses = getCashflowExpenses();
  expenses.unshift(expense);
  writeJson(storageKeys.cashflowExpenses, expenses.slice(0, 2000));
}

function getPendingDeletes() {
  return readJson(storageKeys.pendingDeletes, []);
}

function savePendingDeletes(deletes) {
  writeJson(storageKeys.pendingDeletes, deletes);
}

function clearPendingDelete(type, id) {
  savePendingDeletes(getPendingDeletes().filter((entry) => !(entry.type === type && entry.id === id)));
}

function getDeletedTransactionTombstones() {
  return readJson(storageKeys.deletedTransactions, []);
}

function saveDeletedTransactionTombstones(tombstones) {
  writeJson(storageKeys.deletedTransactions, tombstones.slice(0, 2000));
}

function rememberDeletedTransaction(id, createdAt = new Date().toISOString()) {
  if (!id) return;
  const tombstones = getDeletedTransactionTombstones().filter((entry) => entry.id !== id);
  tombstones.unshift({ id, createdAt: createdAt || new Date().toISOString(), deletedAt: new Date().toISOString() });
  saveDeletedTransactionTombstones(tombstones);
}

function mergeDeletedTransactionTombstones(entries = []) {
  const map = new Map(getDeletedTransactionTombstones().map((entry) => [entry.id, entry]));
  entries.forEach((entry) => {
    const id = entry?.id;
    if (!id) return;
    map.set(id, {
      id,
      createdAt: entry.createdAt || entry.created_at || new Date().toISOString(),
      deletedAt: entry.deletedAt || entry.deleted_at || new Date().toISOString(),
    });
  });
  saveDeletedTransactionTombstones(
    [...map.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
  );
}

function queuePendingDelete(type, id) {
  const deletes = getPendingDeletes();
  if (deletes.some((entry) => entry.type === type && entry.id === id)) return;
  deletes.push({ type, id, createdAt: new Date().toISOString() });
  savePendingDeletes(deletes);
}

function getBoothSessions() {
  return readJson(storageKeys.booth, []);
}

function getLegacyBoothSessions() {
  return readJson(storageKeys.boothLegacy, []);
}

function saveLegacyBoothSessions(sessions) {
  writeJson(storageKeys.boothLegacy, sessions);
  boothSyncChannel?.postMessage({ action: "update_sessions", data: sessions, sender: "cashier", timestamp: Date.now() });
}

async function sendBoothServerAction(action, code, payload = {}) {
  try {
    const response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code, ...payload }),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return Boolean(result?.success);
  } catch {
    return false;
  }
}

if (boothSyncChannel) {
  boothSyncChannel.onmessage = (event) => {
    const { action, data, sender } = event.data || {};
    if (sender !== "booth") return;

    const sessions = getLegacyBoothSessions();
    if (action === "request_sync") {
      saveLegacyBoothSessions(sessions);
      return;
    }

    if (action === "claim_code") {
      const session = sessions.find((entry) => entry.code === data?.code && entry.status === "unused");
      if (session) {
        session.status = "active";
        saveLegacyBoothSessions(sessions);
        boothSyncChannel.postMessage({ action: "code_claimed_ok", data: { code: data.code }, sender: "cashier" });
      }
      return;
    }

    if (action === "release_code") {
      const session = sessions.find((entry) => entry.code === data?.code && entry.status === "active");
      if (session) {
        session.status = "unused";
        saveLegacyBoothSessions(sessions);
      }
      return;
    }

    if (action === "finish_session") {
      const session = sessions.find((entry) => entry.code === data?.code);
      if (session) {
        session.status = "used";
        saveLegacyBoothSessions(sessions);
      }
    }
  };
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function setPrinterStatus(status, tone, hint) {
  els.printerStatus.textContent = status;
  els.printerStatus.className = `printer-status ${tone}`;
  els.printerToggle.classList.remove("disconnected", "connecting", "connected");
  els.printerToggle.classList.add(tone);
  els.connectPrinter.textContent = tone === "connected" ? "Ganti Printer" : tone === "connecting" ? "Menghubungkan..." : "Sambungkan Printer";
  els.connectPrinter.disabled = tone === "connecting";
  els.printerHint.textContent = hint;

  // Label printer is optional, but its warning remains visible regardless of
  // the receipt-printer connection.
  if (els.printerBadge) {
    els.printerBadge.classList.toggle("hidden", isLabelPrinterReady());
  }
}

function togglePrinterDropdown(force) {
  const isOpen = force ?? !els.printerDropdown.classList.contains("open");
  els.printerDropdown.classList.toggle("open", isOpen);
  els.printerToggle.classList.toggle("active", isOpen);
  els.printerToggle.setAttribute("aria-expanded", String(isOpen));
}

function setLabelPrinterStatus(status, tone, hint) {
  if (els.labelPrinterStatus) {
    els.labelPrinterStatus.textContent = status;
    els.labelPrinterStatus.className = `printer-status ${tone}`;
  }
  if (els.connectLabelPrinter) {
    els.connectLabelPrinter.textContent = tone === "connected" ? "Ganti Label Printer" : tone === "connecting" ? "Menghubungkan..." : "Sambungkan Label Printer";
    els.connectLabelPrinter.disabled = tone === "connecting";
  }
  if (els.labelPrinterHint) els.labelPrinterHint.textContent = hint;
  // Keep the indicator and checkout notice in sync with the actual GATT state.
  if (els.printerBadge) {
    els.printerBadge.classList.toggle("hidden", isLabelPrinterReady());
  }
  updateLabelPrinterCheckoutWarning();
}

function switchPrinterTab(tab) {
  const isKasir = tab === "kasir";
  els.printerTabKasir?.classList.toggle("active", isKasir);
  els.printerTabKasir?.setAttribute("aria-selected", String(isKasir));
  els.printerTabLabel?.classList.toggle("active", !isKasir);
  els.printerTabLabel?.setAttribute("aria-selected", String(!isKasir));
  if (els.printerPanelKasir) els.printerPanelKasir.hidden = !isKasir;
  if (els.printerPanelLabel) els.printerPanelLabel.hidden = isKasir;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    toast("Fullscreen belum bisa diaktifkan di browser ini.");
  }
}

function syncFullscreenButton() {
  els.fullscreenToggle?.classList.toggle("active", !!document.fullscreenElement);
}

function normalizeLabelFontScale(value) {
  const size = Number(value ?? 16);
  // Legacy ESC/POS values (0..4) map to useful bitmap pixel sizes.
  if (size >= 0 && size <= 4) return [12, 16, 20, 18, 24][Math.round(size)];
  return Math.max(10, Math.min(32, Math.round(size)));
}

function getLabelFontMetrics(value) {
  const requestedPixelSize = normalizeLabelFontScale(value);
  // Browser CSS pixels and thermal printer dots have different glyph density.
  // Use the same calibrated effective size in preview and bitmap rendering.
  const pixelSize = Math.max(10, Math.round(requestedPixelSize * 1.35));
  const metrics = { fontByte: 0, sizeByte: 0x00, widthMultiplier: 1, heightMultiplier: 1 };
  return {
    ...metrics,
    scale: requestedPixelSize,
    requestedPixelSize,
    pixelSize,
    charWidth: Math.max(6, Math.round(pixelSize * 0.6)),
    charHeight: Math.max(12, Math.round(pixelSize * 1.2))
  };
}

function fitLabelText(text, widthDots, fontScale) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const { charWidth } = getLabelFontMetrics(fontScale);
  const maxChars = Math.max(0, Math.floor(Number(widthDots || 0) / charWidth));
  if (!maxChars || normalized.length <= maxChars) return maxChars ? normalized : "";
  if (maxChars <= 2) return normalized.slice(0, maxChars);
  return `${normalized.slice(0, maxChars - 2).trimEnd()}..`;
}

function getLabelPaperDimensions(settings = {}) {
  const paperSize = settings.paperSize || "40x20mm";
  if (paperSize === "50x30mm") return { width: 400, height: 240 };
  if (paperSize === "30x15mm") return { width: 240, height: 120 };
  if (paperSize === "58mm") return { width: 384, height: 240 };
  return { width: 320, height: 160 };
}

const LABEL_PRINTER_WIDTH_DOTS = 384;

function getMaxLabelOffsetX(paperWidth) {
  return Math.max(0, LABEL_PRINTER_WIDTH_DOTS - Number(paperWidth || LABEL_PRINTER_WIDTH_DOTS));
}

function syncLabelOffsetLimit(settings = getLabelPrinterSettings()) {
  if (!els.labelStickerOffsetX) return 0;
  const { width } = getLabelPaperDimensions(settings);
  const maxOffset = getMaxLabelOffsetX(width);
  const nextOffset = Math.min(maxOffset, Math.max(0, Number(els.labelStickerOffsetX.value || 0)));
  els.labelStickerOffsetX.max = String(maxOffset);
  els.labelStickerOffsetX.value = String(nextOffset);
  if (els.labelStickerOffsetXVal) els.labelStickerOffsetXVal.textContent = String(nextOffset);
  return nextOffset;
}

function getLabelPrinterSettings() {
  const fallback = {
    printEngine: "bitmap",
    paperSize: "40x20mm",
    feedMethod: "gap",
    pitch: 160,
    lineSpacing: 20,
    labelDelay: 300,
    labelMargin: 8,
    labelSpaces: 0,
    stickerOffsetX: 64,
    
    drinkNameEnabled: true,
    drinkNameBold: true,
    drinkNameFontSize: 1,
    drinkNameX: 12,
    drinkNameY: 12,
    drinkNameWidth: parseInt(els.labelPreviewDrinkName?.style.width || "200"),
    drinkNameMaxHeight: parseInt(els.labelPreviewDrinkName?.style.height || "48"),

    notesEnabled: true,
    notesBold: false,
    notesFontSize: 1,
    notesX: 12,
    notesY: 48,
    notesWidth: parseInt(els.labelPreviewNotes?.style.width || "280"),
    notesMaxHeight: parseInt(els.labelPreviewNotes?.style.height || "24"),

    orderCodeEnabled: true,
    orderCodeBold: false,
    orderCodeFontSize: 1,
    orderCodeX: 12,
    orderCodeY: 84,
    orderCodeWidth: parseInt(els.labelPreviewOrderCode?.style.width || "120"),
    orderCodeMaxHeight: parseInt(els.labelPreviewOrderCode?.style.height || "24"),

    customerEnabled: true,
    customerBold: false,
    customerFontSize: 1,
    customerX: 12,
    customerY: 110,
    customerWidth: 150,
    customerMaxHeight: parseInt(els.labelPreviewCustomer?.style.height || "24"),

    counterEnabled: true,
    counterBold: false,
    counterFontSize: 1,
    counterX: 240,
    counterY: 84,
    counterWidth: parseInt(els.labelPreviewCounter?.style.width || "80"),
    counterMaxHeight: parseInt(els.labelPreviewCounter?.style.height || "24"),

    customTextEnabled: false,
    customTextBold: true,
    customTextFontSize: 1,
    customTextX: 150,
    customTextY: 12,
    customTextWidth: 100,
    customTextMaxHeight: parseInt(els.labelPreviewCustomText?.style.height || "24"),
    customTextValue: "TEMAN",

    logoEnabled: false,
    logoX: 12,
    logoY: 12,
    logoWidth: 32,
    logoMaxHeight: 32,

    customImageEnabled: false,
    customImageData: "",
    customImageX: 260,
    customImageY: 12,
    customImageWidth: 48,
    customImageMaxHeight: 48,

    barcodeEnabled: false,
    barcodeX: 60,
    barcodeY: 130,
    barcodeWidth: parseInt(els.labelPreviewBarcode?.style.width || "200"),
    barcodeMaxHeight: 20
  };
  const settings = readJson("kasir-migi-label-printer-settings", fallback);
  // Pulihkan konfigurasi stabil sebelum perubahan pitch manual v126.
  // Migrasi hanya sekali agar pengaturan baru pengguna tetap dihormati.
  if (settings && !settings.feedRollback127Applied) {
    settings.feedMethod = "gap";
    settings.feedRollback127Applied = true;
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  if (settings && !settings.labelTransportV128Applied) {
    settings.labelDelay = Math.max(1500, Number(settings.labelDelay || 0));
    settings.labelTransportV128Applied = true;
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  if (settings && settings.customImageEnabled === undefined) {
    Object.assign(settings, {
      customImageEnabled: false,
      customImageData: "",
      customImageX: 260,
      customImageY: 12,
      customImageWidth: 48,
      customImageMaxHeight: 48,
    });
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  if (settings && (settings.serviceTypeY === undefined || settings.serviceTypeY >= 110)) {
    settings.serviceTypeX = 214;
    settings.serviceTypeY = 88;
    settings.serviceTypeWidth = 64;
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  if (["40x30mm", "40x40mm", "custom"].includes(settings.paperSize)) {
    settings.paperSize = "40x20mm";
    settings.pitch = 160;
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  if (settings && settings.stickerOffsetX === 8) {
    settings.stickerOffsetX = 64;
  }
  if (settings && !settings.fontScaleV2) {
    ["drinkName", "notes", "orderCode", "customer", "counter", "customText"].forEach((key) => {
      settings[`${key}FontSize`] = normalizeLabelFontScale(settings[`${key}FontSize`]);
    });
    settings.fontScaleV2 = true;
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  if (settings && !settings.migrated4x2) {
    if (settings.paperSize === "40x20mm") {
      settings.drinkNameY = 8;
      settings.drinkNameMaxHeight = 48;
      settings.notesY = 40;
      settings.notesMaxHeight = 24;
      settings.orderCodeY = 64;
      settings.orderCodeMaxHeight = 24;
      settings.counterY = 64;
      settings.counterMaxHeight = 24;
      settings.customerY = 88;
      settings.customerMaxHeight = 24;
      settings.barcodeY = 112;
      settings.barcodeMaxHeight = 20;
    }
    settings.migrated4x2 = true;
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  if (settings && settings.paperSize === "40x20mm" && !settings.exactLayoutPresetV1) {
    Object.assign(settings, {
      drinkNameEnabled: true,
      drinkNameBold: true,
      drinkNameFontSize: 16,
      drinkNameX: 10,
      drinkNameY: 8,
      drinkNameWidth: 210,
      drinkNameMaxHeight: 44,
      customTextEnabled: true,
      customTextBold: true,
      customTextFontSize: 12,
      customTextValue: "©2026",
      customTextX: 252,
      customTextY: 8,
      customTextWidth: 68,
      customTextMaxHeight: 24,
      counterEnabled: true,
      counterBold: false,
      counterFontSize: 12,
      counterX: 272,
      counterY: 76,
      counterWidth: 48,
      counterMaxHeight: 24,
      customerEnabled: true,
      customerBold: true,
      customerFontSize: 14,
      customerX: 8,
      customerY: 106,
      customerWidth: 150,
      customerMaxHeight: 24,
      notesEnabled: true,
      notesBold: false,
      notesFontSize: 14,
      notesX: 8,
      notesY: 134,
      notesWidth: 160,
      notesMaxHeight: 24,
      orderCodeEnabled: true,
      orderCodeBold: false,
      orderCodeFontSize: 14,
      orderCodeX: 170,
      orderCodeY: 134,
      orderCodeWidth: 80,
      orderCodeMaxHeight: 24,
      barcodeEnabled: true,
      barcodeX: 250,
      barcodeY: 108,
      barcodeWidth: 70,
      barcodeMaxHeight: 24,
      serviceTypeEnabled: false,
      logoEnabled: false,
      exactLayoutPresetV1: true,
    });
    writeJson("kasir-migi-label-printer-settings", settings);
  }
  return settings;
}

const LABEL_LAYOUT_KEYS = ["Logo", "CustomImage", "DrinkName", "Notes", "OrderCode", "Customer", "ServiceType", "Counter", "CustomText", "Barcode"];

function scaleLabelLayoutForPaperChange(previousSettings, nextPaperSize) {
  const previousPaper = getLabelPaperDimensions(previousSettings);
  const nextPaper = getLabelPaperDimensions({ paperSize: nextPaperSize });
  const scaleX = nextPaper.width / previousPaper.width;
  const scaleY = nextPaper.height / previousPaper.height;

  LABEL_LAYOUT_KEYS.forEach((key) => {
    const element = els[`labelPreview${key}`];
    if (!element) return;
    const currentX = parseInt(element.getAttribute("data-drag-x") || element.style.left || "0");
    const currentY = parseInt(element.getAttribute("data-drag-y") || element.style.top || "0");
    const currentWidth = parseInt(element.style.width || "80");
    const currentHeight = parseInt(element.style.height || "24");
    const nextWidth = Math.max(30, Math.min(nextPaper.width, Math.round(currentWidth * scaleX)));
    const nextHeight = Math.max(15, Math.min(nextPaper.height, Math.round(currentHeight * scaleY)));
    const nextX = Math.max(0, Math.min(nextPaper.width - nextWidth, Math.round(currentX * scaleX)));
    const nextY = Math.max(0, Math.min(nextPaper.height - nextHeight, Math.round(currentY * scaleY)));

    element.style.left = `${nextX}px`;
    element.style.top = `${nextY}px`;
    element.style.width = `${nextWidth}px`;
    element.style.height = `${nextHeight}px`;
    element.style.maxWidth = `${nextWidth}px`;
    element.style.maxHeight = `${nextHeight}px`;
    element.setAttribute("data-drag-x", String(nextX));
    element.setAttribute("data-drag-y", String(nextY));
  });

  if (els.labelStickerOffsetX) {
    const previousMax = getMaxLabelOffsetX(previousPaper.width);
    const nextMax = getMaxLabelOffsetX(nextPaper.width);
    const currentOffset = Math.max(0, Number(els.labelStickerOffsetX.value || 0));
    const alignmentRatio = previousMax > 0 ? currentOffset / previousMax : 0;
    els.labelStickerOffsetX.value = String(Math.round(nextMax * alignmentRatio));
  }
}

function saveLabelPrinterSettingsFromUI() {
  const previousSettings = getLabelPrinterSettings();
  const paperSize = els.labelPrinterPaperSize?.value || "40x20mm";
  if (previousSettings.paperSize !== paperSize) {
    scaleLabelLayoutForPaperChange(previousSettings, paperSize);
  }

  const presetPitch = getLabelPaperDimensions({ paperSize }).height;
  const pitch = previousSettings.paperSize !== paperSize
    ? presetPitch
    : Math.max(1, Number(els.labelPrinterPitch?.value || previousSettings.pitch || presetPitch));
  if (els.labelPrinterPitch) els.labelPrinterPitch.value = pitch;

  const settings = {
    ...previousSettings,
    printEngine: els.labelPrinterPrintEngine?.value || "bitmap",
    paperSize,
    feedMethod: els.labelPrinterFeedMethod?.value || "gap",
    pitch,
    lineSpacing: Number(els.labelPrinterLineSpacing?.value || 20),
    labelDelay: Number(els.labelPrinterDelay?.value || 300),
    labelMargin: Number(els.labelPrinterMargin?.value || 8),
    labelSpaces: Number(els.labelPrinterSpaces?.value || 0),
    stickerOffsetX: syncLabelOffsetLimit({ paperSize }),
    fontScaleV2: true,

    drinkNameEnabled: els.labelDrinkNameEnabled?.checked !== false,
    drinkNameBold: els.labelDrinkNameBold?.checked !== false,
    drinkNameFontSize: Number(els.labelDrinkNameFontSize?.value ?? 1),
    drinkNameX: parseInt(els.labelPreviewDrinkName?.getAttribute("data-drag-x") || els.labelPreviewDrinkName?.style.left || "12"),
    drinkNameY: parseInt(els.labelPreviewDrinkName?.getAttribute("data-drag-y") || els.labelPreviewDrinkName?.style.top || "12"),
    drinkNameWidth: parseInt(els.labelPreviewDrinkName?.style.width || "200"),
    drinkNameMaxHeight: parseInt(els.labelPreviewDrinkName?.style.height || "48"),

    notesEnabled: els.labelNotesEnabled?.checked !== false,
    notesBold: els.labelNotesBold?.checked === true,
    notesFontSize: Number(els.labelNotesFontSize?.value ?? 1),
    notesX: parseInt(els.labelPreviewNotes?.getAttribute("data-drag-x") || els.labelPreviewNotes?.style.left || "12"),
    notesY: parseInt(els.labelPreviewNotes?.getAttribute("data-drag-y") || els.labelPreviewNotes?.style.top || "48"),
    notesWidth: parseInt(els.labelPreviewNotes?.style.width || "280"),
    notesMaxHeight: parseInt(els.labelPreviewNotes?.style.height || "24"),

    orderCodeEnabled: els.labelOrderCodeEnabled?.checked !== false,
    orderCodeBold: els.labelOrderCodeBold?.checked === true,
    orderCodeFontSize: Number(els.labelOrderCodeFontSize?.value ?? 1),
    orderCodeX: parseInt(els.labelPreviewOrderCode?.getAttribute("data-drag-x") || els.labelPreviewOrderCode?.style.left || "12"),
    orderCodeY: parseInt(els.labelPreviewOrderCode?.getAttribute("data-drag-y") || els.labelPreviewOrderCode?.style.top || "84"),
    orderCodeWidth: parseInt(els.labelPreviewOrderCode?.style.width || "120"),
    orderCodeMaxHeight: parseInt(els.labelPreviewOrderCode?.style.height || "24"),

    customerEnabled: els.labelCustomerEnabled?.checked !== false,
    customerBold: els.labelCustomerBold?.checked === true,
    customerFontSize: Number(els.labelCustomerFontSize?.value ?? 1),
    customerX: parseInt(els.labelPreviewCustomer?.getAttribute("data-drag-x") || els.labelPreviewCustomer?.style.left || "12"),
    customerY: parseInt(els.labelPreviewCustomer?.getAttribute("data-drag-y") || els.labelPreviewCustomer?.style.top || "110"),
    customerWidth: parseInt(els.labelPreviewCustomer?.style.width || "150"),
    customerMaxHeight: parseInt(els.labelPreviewCustomer?.style.height || "24"),

    serviceTypeEnabled: els.labelServiceTypeEnabled?.checked !== false,
    serviceTypeFontSize: Number(els.labelServiceTypeFontSize?.value ?? 16),
    serviceTypeX: parseInt(els.labelPreviewServiceType?.getAttribute("data-drag-x") || els.labelPreviewServiceType?.style.left || "214"),
    serviceTypeY: parseInt(els.labelPreviewServiceType?.getAttribute("data-drag-y") || els.labelPreviewServiceType?.style.top || "88"),
    serviceTypeWidth: parseInt(els.labelPreviewServiceType?.style.width || "64"),
    serviceTypeMaxHeight: parseInt(els.labelPreviewServiceType?.style.height || "24"),

    counterEnabled: els.labelCounterEnabled?.checked !== false,
    counterBold: els.labelCounterBold?.checked === true,
    counterFontSize: Number(els.labelCounterFontSize?.value ?? 1),
    counterX: parseInt(els.labelPreviewCounter?.getAttribute("data-drag-x") || els.labelPreviewCounter?.style.left || "240"),
    counterY: parseInt(els.labelPreviewCounter?.getAttribute("data-drag-y") || els.labelPreviewCounter?.style.top || "84"),
    counterWidth: parseInt(els.labelPreviewCounter?.style.width || "80"),
    counterMaxHeight: parseInt(els.labelPreviewCounter?.style.height || "24"),

    customTextEnabled: els.labelCustomTextEnabled?.checked === true,
    customTextBold: els.labelCustomTextBold?.checked !== false,
    customTextFontSize: Number(els.labelCustomTextFontSize?.value ?? 1),
    customTextX: parseInt(els.labelPreviewCustomText?.getAttribute("data-drag-x") || els.labelPreviewCustomText?.style.left || "150"),
    customTextY: parseInt(els.labelPreviewCustomText?.getAttribute("data-drag-y") || els.labelPreviewCustomText?.style.top || "12"),
    customTextWidth: parseInt(els.labelPreviewCustomText?.style.width || "100"),
    customTextMaxHeight: parseInt(els.labelPreviewCustomText?.style.height || "24"),
    customTextValue: els.labelCustomTextValue?.value || "TEMAN",

    logoEnabled: els.labelLogoEnabled?.checked === true,
    logoX: parseInt(els.labelPreviewLogo?.getAttribute("data-drag-x") || els.labelPreviewLogo?.style.left || "12"),
    logoY: parseInt(els.labelPreviewLogo?.getAttribute("data-drag-y") || els.labelPreviewLogo?.style.top || "12"),
    logoWidth: parseInt(els.labelPreviewLogo?.style.width || "32"),
    logoMaxHeight: parseInt(els.labelPreviewLogo?.style.height || "32"),

    customImageEnabled: els.labelCustomImageEnabled?.checked === true && Boolean(previousSettings.customImageData),
    customImageX: parseInt(els.labelPreviewCustomImage?.getAttribute("data-drag-x") || els.labelPreviewCustomImage?.style.left || "260"),
    customImageY: parseInt(els.labelPreviewCustomImage?.getAttribute("data-drag-y") || els.labelPreviewCustomImage?.style.top || "12"),
    customImageWidth: parseInt(els.labelPreviewCustomImage?.style.width || "48"),
    customImageMaxHeight: parseInt(els.labelPreviewCustomImage?.style.height || "48"),

    barcodeEnabled: els.labelBarcodeEnabled?.checked === true,
    barcodeX: parseInt(els.labelPreviewBarcode?.getAttribute("data-drag-x") || els.labelPreviewBarcode?.style.left || "60"),
    barcodeY: parseInt(els.labelPreviewBarcode?.getAttribute("data-drag-y") || els.labelPreviewBarcode?.style.top || "130"),
    barcodeWidth: parseInt(els.labelPreviewBarcode?.style.width || "160"),
    barcodeMaxHeight: (() => {
      const renderedHeight = parseInt(els.labelPreviewBarcode?.style.height || "44");
      return Math.max(1, renderedHeight > 24 ? renderedHeight - 24 : renderedHeight);
    })()
  };
  writeJson("kasir-migi-label-printer-settings", settings);
  markSettingsDirty();
  toggleLabelPrinterManualSettingsVisibility();
  updateLabelPreview();
  renderLabelSettingsSummary();
}

function persistLabelLayoutSnapshot() {
  const settings = getLabelPrinterSettings();
  LABEL_LAYOUT_KEYS.forEach((key) => {
    const element = els[`labelPreview${key}`];
    if (!element) return;
    const keyLower = key.charAt(0).toLowerCase() + key.slice(1);
    settings[`${keyLower}X`] = parseInt(element.style.left || element.getAttribute("data-drag-x") || "0");
    settings[`${keyLower}Y`] = parseInt(element.style.top || element.getAttribute("data-drag-y") || "0");
    settings[`${keyLower}Width`] = parseInt(element.style.width || "80");
    const renderedHeight = parseInt(element.style.height || "24");
    settings[`${keyLower}MaxHeight`] = key === "Barcode" ? Math.max(1, renderedHeight - 24) : renderedHeight;
  });
  writeJson("kasir-migi-label-printer-settings", settings);
}

// Preserve the latest visible layout even if the page is refreshed while a
// drag gesture is still active and the normal mouseup handler has not fired.
window.addEventListener("pagehide", persistLabelLayoutSnapshot);

async function prepareLabelCustomImage(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Pilih file gambar PNG, JPG, atau WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 5 MB.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const source = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("File gambar tidak dapat dibaca."));
      image.src = objectUrl;
    });
    const maxDimension = 256;
    const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
    const width = Math.max(1, Math.round(source.naturalWidth * scale));
    const height = Math.max(1, Math.round(source.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    // Simpan persis seperti hasil thermal: monokrom dan berukuran kecil.
    const pixels = ctx.getImageData(0, 0, width, height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const luminance = 0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2];
      const value = luminance < 190 ? 0 : 255;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function handleLabelCustomImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (els.labelCustomImageHint) els.labelCustomImageHint.textContent = "Memproses gambar...";
    const processed = await prepareLabelCustomImage(file);
    const paper = getLabelPaperDimensions(getLabelPrinterSettings());
    const displayWidth = Math.max(24, Math.min(80, Math.round(processed.width * Math.min(1, 64 / processed.width))));
    const displayHeight = Math.max(15, Math.min(paper.height, Math.round(displayWidth * processed.height / processed.width)));
    const settings = getLabelPrinterSettings();
    Object.assign(settings, {
      customImageData: processed.dataUrl,
      customImageEnabled: true,
      customImageWidth: displayWidth,
      customImageMaxHeight: displayHeight,
    });
    writeJson("kasir-migi-label-printer-settings", settings);
    markSettingsDirty();
    if (els.labelCustomImageEnabled) els.labelCustomImageEnabled.checked = true;
    if (els.labelPreviewCustomImage) {
      els.labelPreviewCustomImage.style.width = `${displayWidth}px`;
      els.labelPreviewCustomImage.style.height = `${displayHeight}px`;
      els.labelPreviewCustomImage.style.maxHeight = `${displayHeight}px`;
    }
    updateLabelPreview();
    renderLabelSettingsSummary();
    if (els.labelCustomImageHint) els.labelCustomImageHint.textContent = `${file.name} siap · tarik gambarnya di preview untuk mengatur posisi dan ukuran.`;
    toast("Gambar dekorasi ditambahkan ke label.");
  } catch (error) {
    if (els.labelCustomImageHint) els.labelCustomImageHint.textContent = error.message;
    toast(error.message);
  } finally {
    event.target.value = "";
  }
}

function removeLabelCustomImage() {
  const settings = getLabelPrinterSettings();
  settings.customImageData = "";
  settings.customImageEnabled = false;
  writeJson("kasir-migi-label-printer-settings", settings);
  markSettingsDirty();
  if (els.labelCustomImageEnabled) els.labelCustomImageEnabled.checked = false;
  if (els.labelCustomImageHint) {
    els.labelCustomImageHint.textContent = "PNG/JPG/WebP maks. 5 MB. Gambar otomatis diperkecil dan dicetak hitam-putih.";
  }
  [els.labelPreviewCustomImage, document.getElementById("labelReadOnlyPreviewCustomImage")].forEach((element) => {
    const image = element?.querySelector("img");
    if (image) image.removeAttribute("src");
  });
  updateLabelPreview();
  renderLabelSettingsSummary();
  toast("Gambar dekorasi dihapus.");
}

function toggleLabelPrinterManualSettingsVisibility() {
  if (!els.labelPrinterFeedMethod || !els.labelPrinterManualSettings) return;
  const isManual = els.labelPrinterFeedMethod.value === "manual";
  els.labelPrinterManualSettings.style.display = isManual ? "block" : "none";
}

function renderLabelSettingsSummary() {
  const container = document.getElementById("labelSettingsSummaryContainer");
  if (!container) return;
  const settings = getLabelPrinterSettings();
  const elements = [
    { key: "CustomImage", label: "Gambar Dekorasi", isGraphic: true },
    { key: "DrinkName", label: "Nama Produk" },
    { key: "Notes", label: "Catatan Varian" },
    { key: "OrderCode", label: "Nomor Pesanan" },
    { key: "Customer", label: "Nama Pengunjung" },
    { key: "Counter", label: "Nomor Item" },
    { key: "CustomText", label: "Teks Kustom", textVal: settings.customTextValue }
  ];
  
  let html = '<div style="font-weight: 600; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Konfigurasi Aktif saat ini:</div>';
  let activeCount = 0;
  
  elements.forEach(({ key, label, textVal, isGraphic }) => {
    const keyLower = key.charAt(0).toLowerCase() + key.slice(1);
    const enabled = settings[`${keyLower}Enabled`] !== false;
    if (enabled) {
      activeCount++;
      const size = isGraphic
        ? `${settings.customImageWidth || 48}×${settings.customImageMaxHeight || 48}`
        : (settings[`${keyLower}FontSize`] !== undefined ? settings[`${keyLower}FontSize`] : 13);
      const bold = settings[`${keyLower}Bold`] === true ? " · B" : "";
      const extra = (key === "CustomText" && textVal) ? ` ("${textVal}")` : "";
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--border); padding: 4px 0;">
          <span style="font-weight: 500;">${label}${extra}</span>
          <span style="color: var(--muted); font-family: monospace; font-size: 11.5px;">Ukuran ${size}${bold}</span>
        </div>
      `;
    }
  });
  
  if (activeCount === 0) {
    html += '<div style="color: var(--muted); font-style: italic;">Tidak ada elemen aktif</div>';
  }
  
  container.innerHTML = html;
}

function updateLabelPreview() {
  if (!els.labelPreviewSticker) return;

  const labelSettings = getLabelPrinterSettings();

  const previewSettings = {
    ...labelSettings,
    paperSize: els.labelPrinterPaperSize?.value || labelSettings.paperSize
  };
  const { width: stickerWidth, height: stickerHeight } = getLabelPaperDimensions(previewSettings);
  const stickerOffsetX = syncLabelOffsetLimit(previewSettings);

  [els.labelPreviewPaper, document.getElementById("labelReadOnlyPreviewPaper")].forEach(p => {
    if (p) {
      p.style.width = `${Math.max(LABEL_PRINTER_WIDTH_DOTS, stickerWidth)}px`;
      p.style.height = `${stickerHeight}px`;
    }
  });

  [els.labelPreviewSticker, document.getElementById("labelReadOnlyPreviewSticker")].forEach(s => {
    if (s) {
      s.style.width = `${stickerWidth}px`;
      s.style.height = `${stickerHeight}px`;
    }
  });

  els.labelPreviewSticker.style.left = `${stickerOffsetX}px`;
  els.labelPreviewSticker.style.top = "0px";
  const readOnlySticker = document.getElementById("labelReadOnlyPreviewSticker");
  if (readOnlySticker) {
    readOnlySticker.style.left = `${stickerOffsetX}px`;
    readOnlySticker.style.top = "0px";
  }
  const previewCaption = document.getElementById("labelPreviewCaption");
  if (previewCaption) {
    const paperLabels = { "50x30mm": "50 × 30 mm", "40x20mm": "40 × 20 mm", "30x15mm": "30 × 15 mm", "58mm": "58 mm" };
    previewCaption.textContent = `Abu-abu = area printer 58 mm, putih = stiker ${paperLabels[previewSettings.paperSize] || "40 × 20 mm"}.`;
  }

  const elements = [
    { key: "Logo", label: "Logo", defaultText: "", isImage: true },
    { key: "CustomImage", label: "Gambar Dekorasi", defaultText: "", isImage: true, imageData: labelSettings.customImageData },
    { key: "DrinkName", label: "Nama Produk", defaultText: "Kopi Susu Migi" },
    { key: "Notes", label: "Catatan Varian", defaultText: "Ice * Less Sugar" },
    { key: "OrderCode", label: "Nomor Pesanan", defaultText: "#SB-001" },
    { key: "Customer", label: "Nama Pengunjung", defaultText: "Teman Migi" },
    { key: "ServiceType", label: "Metode Pesanan", defaultText: "DI" },
    { key: "Counter", label: "Nomor Item", defaultText: "[1/1]" },
    { key: "CustomText", label: "Teks Kustom", defaultText: "TEMAN", isFreeText: true },
    { key: "Barcode", label: "Barcode", defaultText: "12345678", isBarcode: true }
  ];

  const segments = [];

  elements.forEach(({ key, label, defaultText, isFreeText, isBarcode, isImage, imageData }) => {
    const previewEl = els[`labelPreview${key}`];
    const readOnlyEl = document.getElementById(`labelReadOnlyPreview${key}`);
    const enabledInput = els[`label${key}Enabled`];
    const boldInput = els[`label${key}Bold`];
    const fontSizeInput = els[`label${key}FontSize`];
    const fontSizeVal = document.getElementById(`label${key}FontSizeVal`);
    const widthHidden = document.getElementById(`label${key}Width`);
    const customTextVal = els.labelCustomTextValue;

    if (!previewEl) return;

    const enabledBySetting = enabledInput ? enabledInput.checked : (labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}Enabled`] !== false);
    const enabled = key === "CustomImage" ? enabledBySetting && Boolean(labelSettings.customImageData) : enabledBySetting;
    
    const fontSizeInputVal = fontSizeInput ? Number(fontSizeInput.value) : Number(labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}FontSize`] ?? 16);
    const fontSize = fontSizeInput
      ? normalizeLabelFontScale(fontSizeInputVal)
      : normalizeLabelFontScale(labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}FontSize`]);
    const bold = boldInput ? boldInput.checked : (labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}Bold`] === true);

    if (fontSizeVal && fontSizeInput) {
      fontSizeVal.textContent = String(fontSize);
    }

    const defaultWidths = { Logo: 32, CustomImage: 48, DrinkName: 200, Notes: 280, OrderCode: 120, Customer: 150, ServiceType: 120, Counter: 80, CustomText: 100, Barcode: 160 };
    const defaultHeights = { Logo: 32, CustomImage: 48, DrinkName: 48, Notes: 24, OrderCode: 24, Customer: 24, ServiceType: 24, Counter: 24, CustomText: 24, Barcode: 20 };
    
    let width = Number(labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}Width`] || defaultWidths[key]);
    if (widthHidden) widthHidden.value = width;

    let height = Number(labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}MaxHeight`] || defaultHeights[key]);

    let x = parseInt(previewEl.getAttribute("data-drag-x") || String(labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}X`] || (key === "Barcode" ? 60 : 12)));
    let y = parseInt(previewEl.getAttribute("data-drag-y") || String(labelSettings[`${key.charAt(0).toLowerCase() + key.slice(1)}Y`] || (key === "Barcode" ? 130 : 12)));

    previewEl.setAttribute("data-drag-x", x);
    previewEl.setAttribute("data-drag-y", y);

    let text = defaultText;
    if (isBarcode) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = String(now.getFullYear());
      text = `${dd}${mm}${yyyy}`;
    } else if (isFreeText && customTextVal) {
      text = customTextVal.value || defaultText;
    } else if (key === "ServiceType") {
      text = defaultText;
    } else if (isFreeText) {
      text = labelSettings.customTextValue || defaultText;
    }

    if (enabled) {
      let charHeight = 24;
      if (isBarcode) {
        charHeight = height + 24; // barcode height + HRI text
      } else {
        charHeight = getLabelFontMetrics(fontSize).charHeight;
      }

      segments.push({
        key,
        x,
        y,
        width,
        height,
        charHeight,
        fontSize,
        bold,
        text,
        isBarcode,
        isImage,
        imageData,
        previewEl,
        readOnlyEl,
        posVal: null
      });
    } else {
      [previewEl, readOnlyEl].forEach(el => {
        if (el) el.style.display = "none";
      });
    }
  });

  // Bitmap printing supports true absolute coordinates. Do not push elements
  // into simulated ESC/POS rows; this lets text align exactly with a barcode.
  segments.forEach((segment) => {
    segment.printedY = segment.y;
  });

  segments.forEach((segment) => {
    const { key, x, printedY, width, height, fontSize, bold, text, isBarcode, isImage, imageData, previewEl, readOnlyEl, posVal } = segment;

    let actualLineHeight = 24;
    let actualFontSize = 13;
    if (isImage) {
      [previewEl, readOnlyEl].forEach((el) => {
        if (!el) return;
        const image = el.querySelector("img");
        if (image && imageData) image.src = imageData;
        el.style.display = "block";
        el.style.left = `${x}px`;
        el.style.top = `${printedY}px`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
      });
      return;
    }
    if (isBarcode) {
      actualLineHeight = height + 24;
    } else {
      const metrics = getLabelFontMetrics(fontSize);
      actualLineHeight = metrics.charHeight;
      // Font A ESC/POS kira-kira 12 dot lebar x 24 dot tinggi.
      // Courier New 20px mendekati lebar karakter tersebut pada preview.
      actualFontSize = metrics.pixelSize;
      actualLineHeight = metrics.charHeight;
    }

    const lineClamp = Math.max(1, Math.floor(height / (isBarcode ? height : actualLineHeight)));

    [previewEl, readOnlyEl].forEach((el) => {
      if (!el) return;
      el.style.display = isBarcode ? "flex" : "block";
      el.style.left = `${x}px`;
      el.style.top = `${printedY}px`;
      el.style.width = `${width}px`;

      if (isBarcode) {
        el.style.height = `${height + 24}px`;
        const spanEl = el.querySelector("span");
        if (spanEl) spanEl.textContent = text;
        return;
      }

      el.style.fontSize = `${actualFontSize}px`;
      el.style.lineHeight = `${actualLineHeight}px`;
      el.style.fontFamily = "Geist, Arial, sans-serif";
      el.style.letterSpacing = getLabelFontMetrics(fontSize).widthMultiplier === 2 ? "12px" : "normal";
      el.style.fontWeight = bold ? "bold" : "normal";
      el.style.maxWidth = `${width}px`;

      el.style.display = "-webkit-box";
      el.style.webkitBoxOrient = "vertical";
      el.style.overflow = "hidden";
      el.style.webkitLineClamp = String(lineClamp);
      el.style.height = `${height}px`;
      el.style.maxHeight = `${height}px`;

      let textNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      if (!textNode) {
        textNode = document.createTextNode(text);
        el.insertBefore(textNode, el.firstChild);
      } else {
        textNode.textContent = text;
      }
    });
  });

  const collisionWarning = document.getElementById("labelLayoutCollisionWarning");
  if (collisionWarning) {
    const collisions = [];
    for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
        const left = segments[leftIndex];
        const right = segments[rightIndex];
        const leftHeight = left.isBarcode ? left.height + 24 : left.height;
        const rightHeight = right.isBarcode ? right.height + 24 : right.height;
        const overlapWidth = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
        const overlapHeight = Math.min(left.y + leftHeight, right.y + rightHeight) - Math.max(left.y, right.y);
        if (overlapWidth > 4 && overlapHeight > 4) collisions.push(`${left.key}–${right.key}`);
      }
    }
    const clipped = segments
      .filter((segment) => {
        const boxHeight = segment.isBarcode ? segment.height + 24 : segment.height;
        return segment.x < 0 || segment.y < 0 ||
          segment.x + segment.width > stickerWidth ||
          segment.y + boxHeight > stickerHeight;
      })
      .map((segment) => segment.key);
    if (clipped.length) {
      collisions.push(`keluar batas: ${clipped.slice(0, 2).join(", ")}`);
    }
    collisionWarning.style.display = collisions.length ? "block" : "none";
    collisionWarning.textContent = collisions.length
      ? `⚠ Ada elemen bertumpuk: ${collisions.slice(0, 3).join(", ")}${collisions.length > 3 ? ` +${collisions.length - 3}` : ""}`
      : "";
  }

  [els.labelPreviewPaper, document.getElementById("labelReadOnlyPreviewPaper")].forEach((paper) => {
    if (!paper) return;
    let parentWidth = paper.parentElement?.getBoundingClientRect().width || 0;
    if (parentWidth < 100) {
      parentWidth = paper.parentElement?.offsetWidth || 384;
    }
    if (parentWidth < 100) {
      parentWidth = 384; // Safe fallback to prevent scale(0) or scale(negative) on initial render
    }
    const padding = 32;
    const availableWidth = parentWidth - padding;
    const currentPaperWidth = parseInt(paper.style.width || "384");
    const currentPaperHeight = parseInt(paper.style.height || "160");
    if (availableWidth < currentPaperWidth && availableWidth > 0) {
      const scale = availableWidth / currentPaperWidth;
      paper.style.transform = `scale(${scale})`;
      paper.style.transformOrigin = "top center";
      paper.style.margin = `0 -${(currentPaperWidth - availableWidth) / 2}px`;
      if (paper.parentElement) paper.parentElement.style.height = `${Math.ceil(currentPaperHeight * scale)}px`;
    } else {
      paper.style.transform = "none";
      paper.style.margin = "0";
      if (paper.parentElement) paper.parentElement.style.height = `${currentPaperHeight}px`;
    }
  });
}

function initDraggableRows() {
  const items = [
    { el: els.labelPreviewLogo, key: "Logo" },
    { el: els.labelPreviewCustomImage, key: "CustomImage" },
    { el: els.labelPreviewDrinkName, key: "DrinkName" },
    { el: els.labelPreviewNotes, key: "Notes" },
    { el: els.labelPreviewOrderCode, key: "OrderCode" },
    { el: els.labelPreviewCustomer, key: "Customer" },
    { el: els.labelPreviewServiceType, key: "ServiceType" },
    { el: els.labelPreviewCounter, key: "Counter" },
    { el: els.labelPreviewCustomText, key: "CustomText" },
    { el: els.labelPreviewBarcode, key: "Barcode" }
  ];

  items.forEach(({ el, key }) => {
    if (!el) return;

    if (!el.querySelector(".label-width-handle")) {
      const widthHandleElement = document.createElement("button");
      widthHandleElement.type = "button";
      widthHandleElement.className = "label-width-handle";
      widthHandleElement.title = "Ubah lebar";
      widthHandleElement.setAttribute("aria-label", `Ubah lebar ${key}`);
      el.appendChild(widthHandleElement);
    }
    if (!el.querySelector(".label-height-handle")) {
      const heightHandleElement = document.createElement("button");
      heightHandleElement.type = "button";
      heightHandleElement.className = "label-height-handle";
      heightHandleElement.title = "Ubah tinggi";
      heightHandleElement.setAttribute("aria-label", `Ubah tinggi ${key}`);
      el.appendChild(heightHandleElement);
    }

    let isDragging = false;
    let isWidthResizing = false;
    let isHeightResizing = false;
    let startX = 0;
    let startY = 0;
    let originalLeft = 0;
    let originalTop = 0;
    let originalWidth = 0;
    let originalHeight = 0;

    const widthHandle = el.querySelector(".label-width-handle");
    const heightHandle = el.querySelector(".label-height-handle");

    if (widthHandle) {
      const onWidthResizeStart = (e) => {
        e.stopPropagation();
        e.preventDefault();
        isWidthResizing = true;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        startX = clientX;
        originalWidth = el.offsetWidth;
        el.style.borderColor = "#3b82f6";
      };
      widthHandle.addEventListener("mousedown", onWidthResizeStart);
      widthHandle.addEventListener("touchstart", onWidthResizeStart, { passive: false });
    }

    if (heightHandle) {
      const onHeightResizeStart = (e) => {
        e.stopPropagation();
        e.preventDefault();
        isHeightResizing = true;

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startY = clientY;
        originalHeight = el.offsetHeight;
        el.style.borderColor = "#3b82f6";
      };
      heightHandle.addEventListener("mousedown", onHeightResizeStart);
      heightHandle.addEventListener("touchstart", onHeightResizeStart, { passive: false });
    }

    const onDragStart = (e) => {
      if (isWidthResizing || isHeightResizing) return;
      isDragging = true;
      el.style.borderColor = "#3b82f6";
      el.style.backgroundColor = "rgba(59, 130, 246, 0.05)";
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      startX = clientX;
      startY = clientY;
      originalLeft = parseInt(el.getAttribute("data-drag-x") || el.style.left || "12");
      originalTop = parseInt(el.getAttribute("data-drag-y") || el.style.top || "12");
      
      e.preventDefault();
    };

    el.addEventListener("mousedown", onDragStart);
    el.addEventListener("touchstart", onDragStart, { passive: false });

    const onGlobalMove = (e) => {
      const stickerEl = els.labelPreviewSticker;
      const containerWidth = stickerEl ? parseInt(stickerEl.style.width || "320") : 320;
      const containerHeight = stickerEl ? parseInt(stickerEl.style.height || "160") : 160;
      const stickerRect = stickerEl?.getBoundingClientRect();
      const scaleX = stickerRect?.width ? stickerRect.width / containerWidth : 1;
      const scaleY = stickerRect?.height ? stickerRect.height / containerHeight : 1;

      if (isWidthResizing) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const dx = (clientX - startX) / Math.max(0.01, scaleX);
        let newWidth = originalWidth + dx;
        const maxAvailableWidth = containerWidth - parseInt(el.style.left || "0");
        newWidth = Math.max(30, Math.min(maxAvailableWidth, newWidth));
        
        el.style.width = `${newWidth}px`;
        el.style.maxWidth = `${newWidth}px`;

        const widthVal = document.getElementById(`label${key}Width`);
        if (widthVal) widthVal.value = newWidth;
        
      } else if (isHeightResizing) {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dy = (clientY - startY) / Math.max(0.01, scaleY);
        let newHeight = originalHeight + dy;
        const maxAvailableHeight = containerHeight - parseInt(el.style.top || "0");
        newHeight = Math.max(15, Math.min(maxAvailableHeight, newHeight));
        
        el.style.height = `${newHeight}px`;
        el.style.maxHeight = `${newHeight}px`;

      } else if (isDragging) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const dx = (clientX - startX) / Math.max(0.01, scaleX);
        const dy = (clientY - startY) / Math.max(0.01, scaleY);
        
        let newLeft = originalLeft + dx;
        let newTop = originalTop + dy;
        
        const elWidth = el.offsetWidth;
        const elHeight = el.offsetHeight;
        
        newLeft = Math.max(0, Math.min(containerWidth - elWidth, newLeft));
        newTop = Math.max(0, Math.min(containerHeight - elHeight, newTop));
        
        // Move smoothly during dragging
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;

      }
    };

    const onGlobalEnd = () => {
      if (isWidthResizing) {
        isWidthResizing = false;
        el.style.borderColor = "rgba(59, 130, 246, 0.3)";
        saveLabelPrinterSettingsFromUI();
      } else if (isHeightResizing) {
        isHeightResizing = false;
        el.style.borderColor = "rgba(59, 130, 246, 0.3)";
        saveLabelPrinterSettingsFromUI();
      } else if (isDragging) {
        isDragging = false;
        el.style.borderColor = "rgba(59, 130, 246, 0.3)";
        el.style.backgroundColor = "transparent";
        
        // Persist final dragged positions and snap to printer lines
        const finalLeft = parseInt(el.style.left || "0");
        const finalTop = parseInt(el.style.top || "0");
        el.setAttribute("data-drag-x", finalLeft);
        el.setAttribute("data-drag-y", finalTop);
        
        saveLabelPrinterSettingsFromUI();
      }
    };

    window.addEventListener("mousemove", onGlobalMove);
    window.addEventListener("touchmove", onGlobalMove, { passive: false });
    window.addEventListener("mouseup", onGlobalEnd);
    window.addEventListener("touchend", onGlobalEnd);
  });
}

function initPrinterSettings() {
  const printerSize = localStorage.getItem("kasir-migi-printer-paper-size") || "58mm";
  if (els.printerPaperSize) els.printerPaperSize.value = printerSize;

  const labelSettings = getLabelPrinterSettings();
  if (els.labelPrinterPrintEngine) els.labelPrinterPrintEngine.value = labelSettings.printEngine || "bitmap";
  if (els.labelPrinterPaperSize) {
    els.labelPrinterPaperSize.value = labelSettings.paperSize;
  }
  if (els.labelPrinterFeedMethod) els.labelPrinterFeedMethod.value = labelSettings.feedMethod;
  if (els.labelPrinterPitch) els.labelPrinterPitch.value = labelSettings.pitch;
  if (els.labelPrinterLineSpacing) els.labelPrinterLineSpacing.value = labelSettings.lineSpacing;
  if (els.labelPrinterDelay) els.labelPrinterDelay.value = labelSettings.labelDelay;
  if (els.labelPrinterMargin) els.labelPrinterMargin.value = labelSettings.labelMargin !== undefined ? labelSettings.labelMargin : 8;
  if (els.labelPrinterSpaces) els.labelPrinterSpaces.value = labelSettings.labelSpaces !== undefined ? labelSettings.labelSpaces : 0;

  if (els.labelStickerOffsetX) els.labelStickerOffsetX.value = labelSettings.stickerOffsetX !== undefined ? labelSettings.stickerOffsetX : 64;
  syncLabelOffsetLimit(labelSettings);

  const elements = ["Logo", "CustomImage", "DrinkName", "Notes", "OrderCode", "Customer", "ServiceType", "Counter", "CustomText", "Barcode"];
  elements.forEach((key) => {
    const keyLower = key.charAt(0).toLowerCase() + key.slice(1);
    const enabledInput = els[`label${key}Enabled`];
    const boldInput = els[`label${key}Bold`];
    const fontSizeInput = els[`label${key}FontSize`];
    const widthInput = document.getElementById(`label${key}Width`);
    const previewEl = els[`labelPreview${key}`];

    if (enabledInput) enabledInput.checked = labelSettings[`${keyLower}Enabled`] !== false;
    if (boldInput) boldInput.checked = labelSettings[`${keyLower}Bold`] === true;
    if (fontSizeInput) fontSizeInput.value = normalizeLabelFontScale(labelSettings[`${keyLower}FontSize`]);
    if (widthInput) widthInput.value = labelSettings[`${keyLower}Width`] !== undefined ? labelSettings[`${keyLower}Width`] : (key === "Barcode" ? 200 : 150);

    if (previewEl) {
      const savedHeight = labelSettings[`${keyLower}MaxHeight`] !== undefined
        ? labelSettings[`${keyLower}MaxHeight`]
        : (key === "Logo" ? 32 : (key === "CustomImage" ? 48 : (key === "DrinkName" ? 48 : (key === "Barcode" ? 20 : 24))));
      const renderedHeight = key === "Barcode" ? Number(savedHeight) + 24 : Number(savedHeight);
      const savedX = labelSettings[`${keyLower}X`] !== undefined ? labelSettings[`${keyLower}X`] : (key === "CustomImage" ? 260 : (key === "ServiceType" ? 214 : (key === "Barcode" ? 60 : 12)));
      const savedY = labelSettings[`${keyLower}Y`] !== undefined ? labelSettings[`${keyLower}Y`] : (key === "ServiceType" ? 88 : (key === "Barcode" ? 130 : 12));
      previewEl.style.left = `${savedX}px`;
      previewEl.style.top = `${savedY}px`;
      previewEl.setAttribute("data-drag-x", String(savedX));
      previewEl.setAttribute("data-drag-y", String(savedY));
      previewEl.style.width = `${labelSettings[`${keyLower}Width`] !== undefined ? labelSettings[`${keyLower}Width`] : (key === "CustomImage" ? 48 : (key === "Barcode" ? 200 : 150))}px`;
      previewEl.style.height = `${renderedHeight}px`;
      previewEl.style.maxHeight = `${renderedHeight}px`;
      if (key === "DrinkName" && els.labelDrinkNameHeight) {
        els.labelDrinkNameHeight.value = String(renderedHeight);
        if (els.labelDrinkNameHeightVal) els.labelDrinkNameHeightVal.textContent = String(renderedHeight);
      }
    }
  });

  if (els.labelCustomTextValue) els.labelCustomTextValue.value = labelSettings.customTextValue || "TEMAN";

  toggleLabelPrinterManualSettingsVisibility();
  updateLabelPreview();
  renderLabelSettingsSummary();
  initDraggableRows();
}

async function connectPrinter() {
  if (!navigator.bluetooth) {
    toast("Web Bluetooth belum didukung. Coba Chrome atau Brave desktop.");
    setPrinterStatus("Tidak didukung", "disconnected", "Browser ini belum mendukung Web Bluetooth.");
    return;
  }

  setPrinterStatus("Menghubungkan", "connecting", "Pilih printer thermal ESC/POS dari dialog Bluetooth.");
  try {
    state.printerDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: bleServiceUuids,
    });

    state.printerDevice.addEventListener("gattserverdisconnected", () => {
      state.printerCharacteristic = null;
      setPrinterStatus("Terputus", "disconnected", "Printer terputus. Sambungkan ulang sebelum cetak.");
      toast("Printer Bluetooth terputus.");
    });

    const server = await state.printerDevice.gatt.connect();
    let service = null;
    for (const uuid of bleServiceUuids) {
      try {
        service = await server.getPrimaryService(uuid);
        break;
      } catch {}
    }
    if (!service) {
      const services = await server.getPrimaryServices();
      service = services[0];
    }
    if (!service) throw new Error("Service printer tidak ditemukan.");

    let characteristic = null;
    for (const uuid of bleCharacteristicUuids) {
      try {
        characteristic = await service.getCharacteristic(uuid);
        break;
      } catch {}
    }
    if (!characteristic) {
      const chars = await service.getCharacteristics();
      characteristic = chars.find((entry) => entry.properties.write || entry.properties.writeWithoutResponse);
    }
    if (!characteristic) throw new Error("Characteristic printer tidak ditemukan.");

    state.printerCharacteristic = characteristic;
    setPrinterStatus("Tersambung", "connected", `${state.printerDevice.name || "Printer ESC/POS"} siap untuk cetak struk.`);
    toast("Printer termal tersambung.");
  } catch (error) {
    state.printerCharacteristic = null;
    setPrinterStatus("Terputus", "disconnected", "Koneksi gagal atau dibatalkan. Coba sambungkan lagi.");
    if (!String(error.message).toLowerCase().includes("cancel")) {
      toast(`Koneksi printer gagal: ${error.message}`);
    }
  }
}

async function connectLabelPrinter() {
  if (!navigator.bluetooth) {
    toast("Web Bluetooth belum didukung. Coba Chrome atau Brave desktop.");
    setLabelPrinterStatus("Tidak didukung", "disconnected", "Browser ini belum mendukung Web Bluetooth.");
    return;
  }

  setLabelPrinterStatus("Menghubungkan", "connecting", "Pilih printer label ESC/POS dari dialog Bluetooth.");
  try {
    state.labelPrinterDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: bleServiceUuids,
    });

    state.labelPrinterDevice.addEventListener("gattserverdisconnected", () => {
      // Tandai printer terputus agar isLabelPrinterReady() mengembalikan false,
      // tapi JANGAN null-kan characteristic di sini — job yang sedang berjalan
      // dalam antrian perlu mendeteksi ini sendiri (lewat gatt.connected) agar
      // tidak mendapat null-ref di tengah pengiriman byte.
      // characteristic di-null setelah job aktif selesai (lewat catch di performCupLabelPrint).
      setLabelPrinterStatus("Terputus", "disconnected", "Label printer terputus. Sambungkan ulang.");
      toast("Label printer Bluetooth terputus.");
    });

    const server = await state.labelPrinterDevice.gatt.connect();
    let service = null;
    for (const uuid of bleServiceUuids) {
      try { service = await server.getPrimaryService(uuid); break; } catch {}
    }
    if (!service) {
      const services = await server.getPrimaryServices();
      service = services[0];
    }
    if (!service) throw new Error("Service label printer tidak ditemukan.");

    const characteristicCandidates = [];
    for (const uuid of bleCharacteristicUuids) {
      try {
        const candidate = await service.getCharacteristic(uuid);
        if (candidate.properties.write || candidate.properties.writeWithoutResponse) {
          characteristicCandidates.push(candidate);
        }
      } catch {}
    }
    const serviceCharacteristics = await service.getCharacteristics().catch(() => []);
    serviceCharacteristics.forEach((candidate) => {
      if (
        (candidate.properties.write || candidate.properties.writeWithoutResponse) &&
        !characteristicCandidates.some((entry) => entry.uuid === candidate.uuid)
      ) {
        characteristicCandidates.push(candidate);
      }
    });
    // ACK/write-with-response jauh lebih aman untuk bitmap besar. Jangan
    // memilih characteristic pertama bila service menyediakan jalur ACK lain.
    const characteristic = characteristicCandidates.find((entry) => entry.properties.write)
      || characteristicCandidates.find((entry) => entry.properties.writeWithoutResponse)
      || null;
    if (!characteristic) {
      throw new Error("Characteristic label printer tidak ditemukan.");
    }

    state.labelPrinterCharacteristic = characteristic;
    // Kirim ESC @ melalui antrian agar tidak memotong job label yang sedang
    // berjalan. Jika antrian kosong, task ini langsung dieksekusi.
    await enqueueLabelPrint(async () => {
      if (!state.labelPrinterCharacteristic) return;
      await writePrinterChunks(
        new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x00]),
        state.labelPrinterCharacteristic,
        12,
        true,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    const transportMode = characteristic.properties.write ? "ACK aman" : "tanpa ACK · mode ekstra aman";
    setLabelPrinterStatus(
      "Tersambung",
      "connected",
      `${state.labelPrinterDevice.name || "Label Printer"} siap · ${transportMode}.`,
    );
    toast(`Label printer tersambung (${transportMode}).`);
  } catch (error) {
    state.labelPrinterCharacteristic = null;
    setLabelPrinterStatus("Terputus", "disconnected", "Koneksi gagal atau dibatalkan. Coba sambungkan lagi.");
    if (!String(error.message).toLowerCase().includes("cancel")) {
      toast(`Koneksi label printer gagal: ${error.message}`);
    }
  }
}

async function testLogoPrint() {
  if (!state.printerCharacteristic) {
    toast("Sambungkan printer dulu untuk test logo.");
    togglePrinterDropdown(true);
    return;
  }

  try {
    els.testLogoPrint.disabled = true;
    els.testLogoPrint.textContent = "Mengirim...";
    const encoder = new TextEncoder();
    const bytes = new Uint8Array([
      0x1b, 0x40,
      ...(await escPosLogoBytes()),
      ...encoder.encode("Test logo Kopi Migi\n\n"),
      0x1d, 0x56, 0x42, 0x00,
    ]);
    await writePrinterChunks(bytes);
    toast("Test logo dikirim ke printer.");
  } catch (error) {
    toast(`Test logo gagal: ${error.message}`);
  } finally {
    els.testLogoPrint.disabled = false;
    els.testLogoPrint.textContent = "Test Logo";
  }
}

async function testLabelPrint() {
  if (!isLabelPrinterReady()) {
    toast("Sambungkan printer label dulu untuk test label.");
    togglePrinterDropdown(true);
    switchPrinterTab("label");
    return;
  }

  try {
    if (els.testLabelPrint) {
      els.testLabelPrint.disabled = true;
      els.testLabelPrint.textContent = "Mengirim...";
    }
    const activeCartItem = state.cart.find((item) => isBeverageItem(item));
    const mockTransaction = {
      orderCode: els.orderTableNumber?.value.trim() || els.tableNumber?.value.trim() || "999",
      customer: els.customerName?.value.trim() || "Test Migi",
      serviceType: state.serviceType || "dine_in",
      createdAt: new Date().toISOString()
    };
    const mockItem = activeCartItem || {
      name: "KOPI SUSU MIGI",
      notes: "ICE · REGULAR · LESS SUGAR"
    };
    await enqueueLabelPrint(async () => {
      if (!isLabelPrinterReady()) throw new Error("Koneksi label printer terputus.");
      const bytes = await encodeCupLabelBitmap(mockTransaction, mockItem, 0, 1);
      await writeLabelPrinterChunks(bytes);
    });
    toast(activeCartItem
      ? `Test label ${activeCartItem.name}${activeCartItem.notes ? ` · ${activeCartItem.notes}` : ""} dikirim ke printer.`
      : "Test label contoh dikirim ke printer.");
  } catch (error) {
    toast(`Test label gagal: ${error.message}`);
  } finally {
    if (els.testLabelPrint) {
      els.testLabelPrint.disabled = false;
      els.testLabelPrint.textContent = "Test Label";
    }
  }
}

function idFromName(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;
}

function stableIdFromName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `bahan-${Date.now().toString(36)}`;
}

function itemArt(item) {
  const category = String(item.category || "").toLowerCase();
  if (category.includes("photo")) return "art-photo";
  if (category.includes("snack") || category.includes("food")) return "art-food";
  if (category.includes("non") || category.includes("milk") || category.includes("latte")) return "art-milk";
  return "art-coffee";
}

function itemVisual(item) {
  if (item.image) {
    return `<img class="item-image" src="${escapeHtml(item.image)}" alt="" />`;
  }
  return `<span class="item-art ${itemArt(item)}" aria-hidden="true">${escapeHtml(itemLabel(item))}</span>`;
}

function itemLabel(item) {
  return String(item.name || "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function isPhotoboothItem(item) {
  return Boolean(item?.boothPackage || item?.category?.toLowerCase().includes("photo"));
}

function hasPhotoboothCart() {
  return state.cart.some((entry) => isPhotoboothItem(entry));
}

function photoboothOrderQty() {
  return state.cart.reduce((sum, entry) => sum + (isPhotoboothItem(entry) ? entry.qty : 0), 0);
}

function boothPhotoCount(packageName = els.boothPackage.value) {
  return boothPackagePhotoCounts[packageName] || 2;
}

function employeeIdFromName(name) {
  return stableIdFromName(name || "Admin");
}

function activeEmployeeId() {
  return employeeIdFromName(activeEmployeeName());
}

function uniqueTransactionId(orderCode = nextDailyOrderCode()) {
  const randomPart = window.crypto?.randomUUID
    ? window.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${String(orderCode || "order").replace(/[^A-Za-z0-9-]+/g, "-")}-${Date.now().toString(36)}-${randomPart}`;
}

function normalizeDiscountValue(value = "") {
  if (state.discountType === "nominal") return parseRupiah(value);
  const number = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function parseVoucherValue(value = "", type = "percent") {
  if (type === "nominal") return parseRupiah(value);
  const number = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function appliedVoucher() {
  return voucherById(state.discountVoucherId);
}

function canUseDiscount() {
  return isLoggedIn() && state.orderType === "normal" && activeDiscountVouchers().length > 0;
}

function clearDiscountState() {
  state.discountType = "none";
  state.discountValue = 0;
  state.discountNote = "";
  state.discountVoucherId = "";
  state.pendingDiscountVoucherId = "";
  if (els.discountVoucherSelect) els.discountVoucherSelect.value = "";
  if (els.voucherDiscountInfo) els.voucherDiscountInfo.textContent = activeDiscountVouchers().length
    ? "Pilih voucher lalu tekan Apply."
    : "Belum ada voucher aktif.";
}

function discountAmount(subtotal) {
  const voucher = appliedVoucher();
  if (state.orderType === "staff_drink" || !voucher) return 0;
  const value = Number(voucher.value || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const amount = voucher.type === "percent" ? subtotal * Math.min(value, 100) / 100 : value;
  return Math.min(subtotal, Math.round(amount));
}

function applyDiscountVoucher(id = "") {
  const voucher = voucherById(id);
  if (!voucher) {
    clearDiscountState();
    renderCart();
    return false;
  }
  state.discountVoucherId = voucher.id;
  state.pendingDiscountVoucherId = "";
  state.discountType = voucher.type;
  state.discountValue = Number(voucher.value || 0);
  state.discountNote = `Voucher ${voucher.code}${voucher.note ? ` - ${voucher.note}` : ""}`;
  if (els.discountVoucherSelect) els.discountVoucherSelect.value = voucher.id;
  renderCart();
  return true;
}

function renderDiscountVoucherControls() {
  const vouchers = activeDiscountVouchers();
  if (els.discountVoucherSelect) {
    const selected = state.discountVoucherId || state.pendingDiscountVoucherId;
    els.discountVoucherSelect.innerHTML = [
      `<option value="">Tanpa voucher</option>`,
      ...vouchers.map((voucher) => `<option value="${escapeHtml(voucher.id)}">${escapeHtml(voucherLabel(voucher))}</option>`),
    ].join("");
    els.discountVoucherSelect.value = vouchers.some((voucher) => voucher.id === selected) ? selected : "";
  }
  const voucher = appliedVoucher();
  const pendingVoucher = !voucher ? voucherById(state.pendingDiscountVoucherId) : null;
  if (els.voucherDiscountInfo) {
    els.voucherDiscountInfo.textContent = voucher
      ? `${voucherLabel(voucher)} diterapkan${voucher.note ? ` - ${voucher.note}` : ""}.`
      : pendingVoucher
        ? `${voucherLabel(pendingVoucher)} dipilih. Tekan Apply untuk memakai voucher.`
      : vouchers.length
        ? "Pilih voucher lalu tekan Apply."
        : "Belum ada voucher aktif.";
  }
  if (els.applyDiscountVoucher) els.applyDiscountVoucher.disabled = !vouchers.length;
  if (els.clearDiscountVoucher) els.clearDiscountVoucher.disabled = !state.discountVoucherId && !state.pendingDiscountVoucherId;
}

function totals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountTotal = discountAmount(subtotal);
  const staffDrink = state.orderType === "staff_drink";
  return {
    subtotal,
    originalTotal: subtotal,
    discountTotal: staffDrink ? 0 : discountTotal,
    grandTotal: staffDrink ? 0 : Math.max(0, subtotal - discountTotal),
  };
}

function subtotalForItems(items = []) {
  return mergeLineItems(items).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
}

function discountForTransaction(transaction, subtotal) {
  if (isStaffDrinkTransaction(transaction)) return 0;
  const type = transaction?.discountType;
  const value = Number(transaction?.discountValue || 0);
  if (!type || type === "none" || !Number.isFinite(value) || value <= 0) return 0;
  const amount = type === "percent" ? subtotal * Math.min(value, 100) / 100 : value;
  return Math.min(subtotal, Math.round(amount));
}

function totalsForEditedTransaction(transaction, items) {
  const subtotal = subtotalForItems(items);
  const staffDrink = isStaffDrinkTransaction(transaction);
  const discountTotal = staffDrink ? 0 : discountForTransaction(transaction, subtotal);
  return {
    subtotal,
    originalTotal: subtotal,
    discountTotal,
    grandTotal: staffDrink ? 0 : Math.max(0, subtotal - discountTotal),
  };
}

function isStaffDrinkTransaction(transaction) {
  return transaction?.isStaffDrink === true || transaction?.orderType === "staff_drink";
}

function isBillTransaction(transaction = {}) {
  return String(transaction.status || "").toLowerCase() === "bill"
    || String(transaction.payment || "").toLowerCase() === "bill";
}

function isUnpaidTransaction(transaction = {}) {
  return String(transaction.status || "").toLowerCase() === "unpaid" || isBillTransaction(transaction);
}

function isPaidTransaction(transaction = {}) {
  return !isUnpaidTransaction(transaction);
}

function kitchenStatus(transaction = {}) {
  if (!isPaidTransaction(transaction)) return "";
  return String(transaction.kitchenStatus || "").toLowerCase() || "done";
}

function isKitchenPendingTransaction(transaction = {}) {
  return isPaidTransaction(transaction) && kitchenStatus(transaction) !== "done";
}

function isKitchenDoneTransaction(transaction = {}) {
  return isPaidTransaction(transaction) && kitchenStatus(transaction) === "done";
}

function revenueTransactions(list) {
  return (list || []).filter((transaction) => isPaidTransaction(transaction) && !isStaffDrinkTransaction(transaction));
}

function staffDrinkUsedToday(employee = activeEmployeeName(), date = dateKey()) {
  const employeeId = employeeIdFromName(employee);
  return getHistory().some((transaction) => (
    transaction.isStaffDrink === true &&
    transaction.staffDrinkDate === date &&
    (transaction.employeeId === employeeId || transaction.employee === employee)
  ));
}

async function staffDrinkUsedTodayRemote(employee = activeEmployeeName(), date = dateKey()) {
  if (!navigator.onLine) return false;
  const result = await postSupabaseAction("check-staff-drink", {
    employee,
    employeeId: employeeIdFromName(employee),
    date,
  });
  return Boolean(result?.used);
}

async function staffDrinkAlreadyUsedToday(employee = activeEmployeeName(), date = dateKey()) {
  if (staffDrinkUsedToday(employee, date)) return true;
  if (!navigator.onLine) return false;
  await syncPendingTransactions({ pull: false }).catch(() => null);
  if (await staffDrinkUsedTodayRemote(employee, date).catch(() => false)) return true;
  await pullTransactionsFromSupabase({ render: false }).catch(() => null);
  return staffDrinkUsedToday(employee, date);
}

function staffDrinkItemCount() {
  return state.cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

function canAddStaffDrinkItem(id = "") {
  if (state.orderType !== "staff_drink") return true;
  if (!state.cart.length) return true;
  return state.cart.length === 1 && state.cart[0]?.id === id && Number(state.cart[0]?.qty || 0) < 1;
}

function staffDrinkItemsLabel(transaction) {
  const firstItem = transaction?.items?.[0];
  if (!firstItem) return "1x Staff Drink";
  return `1x ${firstItem.name}`;
}

function syncOrderTypeUi() {
  const staffDrink = state.orderType === "staff_drink";
  const onlineChannel = isOnlineChannel(state.orderChannel);
  const staffDrinkAvailable = staffDrinkItemCount() === 1;
  if (staffDrink && !staffDrinkAvailable) {
    state.orderType = "normal";
    state.payment = state.payment === "Staff Drink" ? "Tunai" : state.payment;
  }
  els.orderTypeTabs?.querySelectorAll("button[data-order-type]").forEach((button) => {
    if (button.dataset.orderType === "staff_drink") {
      button.disabled = !staffDrinkAvailable;
      button.title = staffDrinkAvailable ? "" : "Staff Drink hanya bisa dipilih untuk tepat 1 item.";
    }
    button.classList.toggle("active", button.dataset.orderType === state.orderType);
  });
  const staffDrinkActive = state.orderType === "staff_drink";
  if (!canUseDiscount()) clearDiscountState();
  renderDiscountVoucherControls();
  if (els.staffDrinkInfo) {
    els.staffDrinkInfo.hidden = !staffDrinkActive && (staffDrinkAvailable || !state.cart.length);
    els.staffDrinkInfo.textContent = staffDrinkAvailable
      ? "Staff Drink hanya bisa digunakan 1 kali per hari per crew dan maksimal 1 item."
      : "Staff Drink hanya bisa dipilih untuk tepat 1 item.";
  }
  if (els.discountBox) els.discountBox.hidden = !canUseDiscount();
  if (els.paymentMethods) els.paymentMethods.hidden = staffDrinkActive || onlineChannel;
  if (staffDrinkActive) state.payment = "Staff Drink";
  else if (onlineChannel) state.payment = state.orderChannel;
  else if (isOnlineChannel(state.payment)) state.payment = "Tunai";
  else if (state.payment === "Staff Drink") state.payment = "Tunai";
  if (els.paidAmount) {
    const wasStaffInput = els.paidAmount.disabled;
    els.paidAmount.value = staffDrinkActive ? "0" : onlineChannel ? totals().grandTotal : wasStaffInput && state.payment === "Tunai" ? "" : els.paidAmount.value;
    els.paidAmount.disabled = staffDrinkActive || onlineChannel;
    if (!staffDrinkActive && !onlineChannel && state.payment !== "Tunai") els.paidAmount.value = totals().grandTotal;
  }
  if (els.paidAmountLabel) els.paidAmountLabel.textContent = staffDrinkActive ? "Payment" : onlineChannel ? state.orderChannel : "Dibayar";
  els.paymentMethods?.querySelectorAll("button[data-payment]").forEach((button) => {
    button.classList.toggle("active", button.dataset.payment === state.payment);
  });
  updateChange();
  if (els.dineTakeBox) els.dineTakeBox.hidden = staffDrinkActive;
  syncDineTakeUi();
}

function syncDineTakeUi() {
  els.dineTakeTabs?.querySelectorAll("button[data-service-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.serviceType === state.serviceType);
  });
}

function resetOrderAdjustments() {
  state.orderType = "normal";
  state.serviceType = "dine_in";
  clearDiscountState();
  if (els.paidAmount) {
    els.paidAmount.disabled = false;
    els.paidAmount.value = "";
  }
  state.payment = "Tunai";
  syncCheckoutWifiOption({ reset: true });
  syncOrderTypeUi();
}

function renderCategories() {
  const categories = ["Semua", ...getMenuCategories()];
  els.categoryTabs.innerHTML = categories
    .map((category) => `<button class="${category === state.category ? "active" : ""}" data-category="${category}" type="button">${category}</button>`)
    .join("");
}

function syncMenuCategoryField() {
  const isCustom = els.menuCategorySelect.value === "__custom";
  els.menuCategoryCustom.classList.toggle("hidden-field", !isCustom);
  els.menuCategoryCustom.toggleAttribute("required", isCustom);
  els.menuCategory.value = isCustom ? els.menuCategoryCustom.value.trim() : els.menuCategorySelect.value;
}

function renderMenuCategoryOptions(selectedCategory = els.menuCategory.value) {
  const categories = getMenuCategories();
  const hasSelected = categories.includes(selectedCategory);
  els.menuCategorySelect.innerHTML = [
    `<option value="" disabled ${selectedCategory ? "" : "selected"}>Pilih kategori</option>`,
    ...categories.map((category) => `<option value="${escapeHtml(category)}" ${category === selectedCategory ? "selected" : ""}>${escapeHtml(category)}</option>`),
    `<option value="__custom" ${selectedCategory && !hasSelected ? "selected" : ""}>+ Kategori baru</option>`,
  ].join("");
  els.menuCategoryCustom.value = selectedCategory && !hasSelected ? selectedCategory : "";
  syncMenuCategoryField();
}

function renderMenuGrid() {
  const keyword = state.search.toLowerCase();
  const filtered = getMenu().filter((item) => {
    const matchesCategory = state.category === "Semua" || item.category === state.category;
    const matchesSearch = `${item.name} ${item.category}`.toLowerCase().includes(keyword);
    return matchesCategory && matchesSearch;
  });

  els.menuGrid.innerHTML = filtered.length
    ? filtered
        .map(
          (item) => {
            const cartItem = state.cart.find((entry) => entry.id === item.id);
            const qty = cartItem?.qty || 0;
            const safeId = escapeHtml(item.id);
            const safeName = escapeHtml(item.name);
            const safeCategory = escapeHtml(item.category);
            return `
            <article class="menu-card ${qty ? "selected" : ""}" data-id="${safeId}" role="button" tabindex="0" aria-label="Tambah ${safeName}">
              ${qty ? `<span class="menu-qty-control"><button class="menu-qty-btn" data-menu-decrease="${safeId}" type="button" title="Kurangi ${safeName}">-</button><strong>${qty}</strong><button class="menu-qty-btn" data-menu-increase="${safeId}" type="button" title="Tambah ${safeName}">+</button></span>` : ""}
              ${itemVisual(item)}
              <span>
                <strong>${safeName}</strong>
                <span>${safeCategory} <b>${money(item.price)}</b></span>
              </span>
            </article>
          `;
          },
        )
        .join("")
    : `<div class="empty-state">Menu tidak ditemukan.</div>`;
}

function renderMenuTable() {
  const recipes = getRecipes();
  const menu = getMenu();
  const categories = [...new Set(menu.map((item) => item.category || "Tanpa Kategori"))].sort((a, b) => a.localeCompare(b, "id-ID"));
  const menuEditCategories = ["Semua", ...categories];
  if (!menuEditCategories.includes(state.menuEditCategory)) state.menuEditCategory = "Semua";
  if (els.menuEditCategoryTabs) {
    els.menuEditCategoryTabs.innerHTML = menuEditCategories
      .map((category) => `<button class="${category === state.menuEditCategory ? "active" : ""}" data-menu-edit-category="${category}" type="button">${category}</button>`)
      .join("");
  }
  const items = menu
    .filter((item) => state.menuEditCategory === "Semua" || (item.category || "Tanpa Kategori") === state.menuEditCategory)
    .filter((item) => {
      const query = state.menuEditSearch.trim().toLowerCase();
      if (!query) return true;
      return [
        item.name,
        item.category,
        money(item.price),
        String(item.price || ""),
      ].some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => (a.category || "").localeCompare(b.category || "", "id-ID") || a.name.localeCompare(b.name, "id-ID"));
  const rows = items
    .map((item) => {
      const recipeCount = recipes[item.id]?.length || 0;
      return `
          <article class="menu-row">
            <div class="menu-row-main">
              <span class="menu-thumb">${itemVisual(item)}</span>
              <div>
                <strong>${item.name}</strong>
                <span>${item.category} · ${money(item.price)} · ${recipeCount ? `${recipeCount} bahan` : "Belum ada resep"}</span>
              </div>
            </div>
            <div class="history-actions">
              <button class="secondary-button compact" data-edit-menu="${item.id}" type="button">Edit</button>
              <button class="secondary-button compact danger-text" data-delete-menu="${item.id}" type="button">Hapus</button>
            </div>
          </article>
        `;
    })
    .join("");

  els.menuTable.innerHTML = rows || `<div class="empty-state">${state.menuEditSearch ? "Menu tidak ditemukan." : "Belum ada menu."}</div>`;
}

function ingredientOptions(selectedId = "") {
  const ingredients = Object.entries(getInventory()).filter(([, item]) => item?.name);
  return ingredients.length
    ? `<option value="" disabled ${selectedId ? "" : "selected"}>Pilih bahan</option>` +
        ingredients
        .map(([id, item]) => `<option value="${id}" ${id === selectedId ? "selected" : ""}>${item.name}</option>`)
        .join("")
    : `<option value="" disabled selected>Tambahkan bahan dulu</option>`;
}

function recipeRowHtml(recipe = {}) {
  const ingredient = getInventory()[recipe.ingredientId];
  const type = recipe.type || "all";
  return `
    <div class="recipe-ingredient-row">
      <label>
        Bahan
        <select class="recipe-ingredient-select">
          ${ingredientOptions(recipe.ingredientId)}
        </select>
      </label>
      <label>
        Dipakai / porsi
        <input class="recipe-qty-input" type="number" min="0.01" step="0.01" placeholder="18" value="${recipe.qty || ""}" />
      </label>
      <label>
        Satuan
        <input class="recipe-unit-preview" type="text" value="${ingredient?.unit || ""}" disabled />
      </label>
      <label>
        Penyajian
        <select class="recipe-service-select">
          <option value="all" ${type === "all" ? "selected" : ""}>Semua</option>
          <option value="dine_in" ${type === "dine_in" ? "selected" : ""}>Dine In</option>
          <option value="take_away" ${type === "take_away" ? "selected" : ""}>Take Away</option>
        </select>
      </label>
      <button class="secondary-button compact danger-text recipe-remove-button" type="button" aria-label="Hapus bahan">Hapus</button>
    </div>
  `;
}

function renderRecipeRows(menuId = els.menuId?.value) {
  if (!els.recipeIngredientRows) return;
  const rows = getRecipes()[menuId] || [];
  renderRecipeRowsFromRows(rows);
}

function renderRecipeRowsFromRows(rows = []) {
  if (!els.recipeIngredientRows) return;
  els.recipeIngredientRows.innerHTML = rows.length ? rows.map(recipeRowHtml).join("") : recipeRowHtml();
  updateRecipeRowUnits();
}

function updateRecipeRowUnits() {
  if (!els.recipeIngredientRows) return;
  const inventory = getInventory();
  els.recipeIngredientRows.querySelectorAll(".recipe-ingredient-row").forEach((row) => {
    const select = row.querySelector(".recipe-ingredient-select");
    const unit = row.querySelector(".recipe-unit-preview");
    if (unit) unit.value = inventory[select?.value]?.unit || "";
  });
}

function recipeDraftRows() {
  const rows = Array.from(els.recipeIngredientRows?.querySelectorAll(".recipe-ingredient-row") || []);
  return rows.map((row) => ({
    ingredientId: row.querySelector(".recipe-ingredient-select")?.value || "",
    qty: row.querySelector(".recipe-qty-input")?.value || "",
    type: row.querySelector(".recipe-service-select")?.value || "all",
  }));
}

function hasMenuFormDraft() {
  if (!els.menuForm) return false;
  const hasMenuInput = Boolean(
    els.menuId?.value ||
      els.menuName?.value.trim() ||
      els.menuCategory?.value.trim() ||
      els.menuPrice?.value.trim() ||
      els.menuImage?.value,
  );
  const hasRecipeInput = recipeDraftRows().some((row) => row.ingredientId || row.qty);
  return hasMenuInput || hasRecipeInput;
}

function collectRecipeRows() {
  const inventory = getInventory();
  const rows = Array.from(els.recipeIngredientRows?.querySelectorAll(".recipe-ingredient-row") || []);
  const filledRows = [];
  for (const row of rows) {
    const ingredientId = row.querySelector(".recipe-ingredient-select")?.value || "";
    const qtyValue = row.querySelector(".recipe-qty-input")?.value || "";
    const type = row.querySelector(".recipe-service-select")?.value || "all";
    const qty = Number(qtyValue);
    if (!ingredientId && !qtyValue) continue;
    if (!inventory[ingredientId] || !Number.isFinite(qty) || qty <= 0) {
      toast("Lengkapi bahan dan jumlah pemakaian, atau kosongkan barisnya.");
      return null;
    }
    filledRows.push({ ingredientId, qty, type });
  }

  const duplicateIngredient = filledRows.find((row, index) => filledRows.findIndex((entry) => entry.ingredientId === row.ingredientId && entry.type === row.type) !== index);
  if (duplicateIngredient) {
    toast("Bahan yang sama dengan penyajian sama cukup diisi satu kali per menu.");
    return null;
  }
  return filledRows;
}

function renderRecipeOptions() {
  if (hasMenuFormDraft()) {
    renderRecipeRowsFromRows(recipeDraftRows());
    return;
  }
  renderRecipeRows(els.menuId?.value || "");
}

function stockStatus(record) {
  const stock = Number(record.stock || 0);
  const unit = record.unit || "";
  const lowLimit = unit === "pcs" ? 5 : 100;
  if (stock <= 0) return { tone: "danger", label: "Habis" };
  if (stock <= lowLimit) return { tone: "danger", label: "Akan habis" };
  return { tone: "good", label: "Aman" };
}

function stockChartPercent(record) {
  const stock = Math.max(0, Number(record.stock || 0));
  const unit = record.unit || "";
  const target = unit === "pcs" ? 20 : 1000;
  if (!target) return 0;
  return Math.min(100, Math.round((stock / target) * 100));
}

function stockEditStep(unit) {
  return unit === "pcs" ? 1 : 0.01;
}

function stockEditMax(stock, unit) {
  const base = unit === "pcs" ? 20 : 1000;
  return Math.max(base, Math.ceil(stock * 2 || 0), Math.ceil(stock + base));
}

function formatStockValue(value, unit = "") {
  return `${Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function updateStockEditSummary() {
  if (!els.stockEditForm || !els.stockEditSummary) return;
  const original = Number(els.stockEditForm.dataset.originalStock || 0);
  const unit = els.stockEditForm.dataset.unit || "";
  const next = Number(els.stockEditInput?.value || 0);
  const diff = next - original;
  if (!Number.isFinite(next)) {
    els.stockEditSummary.textContent = "Masukkan angka stock yang valid.";
    return;
  }
  if (Math.abs(diff) < 0.0001) {
    els.stockEditSummary.textContent = "Belum ada perubahan.";
    return;
  }
  const direction = diff > 0 ? "Naik" : "Turun";
  els.stockEditSummary.textContent = `${direction} ${formatStockValue(Math.abs(diff), unit)} menjadi ${formatStockValue(next, unit)}.`;
}

function syncStockEditControls(source) {
  if (!els.stockEditSlider || !els.stockEditInput) return;
  const sourceEl = source === "slider" ? els.stockEditSlider : els.stockEditInput;
  const targetEl = source === "slider" ? els.stockEditInput : els.stockEditSlider;
  const max = Number(els.stockEditSlider.max || 0);
  const value = Math.max(0, Number(sourceEl.value || 0));
  if (source === "input" && value > max) els.stockEditSlider.max = String(stockEditMax(value, els.stockEditForm?.dataset.unit || ""));
  targetEl.value = String(value);
  updateStockEditSummary();
}

function openStockEditModal(id) {
  if (!isOwner()) {
    toast("Edit stock aktif hanya untuk Owner.");
    return;
  }
  const record = getInventory()[id];
  if (!record) return;
  const stock = Number(record.stock || 0);
  const unit = record.unit || "";
  const max = stockEditMax(stock, unit);
  const step = stockEditStep(unit);
  els.stockEditForm.dataset.stockId = id;
  els.stockEditForm.dataset.originalStock = String(stock);
  els.stockEditForm.dataset.unit = unit;
  if (els.stockEditName) els.stockEditName.textContent = record.name;
  if (els.stockEditUnit) els.stockEditUnit.textContent = unit || "unit";
  if (els.stockEditCurrent) els.stockEditCurrent.textContent = formatStockValue(stock, unit);
  if (els.stockEditSlider) {
    els.stockEditSlider.min = "0";
    els.stockEditSlider.max = String(max);
    els.stockEditSlider.step = String(step);
    els.stockEditSlider.value = String(stock);
  }
  if (els.stockEditInput) {
    els.stockEditInput.min = "0";
    els.stockEditInput.step = String(step);
    els.stockEditInput.value = String(stock);
  }
  updateStockEditSummary();
  els.stockEditModal?.classList.add("open");
  els.stockEditModal?.setAttribute("aria-hidden", "false");
}

function closeStockEditModal() {
  els.stockEditModal?.classList.remove("open");
  els.stockEditModal?.setAttribute("aria-hidden", "true");
  if (els.stockEditForm) {
    delete els.stockEditForm.dataset.stockId;
    delete els.stockEditForm.dataset.originalStock;
    delete els.stockEditForm.dataset.unit;
  }
}

function openEmployeeDeleteModal(name) {
  if (!isOwner()) {
    toast("Hapus crew hanya untuk Owner.");
    return;
  }
  state.pendingEmployeeDelete = name;
  if (els.employeeDeleteName) els.employeeDeleteName.textContent = name;
  els.employeeDeleteModal?.classList.add("open");
  els.employeeDeleteModal?.setAttribute("aria-hidden", "false");
}

function closeEmployeeDeleteModal() {
  state.pendingEmployeeDelete = "";
  els.employeeDeleteModal?.classList.remove("open");
  els.employeeDeleteModal?.setAttribute("aria-hidden", "true");
}

async function confirmEmployeeDelete() {
  const name = state.pendingEmployeeDelete;
  if (!name) return;
  if (!navigator.onLine) {
    toast("Hapus crew membutuhkan koneksi internet agar data Supabase tetap konsisten.");
    return;
  }
  try {
    await deleteEmployeeInCloud(name);
  } catch {
    toast("Crew belum terhapus. Coba lagi saat koneksi stabil.");
    return;
  }
  rememberDeletedEmployee(name);
  clearEmployeeLeaveStatus(name);
  const roster = saveEmployeeRoster(getEmployeeRoster().filter((entry) => entry !== name), { dirty: true });
  const fallback = roster.find((entry) => !isEmployeeOnLeave(entry)) || "";
  if (localStorage.getItem(storageKeys.employee) === name) {
    if (fallback) localStorage.setItem(storageKeys.employee, fallback);
    else localStorage.removeItem(storageKeys.employee);
    const auth = readJson(storageKeys.auth, null);
    if (auth?.loggedIn && auth.role !== "owner") {
      if (fallback) writeJson(storageKeys.auth, { ...auth, employee: fallback });
      else logout();
    }
  }
  closeEmployeeDeleteModal();
  renderEmployeeControls();
  await Promise.allSettled([
    syncSettingsToCloud({ force: true }),
    loadCloudData(),
  ]);
  renderEmployeeControls();
  toast(`${name} dihapus dari daftar crew.`);
}

async function toggleEmployeeLeave(name) {
  if (!isOwner()) {
    toast("Status libur hanya untuk Owner.");
    return;
  }
  const onLeave = !isEmployeeOnLeave(name);
  setEmployeeLeaveStatus(name, onLeave);
  if (onLeave && localStorage.getItem(storageKeys.employee) === name) {
    const fallback = getEmployeeRoster().find((entry) => entry !== name && !isEmployeeOnLeave(entry)) || "";
    if (fallback) localStorage.setItem(storageKeys.employee, fallback);
    else localStorage.removeItem(storageKeys.employee);
  }
  renderEmployeeControls();
  try {
    await syncSettingsToCloud({ force: true });
    toast(onLeave ? `${name} ditandai libur.` : `${name} aktif kembali.`);
  } catch {
    toast(onLeave ? `${name} ditandai libur lokal, tapi sync belum berhasil.` : `${name} aktif lokal, tapi sync belum berhasil.`);
  }
}

function setPriceListOpen(open) {
  if (!els.priceListToggle || !els.priceListContent) return;
  els.priceListToggle.setAttribute("aria-expanded", open ? "true" : "false");
  els.priceListContent.classList.toggle("open", open);
}

function renderInventory() {
  if (!els.stockTable) return;
  const inventory = getInventory();
  const inventoryRows = Object.entries(inventory).filter(([, record]) => record?.name);
  const stockCategories = ingredientCategories({ includeAll: true });
  if (!stockCategories.includes(state.stockCategory)) state.stockCategory = "Semua";
  if (els.stockCategoryTabs) {
    els.stockCategoryTabs.innerHTML = stockCategories
      .map((category) => `<button class="${category === state.stockCategory ? "active" : ""}" data-stock-category="${category}" type="button">${category}</button>`)
      .join("");
  }
  renderIngredientCategoryOptions();
  const visibleInventoryRows = inventoryRows.filter(([, record]) => state.stockCategory === "Semua" || ingredientCategory(record) === state.stockCategory);
  const lowRows = inventoryRows.filter(([, record]) => stockStatus(record).tone === "danger");
  if (els.stockAlert) {
    els.stockAlert.hidden = lowRows.length === 0;
    els.stockAlert.innerHTML = lowRows.length
      ? `<strong>Alert stok menipis</strong><span>${lowRows.map(([, record]) => `${record.name}: ${Number(record.stock || 0).toLocaleString("id-ID")} ${record.unit || ""}`).join(" · ")}</span>`
      : "";
  }
  if (els.stockAvailabilityList) {
    els.stockAvailabilityList.innerHTML = visibleInventoryRows.length
      ? visibleInventoryRows
          .map(([id, record], index) => {
            const status = stockStatus(record);
            const percent = stockChartPercent(record);
            return `
            <article class="stock-chart-row stock-${status.tone}" data-edit-active-stock="${id}" tabindex="0" role="button" aria-label="Edit stock aktif ${record.name}" style="--stock-row-delay:${Math.min(index * 22, 180)}ms">
              <div class="stock-chart-copy">
                <strong>${record.name}</strong>
                <span>${ingredientCategory(record)} · Sisa stok aktif · ${status.label}</span>
              </div>
              <div class="stock-chart-meter" aria-label="${record.name} ${percent}%">
                <span class="stock-chart-fill" style="width:${percent}%;min-width:${percent ? 6 : 0}px"></span>
              </div>
              <strong class="stock-chart-value">${Number(record.stock || 0).toLocaleString("id-ID")} ${record.unit || ""}</strong>
            </article>
          `;
          })
          .join("")
      : `<div class="empty-state">Belum ada bahan baku${state.stockCategory === "Semua" ? "" : ` kategori ${state.stockCategory}`}.</div>`;
  }
  els.stockTable.innerHTML = inventoryRows.length
    ? inventoryRows
        .map(([id, record]) => {
          const unit = record.unit || "unit";
          const price = record.buyPrice ? `${money(record.buyPrice)}/${unit}` : `Belum ada harga/${unit}`;
          const updated = new Date(record.updatedAt || Date.now()).toLocaleDateString("id-ID");
          return `
        <article class="stock-row price-list-row">
          <div class="menu-row-main">
            <span class="menu-thumb item-art art-coffee"></span>
            <div>
              <strong>${record.name}</strong>
              <span>${ingredientCategory(record)} · ${price} · satuan ${unit} · update ${updated}</span>
            </div>
          </div>
          <div class="stock-row-actions">
            ${
              isOwner()
                ? `<button class="secondary-button compact" data-edit-stock="${id}" type="button">Edit Harga</button>
                   <button class="secondary-button compact danger-text" data-delete-stock="${id}" type="button">Hapus</button>`
                : ""
            }
          </div>
        </article>
      `;
        })
        .join("")
    : `<div class="empty-state">Belum ada daftar harga bahan.</div>`;

}

function selectedCashflowMonth() {
  const activePeriod = els.cashflowPeriodTabs?.querySelector("button.active")?.dataset?.cashflowPeriod || "month";
  if (activePeriod === "day") return (els.cashflowDate?.value || dateKey()).slice(0, 7);
  return els.cashflowMonth?.value || monthKey();
}

function cashflowSalesSourceForMonth(month = selectedCashflowMonth()) {
  const periodKey = `month:${month}`;
  const mergeWithLocal = (source = []) => {
    const byId = new Map();
    (source || []).forEach((entry) => {
      if (entry?.id) byId.set(entry.id, entry);
    });
    getHistory().forEach((entry) => {
      if (!entry?.id || byId.has(entry.id) || transactionReportMonth(entry) !== month) return;
      byId.set(entry.id, entry);
    });
    return [...byId.values()];
  };
  if (state.cashflowSalesPeriodKey === periodKey && Array.isArray(state.cashflowSalesTransactions)) {
    return mergeWithLocal(state.cashflowSalesTransactions);
  }
  return mergeWithLocal(analyticsSourceForMonth(month));
}

async function refreshCashflowSalesPeriod({ month = selectedCashflowMonth(), render = true, silent = true } = {}) {
  if (!navigator.onLine) return false;
  const requestId = state.cashflowSalesRequestId + 1;
  state.cashflowSalesRequestId = requestId;
  const periodKey = `month:${month}`;
  try {
    const { startDate, endDate } = monthDateRange(month);
    const result = await postSupabaseAction("get-transactions", {
      startDate,
      endDate,
      fullArchive: true,
      limit: 50000,
    });
    if (!result?.success || !Array.isArray(result.transactions)) throw new Error(result?.error || "Ambil arsip arus kas gagal.");
    if (requestId !== state.cashflowSalesRequestId) return false;
    state.cashflowSalesPeriodKey = periodKey;
    state.cashflowSalesTransactions = result.transactions;
    if (Array.isArray(result.deletedTransactions)) mergeDeletedTransactionTombstones(result.deletedTransactions);
    if (render) renderCashflow();
    return true;
  } catch (error) {
    if (!silent) toast(error.message || "Arsip arus kas belum bisa dimuat.");
    return false;
  }
}

function refreshCashflowSalesForSelection(options = {}) {
  return refreshCashflowSalesPeriod({ ...options, month: selectedCashflowMonth() });
}

function refreshActiveCashflowSales() {
  if (!document.querySelector("#view-cashflow")?.classList.contains("active")) return;
  refreshCashflowSalesForSelection({ silent: true }).catch(() => null);
}

function renderCashflow() {
  const activePeriod = els.cashflowPeriodTabs?.querySelector("button.active")?.dataset?.cashflowPeriod || "month";
  const isDaily = activePeriod === "day";
  const selectedMonthValue = els.cashflowMonth?.value || dateKey().slice(0, 7);
  const selectedDateValue = els.cashflowDate?.value || dateKey();
  if (els.cashflowMonth) els.cashflowMonth.hidden = isDaily;
  if (els.cashflowDate) els.cashflowDate.hidden = !isDaily;
  const periodLabel = isDaily ? "tanggal ini" : "bulan ini";
  const isInPeriod = (entry) => {
    const entryDate = dateKey(entry.createdAt);
    return isDaily ? entryDate === selectedDateValue : entryDate.slice(0, 7) === selectedMonthValue;
  };
  const isSaleInPeriod = (entry) => {
    const entryDate = transactionReportDate(entry);
    return isDaily ? entryDate === selectedDateValue : entryDate.slice(0, 7) === selectedMonthValue;
  };
  const salesSourceMonth = isDaily ? selectedDateValue.slice(0, 7) : selectedMonthValue;
  const periodExpenses = getCashflowExpenses().filter(isInPeriod);
  const periodSales = revenueTransactions(cashflowSalesSourceForMonth(salesSourceMonth)).filter(isSaleInPeriod);
  const salesIn = periodSales.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const totalOut = periodExpenses.reduce((sum, entry) => sum + entry.amount, 0);
  const net = salesIn - totalOut;

  if (els.cfTotalIn) els.cfTotalIn.textContent = money(salesIn);
  if (els.cfInCount) els.cfInCount.textContent = `${periodSales.length} transaksi ${periodLabel}`;
  if (els.cfTotalOut) els.cfTotalOut.textContent = money(totalOut);
  if (els.cfOutCount) els.cfOutCount.textContent = `${periodExpenses.length} pengeluaran ${periodLabel}`;
  if (els.cfNet) els.cfNet.textContent = money(net);
  if (els.cfNetLabel) els.cfNetLabel.textContent = `${net >= 0 ? "surplus" : "defisit"} ${periodLabel}`;

  const activeFilter = els.cfFilterTabs?.querySelector("button.active")?.dataset?.cfFilter || "all";
  const salesList = periodSales
    .map((entry) => ({ type: "in", category: "Masuk", label: `Penjualan · ${paidOrderDisplayCode(entry, periodSales)}`, amount: entry.grandTotal, note: entry.customer, createdAt: entry.createdAt, reportDate: transactionReportDate(entry) }));
  const expenseList = periodExpenses.map((entry) => ({
    type: "out",
    category: entry.category || "Lain-lain",
    label: entry.note,
    amount: entry.amount,
    note: `${entry.category}${entry.qty ? ` · ${Number(entry.qty).toLocaleString("id-ID")} ${entry.unit || ""}` : ""}`,
    createdAt: entry.createdAt,
    id: entry.id,
  }));

  let combined = [...salesList, ...expenseList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (activeFilter === "in") combined = combined.filter((entry) => entry.type === "in");
  if (!["all", "in"].includes(activeFilter)) combined = combined.filter((entry) => entry.type === "out" && entry.category === activeFilter);

  // Filter by search query
  const searchQuery = (els.cashflowSearch?.value || "").trim().toLowerCase();
  if (searchQuery) {
    combined = combined.filter((entry) =>
      (entry.label || "").toLowerCase().includes(searchQuery) ||
      (entry.note || "").toLowerCase().includes(searchQuery) ||
      (entry.category || "").toLowerCase().includes(searchQuery)
    );
  }

  if (els.cashflowList) {
    const grouped = combined.reduce((map, entry) => {
      const key = entry.reportDate || dateKey(entry.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
      return map;
    }, new Map());
    els.cashflowList.innerHTML = combined.length
      ? [...grouped.entries()].map(([day, entries]) => {
          const dayTotalIn = entries.filter((entry) => entry.type === "in").reduce((sum, entry) => sum + entry.amount, 0);
          const dayTotalOut = entries.filter((entry) => entry.type === "out").reduce((sum, entry) => sum + entry.amount, 0);
          return `
            <section class="cashflow-day-group">
              <div class="cashflow-day-header">
                <strong>${new Date(`${day}T12:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "short" })}</strong>
                <span>Masuk ${money(dayTotalIn)} · Keluar ${money(dayTotalOut)}</span>
              </div>
              ${entries.map((entry) => `
                <article class="history-card ${entry.type === "in" ? "cashflow-card-in" : "cashflow-card-out"}">
                  <div class="history-card-content">
                    <strong>${entry.type === "in" ? "+" : "-"}${money(entry.amount)}</strong>
                    <p>${entry.label}</p>
                    <p class="history-card-note">${entry.note} · ${new Date(entry.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  ${entry.type === "out" ? `<button class="secondary-button compact danger-text" data-delete-expense="${entry.id}" type="button">Hapus</button>` : ""}
                </article>
              `).join("")}
            </section>
          `;
        }).join("")
      : `<div class="empty-state">Belum ada mutasi kas di ${periodLabel}.</div>`;
  }
}

function syncCfExpenseNoteField() {
  if (!els.cfExpenseCategory || !els.cfExpenseNote) return;
  const category = els.cfExpenseCategory.value;
  if (category === "Bahan Baku") {
    const inventory = getInventory();
    const items = Object.entries(inventory).filter(([, record]) => record?.name);
    if (els.cfIngredientQtyWrap) els.cfIngredientQtyWrap.hidden = false;
    const currentValue = els.cfExpenseNote.value;
    const options = items.length
      ? items.map(([id, item]) => `<option value="${id}">${item.name}</option>`).join("")
      : `<option value="" disabled selected>Input bahan di Daftar Harga dulu</option>`;

    if (els.cfExpenseNote.tagName === "INPUT") {
      const select = document.createElement("select");
      select.id = "cfExpenseNote";
      select.name = "cfExpenseNote";
      select.className = els.cfExpenseNote.className;
      select.required = true;
      select.innerHTML = options;
      els.cfExpenseNote.replaceWith(select);
      els.cfExpenseNote = select;
    } else {
      els.cfExpenseNote.innerHTML = options;
    }

    if (items.some(([id]) => id === currentValue)) els.cfExpenseNote.value = currentValue;
    const selected = inventory[els.cfExpenseNote.value];
    if (els.cfExpenseUnit) els.cfExpenseUnit.value = selected?.unit || "gram";
    return;
  }
  if (els.cfIngredientQtyWrap) els.cfIngredientQtyWrap.hidden = true;
  if (els.cfExpenseQty) els.cfExpenseQty.value = "";
  if (els.cfExpenseUnit) els.cfExpenseUnit.value = "gram";
  if (els.cfExpenseNote.tagName === "SELECT") {
    const input = document.createElement("input");
    input.id = "cfExpenseNote";
    input.name = "cfExpenseNote";
    input.type = "text";
    input.className = els.cfExpenseNote.className;
    input.placeholder = "Beli gelas, bayar listrik, dll";
    input.required = true;
    els.cfExpenseNote.replaceWith(input);
    els.cfExpenseNote = input;
  } else {
    els.cfExpenseNote.placeholder = "Beli gelas, bayar listrik, dll";
  }
}

function ingredientCategory(record) {
  return record?.category || "Lainnya";
}

function ingredientCategories({ includeAll = false } = {}) {
  const fromInventory = Object.values(getInventory())
    .map((record) => ingredientCategory(record))
    .filter(Boolean);
  const categories = [...new Set([...defaultIngredientCategories, ...fromInventory])];
  return includeAll ? ["Semua", ...categories] : categories;
}

function syncIngredientCategoryField() {
  if (!els.ingredientCategorySelect || !els.ingredientCategory) return;
  const isCustom = els.ingredientCategorySelect.value === "__custom";
  els.ingredientCategoryCustom?.classList.toggle("hidden-field", !isCustom);
  els.ingredientCategoryCustom?.toggleAttribute("required", isCustom);
  els.ingredientCategory.value = isCustom ? els.ingredientCategoryCustom?.value.trim() || "" : els.ingredientCategorySelect.value;
}

function renderIngredientCategoryOptions(selectedCategory = els.ingredientCategory?.value || "Lainnya") {
  if (!els.ingredientCategorySelect) return;
  const categories = ingredientCategories();
  const hasSelected = categories.includes(selectedCategory);
  els.ingredientCategorySelect.innerHTML = [
    `<option value="" disabled ${selectedCategory ? "" : "selected"}>Pilih kategori bahan</option>`,
    ...categories.map((category) => `<option value="${category}" ${category === selectedCategory ? "selected" : ""}>${category}</option>`),
    `<option value="__custom" ${selectedCategory && !hasSelected ? "selected" : ""}>+ Kategori baru</option>`,
  ].join("");
  if (els.ingredientCategoryCustom) els.ingredientCategoryCustom.value = selectedCategory && !hasSelected ? selectedCategory : "";
  syncIngredientCategoryField();
}

function customOrderIngredientOptions(selectedId = "") {
  const inventory = Object.entries(getInventory()).filter(([, record]) => record?.name && ingredientCategory(record) === "Bean Kopi");
  return inventory.length
    ? [
        `<option value="" disabled ${selectedId ? "" : "selected"}>Pilih bean kopi</option>`,
        ...inventory
          .sort(([, a], [, b]) => String(a.name || "").localeCompare(String(b.name || ""), "id-ID"))
          .map(([id, record]) => `<option value="${id}" ${id === selectedId ? "selected" : ""}>${record.name}</option>`),
      ].join("")
    : `<option value="">Belum ada bahan kategori Bean Kopi</option>`;
}

function customStockUsageLabel(item) {
  const inventory = getInventory();
  const usage = Array.isArray(item?.customStockUsage) ? item.customStockUsage : [];
  return usage
    .map((entry) => {
      const record = inventory[entry.ingredientId] || {};
      const name = entry.ingredientName || record.name || "Bahan";
      const unit = entry.unit || record.unit || "";
      return `${name} ${Number(entry.qty || 0).toLocaleString("id-ID")} ${unit}`.trim();
    })
    .filter(Boolean)
    .join(" · ");
}

function lineItemMergeKey(item = {}) {
  const stockUsage = Array.isArray(item.customStockUsage) && item.customStockUsage.length
    ? JSON.stringify(item.customStockUsage.map((entry) => ({
        ingredientId: entry.ingredientId || "",
        qty: Number(entry.qty || 0),
        unit: entry.unit || "",
      })))
    : "";
  return [
    String(item.name || "").trim().toLowerCase(),
    String(item.category || "").trim().toLowerCase(),
    Number(item.price || 0),
    item.isCustomOrder ? "custom" : "menu",
    String(item.notes || "").trim().toLowerCase(),
    stockUsage,
  ].join("|");
}

function mergeLineItems(items = []) {
  const merged = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item) return;
    const key = lineItemMergeKey(item);
    const qty = Number(item.qty || 0);
    if (!key || qty <= 0) return;
    const current = merged.get(key);
    if (current) current.qty += qty;
    else merged.set(key, { ...item, qty });
  });
  return [...merged.values()];
}

function syncCustomOrderIngredientUnit() {
  const record = getInventory()[els.customOrderIngredient?.value];
  if (els.customOrderIngredientUnit) els.customOrderIngredientUnit.value = record?.unit || "-";
  if (els.customOrderInfo) {
    const hasBeanOptions = Object.values(getInventory()).some((item) => item?.name && ingredientCategory(item) === "Bean Kopi");
    els.customOrderInfo.textContent = record
      ? `Stock tersedia ${Number(record.stock || 0).toLocaleString("id-ID")} ${record.unit || ""}. Hanya bahan kategori Bean Kopi yang bisa dijual custom.`
      : hasBeanOptions
        ? "Pilih bean kopi yang akan dijual custom."
        : "Belum ada bahan kategori Bean Kopi. Atur kategori bahan baku dulu.";
  }
}

function openCustomOrderModal() {
  if (!Object.values(getInventory()).some((record) => record?.name && ingredientCategory(record) === "Bean Kopi")) {
    toast("Belum ada bahan kategori Bean Kopi. Atur kategori bahan baku dulu.");
    return;
  }
  els.customOrderForm?.reset();
  if (els.customOrderPrice) els.customOrderPrice.value = "";
  if (els.customOrderIngredientQty) els.customOrderIngredientQty.value = "";
  if (els.customOrderIngredient) els.customOrderIngredient.innerHTML = customOrderIngredientOptions();
  syncCustomOrderIngredientUnit();
  els.customOrderModal?.classList.add("open");
  els.customOrderModal?.setAttribute("aria-hidden", "false");
  els.customOrderIngredient?.focus();
}

function closeCustomOrderModal() {
  els.customOrderModal?.classList.remove("open");
  els.customOrderModal?.setAttribute("aria-hidden", "true");
}

function addCustomOrderToCart(event) {
  event.preventDefault();
  const price = parseRupiah(els.customOrderPrice?.value);
  const ingredientId = els.customOrderIngredient?.value;
  const ingredient = getInventory()[ingredientId];
  const ingredientQty = Number(els.customOrderIngredientQty?.value || 0);
  if (!price || !ingredient || ingredientCategory(ingredient) !== "Bean Kopi" || !Number.isFinite(ingredientQty) || ingredientQty <= 0) {
    toast("Pilih bean kopi, isi jumlah bahan, dan harga jual.");
    return;
  }
  const unit = ingredient.unit || "";
  const name = `${ingredient.name} ${Number(ingredientQty).toLocaleString("id-ID")} ${unit}`.trim();
  state.cart.push({
    id: `custom-${stableIdFromName(name)}-${Date.now().toString(36)}`,
    name,
    category: "Bean Kopi",
    price,
    qty: 1,
    isCustomOrder: true,
    customStockUsage: [{
      ingredientId,
      ingredientName: ingredient.name,
      qty: ingredientQty,
      unit: ingredient.unit || "",
    }],
  });
  closeCustomOrderModal();
  renderCart();
  renderMenuGrid();
  toast("Custom Order ditambahkan ke keranjang.");
}

function renderCart() {
  state.cart = mergeLineItems(state.cart);
  els.checkoutPanel?.classList.toggle("has-items", state.cart.length > 0);
  els.checkoutPanel?.classList.toggle("has-booth", hasPhotoboothCart());
  els.orderModal?.classList.toggle("has-booth", hasPhotoboothCart());
  els.cartTitle.textContent = state.cart.length ? `${state.cart.reduce((sum, item) => sum + item.qty, 0)} item` : "Keranjang kosong";
  els.cartList.innerHTML = state.cart.length
    ? state.cart
        .map(
          (item) => `
            <div class="cart-item">
              <div>
                <strong>${item.name}</strong>
                <span>${money(item.price)} x ${item.qty}${item.isCustomOrder ? " · Custom" : ""}</span>
                ${item.notes ? `<div class="item-notes-badge">${escapeHtml(item.notes)}</div>` : ""}
                ${item.customStockUsage ? `<small class="cart-stock-note">${customStockUsageLabel(item)}</small>` : ""}
              </div>
              <div class="item-controls">
                <button class="qty-button" data-action="decrease" data-id="${item.id}" type="button">-</button>
                <strong>${item.qty}</strong>
                <button class="qty-button" data-action="increase" data-id="${item.id}" type="button" ${state.orderType === "staff_drink" ? "disabled" : ""}>+</button>
                ${isBeverageItem(item) ? `<button class="cart-item-edit-btn" data-action="customize" data-id="${item.id}" type="button" title="Kustomisasi"><i class="ph ph-note-pencil"></i></button>` : ""}
              </div>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">Pilih menu untuk mulai order.</div>`;

  const total = totals();
  els.subtotal.textContent = money(total.subtotal);
  if (els.discountLine) els.discountLine.hidden = !total.discountTotal;
  if (els.discountTotal) els.discountTotal.textContent = `-${money(total.discountTotal)}`;
  els.grandTotal.textContent = money(total.grandTotal);
  els.cartSubtotal.textContent = money(total.subtotal);
  els.cartGrandTotal.textContent = money(total.grandTotal);
  els.checkoutBtn.disabled = !state.cart.length;
  els.checkoutBtn.innerHTML = state.cart.length
    ? `<i class="ph ph-caret-right" aria-hidden="true"></i>${state.activeDraftId ? "Update Bill" : "Process Order"}`
    : `<i class="ph ph-caret-right" aria-hidden="true"></i>Pilih Menu`;
  syncOrderTypeUi();
  updateLabelPrinterCheckoutWarning();
}

function openOrderModal() {
  const activeDraft = state.activeDraftId ? getOrderDrafts().find((entry) => entry.id === state.activeDraftId) : null;
  els.orderCustomerName.value = els.customerName.value || "Teman Migi";
  if (els.orderShift) els.orderShift.value = activeDraft?.shift || currentShiftName();
  els.orderTableNumber.value = activeDraft?.orderCode || activeDraft?.table || nextDailyOrderCode(new Date(), state.orderChannel);
  syncCheckoutWifiOption({ reset: true });
  syncOrderTypeUi();
  updateLabelPrinterCheckoutWarning();
  // Tampilkan banner printer struk jika belum tersambung
  syncReceiptPrinterWarning();
  els.modalOrderList.innerHTML = state.cart.length
    ? state.cart
        .map(
          (item) => `
            <article class="modal-order-row">
              <div class="modal-order-copy">
                <strong>${item.name}</strong>
                <span>${item.category} · ${money(item.price)}${item.customStockUsage ? ` · ${customStockUsageLabel(item)}` : ""}</span>
              </div>
              <div class="modal-order-qty">${item.qty}x</div>
              <strong class="modal-order-price">${money(item.price * item.qty)}</strong>
            </article>
          `,
        )
        .join("")
      : `<div class="empty-state">Keranjang kosong.</div>`;
  els.orderModal.classList.add("open");
  els.orderModal.setAttribute("aria-hidden", "false");
}

function closeOrderModal() {
  els.orderModal.classList.remove("open");
  els.orderModal.setAttribute("aria-hidden", "true");
}

function ensurePhotoboothCode(item) {
  if (!isPhotoboothItem(item)) return;
  if (item.boothPackage) els.boothPackage.value = item.boothPackage;
  if (!state.pendingBoothCode) state.pendingBoothCode = generateBoothCode();
  els.latestBoothCode.textContent = state.pendingBoothCode;
  upsertPendingBoothSession();
}

function syncPhotoboothCodeFromCart() {
  const boothItem = state.cart.find((entry) => isPhotoboothItem(entry));
  if (boothItem) {
    ensurePhotoboothCode(boothItem);
    return;
  }
  removePendingBoothSession();
  state.pendingBoothCode = "";
  els.latestBoothCode.textContent = "Belum ada";
}

function upsertPendingBoothSession(transaction = null) {
  if (!state.pendingBoothCode || !hasPhotoboothCart()) return "";
  const code = state.pendingBoothCode;
  const packageName = els.boothPackage.value || "classic";
  const now = new Date();
  const localSessions = getBoothSessions();
  const legacySessions = getLegacyBoothSessions();
  const customer = transaction?.customer || els.customerName.value.trim() || "Teman Migi";
  const transactionId = transaction?.id || "PENDING";
  const localIndex = localSessions.findIndex((session) => session.id === code);
  const legacyIndex = legacySessions.findIndex((session) => session.code === code);
  const localSession = {
    id: code,
    createdAt: transaction?.createdAt || localSessions[localIndex]?.createdAt || now.toISOString(),
    customer,
    package: packageName,
    photoCount: boothPhotoCount(packageName),
    printQuantity: transaction?.boothPrintQuantity || photoboothOrderQty(),
    transactionId,
    status: localSessions[localIndex]?.status || "Belum dipakai",
    image: localSessions[localIndex]?.image || "",
  };
  const legacySession = {
    code,
    status: legacySessions[legacyIndex]?.status || "unused",
    createdAt: legacySessions[legacyIndex]?.createdAt || now.getTime(),
    customer,
    package: packageName,
    photoCount: boothPhotoCount(packageName),
    printQuantity: transaction?.boothPrintQuantity || photoboothOrderQty(),
    transactionId,
  };

  if (localIndex >= 0) localSessions[localIndex] = { ...localSessions[localIndex], ...localSession };
  else localSessions.unshift(localSession);
  if (legacyIndex >= 0) legacySessions[legacyIndex] = { ...legacySessions[legacyIndex], ...legacySession };
  else legacySessions.unshift(legacySession);

  writeJson(storageKeys.booth, localSessions.slice(0, 50));
  saveLegacyBoothSessions(legacySessions.slice(0, 100));
  sendBoothServerAction("create", code, legacySession);
  return code;
}

function removePendingBoothSession() {
  if (!state.pendingBoothCode) return;
  const code = state.pendingBoothCode;
  writeJson(
    storageKeys.booth,
    getBoothSessions().filter((session) => !(session.id === code && session.status !== "Selesai")),
  );
  saveLegacyBoothSessions(getLegacyBoothSessions().filter((session) => !(session.code === code && session.status === "unused")));
  sendBoothServerAction("delete", code);
}

function addToCart(id) {
  const item = getMenu().find((entry) => entry.id === id);
  if (!item) return;
  if (!canAddStaffDrinkItem(id)) {
    toast("Staff Drink hanya untuk 1 item.");
    return;
  }
  const existing = state.cart.find((entry) => entry.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ ...item, qty: 1 });

  ensurePhotoboothCode(item);

  renderCart();
  renderMenuGrid();
}

async function startOrder(event) {
  event.preventDefault();
  if (state.orderProcessing) return;
  const isPayingUnpaidOrder = Boolean(state.activeDraftId);
  setOrderProcessing(true, "Mencetak...");
  try {
    if (!state.cart.length) return;
    if (!validateStockForCart()) return;
    if (state.orderType === "staff_drink" && staffDrinkItemCount() !== 1) {
      window.alert("Staff Drink hanya bisa diproses untuk 1 item.");
      return;
    }
    if (state.orderType === "staff_drink" && await staffDrinkAlreadyUsedToday()) {
      window.alert(`Jatah kopi gratis untuk ${activeEmployeeName()} hari ini sudah digunakan.`);
      return;
    }
    const pendingLabelCount = labelItemCount();
    if (pendingLabelCount > 0 && !isLabelPrinterReady()) {
      toast(`Label printer belum tersambung. Order tetap diproses; ${pendingLabelCount} label cetak ulang dari tab Order.`);
    }
    if (!ensurePrinterReadyForOrderPrint()) return;
    els.customerName.value = els.orderCustomerName.value.trim();
    els.tableNumber.value = els.orderTableNumber.value.trim();
    const transaction = currentTransaction(false);
    if (!isOnlineChannel(transaction.channel) && state.payment === "Tunai" && transaction.paid < transaction.grandTotal) {
      toast("Nominal tunai belum cukup.");
      if (els.paidAmount) els.paidAmount.focus();
      return;
    }
    closeOrderModal();
    transaction.boothCode = createBoothQueue(transaction);
    clearPendingDelete("transaction", transaction.id);
    const stockChanged = deductStockForTransaction(transaction);
    if (stockChanged) transaction.stockSyncedAt = transaction.createdAt;
    const history = getHistory();
    history.unshift(transaction);
    writeJson(storageKeys.history, history.slice(0, 2000));
    const offlineRecord = {
      ...transaction,
      localId: transaction.id,
      idempotencyKey: state.activeDraftId ? `${transaction.id}-paid` : transaction.id,
      syncStatus: "PENDING_SYNC",
      printStatus: "PRINT_PENDING",
    };
    await saveOfflineTransaction(offlineRecord).catch(() => null);
    if (navigator.onLine) await syncPendingTransactions({ pull: false }).catch(() => null);
    
    // Order baru mencetak struk dan label. Saat bill dari tab Belum Dibayar
    // dilunasi, label sudah dicetak ketika bill dibuat sehingga tidak dicetak
    // otomatis lagi. Cetak ulang tetap tersedia lewat tombol Cetak Label Cup.
    const printed = await printReceipt(transaction, "paid");
    if (!isPayingUnpaidOrder) printCupLabels(transaction).catch(() => null);
    
    transaction.printStatus = printed ? "PRINTED" : "PRINT_FAILED";
    patchLocalHistoryTransaction(transaction.id, { printStatus: transaction.printStatus });
    await updateOfflineTransaction(transaction.localId || transaction.id, { printStatus: transaction.printStatus }).catch(() => null);
    
    state.cart = [];
    state.pendingBoothCode = "";
    els.paidAmount.value = "";
    els.customerName.value = "";
    els.tableNumber.value = "";
    els.boothPackage.value = "classic";
    if (els.orderShift) els.orderShift.value = currentShiftName();
    setOrderChannel("Kasir");
    resetOrderAdjustments();
    if (state.activeDraftId) {
      saveOrderDrafts(getOrderDrafts().filter((entry) => entry.id !== state.activeDraftId));
      state.activeDraftId = "";
    }
    renderAll();
    syncPendingTransactions();
    if (stockChanged) syncInventoryToCloud().catch(() => null);
    
    // Setelah checkout order normal → pindah ke tab Order > Diproses
    if (transaction.orderType !== "staff_drink") {
      setActiveView("orders");
      state.orderStatus = "kitchen";
      els.orderStatusTabs?.querySelectorAll("button[data-order-status]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.orderStatus === "kitchen");
      });
      renderOrders();
    }
    
    if (printed) {
      toast(transaction.boothCode ? `Checkout selesai. Kode photobooth: ${transaction.boothCode}` : "Checkout selesai. Segera buat pesanan! ☕");
    } else {
      toast(transaction.boothCode ? `Checkout tersimpan. Kode photobooth: ${transaction.boothCode}. Sambungkan printer lalu cetak ulang.` : "Checkout tersimpan. Sambungkan printer lalu cetak ulang.");
    }
    completeDeferredShiftLogout();
  } finally {
    setOrderProcessing(false);
  }
}

function changeQty(id, delta) {
  const item = state.cart.find((entry) => entry.id === id);
  if (!item) return;
  if (state.orderType === "staff_drink" && delta > 0) {
    toast("Staff Drink hanya untuk 1 item.");
    return;
  }
  item.qty += delta;
  if (item.qty <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
  syncPhotoboothCodeFromCart();
  renderCart();
  renderMenuGrid();
}

function updateChange() {
  const paid = parseRupiah(els.paidAmount.value);
  els.changeDue.textContent = money(Math.max(0, paid - totals().grandTotal));
}

function setOrderChannel(channel = "Kasir") {
  state.orderChannel = channel;
  els.orderChannels?.querySelectorAll("button[data-channel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.channel === channel);
  });
  if (els.orderModal?.getAttribute("aria-hidden") === "false" && !state.activeDraftId) {
    els.orderTableNumber.value = nextDailyOrderCode(new Date(), state.orderChannel);
  }
  if (isOnlineChannel(channel)) {
    state.payment = channel;
    if (els.paidAmount) els.paidAmount.value = totals().grandTotal;
  } else if (isOnlineChannel(state.payment)) {
    state.payment = "Tunai";
    if (els.paidAmount) els.paidAmount.value = "";
  }
  syncOrderTypeUi();
}

function currentTransaction(draft = false) {
  const total = totals();
  const transactionItems = mergeLineItems(state.cart);
  const staffDrink = !draft && state.orderType === "staff_drink";
  const onlineChannel = !staffDrink && isOnlineChannel(state.orderChannel);
  const payment = staffDrink ? "Staff Drink" : onlineChannel ? state.orderChannel : state.payment;
  const paid = staffDrink ? 0 : onlineChannel ? total.grandTotal : parseRupiah(els.paidAmount.value);
  const now = new Date();
  const existingDraft = state.activeDraftId ? getOrderDrafts().find((entry) => entry.id === state.activeDraftId) : null;
  const displayedOrderCode = els.orderTableNumber.value.trim() || existingDraft?.orderCode || nextDailyOrderCode(now, state.orderChannel);
  const generatedId = state.activeDraftId || uniqueTransactionId(displayedOrderCode);
  const selectedShift = normalizeShift(els.orderShift?.value || existingDraft?.shift || currentShiftName(now));
  const orderType = staffDrink ? "staff_drink" : "normal";
  const voucher = orderType === "normal" ? appliedVoucher() : null;
  const discountAllowed = Boolean(voucher);
  return {
    id: generatedId,
    updatedAt: now.toISOString(),
    orderCode: displayedOrderCode,
    createdAt: existingDraft?.createdAt || now.toISOString(),
    customer: els.customerName.value.trim() || "Teman Migi",
    table: els.tableNumber.value.trim() || displayedOrderCode,
    shift: selectedShift,
    channel: state.orderChannel || "Kasir",
    status: draft ? "unpaid" : "paid",
    kitchenStatus: draft ? "" : (staffDrink ? "done" : "pending"),
    kitchenCompletedAt: staffDrink ? new Date().toISOString() : "",
    employee: activeEmployeeName(),
    employeeId: activeEmployeeId(),
    dutyRole: currentDutyRole(),
    orderType,
    serviceType: staffDrink ? "dine_in" : (state.serviceType || "dine_in"),
    isStaffDrink: staffDrink,
    staffDrinkDate: staffDrink ? dateKey(now) : "",
    discountVoucherId: discountAllowed ? voucher.id : "",
    discountCode: discountAllowed ? voucher.code : "",
    discountType: discountAllowed ? voucher.type : undefined,
    discountValue: discountAllowed ? Number(voucher.value || 0) : 0,
    discountTotal: discountAllowed ? total.discountTotal : 0,
    discountNote: discountAllowed ? state.discountNote : "",
    originalTotal: total.originalTotal,
    payment,
    printWifiQr: !draft && Boolean(els.checkoutWifiReceipt?.checked) && canPrintWifiReceipt(),
    boothPackage: hasPhotoboothCart() ? els.boothPackage.value : "none",
    boothPrintQuantity: photoboothOrderQty(),
    boothCode: "",
    sendToBooth: hasPhotoboothCart(),
    paid,
    change: onlineChannel ? 0 : Math.max(0, paid - total.grandTotal),
    items: transactionItems.map(({ id, name, category, price, qty, notes, printLabel, isCustomOrder, customStockUsage }) => ({
      id,
      name,
      category,
      price,
      qty,
      ...(notes ? { notes } : {}),
      ...(typeof printLabel === "boolean" ? { printLabel } : {}),
      ...(isCustomOrder ? { isCustomOrder: true } : {}),
      ...(customStockUsage ? { customStockUsage } : {}),
    })),
    ...total,
  };
}

function requiredIngredientsForItems(items, serviceType = state.serviceType) {
  const recipes = getRecipes();
  const servType = serviceType || "dine_in";
  return items.reduce((required, item) => {
    (recipes[item.id] || []).forEach((recipe) => {
      const recipeType = recipe.type || "all";
      if (recipeType === "all" || recipeType === servType) {
        required[recipe.ingredientId] = (required[recipe.ingredientId] || 0) + Number(recipe.qty || 0) * Number(item.qty || 0);
      }
    });
    (item.customStockUsage || []).forEach((usage) => {
      if (!usage.ingredientId) return;
      required[usage.ingredientId] = (required[usage.ingredientId] || 0) + Number(usage.qty || 0) * Number(item.qty || 0);
    });
    return required;
  }, {});
}

function ingredientUsageFromHistory(history = []) {
  const inventory = getInventory();
  const usage = history
    .filter(isPaidTransaction)
    .reduce((required, entry) => {
      const items = Array.isArray(entry.items) ? entry.items : [];
      const itemRequired = requiredIngredientsForItems(items, entry.serviceType);
      Object.entries(itemRequired).forEach(([ingredientId, qty]) => {
        required[ingredientId] = (required[ingredientId] || 0) + Number(qty || 0);
      });
      return required;
    }, {});

  return Object.entries(usage)
    .map(([ingredientId, qty]) => {
      const record = inventory[ingredientId] || {};
      return {
        id: ingredientId,
        name: record.name || ingredientId,
        category: record.category || "Lainnya",
        unit: record.unit || "",
        qty,
      };
    })
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "id-ID"));
}

function validateStockForCart() {
  const inventory = getInventory();
  const required = requiredIngredientsForItems(state.cart);
  const missing = Object.entries(required).find(([ingredientId, qty]) => Number(inventory[ingredientId]?.stock || 0) < qty);
  if (!missing) return true;
  const [ingredientId, qty] = missing;
  const ingredient = inventory[ingredientId];
  toast(`Stok bahan ${ingredient?.name || "baku"} tidak cukup. Butuh ${qty.toLocaleString("id-ID")} ${ingredient?.unit || ""}, tersedia ${Number(ingredient?.stock || 0).toLocaleString("id-ID")}.`);
  return false;
}

function deductStockForTransaction(transaction) {
  const inventory = getInventory();
  const required = requiredIngredientsForItems(transaction.items, transaction.serviceType);
  let changed = false;
  Object.entries(required).forEach(([ingredientId, qty]) => {
    if (!inventory[ingredientId]) return;
    inventory[ingredientId].stock = Math.max(0, Number(inventory[ingredientId].stock || 0) - qty);
    inventory[ingredientId].updatedAt = transaction.createdAt;
    changed = true;
  });
  if (changed) saveLocalInventoryChange(inventory);
  return changed;
}

function stockDeltaByIngredient(oldItems = [], newItems = [], serviceType = state.serviceType) {
  const oldRequired = requiredIngredientsForItems(oldItems, serviceType);
  const newRequired = requiredIngredientsForItems(newItems, serviceType);
  const ids = new Set([...Object.keys(oldRequired), ...Object.keys(newRequired)]);
  return [...ids].reduce((delta, id) => {
    const diff = Number(newRequired[id] || 0) - Number(oldRequired[id] || 0);
    if (diff) delta[id] = diff;
    return delta;
  }, {});
}

function applyStockDeltaForEdit(oldItems = [], newItems = [], timestamp = new Date().toISOString(), serviceType = state.serviceType) {
  const delta = stockDeltaByIngredient(oldItems, newItems, serviceType);
  const entries = Object.entries(delta);
  if (!entries.length) return { changed: false };
  const inventory = getInventory();
  const missing = entries.find(([ingredientId, qty]) => qty > 0 && Number(inventory[ingredientId]?.stock || 0) < qty);
  if (missing) {
    const [ingredientId, qty] = missing;
    const ingredient = inventory[ingredientId] || {};
    return {
      changed: false,
      error: `Stok ${ingredient.name || "bahan"} tidak cukup untuk koreksi. Butuh tambahan ${Number(qty).toLocaleString("id-ID")} ${ingredient.unit || ""}.`,
    };
  }
  entries.forEach(([ingredientId, qty]) => {
    if (!inventory[ingredientId]) return;
    inventory[ingredientId].stock = Math.max(0, Number(inventory[ingredientId].stock || 0) - Number(qty || 0));
    inventory[ingredientId].updatedAt = timestamp;
  });
  saveLocalInventoryChange(inventory);
  return { changed: true };
}

async function syncTodayStockFromSales() {
  if (!isOwner()) {
    toast("Sinkron stok hanya untuk Owner.");
    return;
  }
  const today = dateKey();
  const history = getHistory();
  const inventory = getInventory();
  const syncedAt = new Date().toISOString();
  let transactionCount = 0;
  let ingredientCount = 0;
  let skippedNoRecipe = 0;
  let stockChanged = false;

  history.forEach((transaction) => {
    if (dateKey(transaction.createdAt) !== today) return;
    if (transaction.status && transaction.status !== "paid") return;
    if (transaction.stockSyncedAt) return;

    const required = requiredIngredientsForItems(transaction.items || [], transaction.serviceType);
    const entries = Object.entries(required).filter(([ingredientId, qty]) => inventory[ingredientId] && Number(qty || 0) > 0);
    if (!entries.length) {
      skippedNoRecipe += 1;
      return;
    }

    entries.forEach(([ingredientId, qty]) => {
      inventory[ingredientId].stock = Math.max(0, Number(inventory[ingredientId].stock || 0) - Number(qty || 0));
      inventory[ingredientId].updatedAt = syncedAt;
      ingredientCount += 1;
      stockChanged = true;
    });
    transaction.stockSyncedAt = syncedAt;
    transactionCount += 1;
  });

  if (!transactionCount) {
    toast(skippedNoRecipe ? "Tidak ada transaksi bersisa dengan resep bahan." : "Stok hari ini sudah sinkron.");
    return;
  }

  saveLocalInventoryChange(inventory);
  writeJson(storageKeys.history, history);
  renderAll();
  await Promise.allSettled([syncInventoryToCloud(), syncHistoryToCloud()]);
  toast(`Stok disinkronkan dari ${transactionCount} transaksi (${ingredientCount} bahan).`);
  if (!stockChanged) toast("Tidak ada stok berubah.");
}

function groupedReceiptItems(items = []) {
  const groups = new Map();
  mergeLineItems(items).forEach((item) => {
    const category = item.category || "Lainnya";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  const preferred = ["Kopi", "Manual Brew", "Non Kopi", "Snack", "Photobooth", "Lainnya"];
  return [...groups.entries()].sort(([a], [b]) => {
    const ai = preferred.includes(a) ? preferred.indexOf(a) : preferred.indexOf("Lainnya");
    const bi = preferred.includes(b) ? preferred.indexOf(b) : preferred.indexOf("Lainnya");
    return ai - bi || a.localeCompare(b);
  });
}

function receiptHtml(transaction, kind = "paid") {
  const rawDisplayCode = receiptDisplayCode(transaction, kind);
  const rawTableLabel = receiptTableLabel(transaction, rawDisplayCode);
  const displayCode = escapeHtml(rawDisplayCode);
  const tableLabel = escapeHtml(rawTableLabel);
  const paymentMethod = escapeHtml(transactionPaymentMethod(transaction));
  const paidAmount = isOnlineChannel(transaction.channel) ? Number(transaction.grandTotal || 0) : Number(transaction.paid || 0);
  const itemLines = groupedReceiptItems(transaction.items)
    .map(([category, items]) => `
      <p class="receipt-category">${escapeHtml(category)}</p>
      ${items
        .map(
          (item) => `
            <div class="receipt-line">
              <span class="receipt-item-name">${escapeHtml(item.qty)}x ${escapeHtml(item.name)}</span>
              ${kind === "bill" ? "" : `<span class="receipt-item-price">${money(item.price * item.qty)}</span>`}
            </div>
          `,
        )
        .join("")}
    `)
    .join("");
  const staffDrink = isStaffDrinkTransaction(transaction);
  const discountLine = !staffDrink && Number(transaction.discountTotal || 0) > 0
    ? `<div class="receipt-line"><span>Diskon${transaction.discountNote ? ` (${escapeHtml(transaction.discountNote)})` : ""}</span><span>-${money(transaction.discountTotal)}</span></div>`
    : "";
  const totalsBlock = kind === "bill"
    ? ""
    : `
    <div class="receipt-rule"></div>
    ${staffDrink ? `<div class="receipt-line"><span>Harga asli</span><span>${money(transaction.originalTotal || transaction.subtotal || 0)}</span></div>` : discountLine}
    <div class="receipt-total"><span>Total</span><span>${money(transaction.grandTotal)}</span></div>
    <div class="receipt-line"><span>${paymentMethod}</span><span>${money(paidAmount)}</span></div>
    <div class="receipt-line"><span>Kembali</span><span>${money(transaction.change)}</span></div>
    ${staffDrink ? `<p>Catatan: Jatah 1 kopi per hari</p>` : ""}
    `;

  return `
    <img class="receipt-logo" src="/assets/logo-migi.png" alt="Logo Kopi Migi" />
    <h2>Kopi Migi</h2>
    ${kind === "bill" ? "" : staffDrink ? "<p>STAFF DRINK / JATAH CREW</p>" : "<p>LUNAS</p>"}
    <p>Kode: ${displayCode}</p>
    <p>${escapeHtml(new Date(transaction.createdAt).toLocaleString("id-ID"))}</p>
    <p>Kasir: ${escapeHtml(transactionEmployeeDisplay(transaction))} (${escapeHtml(transactionShift(transaction))})</p>
    <p>Channel: ${escapeHtml(transaction.channel || "Kasir")}</p>
    ${!staffDrink ? `<p>Penyajian: ${transaction.serviceType === "take_away" ? "Take Away (Bungkus)" : "Dine In (Makan Sini)"}</p>` : ""}
    <p>Customer: ${escapeHtml(transaction.customer)}</p>
    <p>Nomor: ${tableLabel}</p>
    <div class="receipt-rule"></div>
    ${itemLines}
    ${totalsBlock}
    ${transaction.boothPackage !== "none" ? `<div class="receipt-rule"></div><p>Photobooth: ${escapeHtml(transaction.boothPackage)}</p><p>Kode: ${escapeHtml(transaction.boothCode || "-")}</p>` : ""}
    <div class="receipt-rule"></div>
    <p class="receipt-thanks">Terima kasih sudah mampir ke Kopi Migi. Ditunggu kembali ya!</p>
    <p class="receipt-cta">Semoga harimu menyenangkan :)</p>
  `;
}

async function printReceipt(transaction, kind = "paid") {
  els.receiptPaper.innerHTML = receiptHtml(transaction, kind);
  if (state.printerCharacteristic) {
    return printThermalReceipt(transaction, kind);
  }
  // Fallback ke sistem cetak bawaan browser/sistem jika printer termal BLE tidak tersambung
  window.print();
  return true;
}

function receiptText(transaction, kind = "paid", { includeFooter = true } = {}) {
  const width = els.printerPaperSize.value === "80mm" ? 42 : 32;
  const staffDrink = isStaffDrinkTransaction(transaction);
  const displayCode = receiptDisplayCode(transaction, kind);
  const tableLabel = receiptTableLabel(transaction, displayCode);
  const paymentMethod = transactionPaymentMethod(transaction);
  const paidAmount = isOnlineChannel(transaction.channel) ? Number(transaction.grandTotal || 0) : Number(transaction.paid || 0);
  const line = "-".repeat(width);
  const right = (label, value) => `${label}${String(value).padStart(Math.max(1, width - label.length), " ")}`;
  const itemLine = (label, value) => {
    const price = String(value);
    const maxLabel = Math.max(8, width - price.length - 1);
    const cleanLabel = String(label).length > maxLabel ? `${String(label).slice(0, maxLabel - 1)}.` : String(label);
    return `${cleanLabel}${price.padStart(Math.max(1, width - cleanLabel.length), " ")}`;
  };
  const center = (text) => {
    const clean = String(text);
    const left = Math.max(0, Math.floor((width - clean.length) / 2));
    return `${" ".repeat(left)}${clean}`;
  };

  const rows = [
    center("Kopi Migi"),
    ...(kind === "bill" ? [] : [center(staffDrink ? "STAFF DRINK" : "STRUK LUNAS")]),
    line,
    `Kode: ${displayCode}`,
    new Date(transaction.createdAt).toLocaleString("id-ID"),
    `Kasir: ${transactionEmployeeDisplay(transaction)} (${transactionShift(transaction)})`,
    `Channel: ${transaction.channel || "Kasir"}`,
    ...(!staffDrink ? [`Penyajian: ${transaction.serviceType === "take_away" ? "Take Away (Bungkus)" : "Dine In (Makan Sini)"}`] : []),
    `Customer: ${transaction.customer}`,
    `Nomor: ${tableLabel}`,
    line,
  ];

  groupedReceiptItems(transaction.items).forEach(([category, items]) => {
    rows.push(`[${category}]`);
    items.forEach((item) => {
      const label = `${item.qty}x ${item.name}`;
      if (kind === "bill") rows.push(label);
      else rows.push(itemLine(label, money(item.price * item.qty)));
    });
  });

  if (kind !== "bill") {
    rows.push(line);
    if (staffDrink) rows.push(right("Harga asli", money(transaction.originalTotal || transaction.subtotal || 0)));
    if (!staffDrink && Number(transaction.discountTotal || 0) > 0) {
      rows.push(right("Diskon", `-${money(transaction.discountTotal)}`));
      if (transaction.discountNote) rows.push(`Note: ${transaction.discountNote}`);
    }
    rows.push(right("TOTAL", money(transaction.grandTotal)));
    rows.push(right(paymentMethod, money(paidAmount)));
    rows.push(right("Kembali", money(transaction.change)));
    if (staffDrink) rows.push("Jatah 1 kopi per hari");
  }
  if (transaction.boothCode) {
    rows.push(line);
    rows.push(`Photobooth: ${transaction.boothPackage}`);
    rows.push(`Kode akses: ${transaction.boothCode}`);
  }
  rows.push(line);
  if (includeFooter) {
    rows.push(center("Terima kasih sudah mampir."));
    rows.push(center("Ditunggu kembali di Kopi Migi :)"));
  }
  return `${rows.join("\n")}${includeFooter ? "\n\n\n" : "\n"}`;
}

function encodeEscPos(text) {
  const encoder = new TextEncoder();
  const init = [0x1b, 0x40, 0x1b, 0x61, 0x00];
  const body = [...encoder.encode(text)];
  const feedBeforeCut = [0x1b, 0x64, 0x04];
  const cut = [0x1d, 0x56, 0x42, 0x00];
  return new Uint8Array([...init, ...body, ...feedBeforeCut, ...cut]);
}

async function escPosLogoBytes() {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Logo PNG tidak bisa dibaca browser."));
    img.src = "assets/logo-migi-print.png";
  });

  const targetWidth = els.printerPaperSize.value === "80mm" ? 128 : 96;
  const ratio = image.height / image.width;
  const width = Math.ceil(targetWidth / 8) * 8;
  const height = Math.max(1, Math.round(width * ratio));
  const widthBytes = Math.ceil(width / 8);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#faf8ff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const raster = [];
  for (let y = 0; y < height; y += 1) {
    for (let xByte = 0; xByte < widthBytes; xByte += 1) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit += 1) {
        const x = xByte * 8 + bit;
        if (x >= width) continue;
          const index = (y * width + x) * 4;
          const alpha = pixels[index + 3];
          const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
          if (alpha > 24 && luminance < 170) byte |= 0x80 >> bit;
        }
      raster.push(byte);
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  return [
    0x1b, 0x61, 0x01,
    0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH,
    ...raster,
    0x0a, 0x1b, 0x61, 0x00,
  ];
}

async function escPosLabelLogoBytes() {
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Logo stiker tidak terbaca."));
      img.src = "/assets/logo-migi-print.png";
    });

    const targetWidth = 48; // Lebar logo mini (6mm) agar muat di stiker 2cm
    const ratio = image.height / image.width;
    const width = Math.ceil(targetWidth / 8) * 8;
    const height = Math.max(1, Math.round(width * ratio));
    const widthBytes = Math.ceil(width / 8);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#faf8ff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const pixels = ctx.getImageData(0, 0, width, height).data;
    const raster = [];
    for (let y = 0; y < height; y += 1) {
      for (let xByte = 0; xByte < widthBytes; xByte += 1) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit += 1) {
          const x = xByte * 8 + bit;
          if (x >= width) continue;
          const index = (y * width + x) * 4;
          const alpha = pixels[index + 3];
          const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
          if (alpha > 24 && luminance < 170) byte |= 0x80 >> bit;
        }
        raster.push(byte);
      }
    }

    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    return [
      0x1b, 0x61, 0x01, // Center
      0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH,
      ...raster,
      0x0a, // Line feed
      0x1b, 0x61, 0x00, // Left align kembali
    ];
  } catch (err) {
    console.warn("Logo stiker tidak dimuat:", err);
    return []; // Return empty array if logo fails to load (fallback to text-only stiker)
  }
}

function escapeWifiQrValue(value = "") {
  return String(value).replace(/([\\;,"])/g, "\\$1");
}

function wifiQrPayload(transaction = {}) {
  const settings = getWifiReceiptSettings();
  if (transaction.printWifiQr !== true) return "";
  if (!settings.ssid || !settings.password) return "";
  return `WIFI:T:${settings.security};S:${escapeWifiQrValue(settings.ssid)};P:${escapeWifiQrValue(settings.password)};;`;
}

function escPosWifiQrBytes(payload) {
  const data = [...new TextEncoder().encode(payload)];
  const storeLength = data.length + 3;
  const pL = storeLength & 0xff;
  const pH = (storeLength >> 8) & 0xff;
  return [
    0x1b, 0x61, 0x01,
    ...new TextEncoder().encode("Scan untuk terhubung\n"),
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06,
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
    0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...data,
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    0x0a,
    ...new TextEncoder().encode("Terima kasih sudah mampir.\nDitunggu kembali di Kopi Migi :)\n"),
    0x1b, 0x61, 0x00,
  ];
}

async function encodeEscPosReceipt(transaction, kind) {
  const encoder = new TextEncoder();
  const init = [0x1b, 0x40];
  const wifiPayload = kind === "paid" ? wifiQrPayload(transaction) : "";
  const body = [...encoder.encode(receiptText(transaction, kind, { includeFooter: !wifiPayload }))];
  const wifiBlock = wifiPayload ? escPosWifiQrBytes(wifiPayload) : [];
  const feedBeforeCut = [0x1b, 0x64, 0x04];
  const cut = [0x1d, 0x56, 0x42, 0x00];
  try {
    return new Uint8Array([...init, ...(await escPosLogoBytes()), ...body, ...wifiBlock, ...feedBeforeCut, ...cut]);
  } catch {
    return new Uint8Array([...init, ...body, ...wifiBlock, ...feedBeforeCut, ...cut]);
  }
}

async function writePrinterChunks(
  bytes,
  characteristic = state.printerCharacteristic,
  chunkDelayMs = 18,
  preferResponse = false,
  { burstEvery = 0, burstPauseMs = 0, chunkSize = 20 } = {},
) {
  if (!characteristic) return;
  // Maksimum umum BLE adalah 20 byte; mode tanpa ACK dapat memakai paket
  // lebih kecil agar bridge UART tidak kehilangan bagian awal raster.
  const safeChunkSize = Math.max(8, Math.min(20, Number(chunkSize || 20)));
  const canWriteWithResponse = characteristic.properties.write;
  const canWriteWithoutResponse = characteristic.properties.writeWithoutResponse;
  for (let index = 0; index < bytes.length; index += safeChunkSize) {
    const chunk = bytes.slice(index, index + safeChunkSize);
    if (preferResponse && canWriteWithResponse) {
      // ACK per chunk prevents large raster jobs from overflowing the BLE buffer.
      await characteristic.writeValueWithResponse(chunk);
    } else if (canWriteWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (canWriteWithResponse) {
      // writeValueWithResponse menggantikan writeValue() yang sudah deprecated
      await characteristic.writeValueWithResponse(chunk);
    } else {
      throw new Error("Characteristic printer tidak mendukung write.");
    }
    // ACK BLE hanya memastikan modul Bluetooth menerima paket; buffer UART
    // menuju printer tetap dapat penuh. Hormati delay juga pada write-response.
    const effectiveDelay = chunkDelayMs;
    if (effectiveDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, effectiveDelay));
    }
    const chunkNumber = Math.floor(index / safeChunkSize) + 1;
    if (burstEvery > 0 && burstPauseMs > 0 && chunkNumber % burstEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, burstPauseMs));
    }
  }
}

async function writeLabelPrinterChunks(bytes) {
  const characteristic = state.labelPrinterCharacteristic;
  if (!characteristic || !isLabelPrinterReady()) {
    throw new Error("Koneksi label printer tidak siap.");
  }

  // Reset parser sebagai paket tersendiri, lalu beri waktu firmware masuk ke
  // mode ESC/POS sebelum header raster dikirim. Ini mencegah byte bitmap
  // dibaca sebagai karakter saat printer baru menyala atau buffer belum stabil.
  await writePrinterChunks(
    new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x00]),
    characteristic,
    20,
    true,
  );
  const hasWriteResponse = Boolean(characteristic.properties.write);
  await new Promise((resolve) => setTimeout(resolve, hasWriteResponse ? 150 : 350));

  // Header GS v 0 sepanjang 13 byte dikirim terpisah agar parser sudah
  // mengunci ukuran raster sebelum aliran piksel dimulai.
  const rasterHeaderLength = (
    bytes.length >= 13 &&
    bytes[0] === 0x1b && bytes[1] === 0x40 &&
    bytes[5] === 0x1d && bytes[6] === 0x76 && bytes[7] === 0x30
  ) ? 13 : 0;
  if (rasterHeaderLength) {
    await writePrinterChunks(
      bytes.slice(0, rasterHeaderLength),
      characteristic,
      hasWriteResponse ? 20 : 50,
      true,
      { chunkSize: hasWriteResponse ? 20 : 13 },
    );
    await new Promise((resolve) => setTimeout(resolve, hasWriteResponse ? 60 : 200));
  }

  // BLE pacing teroptimasi: writeWithResponse sudah mendapat ACK GATT dari printer,
  // sehingga delay antar-chunk cukup 2ms agar cetak jauh lebih cepat dan hemat baterai.
  const transportDelayMs = hasWriteResponse ? 2 : 20;
  const burstEvery = hasWriteResponse ? 30 : 12;
  const burstPauseMs = hasWriteResponse ? 15 : 100;
  await writePrinterChunks(
    rasterHeaderLength ? bytes.slice(rasterHeaderLength) : bytes,
    characteristic,
    transportDelayMs,
    true,
    {
      burstEvery,
      burstPauseMs,
      chunkSize: hasWriteResponse ? 20 : 16,
    },
  );
  await new Promise((resolve) => setTimeout(resolve, hasWriteResponse ? 40 : 300));
}

function enqueueLabelPrint(task) {
  const job = labelPrintQueue
    .catch(() => null)
    .then(task);
  // Tail tidak boleh berhenti permanen bila satu job gagal.
  labelPrintQueue = job.catch(() => null);
  return job;
}

// Kategori yang TIDAK perlu cetak label cup (makanan, non-minuman)
const SKIP_LABEL_CATEGORIES = ["makanan", "snack", "pastry", "foto", "photo", "booth", "merchandise", "merch"];

function isBeverageItem(item) {
  // Prioritaskan saklar printLabel per produk jika didefinisikan
  if (item.printLabel === false) return false;
  if (item.printLabel === true) return true;

  // Transaksi lama belum menyimpan printLabel pada item. Untuk cetak ulang,
  // tetap hormati pengaturan menu terkini sebelum memakai fallback kategori.
  const menuItem = getMenu().find((entry) => entry.id === item.id);
  if (menuItem?.printLabel === false) return false;
  if (menuItem?.printLabel === true) return true;

  // Fallback berdasarkan kategori jika properti belum diset
  const cat = String(item.category || "").toLowerCase();
  return !SKIP_LABEL_CATEGORIES.some((kw) => cat.includes(kw));
}

function isLabelPrinterReady() {
  if (!state.labelPrinterCharacteristic) return false;
  const gatt = state.labelPrinterDevice?.gatt;
  return !gatt || gatt.connected;
}

function labelItemCount(items = state.cart) {
  return (items || []).reduce(
    (total, item) => total + (isBeverageItem(item) ? Math.max(1, Number(item.qty || 1)) : 0),
    0,
  );
}

function updateLabelPrinterCheckoutWarning() {
  if (els.printerBadge) {
    els.printerBadge.classList.toggle("hidden", isLabelPrinterReady());
  }
  // Icon label printer di header modal
  if (!els.labelPrinterWarningBtn) return;
  const count = labelItemCount();
  const show = count > 0 && !isLabelPrinterReady();
  els.labelPrinterWarningBtn.hidden = !show;
  if (show) {
    const noun = count === 1 ? "label" : `${count} label`;
    els.labelPrinterWarningBtn.title = `Printer label belum tersambung. ${noun} bisa dicetak ulang dari tab Order.`;
  }
}

let cachedMascotBytes = null;
async function getMascotLogoBytes() {
  if (cachedMascotBytes) return cachedMascotBytes;
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Mascot logo failed to load."));
      img.src = "/assets/logo-miginew-transparent.png";
    });

    const size = 64; // 64px mascot
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, size, size);

    const pixels = ctx.getImageData(0, 0, size, size).data;
    const raster = [];
    const widthBytes = size / 8;
    for (let y = 0; y < size; y++) {
      for (let xByte = 0; xByte < widthBytes; xByte++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xByte * 8 + bit;
          const index = (y * size + x) * 4;
          const alpha = pixels[index + 3];
          const luminance = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
          if (alpha > 128 && luminance < 180) {
            byte |= (0x80 >> bit);
          }
        }
        raster.push(byte);
      }
    }

    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = size & 0xff;
    const yH = (size >> 8) & 0xff;

    cachedMascotBytes = [
      0x1b, 0x61, 0x01, // Center align for mascot
      0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH,
      ...raster,
      0x0a, // Line feed
      0x1b, 0x61, 0x00  // Reset to left align
    ];
    return cachedMascotBytes;
  } catch (err) {
    console.warn("Mascot failed to load:", err);
    return [];
  }
}

async function encodeCupLabel(transaction, item, itemIndex, totalItems) {
  const labelSettings = getLabelPrinterSettings();
  const feedMethod = labelSettings.feedMethod;
  const { width: stickerWidth, height: stickerHeight } = getLabelPaperDimensions(labelSettings);

  const toTitleCase = (str) => {
    return String(str || "")
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const drinkName = toTitleCase(item.name || "Minuman");
  const counter = `[${itemIndex + 1}/${totalItems}]`;
  const orderNum = transaction.orderCode || "-";
  const customer = transaction.customer || "Teman Migi";
  const notesText = item.notes || "ICE · NORMAL · REGULAR";
  const tags = notesText.split(" · ").filter(Boolean).map(toTitleCase);
  const variantLine = tags.join(" * ");

  const stickerOffsetX = labelSettings.stickerOffsetX !== undefined ? Number(labelSettings.stickerOffsetX) : 64;

  // Compile list of active elements
  const rawElements = [
    { key: "DrinkName", text: drinkName, enabled: labelSettings.drinkNameEnabled !== false, bold: labelSettings.drinkNameBold !== false, fontSize: normalizeLabelFontScale(labelSettings.drinkNameFontSize), x: labelSettings.drinkNameX !== undefined ? labelSettings.drinkNameX : 12, y: labelSettings.drinkNameY !== undefined ? labelSettings.drinkNameY : 12, width: labelSettings.drinkNameWidth !== undefined ? labelSettings.drinkNameWidth : 200, height: labelSettings.drinkNameMaxHeight !== undefined ? labelSettings.drinkNameMaxHeight : 48 },
    { key: "Notes", text: variantLine, enabled: labelSettings.notesEnabled !== false, bold: labelSettings.notesBold === true, fontSize: normalizeLabelFontScale(labelSettings.notesFontSize), x: labelSettings.notesX !== undefined ? labelSettings.notesX : 12, y: labelSettings.notesY !== undefined ? labelSettings.notesY : 48, width: labelSettings.notesWidth !== undefined ? labelSettings.notesWidth : 280, height: labelSettings.notesMaxHeight !== undefined ? labelSettings.notesMaxHeight : 24 },
    { key: "OrderCode", text: `#${orderNum}`, enabled: labelSettings.orderCodeEnabled !== false, bold: labelSettings.orderCodeBold === true, fontSize: normalizeLabelFontScale(labelSettings.orderCodeFontSize), x: labelSettings.orderCodeX !== undefined ? labelSettings.orderCodeX : 12, y: labelSettings.orderCodeY !== undefined ? labelSettings.orderCodeY : 84, width: labelSettings.orderCodeWidth !== undefined ? labelSettings.orderCodeWidth : 120, height: labelSettings.orderCodeMaxHeight !== undefined ? labelSettings.orderCodeMaxHeight : 24 },
    { key: "Customer", text: customer, enabled: labelSettings.customerEnabled !== false, bold: labelSettings.customerBold === true, fontSize: normalizeLabelFontScale(labelSettings.customerFontSize), x: labelSettings.customerX !== undefined ? labelSettings.customerX : 12, y: labelSettings.customerY !== undefined ? labelSettings.customerY : 110, width: labelSettings.customerWidth !== undefined ? labelSettings.customerWidth : 150, height: labelSettings.customerMaxHeight !== undefined ? labelSettings.customerMaxHeight : 24 },
    { key: "Counter", text: counter, enabled: labelSettings.counterEnabled !== false, bold: labelSettings.counterBold === true, fontSize: normalizeLabelFontScale(labelSettings.counterFontSize), x: labelSettings.counterX !== undefined ? labelSettings.counterX : 240, y: labelSettings.counterY !== undefined ? labelSettings.counterY : 84, width: labelSettings.counterWidth !== undefined ? labelSettings.counterWidth : 80, height: labelSettings.counterMaxHeight !== undefined ? labelSettings.counterMaxHeight : 24 },
    { key: "CustomText", text: labelSettings.customTextValue || "TEMAN", enabled: labelSettings.customTextEnabled === true, bold: labelSettings.customTextBold !== false, fontSize: normalizeLabelFontScale(labelSettings.customTextFontSize), x: labelSettings.customTextX !== undefined ? labelSettings.customTextX : 150, y: labelSettings.customTextY !== undefined ? labelSettings.customTextY : 12, width: labelSettings.customTextWidth !== undefined ? labelSettings.customTextWidth : 100, height: labelSettings.customTextMaxHeight !== undefined ? labelSettings.customTextMaxHeight : 24 }
  ];

  // Add barcode if enabled
  const txDate = transaction.createdAt ? new Date(transaction.createdAt) : new Date();
  const dd = String(txDate.getDate()).padStart(2, '0');
  const mm = String(txDate.getMonth() + 1).padStart(2, '0');
  const yyyy = String(txDate.getFullYear());
  const barcodeValue = `${dd}${mm}${yyyy}`;

  if (labelSettings.barcodeEnabled === true) {
    rawElements.push({
      key: "Barcode",
      text: barcodeValue,
      enabled: true,
      isBarcode: true,
      x: labelSettings.barcodeX !== undefined ? labelSettings.barcodeX : 60,
      y: labelSettings.barcodeY !== undefined ? labelSettings.barcodeY : 130,
      width: labelSettings.barcodeWidth !== undefined ? labelSettings.barcodeWidth : 200,
      height: labelSettings.barcodeMaxHeight !== undefined ? labelSettings.barcodeMaxHeight : 20
    });
  }

  // Filter only active elements
  const activeElements = rawElements.filter(el => el.enabled && el.text);

  // Group elements into vertical rows (same physics as preview)
  const segments = activeElements.map(el => {
    let charHeight = 24;
    if (el.isBarcode) {
      charHeight = el.height + 24;
    } else {
      charHeight = getLabelFontMetrics(el.fontSize).charHeight;
    }
    return { ...el, charHeight };
  });

  segments.sort((a, b) => a.y - b.y);

  const printRows = [];
  for (const segment of segments) {
    let foundRow = printRows.find(r => Math.abs(r.y - segment.y) < 12);
    if (!foundRow) {
      foundRow = {
        y: segment.y,
        segments: [],
        maxCharHeight: 0
      };
      printRows.push(foundRow);
    }
    foundRow.segments.push(segment);
    if (segment.charHeight > foundRow.maxCharHeight) {
      foundRow.maxCharHeight = segment.charHeight;
    }
  }

  printRows.sort((a, b) => a.y - b.y);

  // Re-calculate printedY
  let currentYCalculated = 0;
  printRows.forEach(row => {
    let feedDots = row.y - currentYCalculated;
    if (feedDots < 0) feedDots = 0;
    const printedY = currentYCalculated + feedDots;
    row.segments.forEach(segment => {
      segment.printedY = printedY;
    });
    row.printedY = printedY;
    currentYCalculated = printedY + row.maxCharHeight;
  });

  // ESC/POS Command Compilation
  const ESC = 0x1b, GS = 0x1d;
  const init = [ESC, 0x40];
  let payload = [];
  payload.push(...init);

  // EPPOS dapat menyimpan line spacing/margin dari job sebelumnya. Kunci
  // keduanya agar posisi fisik mengikuti koordinat preview setiap kali cetak.
  const lineSpacing = Math.max(0, Math.min(255, Number(labelSettings.lineSpacing || 20)));
  payload.push(ESC, 0x61, 0x00); // left alignment
  payload.push(GS, 0x4c, 0x00, 0x00); // reset printer left margin
  payload.push(ESC, 0x33, lineSpacing); // explicit line spacing

  const encoder = new TextEncoder();
  let currentY = 0;

  printRows.forEach(row => {
    // EPPOS tidak konsisten memperlakukan ESC J sebagai dot feed pada mode
    // stiker. Gunakan LF dengan line spacing eksplisit agar satu baris tidak
    // meloncat ke label fisik berikutnya.
    const rowHeight = Math.max(1, Math.min(255, row.maxCharHeight));
    payload.push(ESC, 0x33, rowHeight);
    const gapDots = Math.max(0, row.printedY - currentY);
    const blankLines = Math.max(0, Math.round(gapDots / rowHeight) - 1);
    for (let blank = 0; blank < blankLines; blank += 1) payload.push(0x0a);
    currentY += blankLines * rowHeight;

    // Sort segments from left to right to prevent head backward travel issues
    row.segments.sort((a, b) => a.x - b.x);

    row.segments.forEach((segment, segmentIndex) => {
      // 2. Set absolute X position
      const posX = stickerOffsetX + segment.x;
      const nL = posX & 0xff;
      const nH = (posX >> 8) & 0xff;
      payload.push(ESC, 0x24, nL, nH);

      if (segment.isBarcode) {
        // Native ESC/POS Barcode printing
        // Set barcode width (1 dot for compact size)
        payload.push(GS, 0x77, 0x01);
        // Set barcode height
        payload.push(GS, 0x68, segment.height);
        // Set HRI position below barcode
        payload.push(GS, 0x48, 0x02);
        // Print CODE39 barcode (CODE39 needs asterisks wrapping to scan correctly)
        payload.push(GS, 0x6b, 0x04);
        const barcodeText = `*${segment.text}*`;
        payload.push(...encoder.encode(barcodeText));
        payload.push(0x00); // Terminator
      } else {
        // Regular Text
        // Set font family. Some EPPOS firmware ignores ESC M, so also set
        // the equivalent ESC ! font-B bit for the smallest native font.
        const fontMetrics = getLabelFontMetrics(segment.fontSize);
        payload.push(ESC, 0x4d, fontMetrics.fontByte);
        payload.push(ESC, 0x21, fontMetrics.fontByte === 1 ? 0x01 : 0x00);
        // Set bold
        payload.push(ESC, 0x45, segment.bold ? 1 : 0);
        
        // Set font size multiplier
        payload.push(GS, 0x21, fontMetrics.sizeByte);

        // Batasi teks ke kotak elemen, tepi stiker, dan elemen berikutnya pada baris yang sama.
        const nextSegment = row.segments[segmentIndex + 1];
        const widthToLabelEdge = stickerWidth - segment.x;
        const widthToNextElement = nextSegment ? nextSegment.x - segment.x - 4 : widthToLabelEdge;
        const availableWidth = Math.max(0, Math.min(segment.width, widthToLabelEdge, widthToNextElement));
        const fittedText = fitLabelText(segment.text, availableWidth, segment.fontSize);
        payload.push(...encoder.encode(fittedText));
      }
    });

    // 3. Print the line and advance exactly one configured printer row.
    payload.push(0x0a);
    currentY = Math.max(currentY, row.printedY) + rowHeight;
  });

  // Cut/feed settings
  if (feedMethod === "gap") {
    // Do not feed remaining height manually, let the printer's gap sensor do it
    payload.push(GS, 0x0c); 
  } else {
    // Feed sampai pitch berikutnya secara tepat; nilai dapat dikalibrasi sesuai gap fisik roll.
    const pitch = Math.max(stickerHeight, Number(labelSettings.pitch || stickerHeight));
    const remainingFeed = pitch - currentY;
    if (remainingFeed > 0) {
      let rem = remainingFeed;
      while (rem > 255) {
        payload.push(ESC, 0x4a, 255);
        rem -= 255;
      }
      payload.push(ESC, 0x4a, rem);
    }
  }

  payload.push(ESC, 0x32); // restore printer default line spacing for next job

  return new Uint8Array(payload);
}

// Render one label as a monochrome bitmap so the printer receives the same
// font, positions, and wrapping that the preview uses. This is slower than
// native text but avoids firmware-specific ESC/POS font differences.
async function encodeCupLabelBitmap(transaction, item, itemIndex, totalItems) {
  const settings = getLabelPrinterSettings();
  if (document.fonts?.load) {
    await document.fonts.load("16px Geist");
  }
  const { width: stickerWidth, height: stickerHeight } = getLabelPaperDimensions(settings);
  const printerWidth = LABEL_PRINTER_WIDTH_DOTS;
  // Kalibrasi fisik roll 40 mm yang dipakai sebelum perubahan terakhir.
  // Clamp per-elemen tetap tidak digunakan agar objek tidak saling menumpuk.
  const physicalCalibrationX = settings.paperSize === "40x20mm" ? 20 : 0;
  const offsetX = Math.max(0, Math.min(printerWidth - 1, Number(settings.stickerOffsetX || 0) + physicalCalibrationX));
  const titleCase = (value) => String(value || "").toLowerCase().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const txDate = transaction.createdAt ? new Date(transaction.createdAt) : new Date();
  const barcodeValue = `${String(txDate.getDate()).padStart(2, "0")}${String(txDate.getMonth() + 1).padStart(2, "0")}${txDate.getFullYear()}`;
  const tags = String(item.notes || "ICE · NORMAL · REGULAR").split(" · ").filter(Boolean).map(titleCase);
  const elements = [
    { text: "logo", enabled: settings.logoEnabled === true, isImage: true, imageSrc: "assets/logo-migi-print.png", x: settings.logoX ?? 12, y: settings.logoY ?? 12, width: settings.logoWidth ?? 32, height: settings.logoMaxHeight ?? 32 },
    { text: "custom-image", enabled: settings.customImageEnabled === true && Boolean(settings.customImageData), isImage: true, imageSrc: settings.customImageData, x: settings.customImageX ?? 260, y: settings.customImageY ?? 12, width: settings.customImageWidth ?? 48, height: settings.customImageMaxHeight ?? 48 },
    { text: titleCase(item.name || "Minuman"), enabled: settings.drinkNameEnabled !== false, bold: settings.drinkNameBold !== false, fontSize: settings.drinkNameFontSize, x: settings.drinkNameX ?? 12, y: settings.drinkNameY ?? 12, width: settings.drinkNameWidth ?? 200, height: settings.drinkNameMaxHeight ?? 48 },
    { text: tags.join(" * "), enabled: settings.notesEnabled !== false, bold: settings.notesBold === true, fontSize: settings.notesFontSize, x: settings.notesX ?? 12, y: settings.notesY ?? 48, width: settings.notesWidth ?? 280, height: settings.notesMaxHeight ?? 24 },
    { text: `#${transaction.orderCode || "-"}`, enabled: settings.orderCodeEnabled !== false, bold: settings.orderCodeBold === true, fontSize: settings.orderCodeFontSize, x: settings.orderCodeX ?? 12, y: settings.orderCodeY ?? 84, width: settings.orderCodeWidth ?? 120, height: settings.orderCodeMaxHeight ?? 24 },
    { text: transaction.customer || "Teman Migi", enabled: settings.customerEnabled !== false, bold: settings.customerBold === true, fontSize: settings.customerFontSize, x: settings.customerX ?? 12, y: settings.customerY ?? 110, width: settings.customerWidth ?? 150, height: settings.customerMaxHeight ?? 24 },
    { text: transaction.serviceType === "take_away" ? "TA" : "DI", enabled: settings.serviceTypeEnabled !== false, bold: false, fontSize: settings.serviceTypeFontSize ?? 16, x: settings.serviceTypeX ?? 214, y: settings.serviceTypeY ?? 88, width: settings.serviceTypeWidth ?? 64, height: settings.serviceTypeMaxHeight ?? 24 },
    { text: `[${itemIndex + 1}/${totalItems}]`, enabled: settings.counterEnabled !== false, bold: settings.counterBold === true, fontSize: settings.counterFontSize, x: settings.counterX ?? 240, y: settings.counterY ?? 84, width: settings.counterWidth ?? 80, height: settings.counterMaxHeight ?? 24 },
    { text: settings.customTextValue || "TEMAN", enabled: settings.customTextEnabled === true, bold: settings.customTextBold !== false, fontSize: settings.customTextFontSize, x: settings.customTextX ?? 150, y: settings.customTextY ?? 12, width: settings.customTextWidth ?? 100, height: settings.customTextMaxHeight ?? 24 },
    { text: barcodeValue, enabled: settings.barcodeEnabled === true, barcode: true, x: settings.barcodeX ?? 60, y: settings.barcodeY ?? 130, width: settings.barcodeWidth ?? 200, height: settings.barcodeMaxHeight ?? 20 }
  ].filter((element) => element.enabled && (element.text || element.isImage));

  const loadedImages = new Map();
  await Promise.all(elements.filter((element) => element.isImage && element.imageSrc).map((element) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      loadedImages.set(element.imageSrc, image);
      resolve();
    };
    image.onerror = resolve;
    image.src = element.imageSrc;
  })));

  const canvas = document.createElement("canvas");
  canvas.width = printerWidth;
  canvas.height = Math.max(1, stickerHeight);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  // Samakan perilaku dengan overflow:hidden pada stiker di live preview.
  // Elemen yang melewati tepi dipotong, bukan digeser kembali ke kiri.
  ctx.save();
  ctx.beginPath();
  ctx.rect(offsetX, 0, stickerWidth, stickerHeight);
  ctx.clip();
  elements.forEach((element) => {
    const x = offsetX + Number(element.x || 0);
    const y = Number(element.y || 0);
    if (element.isImage) {
      const sourceImage = loadedImages.get(element.imageSrc);
      if (!sourceImage) return;
      const logoCanvas = document.createElement("canvas");
      logoCanvas.width = Math.max(1, Math.round(element.width));
      logoCanvas.height = Math.max(1, Math.round(element.height));
      const logoCtx = logoCanvas.getContext("2d", { willReadFrequently: true });
      logoCtx.fillStyle = "#ffffff";
      logoCtx.fillRect(0, 0, logoCanvas.width, logoCanvas.height);
      logoCtx.drawImage(sourceImage, 0, 0, logoCanvas.width, logoCanvas.height);
      const logoPixels = logoCtx.getImageData(0, 0, logoCanvas.width, logoCanvas.height);
      for (let index = 0; index < logoPixels.data.length; index += 4) {
        const luminance = 0.299 * logoPixels.data[index] + 0.587 * logoPixels.data[index + 1] + 0.114 * logoPixels.data[index + 2];
        const dark = logoPixels.data[index + 3] > 30 && luminance < 180;
        logoPixels.data[index] = dark ? 0 : 255;
        logoPixels.data[index + 1] = dark ? 0 : 255;
        logoPixels.data[index + 2] = dark ? 0 : 255;
        logoPixels.data[index + 3] = 255;
      }
      logoCtx.putImageData(logoPixels, 0, 0);
      ctx.drawImage(logoCanvas, x, y);
      return;
    }
    if (element.barcode) {
      const barWidth = Math.max(1, Math.floor(Math.min(element.width, 72) / (element.text.length * 8)));
      for (let i = 0; i < element.text.length * 8; i += 1) {
        if ((i + element.text.charCodeAt(i % element.text.length)) % 3 !== 1) ctx.fillRect(x + i * barWidth, y, barWidth, element.height);
      }
      ctx.font = "9px Courier New, monospace";
      ctx.fillText(element.text, x, y + element.height + 2);
      return;
    }
    const metrics = getLabelFontMetrics(element.fontSize);
    const px = metrics.pixelSize;
    ctx.font = `${element.bold ? "bold " : ""}${px}px Geist, Arial, sans-serif`;
    // Kotak teks preview memakai padding 4px kiri, 12px kanan, 2px atas,
    // dan 6px bawah. Terapkan content-box yang sama pada bitmap cetak.
    const textX = x + 4;
    const textY = y + 2;
    const maxWidth = Math.max(1, Number(element.width || 0) - 16);
    const maxHeight = Math.max(metrics.charHeight, Number(element.height || metrics.charHeight) - 8);
    const words = String(element.text).trim().split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    const maxLines = Math.max(1, Math.floor(maxHeight / metrics.charHeight));
    lines.slice(0, maxLines).forEach((textLine, lineIndex) => {
      ctx.fillText(textLine, textX, textY + lineIndex * metrics.charHeight);
    });
  });
  ctx.restore();

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const widthBytes = Math.ceil(canvas.width / 8);
  const raster = [];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let xByte = 0; xByte < widthBytes; xByte += 1) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = xByte * 8 + bit;
        const index = (y * canvas.width + x) * 4;
        if (pixels[index] < 180) byte |= 0x80 >> bit;
      }
      raster.push(byte);
    }
  }

  // Deteksi baris piksel terendah yang memiliki konten (non-zero byte)
  let lastActiveRow = -1;
  for (let y = canvas.height - 1; y >= 0; y -= 1) {
    let rowHasPixel = false;
    for (let xByte = 0; xByte < widthBytes; xByte += 1) {
      if (raster[y * widthBytes + xByte] !== 0) {
        rowHasPixel = true;
        break;
      }
    }
    if (rowHasPixel) {
      lastActiveRow = y;
      break;
    }
  }

  // Pangkas baris kosong di bagian bawah (beri margin aman 5 piksel)
  const trimmedHeight = Math.min(canvas.height, Math.max(1, lastActiveRow + 5));
  const trimmedRaster = raster.slice(0, trimmedHeight * widthBytes);

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = trimmedHeight & 0xff;
  const yH = (trimmedHeight >> 8) & 0xff;
  const remainingPitch = Math.max(0, Number(settings.pitch || stickerHeight) - trimmedHeight);

  // Feed stiker: Menggunakan perintah hardware gap sensor (0x1d 0x0c) atau ESC J feed yang instan.
  const feedBytes = settings.feedMethod === "manual"
    ? (() => {
        const bytes = [];
        let remaining = remainingPitch;
        while (remaining > 255) { bytes.push(0x1b, 0x4a, 255); remaining -= 255; }
        if (remaining > 0) bytes.push(0x1b, 0x4a, remaining);
        return bytes;
      })()
    : [0x1d, 0x0c];
  return new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 0x00, 0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...trimmedRaster, ...feedBytes]);
}


async function performCupLabelPrint(transaction) {
  if (!isLabelPrinterReady()) return false; // Label printer opsional
  // Expand items by qty and filter beverages only
  const labelItems = [];
  for (const item of (transaction.items || [])) {
    if (!isBeverageItem(item)) continue;
    const qty = Number(item.qty || 1);
    for (let q = 0; q < qty; q++) {
      labelItems.push(item);
    }
  }
  if (!labelItems.length) return true;

  const labelSettings = getLabelPrinterSettings();
  const delayMs = Math.max(100, Number(labelSettings.labelDelay ?? 300));
  const printEngine = labelSettings.printEngine || "bitmap";

  try {
    for (let i = 0; i < labelItems.length; i++) {
      if (!isLabelPrinterReady()) throw new Error("Koneksi label printer terputus.");
      const bytes = printEngine === "native"
        ? await encodeCupLabel(transaction, labelItems[i], i, labelItems.length)
        : await encodeCupLabelBitmap(transaction, labelItems[i], i, labelItems.length);
      await writeLabelPrinterChunks(bytes);
      // Gap kecil/jeda antar label agar printer menyelesaikan feed sebelumnya
      if (i < labelItems.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    toast(`${labelItems.length} label cup dicetak.`);
    return true;
  } catch (error) {
    console.warn("[Label] Cetak label gagal:", error);
    // Null-kan characteristic hanya jika GATT memang sudah terputus.
    // Error sementara (timeout, buffer penuh) tidak perlu mematikan printer —
    // ini mencegah job berikutnya di antrian di-skip hanya karena gangguan sesaat.
    const gattDisconnected = !state.labelPrinterDevice?.gatt?.connected;
    if (gattDisconnected) {
      state.labelPrinterCharacteristic = null;
      setLabelPrinterStatus("Terputus", "disconnected", "Label printer terputus. Sambungkan ulang.");
    }
    toast(`Cetak label gagal: ${error.message}`);
    return false;
  }
}

function printCupLabels(transaction) {
  return enqueueLabelPrint(() => performCupLabelPrint(transaction));
}

let currentCustomizingItemId = "";

function openItemCustomModal(itemId) {
  const item = state.cart.find((entry) => entry.id === itemId);
  if (!item) return;
  currentCustomizingItemId = itemId;
  if (els.customItemName) els.customItemName.textContent = item.name;

  // Parsing existing notes
  const notesStr = (item.notes || "").toUpperCase();
  
  // Temp (ICE/HOT)
  const isHot = notesStr.includes("HOT");
  els.customTemp?.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === (isHot ? "HOT" : "ICE"));
  });

  // Level es hanya relevan untuk minuman dingin.
  const iceValue = notesStr.includes("NO ICE")
    ? "NO ICE"
    : notesStr.includes("LESS ICE")
      ? "LESS ICE"
      : notesStr.includes("EXTRA ICE")
        ? "EXTRA ICE"
        : "NORMAL ICE";
  els.customIce?.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === iceValue);
  });
  syncCustomIceVisibility();

  // Sugar
  let sugarVal = "NORMAL";
  if (notesStr.includes("LESS SUGAR")) sugarVal = "LESS SUGAR";
  else if (notesStr.includes("NO SUGAR")) sugarVal = "NO SUGAR";
  els.customSugar?.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === sugarVal);
  });

  // Size
  const isLarge = notesStr.includes("LARGE");
  els.customSize?.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === (isLarge ? "LARGE" : "REGULAR"));
  });

  // Custom text note
  let customText = (item.notes || "");
  const standardTags = ["ICE", "HOT", "NORMAL ICE", "LESS ICE", "NO ICE", "EXTRA ICE", "NORMAL", "LESS SUGAR", "NO SUGAR", "REGULAR", "LARGE"];
  standardTags.forEach((tag) => {
    customText = customText.replace(new RegExp(`\\b${tag}\\b`, "gi"), "");
  });
  customText = customText.replace(/·/g, "").replace(/\s+/g, " ").trim();
  if (els.customTextNote) els.customTextNote.value = customText;

  if (els.itemCustomModal) {
    els.itemCustomModal.classList.add("open");
    els.itemCustomModal.setAttribute("aria-hidden", "false");
  }
}

function closeItemCustomModal() {
  if (els.itemCustomModal) {
    els.itemCustomModal.classList.remove("open");
    els.itemCustomModal.setAttribute("aria-hidden", "true");
  }
  currentCustomizingItemId = "";
}

function saveItemCustomization(event) {
  if (event) event.preventDefault();
  const item = state.cart.find((entry) => entry.id === currentCustomizingItemId);
  if (!item) {
    closeItemCustomModal();
    return;
  }

  // Get active choices
  const tempBtn = els.customTemp?.querySelector("button.active");
  const iceBtn = els.customIce?.querySelector("button.active");
  const sugarBtn = els.customSugar?.querySelector("button.active");
  const sizeBtn = els.customSize?.querySelector("button.active");
  const customText = els.customTextNote?.value.trim();

  // Combine into formatted string
  const tags = [];
  if (tempBtn && tempBtn.dataset.value) tags.push(tempBtn.dataset.value);
  if (tempBtn?.dataset.value === "ICE" && iceBtn?.dataset.value && iceBtn.dataset.value !== "NORMAL ICE") {
    tags.push(iceBtn.dataset.value);
  }
  if (sugarBtn && sugarBtn.dataset.value) tags.push(sugarBtn.dataset.value);
  if (sizeBtn && sizeBtn.dataset.value) tags.push(sizeBtn.dataset.value);
  if (customText) tags.push(customText.toUpperCase());

  item.notes = tags.join(" · ");
  
  // Re-render cart (which merges items with same notes if applicable)
  renderCart();
  closeItemCustomModal();
}

async function printThermalReceipt(transaction, kind = "paid") {
  try {
    await writePrinterChunks(await encodeEscPosReceipt(transaction, kind));
    toast("Struk dikirim ke printer termal.");
    return true;
  } catch (error) {
    state.printerCharacteristic = null;
    toast(`Cetak Bluetooth gagal: ${error.message}`);
    promptPrinterConnection();
    return false;
  }
}

function promptPrinterConnection() {
  setPrinterStatus("Belum tersambung", "disconnected", "Printer belum nyambung. Sambungkan dulu lalu cetak ulang.");
  // Tampilkan banner di dalam modal order (jika sedang terbuka) — tidak pakai window.alert agar cart tidak hilang
  syncReceiptPrinterWarning();
  if (!els.orderModal?.classList.contains("open")) {
    // Modal tidak terbuka — buka dropdown printer seperti biasa
    togglePrinterDropdown(true);
  }
}

function syncReceiptPrinterWarning() {
  if (!els.receiptPrinterWarningBtn) return;
  const show = !state.printerCharacteristic;
  els.receiptPrinterWarningBtn.hidden = !show;
}

function ensurePrinterReadyForOrderPrint() {
  if (state.printerCharacteristic) return true;
  // Printer belum tersambung: tampilkan banner peringatan di modal, tapi tetap izinkan checkout
  // agar cart tidak hilang. Crew bisa sambungkan printer lalu cetak ulang dari tab Order.
  syncReceiptPrinterWarning();
  return true;
}

function generateBoothCode() {
  const sessions = getLegacyBoothSessions();
  let code = "";
  do {
    code = `A${Math.floor(100 + Math.random() * 900)}`;
  } while (sessions.some((session) => session.code === code));
  return code;
}

function createBoothQueue(transaction) {
  if (!transaction.sendToBooth || transaction.boothPackage === "none") return "";
  if (!state.pendingBoothCode) state.pendingBoothCode = generateBoothCode();
  return upsertPendingBoothSession(transaction);
}

function setOrderProcessing(active, label = "Memproses...") {
  state.orderProcessing = active;
  const submitButton = els.orderForm?.querySelector('button[type="submit"]');
  [els.billOrderBtn, submitButton, els.clearCart, els.cancelOrderModal].forEach((button) => {
    if (button) button.disabled = active;
  });
  if (submitButton) {
    if (active) {
      submitButton.dataset.idleText = submitButton.dataset.idleText || submitButton.textContent;
      submitButton.textContent = label;
    } else if (submitButton.dataset.idleText) {
      submitButton.textContent = submitButton.dataset.idleText;
    }
  }
  if (els.billOrderBtn) {
    els.billOrderBtn.textContent = active ? "Menyimpan..." : "Bayar Nanti";
  }
}

function checkout() {
  if (state.orderProcessing) return;
  if (!state.cart.length) {
    toast("Keranjang masih kosong.");
    return;
  }
  if (state.orderType === "staff_drink") {
    toast("Staff Drink langsung checkout dan cetak struk, tidak memakai bill.");
    return;
  }
  if (!validateStockForCart()) return;
  openOrderModal();
}

function clearActiveOrder({ silent = false } = {}) {
  removePendingBoothSession();
  state.cart = [];
  state.pendingBoothCode = "";
  els.paidAmount.value = "";
  els.customerName.value = "";
  els.tableNumber.value = "";
  els.orderCustomerName.value = "";
  els.orderTableNumber.value = "";
  if (els.orderShift) els.orderShift.value = currentShiftName();
  setOrderChannel("Kasir");
  resetOrderAdjustments();
  state.activeDraftId = "";
  els.boothPackage.value = "classic";
  closeOrderModal();
  renderCart();
  renderMenuGrid();
  renderBoothQueue();
  renderOrders();
  if (!silent) toast("Order dibatalkan.");
  completeDeferredShiftLogout();
}

async function printBill() {
  if (state.orderProcessing) return;
  setOrderProcessing(true, "Mengecek...");
  try {
    if (!state.cart.length) {
      toast("Keranjang masih kosong.");
      return;
    }
    els.customerName.value = els.orderCustomerName.value.trim();
    els.tableNumber.value = els.orderTableNumber.value.trim();
    const draft = currentTransaction(true);
    clearPendingDelete("transaction", draft.id);
    draft.payment = "Bill";
    draft.paid = 0;
    draft.change = 0;
    const drafts = getOrderDrafts().filter((entry) => entry.id !== draft.id);
    drafts.unshift(draft);
    saveOrderDrafts(drafts.slice(0, 200));
    await saveOfflineTransaction({
      ...draft,
      localId: draft.id,
      idempotencyKey: draft.id,
      syncStatus: "PENDING_SYNC",
      printStatus: "PRINT_PENDING",
    }).catch(() => null);
    if (navigator.onLine) await syncPendingTransactions({ pull: false }).catch(() => null);
    const printStatus = "PRINT_PENDING";
    draft.printStatus = printStatus;
    patchLocalOrderDraft(draft.id, { printStatus });
    await saveOfflineTransaction(
      { ...draft, localId: draft.id, idempotencyKey: draft.id },
      { syncStatus: "PENDING_SYNC", printStatus },
    ).catch(() => null);
    if (navigator.onLine) await syncPendingTransactions({ pull: false }).catch(() => null);
    
    clearActiveOrder({ silent: true });
    renderOrders();
    renderPendingSync();

    // Cetak label cup otomatis saat bill dibuat agar barista bisa langsung
    // memproses minuman sebelum pelanggan membayar.
    printCupLabels(draft).catch((err) => console.warn("[Label] Cetak label bill gagal:", err));

    toast("Order disimpan ke daftar Belum Dibayar.");
    completeDeferredShiftLogout();
  } finally {
    setOrderProcessing(false);
  }
}

function renderHistory() {
  const history = filteredMonthHistory();
  if (els.historyList) {
    els.historyList.innerHTML = history.length
      ? history
          .map(
            (transaction) => `
              <article class="history-card">
                <div>
                  <strong>${transaction.orderCode || transaction.id} · ${money(transaction.grandTotal)}${isStaffDrinkTransaction(transaction) ? " · Staff Drink" : ""}</strong>
                  <p>${new Date(transaction.createdAt).toLocaleString("id-ID")} · ${transactionShift(transaction)} · ${transactionEmployeeDisplay(transaction)} · ${!isStaffDrinkTransaction(transaction) ? (transaction.serviceType === "take_away" ? "Take Away · " : "Dine In · ") : ""}${transaction.customer} · ${transactionPaymentMethod(transaction)}${transaction.discountTotal ? ` · Diskon ${money(transaction.discountTotal)}` : ""}${transaction.boothCode ? ` · Booth ${transaction.boothCode}` : ""}</p>
                  <p>${mergeLineItems(transaction.items).map((item) => `${item.qty}x ${item.name}`).join(", ")}</p>
                </div>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state">Belum ada transaksi di bulan ini.</div>`;
  }

  const today = selectedDailyDate();
  const todayPeriodKey = `month:${today.slice(0, 7)}`;
  if (analyticsLoadFailedForPeriod(todayPeriodKey)) {
    const activeShift = currentShiftName();
    if (els.activeShiftLabel) els.activeShiftLabel.textContent = `${activeShift} aktif`;
    els.shiftTotal.textContent = "-";
    els.shiftCount.textContent = `${activeShift} · data belum dimuat`;
    renderDailySummaryLoadError(today, state.analyticsLoadError);
    return;
  }
  const todayTransactions = analyticsSourceForMonth(today.slice(0, 7)).filter((entry) => transactionReportDate(entry) === today);
  const activeShift = currentShiftName();
  const activeShiftTransactions = revenueTransactions(todayTransactions).filter((entry) => transactionShift(entry) === activeShift);
  if (els.activeShiftLabel) els.activeShiftLabel.textContent = `${activeShift} aktif`;
  els.shiftTotal.textContent = money(activeShiftTransactions.reduce((sum, entry) => sum + entry.grandTotal, 0));
  els.shiftCount.textContent = `${activeShift} · ${activeShiftTransactions.length} transaksi`;
  renderDailySummary(todayTransactions, today);
}

function orderCard(transaction, kind, displayCode = "") {
  const items = mergeLineItems(transaction.items).map((item) => `${item.qty}x ${item.name}`).join(", ");
  const orderCode = displayCode || transaction.orderCode || transaction.id;
  const paymentMethod = transactionPaymentMethod(transaction);
  const paymentLabel = transactionPaymentBreakdownLabel(transaction);
  const actions = kind === "unpaid"
    ? `
      <div class="history-actions">
        <button class="secondary-button compact" data-pay-draft="${transaction.id}" type="button">Bayar</button>
        <button class="secondary-button compact" data-edit-draft="${transaction.id}" type="button">Tambah Menu</button>
        <button class="secondary-button compact" data-print-label="${transaction.id}" data-print-kind="bill" type="button">Cetak Label Cup</button>
        <button class="secondary-button compact" data-reprint-order="${transaction.id}" data-reprint-kind="bill" type="button">Cetak Bill</button>
        ${isOwner() ? `<button class="secondary-button compact danger-text" data-delete-draft="${transaction.id}" type="button">Hapus</button>` : ""}
      </div>
    `
    : kind === "kitchen"
      ? `
        <div class="history-actions">
          <button class="secondary-button compact" data-complete-kitchen-order="${transaction.id}" type="button">Selesai Dibuat</button>
          <button class="secondary-button compact" data-print-label="${transaction.id}" data-print-kind="paid" type="button">Cetak Label Cup</button>
          <button class="secondary-button compact" data-reprint-order="${transaction.id}" data-reprint-kind="paid" type="button">Cetak Ulang Struk</button>
          ${isOwner() ? `<button class="secondary-button compact danger-text" data-delete-transaction="${transaction.id}" type="button">Hapus</button>` : ""}
        </div>
      `
    : `
      <div class="history-actions">
        ${isOwner() ? `<button class="secondary-button compact" data-edit-transaction="${transaction.id}" type="button">Edit Struk</button>` : ""}
        <button class="secondary-button compact" data-print-label="${transaction.id}" data-print-kind="paid" type="button">Cetak Label Cup</button>
        <button class="secondary-button compact" data-reprint-order="${transaction.id}" data-reprint-kind="paid" type="button">Cetak Ulang Struk</button>
        ${
          isStaffDrinkTransaction(transaction)
            ? ""
            : `<label class="payment-edit-control">
                <span>Pembayaran</span>
                <select data-edit-payment="${transaction.id}">
                  ${paymentReportMethods().map((method) => `<option value="${method}" ${paymentMethod === method ? "selected" : ""}>${method}</option>`).join("")}
                </select>
              </label>`
        }
        ${isOwner() ? `<button class="secondary-button compact danger-text" data-delete-transaction="${transaction.id}" type="button">Hapus</button>` : ""}
      </div>
    `;

  return `
    <article class="history-card order-card-row${kind === "kitchen" ? " kitchen-order-card" : ""}">
      <div>
        <strong>${kind === "kitchen" ? "☕ " : ""}${orderCode} · ${money(transaction.grandTotal)}</strong>
        <p>${new Date(transaction.createdAt).toLocaleString("id-ID")} · ${transaction.channel || "Kasir"} · ${!isStaffDrinkTransaction(transaction) ? (transaction.serviceType === "take_away" ? "Take Away" : "Dine In") + " · " : ""}${transaction.customer} · ${paymentLabel}</p>
        <p>${items}</p>
      </div>
      ${actions}
    </article>
  `;
}

async function reprintOrder(id, kind) {
  const source = kind === "bill" ? getOrderDrafts() : getHistory();
  const transaction = source.find((entry) => entry.id === id);
  if (!transaction) {
    toast("Data order tidak ditemukan.");
    return;
  }
  const printed = await printReceipt(transaction, kind === "bill" ? "bill" : "paid");
  await updateOfflineTransaction(transaction.localId || transaction.id, { printStatus: printed ? "PRINTED" : "PRINT_FAILED" }).catch(() => null);
  renderPendingSync();
  toast("Perintah cetak ulang dikirim.");
}

function removeTransactionFromLocalHistory(id) {
  writeJson(storageKeys.history, getHistory().filter((entry) => entry.id !== id));
}

async function deletePaidTransaction(id) {
  if (!id) return;
  if (!isOwner()) {
    toast("Hapus transaksi sudah dibayar hanya untuk Owner.");
    return;
  }
  const transaction = getHistory().find((entry) => entry.id === id);
  rememberDeletedTransaction(id, transaction?.createdAt);
  if (navigator.onLine) {
    try {
      await deleteTransactionInSupabase(id);
      removeTransactionFromLocalHistory(id);
      await pullTransactionsFromSupabase({ render: false }).catch(() => null);
      renderAll();
      toast("Transaksi dihapus dari laporan.");
      return;
    } catch {
      queuePendingDelete("transaction", id);
    }
  } else {
    queuePendingDelete("transaction", id);
  }

  removeTransactionFromLocalHistory(id);
  renderAll();
  toast("Transaksi dihapus lokal. Akan sync saat online.");
}

async function editPaidPayment(id, paymentValue) {
  const history = getHistory();
  const index = history.findIndex((entry) => entry.id === id);
  if (index === -1) {
    toast("Transaksi tidak ditemukan.");
    return;
  }
  const transaction = history[index];
  if (isStaffDrinkTransaction(transaction)) {
    toast("Staff Drink tidak memakai metode pembayaran normal.");
    return;
  }
  const payment = paymentReportMethods().includes(paymentValue) ? paymentValue : "Tunai";
  const onlinePayment = isOnlineChannel(payment);
  const paid = payment === "Tunai" ? Math.max(Number(transaction.paid || 0), Number(transaction.grandTotal || 0)) : Number(transaction.grandTotal || 0);
  const next = {
    ...transaction,
    channel: onlinePayment ? payment : isOnlineChannel(transaction.channel) ? "Kasir" : transaction.channel || "Kasir",
    payment,
    paid,
    change: payment === "Tunai" ? Math.max(0, paid - Number(transaction.grandTotal || 0)) : 0,
    paymentEditedAt: new Date().toISOString(),
  };
  history[index] = next;
  writeJson(storageKeys.history, history.slice(0, 2000));
  patchAnalyticsPeriodTransaction(id, {
    kitchenStatus: next.kitchenStatus,
    kitchenCompletedAt: next.kitchenCompletedAt,
    updatedAt: next.updatedAt,
  });
  await saveOfflineTransaction(
    { ...next, localId: next.id, idempotencyKey: next.id },
    { syncStatus: "PENDING_SYNC", printStatus: next.printStatus || "PRINT_PENDING" },
  ).catch(() => null);
  if (navigator.onLine) await syncPendingTransactions({ pull: false }).catch(() => null);
  renderAll();
  toast("Metode pembayaran diperbarui.");
}

async function completeKitchenOrder(id) {
  const history = getHistory();
  const index = history.findIndex((entry) => entry.id === id);
  if (index === -1) return toast("Order belum dibuat tidak ditemukan.");
  const transaction = history[index];
  if (!isKitchenPendingTransaction(transaction)) return toast("Order ini sudah selesai dibuat.");
  const now = new Date().toISOString();
  const next = {
    ...transaction,
    kitchenStatus: "done",
    kitchenCompletedAt: now,
    updatedAt: now,
  };
  history[index] = next;
  writeJson(storageKeys.history, history.slice(0, 2000));
  await saveOfflineTransaction(
    { ...next, localId: next.id, idempotencyKey: next.id },
    { syncStatus: "PENDING_SYNC", printStatus: next.printStatus || "PRINT_PENDING" },
  ).catch(() => null);
  if (navigator.onLine) await syncPendingTransactions({ pull: false }).catch(() => null);
  renderAll();
  toast("Order selesai dibuat dan masuk ke tab Selesai.");
}

function editedTransaction() {
  return getHistory().find((entry) => entry.id === state.editingTransactionId) || null;
}

function renderTransactionEditModal() {
  const transaction = editedTransaction();
  if (!transaction) return;
  state.editingTransactionItems = mergeLineItems(state.editingTransactionItems);
  const items = state.editingTransactionItems;
  const totals = totalsForEditedTransaction(transaction, items);
  if (els.transactionEditCode) els.transactionEditCode.textContent = transaction.id;
  if (els.transactionEditOldTotal) els.transactionEditOldTotal.textContent = money(Number(transaction.grandTotal || 0));
  if (els.transactionEditNewTotal) els.transactionEditNewTotal.textContent = money(totals.grandTotal);
  if (els.transactionEditPayment) els.transactionEditPayment.value = transactionPaymentMethod(transaction);
  if (els.transactionEditItems) {
    els.transactionEditItems.innerHTML = items.length
      ? items.map((item, index) => `
        <article class="transaction-edit-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.category || "Lainnya")} · ${money(item.price)}${item.customStockUsage ? ` · ${escapeHtml(customStockUsageLabel(item))}` : ""}</span>
          </div>
          <div class="transaction-edit-qty">
            <button class="qty-button" data-edit-item-decrease="${index}" type="button">-</button>
            <strong>${item.qty}</strong>
            <button class="qty-button" data-edit-item-increase="${index}" type="button">+</button>
            <button class="secondary-button compact danger-text" data-edit-item-remove="${index}" type="button">Hapus</button>
          </div>
        </article>
      `).join("")
      : `<div class="empty-state">Minimal harus ada satu item.</div>`;
  }
  if (els.transactionEditAddMenu) {
    els.transactionEditAddMenu.innerHTML = [
      `<option value="">Pilih menu</option>`,
      ...getMenu().map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${money(item.price)}</option>`),
    ].join("");
  }
}

function openTransactionEditModal(id) {
  if (!isOwner()) {
    toast("Edit struk hanya untuk Owner.");
    return;
  }
  const transaction = getHistory().find((entry) => entry.id === id);
  if (!transaction) return toast("Transaksi tidak ditemukan.");
  if (transaction.status !== "paid") return toast("Hanya transaksi sudah dibayar yang bisa dikoreksi.");
  if (isStaffDrinkTransaction(transaction)) return toast("Staff Drink belum bisa diedit lewat koreksi struk.");
  state.editingTransactionId = id;
  state.editingTransactionItems = mergeLineItems(transaction.items || []).map((item) => ({ ...item }));
  if (els.transactionEditReason) els.transactionEditReason.value = "";
  renderTransactionEditModal();
  els.transactionEditModal?.classList.add("open");
  els.transactionEditModal?.setAttribute("aria-hidden", "false");
}

function closeTransactionEditModal() {
  state.editingTransactionId = "";
  state.editingTransactionItems = [];
  els.transactionEditModal?.classList.remove("open");
  els.transactionEditModal?.setAttribute("aria-hidden", "true");
}

function changeEditingItem(index, delta) {
  const item = state.editingTransactionItems[index];
  if (!item) return;
  item.qty = Number(item.qty || 0) + delta;
  if (item.qty <= 0) state.editingTransactionItems.splice(index, 1);
  renderTransactionEditModal();
}

function addEditingMenuItem() {
  const id = els.transactionEditAddMenu?.value || "";
  const item = getMenu().find((entry) => entry.id === id);
  if (!item) return toast("Pilih menu dulu.");
  const existing = state.editingTransactionItems.find((entry) => entry.id === item.id);
  if (existing) existing.qty += 1;
  else state.editingTransactionItems.push({ ...item, qty: 1 });
  renderTransactionEditModal();
}

async function saveTransactionEdit(event) {
  event.preventDefault();
  if (!isOwner()) return toast("Edit struk hanya untuk Owner.");
  const reason = els.transactionEditReason?.value.trim();
  if (!reason) return toast("Alasan koreksi wajib diisi.");
  const history = getHistory();
  const index = history.findIndex((entry) => entry.id === state.editingTransactionId);
  if (index < 0) return toast("Transaksi tidak ditemukan.");
  const transaction = history[index];
  const items = mergeLineItems(state.editingTransactionItems).filter((item) => Number(item.qty || 0) > 0);
  if (!items.length) return toast("Transaksi harus punya minimal satu item.");
  const now = new Date().toISOString();
  const stockResult = applyStockDeltaForEdit(transaction.items || [], items, now, transaction.serviceType);
  if (stockResult.error) return toast(stockResult.error);
  const nextTotals = totalsForEditedTransaction(transaction, items);
  const selectedPayment = els.transactionEditPayment?.value || "Tunai";
  const payment = paymentReportMethods().includes(selectedPayment) ? selectedPayment : "Tunai";
  const onlinePayment = isOnlineChannel(payment);
  const paid = payment === "Tunai" ? Math.max(nextTotals.grandTotal, Number(transaction.paid || 0)) : nextTotals.grandTotal;
  const editEntry = {
    editedAt: now,
    editedBy: "Owner",
    reason,
    previousItems: mergeLineItems(transaction.items || []),
    previousGrandTotal: Number(transaction.grandTotal || 0),
    previousPayment: transaction.payment || "",
  };
  const next = {
    ...transaction,
    ...nextTotals,
    items,
    channel: onlinePayment ? payment : isOnlineChannel(transaction.channel) ? "Kasir" : transaction.channel || "Kasir",
    payment,
    paid,
    change: payment === "Tunai" ? Math.max(0, paid - nextTotals.grandTotal) : 0,
    editedAt: now,
    editedBy: "Owner",
    editReason: reason,
    editHistory: [...(Array.isArray(transaction.editHistory) ? transaction.editHistory : []), editEntry].slice(-20),
    stockSyncedAt: stockResult.changed ? now : transaction.stockSyncedAt,
  };
  history[index] = next;
  writeJson(storageKeys.history, history.slice(0, 2000));
  await saveOfflineTransaction(
    { ...next, localId: next.id, idempotencyKey: `${next.id}-edit-${Date.now()}` },
    { syncStatus: "PENDING_SYNC", printStatus: next.printStatus || "PRINT_PENDING" },
  ).catch(() => null);
  if (navigator.onLine) {
    await Promise.allSettled([
      syncPendingTransactions({ pull: false }),
      stockResult.changed ? syncInventoryToCloud() : Promise.resolve(false),
    ]);
  }
  closeTransactionEditModal();
  renderAll();
  toast("Koreksi struk tersimpan. Laporan dan stok sudah diperbarui.");
}

async function deleteDraftOrder(id) {
  if (!id) return;
  if (!isOwner()) {
    toast("Hapus order masuk hanya untuk Owner.");
    return;
  }
  const draft = getOrderDrafts().find((entry) => entry.id === id);
  rememberDeletedTransaction(id, draft?.createdAt);
  saveOrderDrafts(getOrderDrafts().filter((entry) => entry.id !== id));
  if (navigator.onLine) {
    await deleteTransactionInSupabase(id).catch(() => queuePendingDelete("transaction", id));
    await pullTransactionsFromSupabase({ render: false }).catch(() => null);
  } else {
    queuePendingDelete("transaction", id);
  }
  renderOrders();
  renderPendingSync();
  toast(navigator.onLine ? "Order belum dibayar dihapus." : "Order dihapus lokal. Akan sync saat online.");
}

function renderOrders() {
  if (!els.orderList) return;
  const savedUnpaid = getOrderDrafts();
  const unpaid = dedupeTransactionsById(savedUnpaid);
  if (unpaid.length !== savedUnpaid.length) saveOrderDrafts(unpaid);
  const paidDate = els.paidOrderDate?.value || dateKey();
  const paidPeriodKey = `month:${paidDate.slice(0, 7)}`;
  if (state.orderStatus === "paid" && analyticsLoadFailedForPeriod(paidPeriodKey)) {
    if (els.unpaidOrderCount) els.unpaidOrderCount.textContent = unpaid.length;
    if (els.kitchenOrderCount) els.kitchenOrderCount.textContent = "-";
    if (els.paidOrderCount) els.paidOrderCount.textContent = "-";
    if (els.paidOrderDate) els.paidOrderDate.hidden = false;
    if (els.paidOrderCategoryTabs) els.paidOrderCategoryTabs.hidden = true;
    els.orderList.innerHTML = `<div class="empty-state analytics-error-state">Gagal memuat riwayat transaksi ${escapeHtml(paidDate)} dari Supabase. ${escapeHtml(state.analyticsLoadError)}</div>`;
    return;
  }
  const paidAscending = analyticsSourceForDate(paidDate)
    .filter(isPaidTransaction)
    .filter((entry) => transactionReportDate(entry) === paidDate)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const kitchen = sortTransactionsNewestFirst(getHistory().filter(isKitchenPendingTransaction));
  const doneAscending = paidAscending.filter(isKitchenDoneTransaction);
  const paidDisplayCodes = paidOrderDisplayCodes(doneAscending);
  const paid = [...doneAscending].reverse();
  const paidCategories = paidOrderCategories(doneAscending);
  if (!paidCategories.includes(state.paidOrderCategory)) state.paidOrderCategory = "Semua";
  const paidByCategory = paid.filter((transaction) => orderMatchesPaidCategory(transaction, state.paidOrderCategory));
  if (els.unpaidOrderCount) els.unpaidOrderCount.textContent = unpaid.length;
  if (els.kitchenOrderCount) els.kitchenOrderCount.textContent = kitchen.length;
  if (els.paidOrderCount) els.paidOrderCount.textContent = doneAscending.length;
  // Update nav sidebar badge untuk Diproses
  const navKitchenBadge = document.querySelector("#navKitchenBadge");
  if (navKitchenBadge) {
    navKitchenBadge.textContent = kitchen.length;
    navKitchenBadge.hidden = kitchen.length === 0;
  }
  if (els.paidOrderDate) els.paidOrderDate.hidden = state.orderStatus !== "paid";
  if (els.paidOrderCategoryTabs) {
    els.paidOrderCategoryTabs.hidden = state.orderStatus !== "paid";
    els.paidOrderCategoryTabs.innerHTML = state.orderStatus === "paid"
      ? paidCategories
          .map((category) => `<button class="${category === state.paidOrderCategory ? "active" : ""}" data-paid-order-category="${category}" type="button">${category}</button>`)
          .join("")
      : "";
  }

  const list = state.orderStatus === "paid" ? paidByCategory : state.orderStatus === "kitchen" ? kitchen : unpaid;
  els.orderList.innerHTML = list.length
    ? state.orderStatus === "paid"
      ? list.slice(0, 80).map((transaction) => orderCard(transaction, state.orderStatus, paidDisplayCodes.get(transaction.id))).join("")
      : list.slice(0, 80).map((transaction) => orderCard(transaction, state.orderStatus)).join("")
    : `<div class="empty-state">${
        state.orderStatus === "paid"
          ? `Belum ada order ${state.paidOrderCategory === "Semua" ? "yang selesai" : `kategori ${state.paidOrderCategory}`} pada tanggal ini.`
          : state.orderStatus === "kitchen"
            ? "Belum ada order yang diproses."
            : "Belum ada order menunggu pembayaran."
      }</div>`;
}

async function renderPendingSync() {
  if (!els.pendingSyncList && !els.pendingSyncCount && !els.connectionStatus) return;
  let pending = [];
  try {
    pending = await pendingOfflineTransactions();
  } catch {
    pending = [];
  }
  state.pendingSyncCount = pending.length;

  const online = navigator.onLine;
  if (els.connectionStatus) {
    els.connectionStatus.textContent = online ? (pending.length ? "Sync pending" : "Online") : "Offline";
    els.connectionStatus.dataset.status = online ? (pending.length ? "pending" : "online") : "offline";
  }
  if (els.pendingSyncCount) els.pendingSyncCount.textContent = `${pending.length} pending`;
  renderEmployeeControls();
  if (els.pendingSyncList) {
    els.pendingSyncList.innerHTML = pending.length
      ? pending
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(
            (entry) => `
              <article class="history-card">
                <div>
                  <strong>${entry.id} · ${money(entry.grandTotal || 0)}</strong>
                  <p>${new Date(entry.createdAt).toLocaleString("id-ID")} · ${entry.syncStatus} · ${entry.printStatus}</p>
                  ${entry.lastSyncError ? `<p class="danger-text">${escapeHtml(entry.lastSyncError)}</p>` : ""}
                  <p>${entry.items ? mergeLineItems(entry.items).map((item) => `${item.qty}x ${item.name}`).join(", ") : "-"}</p>
                </div>
                <div class="history-actions">
                  <button class="secondary-button compact" data-reprint-offline="${entry.localId}" type="button">Print Ulang</button>
                </div>
              </article>
            `,
          )
          .join("")
      : `<div class="empty-state">Tidak ada transaksi pending sync.</div>`;
  }
}

async function syncPendingTransactions({ pull = true } = {}) {
  if (!navigator.onLine) {
    renderPendingSync();
    return;
  }

  const pending = await pendingOfflineTransactions().catch(() => []);
  for (const transaction of pending) {
    try {
      const response = await fetch("/api/supabase", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
          "Idempotency-Key": transaction.idempotencyKey || transaction.localId,
        },
        body: JSON.stringify({ action: "sync-transaction", transaction }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) throw new Error(result?.error || `Sync gagal: ${response.status}`);
      await updateOfflineTransaction(transaction.localId, {
        syncStatus: "SYNCED",
        syncedAt: new Date().toISOString(),
        lastSyncError: "",
      });
    } catch (error) {
      await updateOfflineTransaction(transaction.localId, {
        syncStatus: "PENDING_SYNC",
        lastSyncAttemptAt: new Date().toISOString(),
        lastSyncError: error.message || "Sync transaksi gagal.",
      }).catch(() => null);
    }
  }
  renderPendingSync();
  if (pull) await pullTransactionsFromSupabase({ render: true });
}

function authToken() {
  return getAuth()?.token || state.pendingLogin?.token || "";
}

function authHeaders() {
  const token = authToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postCloudJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Cloud sync gagal: ${response.status}`);
  }
  return data;
}

async function postSupabaseAction(action, payload = {}) {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) {
    console.log("[DEV MOCK] postSupabaseAction:", action, payload);
    if (action === "login") {
      const username = String(payload.username || "").toLowerCase();
      if (username === "owner") {
        return { role: "owner", token: "mock-owner-token" };
      }
      return { role: "cashier", token: "mock-cashier-token" };
    }
    if (action === "bootstrap-data") {
      return {
        employees: [
          { id: "e1", name: "Fanni", status: "active" },
          { id: "e2", name: "Robi", status: "active" },
          { id: "e3", name: "Migi Admin", status: "active" }
        ],
        settingsFound: true,
        settings: {}
      };
    }
    if (action === "device-presence") {
      return { activeDevice: null };
    }
    return { success: true };
  }
  return postCloudJson("/api/supabase", { action, ...payload });
}

async function syncHistoryToCloud() {
  // Hanya sync transaksi yang belum tersinkron ke Supabase,
  // bukan semua history — mencegah ribuan request berulang.
  if (!navigator.onLine) return;
  await syncPendingTransactions({ pull: false });
}

async function syncCashflowToCloud() {
  if (!navigator.onLine) return;
  const expenses = getCashflowExpenses();
  if (expenses.length) await postSupabaseAction("sync-cashflow", { expenses });
}

async function syncInventoryToCloud() {
  if (!navigator.onLine) return;
  const inventory = getInventory();
  if (!hasDirtyInventory()) return false;
  await postSupabaseAction("sync-inventory", { inventory });
  clearInventoryDirty();
  return true;
}

async function addEmployeeInCloud(name) {
  if (!navigator.onLine) throw new Error("Koneksi internet diperlukan.");
  return postSupabaseAction("add-employee", { name });
}

async function deleteEmployeeInCloud(name) {
  if (!navigator.onLine) return false;
  await postSupabaseAction("delete-employee", { name });
  return true;
}

async function deleteInventoryInCloud(id) {
  if (!navigator.onLine) return false;
  await postSupabaseAction("delete-inventory", { id });
  return true;
}

async function deleteCashflowInCloud(id) {
  if (!navigator.onLine) return false;
  await postSupabaseAction("delete-cashflow", { id });
  return true;
}

async function syncSettingsToCloud({ force = false } = {}) {
  if (!navigator.onLine || !isLoggedIn() || !isOwner()) return false;
  if (!force && !hasDirtySettings()) return false;
  await postSupabaseAction("sync-settings", { settings: getSettingsPayload() });
  clearSettingsDirty();
  return true;
}

async function pullSettingsFromSupabase({ render = false } = {}) {
  if (!navigator.onLine) return false;
  const result = await postSupabaseAction("get-settings");
  if (!result?.success) throw new Error(result?.error || "Pull setting gagal.");
  if (result.found && (!hasDirtySettings() || !isOwner())) {
    applyCloudSettings(result.settings);
    if (!isOwner()) clearSettingsDirty();
    enforceCurrentEmployeeAvailability();
    if (render) renderAll();
  } else if (isOwner() && (!result.found || hasDirtySettings())) {
    await syncSettingsToCloud({ force: true });
  }
  return true;
}

function sortTransactionsNewestFirst(transactions = []) {
  return [...transactions].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function cacheCloudTransactions(transactions = [], localPending = []) {
  const list = Array.isArray(transactions) ? transactions : [];
  const pendingDeletes = new Set(getPendingDeletes().filter((entry) => entry.type === "transaction").map((entry) => entry.id));
  const deletedTransactions = new Set(getDeletedTransactionTombstones().map((entry) => entry.id));
  const blockedIds = new Set([...pendingDeletes, ...deletedTransactions]);
  const byId = new Map();

  const merge = (entry) => {
    if (!entry?.id || blockedIds.has(entry.id)) return;
    byId.set(entry.id, preferredTransaction(byId.get(entry.id), entry));
  };

  sortTransactionsNewestFirst(list).forEach(merge);
  sortTransactionsNewestFirst(getHistory()).forEach(merge);
  sortTransactionsNewestFirst(localPending).forEach(merge);

  const merged = sortTransactionsNewestFirst([...byId.values()]);
  const unpaid = merged.filter(isUnpaidTransaction).map((entry) => ({ ...entry, status: "unpaid", payment: entry.payment || "Bill" }));
  const paid = merged.filter(isPaidTransaction);
  writeJson(storageKeys.history, paid.slice(0, 2000));
  saveOrderDrafts(unpaid.slice(0, 200));
}

async function cacheCloudTransactionsWithPending(transactions = []) {
  const pending = await pendingOfflineTransactions().catch(() => []);
  cacheCloudTransactions(transactions, pending);
}

async function pullTransactionsFromSupabase({ render = true, limit } = {}) {
  if (!navigator.onLine) return false;
  const payload = limit ? { limit } : {};
  const result = await postSupabaseAction("get-transactions", payload);
  if (!result?.success || !Array.isArray(result.transactions)) {
    throw new Error(result?.error || "Pull transaksi gagal.");
  }
  if (Array.isArray(result.deletedTransactions)) mergeDeletedTransactionTombstones(result.deletedTransactions);
  await cacheCloudTransactionsWithPending(result.transactions);
  if (render) {
    renderHistory();
    renderOrders();
    renderCashflow();
    renderAnalytics();
  }
  return true;
}

async function deleteTransactionInSupabase(id) {
  await postSupabaseAction("delete-transaction", { id });
}

async function processPendingDeletes() {
  if (!navigator.onLine) return;
  const pending = getPendingDeletes();
  const remaining = [];

  for (const entry of pending) {
    try {
      if (entry.type === "transaction") await deleteTransactionInSupabase(entry.id);
    } catch {
      remaining.push(entry);
    }
  }

  savePendingDeletes(remaining);
}

async function loadCloudData() {
  if (!navigator.onLine) return false;
  const data = await postSupabaseAction("bootstrap-data");
  if (!data?.success) throw new Error(data?.error || "Load data cloud gagal.");

  if (Array.isArray(data.deletedTransactions)) mergeDeletedTransactionTombstones(data.deletedTransactions);
  if (Array.isArray(data.history)) await cacheCloudTransactionsWithPending(data.history);
  if (Array.isArray(data.cashflowExpenses)) writeJson(storageKeys.cashflowExpenses, data.cashflowExpenses.slice(0, 2000));
  if (data.inventory && typeof data.inventory === "object") applyCloudInventory(data.inventory);
  if (Array.isArray(data.employees)) applyCloudEmployeeRoster(data.employees);
  if (data.settingsFound && (!hasDirtySettings() || !isOwner())) {
    applyCloudSettings(data.settings);
    if (!isOwner()) clearSettingsDirty();
    enforceCurrentEmployeeAvailability();
  } else if (isOwner() && (!data.settingsFound || hasDirtySettings())) {
    await syncSettingsToCloud({ force: true }).catch(() => null);
  }
  return true;
}

let cloudSyncPromise = null;

async function syncCloudData({ refresh = true } = {}) {
  if (!navigator.onLine || !isLoggedIn()) return;
  if (cloudSyncPromise) return cloudSyncPromise;

  cloudSyncPromise = (async () => {
    await Promise.allSettled([
      processPendingDeletes(),
      syncPendingTransactions(),
      syncCashflowToCloud(),
      syncInventoryToCloud(),
      syncSettingsToCloud(),
    ]);
    if (refresh) {
      await loadCloudData();
      await ensureJuneRecoveryImported().catch(() => null);
      await pullTransactionsFromSupabase({ render: false }).catch(() => null);
      renderAll();
    }
  })()
    .catch(() => null)
    .finally(() => {
      cloudSyncPromise = null;
      renderPendingSync();
    });

  return cloudSyncPromise;
}

async function refreshOnlineData({ render = true } = {}) {
  if (!navigator.onLine || !isLoggedIn()) return false;
  await processPendingDeletes().catch(() => null);
  await syncPendingTransactions({ pull: false }).catch(() => null);
  await syncInventoryToCloud().catch(() => null);
  await loadCloudData().catch(() => null);
  await ensureJuneRecoveryImported().catch(() => null);
  await pullTransactionsFromSupabase({ render: false }).catch(() => null);
  await pullSettingsFromSupabase({ render: false }).catch(() => null);
  if (render) {
    renderAll();
    renderEmployeeControls();
  }
  return true;
}

async function updateDevicePresence() {
  if (!navigator.onLine || !isLoggedIn()) return;
  const auth = getAuth();
  const employee = auth?.employee || (isOwner() ? "Owner" : activeEmployeeName() || "Kasir");
  const role = currentRole();

  const result = await postSupabaseAction("device-presence", {
    deviceId: ensureDeviceId(),
    employee,
    role,
  });

  if (isCashier() && result?.otherActive) {
    const now = Date.now();
    const lastWarning = Number(localStorage.getItem(storageKeys.lastDeviceWarning) || 0);
    if (now - lastWarning >= 5 * 60 * 1000) {
      localStorage.setItem(storageKeys.lastDeviceWarning, String(now));
      const otherEmployee = result.activeDevice?.employee || "petugas lain";
      window.alert(`Kasir juga sedang aktif di device lain oleh ${otherEmployee}. Pastikan hanya satu kasir yang mengambil transaksi utama.`);
    }
  }
}

async function refreshActiveCashierPresence() {
  if (!navigator.onLine || !isLoggedIn() || !isOwner()) {
    state.activeCashier = { online: false, employee: "" };
    updateEmployeeHeaderState();
    return;
  }
  try {
    const result = await checkOtherActiveDevice("Owner");
    state.activeCashier = {
      online: Boolean(result?.otherActive && result.activeDevice?.employee),
      employee: result?.activeDevice?.employee || "",
    };
  } catch (error) {
    state.activeCashier = { online: false, employee: "" };
  }
  renderEmployeeControls();
  updateEmployeeHeaderState();
}

async function checkRemoteLogout() {
  const auth = getAuth();
  if (!navigator.onLine || !auth?.loggedIn) return;
  const result = await postSupabaseAction("logout-state");
  const marker = result?.marker;
  if (!marker?.at) return;
  const markerTime = new Date(marker.at).getTime();
  const authTime = new Date(auth.at || 0).getTime();
  const lastSeen = Number(localStorage.getItem(storageKeys.lastRemoteLogout) || 0);
  const isTargetDevice = marker.targetDeviceId && marker.targetDeviceId === ensureDeviceId();
  const sameSession = (!marker.role || marker.role === auth.role) && (!marker.employee || marker.employee === auth.employee);
  if ((!sameSession && !isTargetDevice) || !markerTime || markerTime <= authTime || markerTime <= lastSeen) return;
  localStorage.setItem(storageKeys.lastRemoteLogout, String(markerTime));
  recordLogoutSession(auth).catch(() => null);
  logout({ remote: true });
  toast(isTargetDevice ? "Sesi Anda telah dikeluarkan (force logout) oleh Owner." : "Sesi logout dari device lain.");
}


async function clearDevicePresence() {
  if (!navigator.onLine) return;
  await postSupabaseAction("device-presence", {
    deviceId: ensureDeviceId(),
    employee: activeEmployeeName(),
    role: currentRole(),
    logout: true,
  });
}

function updateConnectionStatus() {
  renderPendingSync();
  if (navigator.onLine) {
    refreshOnlineData({ render: true }).catch(() => null);
    syncCloudData({ refresh: false });
    updateDevicePresence().catch(() => null);
    refreshActiveCashierPresence().catch(() => null);
    checkRemoteLogout().catch(() => null);
  }
}

function loadDraftToCart(id) {
  const draft = getOrderDrafts().find((entry) => entry.id === id);
  if (!draft) return null;
  state.cart = draft.items.map((item) => ({ ...item }));
  state.activeDraftId = draft.id;
  els.customerName.value = draft.customer === "Walk-in" || draft.customer === "Teman Migi" ? "" : draft.customer;
  els.tableNumber.value = draft.table === "-" ? "" : draft.table;
  els.orderCustomerName.value = draft.customer === "Walk-in" ? "Teman Migi" : draft.customer;
  els.orderTableNumber.value = draft.table === "-" ? "" : draft.table;
  if (els.orderShift) els.orderShift.value = draft.shift || currentShiftName(draft.createdAt);
  setOrderChannel(draft.channel || "Kasir");
  resetOrderAdjustments();
  // Restore diskon yang sudah di-apply saat order di-save sebagai "Bayar Nanti"
  if (draft.discountVoucherId) {
    const voucher = voucherById(draft.discountVoucherId);
    if (voucher) {
      state.discountVoucherId = voucher.id;
      state.discountType = voucher.type;
      state.discountValue = Number(voucher.value || 0);
      state.discountNote = draft.discountNote || `Voucher ${voucher.code}`;
      if (els.discountVoucherSelect) els.discountVoucherSelect.value = voucher.id;
    }
  } else if (draft.discountType && draft.discountType !== "none" && Number(draft.discountTotal || 0) > 0) {
    // Fallback: restore manual discount jika tidak pakai voucher
    state.discountType = draft.discountType;
    state.discountValue = Number(draft.discountValue || 0);
    state.discountNote = draft.discountNote || "";
  }
  renderDiscountVoucherControls();
  state.serviceType = draft.serviceType || "dine_in";
  syncDineTakeUi();
  renderCart();
  renderMenuGrid();
  return draft;
}

function payDraftOrder(id) {
  const draft = loadDraftToCart(id);
  if (!draft) return;
  els.paidAmount.value = totals().grandTotal;
  openOrderModal();
}

function editDraftOrder(id) {
  const draft = loadDraftToCart(id);
  if (!draft) return;
  setActiveView("pos");
  toast("Order belum dibayar dimuat. Tambahkan menu lalu tekan Bayar Nanti.");
}

function selectedMonth() {
  return els.analyticsMonth.value || monthKey();
}

function selectedDailyDate() {
  return els.analyticsDate?.value || dateKey();
}

function dailyReportText(todayTransactions, reportDateValue = selectedDailyDate()) {
  const reportDate = new Date(`${reportDateValue}T12:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const normalTransactions = revenueTransactions(todayTransactions);
  const staffDrinks = todayTransactions.filter(isStaffDrinkTransaction);
  const revenue = normalTransactions.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const paymentTotals = paymentTotalsFor(normalTransactions);
  const items = normalTransactions.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const discountTotal = normalTransactions.reduce((sum, entry) => sum + Number(entry.discountTotal || 0), 0);
  const staffValue = staffDrinks.reduce((sum, entry) => sum + Number(entry.originalTotal || entry.subtotal || 0), 0);
  const dailyCash = getDailyCashReport(reportDateValue);
  const orderedItems = [...normalTransactions.reduce((map, entry) => {
    entry.items.forEach((item) => {
      const current = map.get(item.id) || { name: item.name, category: item.category || "Lainnya", qty: 0, revenue: 0 };
      current.qty += item.qty;
      current.revenue += item.price * item.qty;
      map.set(item.id, current);
    });
    return map;
  }, new Map()).values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const orderedCategoryLines = groupedReceiptItems(orderedItems)
    .flatMap(([category, items]) => [
      `${category}:`,
      ...items.map((item) => `- ${item.name}: ${item.qty} pcs (${money(item.revenue)})`),
    ]);
  const shiftLines = ["Shift 1", "Shift 2"].map((shift) => {
    const transactions = normalTransactions.filter((entry) => transactionShift(entry) === shift);
    const shiftRevenue = transactions.reduce((sum, entry) => sum + entry.grandTotal, 0);
    return `- ${shift}: ${money(shiftRevenue)} (${transactions.length} transaksi)`;
  });

  return [
    "Laporan Penjualan",
    reportDate,
    "",
    `Total Penjualan: ${money(revenue)}`,
    `Transaksi Normal: ${normalTransactions.length}`,
    `Item terjual: ${items}`,
    `Total Diskon: ${money(discountTotal)}`,
    "",
    "Klasifikasi Pembayaran:",
    ...paymentReportMethods().map((method) => `- ${method}: ${money(paymentTotals.get(method) || 0)}`),
    "",
    "Rincian Shift:",
    ...shiftLines,
    "",
    `Kas Harian untuk Kembalian: ${dailyCash ? money(dailyCash.amount) : "-"}`,
    ...(dailyCash?.employee ? [`Dicatat oleh: ${dailyCash.employee}`] : []),
    "",
    "Konsumsi Crew:",
    ...(staffDrinks.length ? staffDrinks.map((entry) => `- ${transactionEmployeeDisplay(entry)}: ${staffDrinkItemsLabel(entry)} (${money(entry.originalTotal || entry.subtotal || 0)})`) : ["- Belum ada Staff Drink"]),
    `Nilai konsumsi: ${money(staffValue)}`,
    "",
    "Rincian Orderan per Kategori:",
    ...(orderedCategoryLines.length ? orderedCategoryLines : ["- Belum ada order"]),
  ].join("\n");
}

function renderDailySummaryLoadError(reportDateValue, message = "") {
  const safeMessage = message || "Data Supabase belum bisa dimuat.";
  if (els.dailySummary) {
    els.dailySummary.innerHTML = `
      <div class="empty-state analytics-error-state">
        Gagal memuat data Supabase untuk ${escapeHtml(reportDateValue)}. ${escapeHtml(safeMessage)}
      </div>
    `;
  }
  if (els.dailyReportText) {
    els.dailyReportText.textContent = `Gagal memuat laporan harian ${reportDateValue}.\n${safeMessage}\n\nCoba sync ulang atau cek koneksi sebelum memakai angka laporan.`;
  }
}

function renderDailySummary(todayTransactions, reportDateValue = selectedDailyDate()) {
  if (!els.dailySummary) return;
  const normalTransactions = revenueTransactions(todayTransactions);
  const staffDrinks = todayTransactions.filter(isStaffDrinkTransaction);
  const revenue = normalTransactions.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const items = normalTransactions.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const discountTotal = normalTransactions.reduce((sum, entry) => sum + Number(entry.discountTotal || 0), 0);
  const staffValue = staffDrinks.reduce((sum, entry) => sum + Number(entry.originalTotal || entry.subtotal || 0), 0);
  const paymentTotals = paymentTotalsFor(normalTransactions);
  const dailyCash = getDailyCashReport(reportDateValue);
  const shiftTotals = ["Shift 1", "Shift 2"].map((shift) => {
    const transactions = normalTransactions.filter((entry) => transactionShift(entry) === shift);
    return {
      shift,
      revenue: transactions.reduce((sum, entry) => sum + entry.grandTotal, 0),
      count: transactions.length,
      items: transactions.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0),
    };
  });
  const topItem = [...normalTransactions.reduce((map, entry) => {
    entry.items.forEach((item) => {
      const current = map.get(item.id) || { name: item.name, qty: 0 };
      current.qty += item.qty;
      map.set(item.id, current);
    });
    return map;
  }, new Map()).values()].sort((a, b) => b.qty - a.qty)[0];

  els.dailySummary.innerHTML = `
    <article><span>Total penjualan</span><strong>${money(revenue)}</strong></article>
    <article><span>Transaksi normal</span><strong>${normalTransactions.length}</strong></article>
    <article><span>Item terjual</span><strong>${items}</strong></article>
    <article><span>Menu paling jalan</span><strong>${topItem ? `${topItem.name} (${topItem.qty})` : "-"}</strong></article>
    <article><span>Total diskon</span><strong>${money(discountTotal)}</strong></article>
    <article><span>Konsumsi crew</span><strong>${staffDrinks.length} staff drink</strong><small>${money(staffValue)}</small></article>
    <article class="daily-cash-summary">
      <span>Kas harian untuk kembalian</span>
      <strong>${dailyCash ? money(dailyCash.amount) : "-"}</strong>
      ${dailyCash?.employee ? `<small>Dicatat ${escapeHtml(dailyCash.employee)}</small>` : ""}
    </article>
    <div class="shift-summary">
      ${shiftTotals
        .map(
          (item) => `
            <div>
              <span>${item.shift}</span>
              <strong>${money(item.revenue)}</strong>
              <small>${item.count} transaksi · ${item.items} item</small>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="payment-summary">
      ${paymentReportMethods()
        .map((method) => {
          const meta = paymentUiMeta(method);
          return `
            <div class="payment-summary-row payment-summary-row-${meta.tone}">
              <span><i class="ph ${meta.icon}" aria-hidden="true"></i>${method}</span>
              <strong>${money(paymentTotals.get(method) || 0)}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
  if (els.dailyReportText) els.dailyReportText.textContent = dailyReportText(todayTransactions, reportDateValue);
}

async function copyDailyReport() {
  const text = els.dailyReportText?.textContent?.trim();
  if (!text) return toast("Belum ada laporan untuk dicopy.");
  try {
    await navigator.clipboard.writeText(text);
    toast("Laporan dicopy.");
  } catch {
    toast("Browser memblokir clipboard. Seleksi teks laporan secara manual.");
  }
}

function shareDailyReportToWhatsApp() {
  const text = els.dailyReportText?.textContent?.trim() || state.reportShareText;
  if (!text) return toast("Belum ada laporan untuk dibagikan.");
  openWhatsAppReport(text);
  if (els.dailyReportShareStatus) els.dailyReportShareStatus.textContent = "Laporan dibuka di WhatsApp";
}

function pdfEscape(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfLine(text, maxChars = 92) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function dailyReportPdfLines(transactions = [], reportDateValue = selectedDailyDate()) {
  const normalTransactions = revenueTransactions(transactions);
  const reportDate = new Date(`${reportDateValue}T12:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const revenue = normalTransactions.reduce((sum, entry) => sum + Number(entry.grandTotal || 0), 0);
  const discountTotal = normalTransactions.reduce((sum, entry) => sum + Number(entry.discountTotal || 0), 0);
  const subtotal = normalTransactions.reduce((sum, entry) => sum + Number(entry.subtotal || entry.originalTotal || entry.grandTotal || 0), 0);
  const paymentTotals = paymentTotalsFor(normalTransactions);
  const productRows = [...normalTransactions.reduce((map, entry) => {
    (entry.items || []).forEach((item) => {
      const key = item.id || item.name;
      const current = map.get(key) || { name: item.name, qty: 0, revenue: 0 };
      current.qty += Number(item.qty || 0);
      current.revenue += Number(item.qty || 0) * Number(item.price || 0);
      map.set(key, current);
    });
    return map;
  }, new Map()).values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const lines = [
    "Kasir Migi",
    `Laporan Penjualan Harian - ${reportDate}`,
    "",
    `Total transaksi: ${normalTransactions.length}`,
    `Total pendapatan: ${money(subtotal)}`,
    `Total diskon: ${money(discountTotal)}`,
    `Total penjualan bersih: ${money(revenue)}`,
    "",
    "Rincian metode pembayaran:",
    ...paymentReportMethods().map((method) => `- ${method}: ${money(paymentTotals.get(method) || 0)}`),
    "",
    "Rincian produk terjual:",
    ...(productRows.length ? productRows.map((item) => `- ${item.name}: ${quantityLabel(item.qty)} pcs (${money(item.revenue)})`) : ["- Belum ada produk terjual"]),
    "",
    "Daftar transaksi:",
  ];

  if (!normalTransactions.length) lines.push("- Belum ada transaksi valid pada tanggal ini.");
  normalTransactions
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((entry) => {
      const time = new Date(entry.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      lines.push("");
      lines.push(`${entry.id} | ${time} | ${transactionEmployeeDisplay(entry)} | ${transactionShift(entry)} | ${transactionPaymentMethod(entry)}`);
      lines.push(`Pelanggan: ${entry.customer || "Teman Migi"}`);
      (entry.items || []).forEach((item) => {
        const qty = Number(item.qty || 0);
        const price = Number(item.price || 0);
        lines.push(`- ${item.name} | ${quantityLabel(qty)} x ${money(price)} = ${money(qty * price)}`);
      });
      lines.push(`Subtotal: ${money(entry.subtotal || entry.originalTotal || entry.grandTotal || 0)} | Diskon: ${money(entry.discountTotal || 0)} | Total akhir: ${money(entry.grandTotal || 0)}`);
      lines.push(`Nominal pembayaran: ${money(entry.paid || 0)} | Kembalian: ${money(entry.change || 0)}`);
      const note = entry.note || entry.discountNote || entry.editReason || "";
      if (note) lines.push(`Catatan: ${note}`);
    });
  return lines;
}

function buildSimplePdf(lines = []) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const fontSize = 10;
  const lineHeight = 15;
  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pages = [];
  for (let index = 0; index < lines.length; index += linesPerPage) pages.push(lines.slice(index, index + linesPerPage));
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>"];
  const pageRefs = [];
  const contentObjects = [];
  pages.forEach((pageLines, pageIndex) => {
    const content = [
      "BT",
      `/F1 ${fontSize} Tf`,
      `${margin} ${pageHeight - margin} Td`,
      `${lineHeight} TL`,
      ...pageLines.flatMap((line) => wrapPdfLine(line).map((wrapped) => `(${pdfEscape(wrapped)}) Tj T*`)),
      "ET",
    ].join("\n");
    const pageObjectNumber = 3 + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageRefs.push(`${pageObjectNumber} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
    contentObjects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects.push(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`);
  const orderedObjects = [objects[0], objects[objects.length - 1]];
  for (let index = 1; index < objects.length - 1; index += 1) {
    orderedObjects.push(objects[index]);
    orderedObjects.push(contentObjects[index - 1]);
  }
  orderedObjects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  orderedObjects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${orderedObjects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${orderedObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

async function downloadDailyReportPdf() {
  try {
    const reportDateValue = selectedDailyDate();
    const loaded = await refreshAnalyticsPeriod({ month: reportDateValue.slice(0, 7), range: "daily", silent: false });
    if (!loaded && navigator.onLine) throw new Error(state.analyticsLoadError || "Arsip Supabase belum bisa dimuat.");
    const transactions = analyticsSourceForDate(reportDateValue).filter((entry) => transactionReportDate(entry) === reportDateValue);
    const lines = dailyReportPdfLines(transactions, reportDateValue);
    const blob = buildSimplePdf(lines);
    const label = new Date(`${reportDateValue}T12:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }).replace(/\s+/g, "-");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Kasir-Migi-Laporan-${label}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("PDF laporan dibuat.");
  } catch (error) {
    toast(error.message || "PDF laporan belum bisa dibuat.");
  }
}

function analyticsSourceForPeriod(key = analyticsPeriodKey()) {
  return state.analyticsPeriodKey === key && Array.isArray(state.analyticsPeriodTransactions)
    ? state.analyticsPeriodTransactions
    : getHistory();
}

function analyticsSourceForMonth(month = selectedMonth()) {
  const yearKey = `year:${month.slice(0, 4)}`;
  const monthKeyValue = `month:${month}`;
  if (state.analyticsPeriodKey === yearKey && Array.isArray(state.analyticsPeriodTransactions)) return state.analyticsPeriodTransactions;
  if (state.analyticsPeriodKey === monthKeyValue && Array.isArray(state.analyticsPeriodTransactions)) return state.analyticsPeriodTransactions;
  return getHistory();
}

function analyticsSourceForDate(date = dateKey()) {
  return analyticsSourceForMonth(date.slice(0, 7));
}

function analyticsArchiveCoversPeriodKey(periodKey = "") {
  if (!periodKey) return false;
  if (state.analyticsPeriodKey === periodKey) return true;
  if (periodKey.startsWith("month:")) {
    const yearKey = `year:${periodKey.slice(6, 10)}`;
    return state.analyticsPeriodKey === yearKey;
  }
  return false;
}

function analyticsLoadFailedForPeriod(periodKey = "") {
  return Boolean(
    navigator.onLine
    && state.analyticsLoadError
    && state.analyticsLoadErrorPeriodKey === periodKey
    && !analyticsArchiveCoversPeriodKey(periodKey),
  );
}

function filteredMonthHistory() {
  const month = selectedMonth();
  return analyticsSourceForMonth(month).filter((entry) => transactionReportMonth(entry) === month);
}

function filteredAnalyticsHistory() {
  if (state.chartRange === "daily") return filteredMonthHistory();
  const year = String(selectedAnalyticsYear());
  return analyticsSourceForPeriod(`year:${year}`).filter((entry) => transactionReportYear(entry) === year);
}

function renderAnalyticsControls() {
  const yearlyMode = state.chartRange !== "daily";
  if (els.analyticsMonth) els.analyticsMonth.hidden = yearlyMode;
  if (els.analyticsDate) els.analyticsDate.hidden = yearlyMode;
  if (els.analyticsYear) els.analyticsYear.hidden = !yearlyMode;
}

async function refreshAnalyticsPeriod({ render = true, month = selectedMonth(), range = state.chartRange, silent = false } = {}) {
  if (!navigator.onLine) {
    state.analyticsPeriodKey = "";
    state.analyticsPeriodTransactions = [];
    return false;
  }
  if (isLoggedIn() && isOwner() && localStorage.getItem(storageKeys.juneRecoverySynced) !== "true") {
    await loadCloudData().catch(() => null);
  }
  await ensureJuneRecoveryImported().catch(() => null);
  const requestId = state.analyticsPeriodRequestId + 1;
  state.analyticsPeriodRequestId = requestId;
  state.analyticsPeriodLoading = true;
  const periodKey = range === "daily" ? `month:${month}` : `year:${selectedAnalyticsYear()}`;
  try {
    const { startDate, endDate } = range === "daily" ? monthDateRange(month) : yearDateRange(selectedAnalyticsYear());
    const result = await postSupabaseAction("get-transactions", {
      startDate,
      endDate,
      fullArchive: true,
      limit: 50000,
    });
    if (!result?.success || !Array.isArray(result.transactions)) throw new Error(result?.error || "Ambil arsip analitik gagal.");
    if (requestId !== state.analyticsPeriodRequestId) return false;
    state.analyticsPeriodKey = periodKey;
    state.analyticsPeriodTransactions = result.transactions;
    state.analyticsLoadError = "";
    state.analyticsLoadErrorPeriodKey = "";
    if (Array.isArray(result.deletedTransactions)) mergeDeletedTransactionTombstones(result.deletedTransactions);
    if (render) {
      renderAnalytics();
      renderHistory();
    }
    return true;
  } catch (error) {
    if (requestId === state.analyticsPeriodRequestId) {
      state.analyticsLoadError = error.message || "Arsip analitik belum bisa dimuat.";
      state.analyticsLoadErrorPeriodKey = periodKey;
      if (render) {
        renderAnalytics();
        renderHistory();
      }
    }
    if (!silent) toast(error.message || "Arsip analitik belum bisa dimuat.");
    return false;
  } finally {
    if (requestId === state.analyticsPeriodRequestId) state.analyticsPeriodLoading = false;
  }
}

function discountTypeLabel(type = "") {
  if (type === "percent") return "Persen";
  if (type === "nominal") return "Nominal";
  return "Diskon";
}

function renderDiscountAnalytics(discountedTransactions = []) {
  if (!els.discountAnalyticsList) return;
  if (!discountedTransactions.length) {
    els.discountAnalyticsList.innerHTML = `<div class="empty-state">Belum ada diskon di bulan ini.</div>`;
    return;
  }
  const byType = [...discountedTransactions.reduce((map, entry) => {
    const label = discountTypeLabel(entry.discountType);
    const current = map.get(label) || { label, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(entry.discountTotal || 0);
    map.set(label, current);
    return map;
  }, new Map()).values()];
  const byCode = [...discountedTransactions.reduce((map, entry) => {
    const label = entry.discountCode || entry.discountNote || "Voucher";
    const current = map.get(label) || { label, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(entry.discountTotal || 0);
    map.set(label, current);
    return map;
  }, new Map()).values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  const noteRows = [...discountedTransactions.reduce((map, entry) => {
    const note = String(entry.discountNote || "Tanpa catatan").trim() || "Tanpa catatan";
    const current = map.get(note) || { label: note, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(entry.discountTotal || 0);
    map.set(note, current);
    return map;
  }, new Map()).values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  const rows = [
    ...byCode.map((item) => ({ ...item, meta: `${item.count} transaksi · voucher` })),
    ...byType.map((item) => ({ ...item, meta: `${item.count} transaksi` })),
    ...noteRows.map((item) => ({ ...item, meta: `${item.count} transaksi · catatan` })),
  ];
  els.discountAnalyticsList.innerHTML = rows
    .map((item) => `
      <article class="discount-analytics-row">
        <div>
          <b>${escapeHtml(item.label)}</b>
          <span>${escapeHtml(item.meta)}</span>
        </div>
        <strong>${money(item.total)}</strong>
      </article>
    `)
    .join("");
}

function renderDiscountVoucherList() {
  if (!els.discountVoucherList) return;
  const vouchers = getDiscountVouchers();
  if (!vouchers.length) {
    els.discountVoucherList.innerHTML = `<div class="empty-state">Belum ada voucher. Buat voucher pertama dari form di atas.</div>`;
    return;
  }
  els.discountVoucherList.innerHTML = vouchers
    .map((voucher) => `
      <article class="discount-analytics-row voucher-row ${voucher.active === false ? "inactive" : ""}">
        <div>
          <b>${escapeHtml(voucherLabel(voucher))}</b>
          <span>${escapeHtml(voucher.note || "Tanpa catatan")} · ${voucher.active === false ? "Nonaktif" : "Aktif"}</span>
        </div>
        <div class="voucher-row-actions">
          <button class="secondary-button compact" data-toggle-voucher="${escapeHtml(voucher.id)}" type="button">${voucher.active === false ? "Aktifkan" : "Nonaktifkan"}</button>
          <button class="secondary-button compact danger-text" data-delete-voucher="${escapeHtml(voucher.id)}" type="button">Hapus</button>
        </div>
      </article>
    `)
    .join("");
}

async function saveDiscountVoucher(event) {
  event.preventDefault();
  if (!isOwner()) {
    toast("Voucher hanya bisa dibuat Owner.");
    return;
  }
  const code = normalizeVoucherCode(els.voucherCode?.value || "");
  const type = els.voucherType?.value === "nominal" ? "nominal" : "percent";
  const value = parseVoucherValue(els.voucherValue?.value || "", type);
  const note = els.voucherNote?.value.trim() || "";
  if (!code) return toast("Kode voucher perlu diisi.");
  if (!value) return toast("Nilai voucher perlu diisi.");
  if (type === "percent" && value > 100) return toast("Diskon persen maksimal 100%.");

  const vouchers = getDiscountVouchers();
  const id = idFromName(code);
  const existingIndex = vouchers.findIndex((voucher) => voucher.id === id || voucher.code === code);
  const row = {
    id,
    code,
    type,
    value,
    note,
    active: true,
    createdAt: existingIndex >= 0 ? vouchers[existingIndex].createdAt || new Date().toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) vouchers[existingIndex] = { ...vouchers[existingIndex], ...row };
  else vouchers.unshift(row);
  saveDiscountVouchers(vouchers);
  try {
    await syncSettingsToCloud({ force: true });
    await pullSettingsFromSupabase({ render: false });
    toast("Voucher tersimpan dan tersinkron.");
  } catch {
    toast("Voucher tersimpan lokal, tapi sync cloud belum berhasil.");
  }
  els.discountVoucherForm?.reset();
  clearDiscountState();
  renderAll();
}

async function mutateDiscountVoucher(id, updater) {
  if (!isOwner()) return toast("Voucher hanya bisa diubah Owner.");
  const vouchers = getDiscountVouchers();
  const index = vouchers.findIndex((voucher) => voucher.id === id);
  if (index < 0) return;
  const next = updater(vouchers[index], vouchers);
  const result = Array.isArray(next)
    ? next
    : vouchers.map((voucher, entryIndex) => (entryIndex === index ? next : voucher));
  saveDiscountVouchers(result);
  if (state.discountVoucherId === id && (!next || next.active === false || Array.isArray(next))) clearDiscountState();
  renderAll();
  try {
    await syncSettingsToCloud({ force: true });
  } catch {
    toast("Voucher berubah lokal, tapi sync cloud belum berhasil.");
  }
}

function renderAnalytics() {
  renderAnalyticsControls();
  const requestedPeriodKey = state.chartRange === "daily" ? `month:${selectedMonth()}` : `year:${selectedAnalyticsYear()}`;
  if (analyticsLoadFailedForPeriod(requestedPeriodKey)) {
    const message = `Gagal memuat arsip Supabase: ${state.analyticsLoadError}`;
    if (els.analyticsRevenueLabel) els.analyticsRevenueLabel.textContent = "Omset";
    if (els.analyticsTunaiLabel) els.analyticsTunaiLabel.textContent = "Tunai";
    if (els.analyticsQrisLabel) els.analyticsQrisLabel.textContent = "QRIS";
    if (els.analyticsAverageLabel) els.analyticsAverageLabel.textContent = "Rata-rata";
    if (els.analyticsDiscountLabel) els.analyticsDiscountLabel.textContent = "Diskon";
    if (els.monthRevenue) els.monthRevenue.textContent = "-";
    if (els.monthTunaiRevenue) els.monthTunaiRevenue.textContent = "-";
    if (els.monthQrisRevenue) els.monthQrisRevenue.textContent = "-";
    if (els.monthDiscountTotal) els.monthDiscountTotal.textContent = "-";
    if (els.monthDiscountCount) els.monthDiscountCount.textContent = "-";
    if (els.avgDailyRevenue) els.avgDailyRevenue.textContent = "-";
    if (els.monthTransactions) els.monthTransactions.textContent = "-";
    if (els.monthItems) els.monthItems.textContent = "-";
    if (els.bestsellerList) els.bestsellerList.innerHTML = `<div class="empty-state analytics-error-state">${escapeHtml(message)}</div>`;
    if (els.insightList) els.insightList.innerHTML = `<div class="empty-state analytics-error-state">Jangan gunakan angka laporan sampai archive berhasil dimuat.</div>`;
    if (els.ingredientOutList) els.ingredientOutList.innerHTML = `<div class="empty-state analytics-error-state">Data bahan keluar belum dimuat.</div>`;
    renderRevenueChart([]);
    renderDiscountVoucherList();
    renderDiscountAnalytics([]);
    return;
  }
  const periodHistory = filteredAnalyticsHistory();
  const staffDrinks = periodHistory.filter(isStaffDrinkTransaction);
  const history = revenueTransactions(periodHistory);
  const ingredientUsage = ingredientUsageFromHistory(periodHistory);
  const yearlyMode = state.chartRange !== "daily";
  const periodLabel = yearlyMode ? "tahun ini" : "bulan ini";
  const revenue = history.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const monthPaymentTotals = paymentTotalsFor(history);
  const monthTunai = monthPaymentTotals.get("Tunai") || 0;
  const monthQris = monthPaymentTotals.get("QRIS") || 0;
  const discountedTransactions = history.filter((entry) => Number(entry.discountTotal || 0) > 0);
  const discountTotal = discountedTransactions.reduce((sum, entry) => sum + Number(entry.discountTotal || 0), 0);
  const uniqueDays = new Set(history.map((entry) => transactionReportDate(entry))).size || 1;
  const itemCount = history.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + item.qty, 0), 0);
  const products = new Map();

  history.forEach((entry) => {
    entry.items.forEach((item) => {
      const current = products.get(item.id) || { name: item.name, qty: 0, revenue: 0 };
      current.qty += item.qty;
      current.revenue += item.qty * item.price;
      products.set(item.id, current);
    });
  });

  const bestsellers = [...products.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 8);
  if (els.analyticsRevenueLabel) els.analyticsRevenueLabel.textContent = `Omset ${periodLabel}`;
  if (els.analyticsTunaiLabel) els.analyticsTunaiLabel.textContent = `Tunai ${periodLabel}`;
  if (els.analyticsQrisLabel) els.analyticsQrisLabel.textContent = `QRIS ${periodLabel}`;
  if (els.analyticsAverageLabel) els.analyticsAverageLabel.textContent = yearlyMode ? "Rata-rata / bulan jualan" : "Rata-rata / hari jualan";
  if (els.analyticsDiscountLabel) els.analyticsDiscountLabel.textContent = `Diskon ${periodLabel}`;
  els.monthRevenue.textContent = money(revenue);
  if (els.monthTunaiRevenue) els.monthTunaiRevenue.textContent = money(monthTunai);
  if (els.monthQrisRevenue) els.monthQrisRevenue.textContent = money(monthQris);
  if (els.monthDiscountTotal) els.monthDiscountTotal.textContent = money(discountTotal);
  if (els.monthDiscountCount) els.monthDiscountCount.textContent = `${discountedTransactions.length}`;
  els.avgDailyRevenue.textContent = money(Math.round(revenue / (yearlyMode ? Math.max(1, new Set(history.map((entry) => transactionReportMonth(entry))).size) : uniqueDays)));
  els.monthTransactions.textContent = String(history.length);
  els.monthItems.textContent = String(itemCount);
  els.bestsellerList.innerHTML = bestsellers.length
    ? bestsellers
        .map(
          (item, index) => `
            <article class="bestseller-row">
              <strong>${index + 1}</strong>
              <div><b>${item.name}</b><span>${item.qty} terjual · ${money(item.revenue)}</span></div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">Belum ada best seller di bulan ini.</div>`;

  renderRevenueChart(history);
  renderDiscountVoucherList();
  renderDiscountAnalytics(discountedTransactions);
  renderIngredientOutSummary(ingredientUsage);
  renderInsights({ history, bestsellers, revenue, itemCount, staffDrinks });
}

function renderIngredientOutSummary(ingredientUsage = []) {
  if (!els.ingredientOutList) return;
  if (!ingredientUsage.length) {
    els.ingredientOutList.innerHTML = `<div class="empty-state">Belum ada bahan baku keluar dari transaksi bulan ini.</div>`;
    return;
  }
  const grouped = ingredientUsage.reduce((map, item) => {
    const current = map.get(item.category) || [];
    current.push(item);
    map.set(item.category, current);
    return map;
  }, new Map());
  const preferred = ["Bean Kopi", "Susu / Creamer", "Sirup", "Bubuk / Powder", "Gula", "Packaging", "Lainnya"];
  els.ingredientOutList.innerHTML = [...grouped.entries()]
    .sort(([a], [b]) => {
      const ai = preferred.includes(a) ? preferred.indexOf(a) : preferred.indexOf("Lainnya");
      const bi = preferred.includes(b) ? preferred.indexOf(b) : preferred.indexOf("Lainnya");
      return ai - bi || a.localeCompare(b, "id-ID");
    })
    .map(([category, items]) => `
      <article class="ingredient-out-group">
        <div class="ingredient-out-group-head">
          <b>${escapeHtml(category)}</b>
          <span>${items.length} bahan</span>
        </div>
        <div class="ingredient-out-items">
          ${items.map((item) => `
            <div class="ingredient-out-row">
              <span>${escapeHtml(item.name)}</span>
              <strong>${quantityLabel(item.qty)} ${escapeHtml(item.unit || "")}</strong>
            </div>
          `).join("")}
        </div>
      </article>
    `)
    .join("");
}

function renderRevenueChart(history) {
  const canvas = els.revenueChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(640, Math.round((rect.width || 980) * dpr));
  const height = Math.round(360 * dpr);
  canvas.width = width;
  canvas.height = height;
  ctx.scale(dpr, dpr);

  const w = width / dpr;
  const h = height / dpr;
  const pad = { top: 24, right: 28, bottom: 38, left: 72 };
  const month = selectedMonth();
  const [year, monthIndex] = month.split("-").map(Number);
  const selectedYear = selectedAnalyticsYear();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const range = state.chartRange;
  const source = range === "daily"
    ? history
    : revenueTransactions(analyticsSourceForPeriod(`year:${selectedYear}`)).filter((entry) => transactionReportYear(entry) === String(selectedYear));
  const points = range !== "daily"
      ? Array.from({ length: 12 }, (_, index) => ({ label: new Date(selectedYear, index, 1).toLocaleDateString("id-ID", { month: "short" }), total: 0 }))
      : Array.from({ length: daysInMonth }, (_, index) => ({ label: String(index + 1), total: 0 }));

  source.forEach((entry) => {
    if (range !== "daily") {
      const index = Number(transactionReportMonth(entry).slice(5, 7)) - 1;
      if (points[index]) points[index].total += entry.grandTotal;
      return;
    }
    const day = Number(transactionReportDate(entry).slice(8, 10));
    if (points[day - 1]) points[day - 1].total += entry.grandTotal;
  });

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#faf8ff";
  ctx.fillRect(0, 0, w, h);

  if (!source.length) {
    ctx.fillStyle = "#77736d";
    ctx.font = "700 15px Geist, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Belum ada omset untuk rentang ini.", w / 2, h / 2);
    return;
  }

  const maxValue = Math.max(...points.map((entry) => entry.total), 1);
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const xFor = (index) => pad.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotW);
  const yFor = (value) => pad.top + plotH - (value / maxValue) * plotH;

  ctx.strokeStyle = "#e6e2dc";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#77736d";
  ctx.font = "700 11px Geist, system-ui";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const value = (maxValue / 4) * i;
    const y = yFor(value);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText(money(Math.round(value)).replace(/^Rp\s*/, ""), pad.left - 10, y + 4);
  }

  ctx.textAlign = "center";
  points.forEach((entry, index) => {
    if (range !== "daily" || index === 0 || index === points.length - 1 || Number(entry.label) % 7 === 0) {
      ctx.fillText(entry.label, xFor(index), h - 14);
    }
  });

  const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  gradient.addColorStop(0, "rgba(47, 122, 70, 0.2)");
  gradient.addColorStop(1, "rgba(47, 122, 70, 0)");

  ctx.beginPath();
  points.forEach((entry, index) => {
    const x = xFor(index);
    const y = yFor(entry.total);
    if (index === 0) ctx.moveTo(x, y);
    else {
      const prevX = xFor(index - 1);
      const prevY = yFor(points[index - 1].total);
      const midX = (prevX + x) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
    }
  });
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((entry, index) => {
    const x = xFor(index);
    const y = yFor(entry.total);
    if (index === 0) ctx.moveTo(x, y);
    else {
      const prevX = xFor(index - 1);
      const prevY = yFor(points[index - 1].total);
      const midX = (prevX + x) / 2;
      ctx.bezierCurveTo(midX, prevY, midX, y, x, y);
    }
  });
  ctx.strokeStyle = "#2f7a46";
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((entry, index) => {
    if (!entry.total) return;
    ctx.beginPath();
    ctx.arc(xFor(index), yFor(entry.total), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#2f7a46";
    ctx.fill();
    ctx.strokeStyle = "#faf8ff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function renderInsights({ history, bestsellers, revenue, itemCount, staffDrinks = [] }) {
  if (!els.insightList) return;
  const top = bestsellers[0];
  const avgTransaction = history.length ? Math.round(revenue / history.length) : 0;
  const boothCount = history.filter((entry) => entry.boothCode || entry.boothPackage !== "none").length;
  const activeDays = new Set(history.map((entry) => transactionReportDate(entry))).size;
  const staffValue = staffDrinks.reduce((sum, entry) => sum + Number(entry.originalTotal || entry.subtotal || 0), 0);
  const insights = top
    ? [
        { label: "Menu terkuat", value: top.name, detail: `${top.qty} terjual dengan omset ${money(top.revenue)}.` },
        { label: "Rata-rata transaksi", value: money(avgTransaction), detail: `${history.length} transaksi dari ${activeDays || 0} hari jualan.` },
        { label: "Kontribusi photobooth", value: `${boothCount} transaksi`, detail: boothCount ? "Kode akses otomatis dibuat saat checkout." : "Belum ada sesi photobooth di bulan ini." },
        { label: "Konsumsi crew", value: `${staffDrinks.length} Staff Drink`, detail: `${money(staffValue)} nilai konsumsi, tidak masuk omzet.` },
      ]
    : [
        { label: "Belum ada data", value: "Mulai checkout", detail: "Best seller dan evaluasi akan muncul setelah ada transaksi." },
        { label: "Item terjual", value: String(itemCount), detail: "Jumlah item mengikuti semua transaksi bulan terpilih." },
        { label: "Konsumsi crew", value: `${staffDrinks.length} Staff Drink`, detail: `${money(staffValue)} nilai konsumsi, tidak masuk omzet.` },
      ];

  els.insightList.innerHTML = insights
    .map(
      (item) => `
        <article class="insight-card">
          <p class="eyebrow">${item.label}</p>
          <strong>${item.value}</strong>
          <span>${item.detail}</span>
        </article>
      `,
    )
    .join("");
}

function resetMenuForm() {
  els.menuId.value = "";
  els.menuName.value = "";
  els.menuCategory.value = "";
  els.menuCategoryCustom.value = "";
  els.menuPrice.value = "";
  els.menuImage.value = "";
  els.menuImageFile.value = "";
  if (els.menuPrintLabel) {
    els.menuPrintLabel.checked = true;
  }
  els.menuImagePreview.innerHTML = "Belum ada gambar";
  renderMenuCategoryOptions("");
  renderRecipeRows("");
}

function setMenuImagePreview(src) {
  els.menuImage.value = src || "";
  els.menuImagePreview.innerHTML = src ? `<img src="${src}" alt="Preview gambar menu" />` : "Belum ada gambar";
}

function readMenuImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast("File gambar tidak valid.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 320;
      const ratio = image.width / image.height;
      canvas.width = ratio >= 1 ? size : Math.round(size * ratio);
      canvas.height = ratio >= 1 ? Math.round(size / ratio) : size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      setMenuImagePreview(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function setMenuSaveState(isSaving, text = "Menyimpan...") {
  state.menuSaving = isSaving;
  els.menuForm?.classList.toggle("is-saving", isSaving);
  if (els.menuSubmitBtn) {
    els.menuSubmitBtn.disabled = isSaving;
    els.menuSubmitBtn.textContent = isSaving ? text : "Simpan Menu";
  }
}

async function persistMenuSettings() {
  if (!navigator.onLine) {
    toast("Menu tersimpan lokal. Akan sync saat online.");
    return false;
  }
  const synced = await syncSettingsToCloud({ force: true });
  // Hanya pull dari cloud jika berhasil sync (owner online).
  // Jika bukan owner, cloud belum terupdate — pull justru akan
  // menimpa menu yang baru saja disimpan dengan data cloud lama.
  if (synced) {
    await pullSettingsFromSupabase({ render: false });
  }
  return synced;
}

async function saveMenu(event) {
  event.preventDefault();
  if (state.menuSaving) return;
  const menu = getMenu();
  syncMenuCategoryField();
  const recipes = getRecipes();
  const data = {
    id: els.menuId.value || idFromName(els.menuName.value),
    name: els.menuName.value.trim(),
    category: els.menuCategory.value.trim(),
    price: parseRupiah(els.menuPrice.value),
    image: els.menuImage.value,
    printLabel: els.menuPrintLabel ? els.menuPrintLabel.checked : false,
  };

  if (!data.name || !data.category || data.price < 0) {
    toast("Nama, kategori, dan harga perlu diisi.");
    return;
  }

  const recipeRows = collectRecipeRows();
  if (!recipeRows) return;

  const index = menu.findIndex((item) => item.id === data.id);
  if (index >= 0) menu[index] = { ...menu[index], ...data };
  else menu.push(data);

  if (recipeRows.length) recipes[data.id] = recipeRows;
  else delete recipes[data.id];
  writeJson(storageKeys.menu, menu);
  saveRecipes(recipes);
  markSettingsDirty();
  setMenuSaveState(true);
  try {
    const synced = await persistMenuSettings();
    resetMenuForm();
    state.category = "Semua";
    state.menuEditCategory = data.category || "Semua";
    renderAll();
    toast(synced ? "Menu tersimpan dan tersinkron." : "Menu tersimpan lokal.");
  } catch (error) {
    renderAll();
    toast("Menu tersimpan lokal, tapi sync cloud belum berhasil.");
  } finally {
    setMenuSaveState(false);
  }
}

function savePurchase(event) {
  event.preventDefault();
  if (!isOwner()) {
    toast("Set harga bahan baku hanya untuk Owner.");
    return;
  }
  const itemName = els.purchaseMenuId.value.trim();
  syncIngredientCategoryField();
  const category = els.ingredientCategory?.value.trim() || "Lainnya";
  const unit = els.ingredientUnit.value.trim();
  const qty = Number(els.purchaseQty.value || 0);
  const cost = parseRupiah(els.purchaseCost.value);
  const editingId = els.purchaseForm.dataset.editingStockId || "";

  if (!itemName || !category || !unit || !Number.isFinite(qty) || qty <= 0 || cost <= 0) {
    toast("Nama bahan, kategori, jumlah, satuan, dan harga total perlu diisi.");
    return;
  }

  const inventory = getInventory();
  const ingredientId = editingId || stableIdFromName(itemName);
  const current = inventory[ingredientId] || {};
  inventory[ingredientId] = {
    ...current,
    name: itemName,
    category,
    unit,
    stock: Number(current.stock || 0),
    buyPrice: cost / qty,
    updatedAt: new Date().toISOString(),
  };
  saveLocalInventoryChange(inventory);

  delete els.purchaseForm.dataset.editingStockId;
  const submitBtn = els.purchaseForm.querySelector("button[type=submit]");
  if (submitBtn) submitBtn.textContent = "Simpan Harga Bahan";
  els.purchaseMenuId.value = "";
  els.purchaseQty.value = "";
  els.ingredientUnit.value = "gram";
  els.purchaseCost.value = "";
  if (els.ingredientCategory) els.ingredientCategory.value = category;
  renderIngredientCategoryOptions(category);
  renderAll();
  syncInventoryToCloud().catch(() => null);
  toast(`Bahan "${itemName}" tersimpan.`);
}


async function startCamera() {
  if (!els.boothVideo) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Browser ini belum mendukung kamera.");
    return;
  }

  try {
    state.boothStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    els.boothVideo.srcObject = state.boothStream;
    els.cameraPlaceholder.hidden = true;
    els.boothStatus.textContent = "Kamera aktif";
    els.boothStatus.className = "status-pill ok";
  } catch {
    els.boothStatus.textContent = "Izin kamera ditolak";
    els.boothStatus.className = "status-pill bad";
    toast("Kamera belum bisa diakses. Cek izin kamera browser.");
  }
}

function drawBoothCanvas() {
  const canvas = els.boothCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#faf8ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#171717";
  ctx.font = "700 34px system-ui";
  ctx.fillText("Kopi Migi", 44, 58);
  ctx.font = "500 22px system-ui";
  ctx.fillText(new Date().toLocaleString("id-ID"), 44, 92);

  const slots = [
    [44, 122],
    [374, 122],
    [44, 554],
    [374, 554],
  ];

  slots.forEach(([x, y], index) => {
    ctx.fillStyle = "#f3f3f1";
    ctx.fillRect(x, y, 302, 392);
    const image = state.boothPhotos[index];
    if (!image) return;
    ctx.drawImage(image, x, y, 302, 392);
  });

  ctx.fillStyle = "#171717";
  ctx.font = "700 26px system-ui";
  ctx.fillText(els.boothCustomer.value.trim() || "Walk-in", 44, 1002);
  ctx.font = "500 20px system-ui";
  ctx.fillText(`Paket ${els.boothSessionPackage.value}`, 44, 1034);
}

function capturePhoto() {
  if (!els.boothVideo) return;
  if (!state.boothStream) {
    toast("Aktifkan kamera dulu.");
    return;
  }

  const image = new Image();
  const capture = document.createElement("canvas");
  capture.width = 302;
  capture.height = 392;
  const ctx = capture.getContext("2d");
  const video = els.boothVideo;
  const sourceRatio = video.videoWidth / video.videoHeight;
  const targetRatio = capture.width / capture.height;
  let sx = 0;
  let sy = 0;
  let sw = video.videoWidth;
  let sh = video.videoHeight;

  if (sourceRatio > targetRatio) {
    sw = video.videoHeight * targetRatio;
    sx = (video.videoWidth - sw) / 2;
  } else {
    sh = video.videoWidth / targetRatio;
    sy = (video.videoHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, capture.width, capture.height);
  image.onload = () => {
    state.boothPhotos.push(image);
    if (state.boothPhotos.length > 4) state.boothPhotos.shift();
    els.photoCount.textContent = String(state.boothPhotos.length);
    drawBoothCanvas();
  };
  image.src = capture.toDataURL("image/jpeg", 0.92);
}

function resetBooth() {
  if (!els.boothCanvas) return;
  state.boothPhotos = [];
  els.photoCount.textContent = "0";
  drawBoothCanvas();
}

function downloadBooth() {
  if (!els.boothCanvas) return;
  if (!state.boothPhotos.length) {
    toast("Belum ada foto untuk didownload.");
    return;
  }

  drawBoothCanvas();
  const dataUrl = els.boothCanvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `photobooth-${Date.now()}.png`;
  link.click();

  const sessions = getBoothSessions();
  sessions.unshift({
    id: `PB-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    customer: els.boothCustomer.value.trim() || "Walk-in",
    package: els.boothSessionPackage.value,
    status: "Selesai",
    image: dataUrl,
  });
  writeJson(storageKeys.booth, sessions.slice(0, 50));
  renderBoothQueue();
  toast("Hasil photobooth tersimpan di riwayat lokal.");
}

function renderBoothQueue() {
  const sessions = getBoothSessions();
  const latest = sessions.find((session) => session.status !== "Selesai");
  if (els.latestBoothCode) {
    els.latestBoothCode.textContent = state.pendingBoothCode || latest?.id || "Belum ada";
  }
  if (!els.boothQueue) return;
  els.boothQueue.innerHTML = sessions.length
    ? sessions
        .slice(0, 8)
        .map(
          (session) => `
            <article class="history-card compact-card">
              <div>
                <strong>${session.customer} · ${session.package}</strong>
                <p>${new Date(session.createdAt).toLocaleString("id-ID")} · ${session.status}</p>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">Belum ada antrian photobooth.</div>`;
}

function renderAll() {
  updateClock();
  renderCategories();
  renderMenuCategoryOptions();
  renderRecipeOptions();
  renderMenuGrid();
  renderMenuTable();
  renderCart();
  renderAnalytics();
  renderHistory();
  renderOrders();
  renderInventory();
  renderCashflow();
  renderBoothQueue();
  drawBoothCanvas();
  syncCfExpenseNoteField();
  renderWifiReceiptSettings();
  renderPendingSync();
  renderEmployeeRolesControls();
  updateLabelPreview();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Lakukan update di background dan abaikan jika gagal/offline
        registration.update().catch(() => null);
      })
      .catch((err) => {
        console.warn("Service Worker registration failed:", err);
        toast("Service worker belum aktif. Coba refresh saat online.");
      });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register);
  }

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// ─── Kehadiran & Absensi Crew ───────────────────────────────────────────

function shiftEndTime(shift) {
  return normalizeShift(shift) === "Shift 1" ? "17:00" : "22:00";
}

function shiftStartTime(shift) {
  return normalizeShift(shift) === "Shift 1" ? "10:00" : "17:00";
}

function getAttendanceForDate(dateStr) {
  const roster = getEmployeeRoster();
  const assignments = todayShiftAssignments(dateStr);
  const result = [];
  roster.forEach((name) => {
    const employeeId = assignmentEmployeeId(name);
    const empAssignments = assignments.filter(
      (a) => (a.employeeId || assignmentEmployeeId(a.employee)) === employeeId,
    );
    const onLeave = isEmployeeOnLeave(name);
    if (empAssignments.length > 0) {
      empAssignments.forEach((assignment) => {
        result.push({
          name,
          shift: assignment.shift || "",
          loginAt: assignment.loginAt || "",
          dutyRole: assignment.dutyRole || "",
          status: "hadir",
        });
      });
    } else {
      result.push({
        name,
        shift: "",
        loginAt: "",
        dutyRole: "",
        status: onLeave ? "libur" : "belum",
      });
    }
  });
  return result;
}

function getAttendanceSummary(startDate, endDate) {
  const roster = getEmployeeRoster();
  const summary = Object.fromEntries(
    roster.map((name) => [name, { name, shift1: 0, shift2: 0, total: 0 }]),
  );
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59);
  if (isNaN(start) || isNaN(end) || start > end) return Object.values(summary);
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = dateKey(cursor);
    getAttendanceForDate(dateStr).forEach(({ name, shift, status }) => {
      if (!summary[name] || status !== "hadir") return;
      summary[name].total++;
      if (normalizeShift(shift) === "Shift 1") summary[name].shift1++;
      else summary[name].shift2++;
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return Object.values(summary);
}

function initStaffDateRange() {
  const fromInput = document.querySelector("#staffDateFrom");
  const toInput = document.querySelector("#staffDateTo");
  if (!fromInput || !toInput || (fromInput.value && toInput.value)) return;
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  fromInput.value = dateKey(firstOfMonth);
  toInput.value = dateKey(today);
}

function applyStaffPresetRange(preset) {
  const fromInput = document.querySelector("#staffDateFrom");
  const toInput = document.querySelector("#staffDateTo");
  if (!fromInput || !toInput) return;
  const today = new Date();
  let fromDate = new Date(today);
  if (preset === "7days") {
    fromDate.setDate(today.getDate() - 6);
  } else {
    // month default
    fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }
  fromInput.value = dateKey(fromDate);
  toInput.value = dateKey(today);

  document.querySelectorAll(".staff-preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.rangePreset === preset);
  });
  renderStaffSummary();
}

function renderStaffTodayAttendance() {
  const container = document.querySelector("#staffTodayTable");
  const todayLabel = document.querySelector("#staffTodayDate");
  if (!container) return;
  const today = dateKey();
  if (todayLabel) {
    todayLabel.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }
  const attendance = getAttendanceForDate(today);
  if (!attendance.length) {
    container.innerHTML = `<div class="empty-state">Belum ada crew terdaftar.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="attendance-table">
      <div class="attendance-header">
        <span><i class="ph ph-user"></i> Crew</span>
        <span><i class="ph ph-calendar-check"></i> Shift</span>
        <span><i class="ph ph-sign-in"></i> Jam Masuk</span>
        <span><i class="ph ph-sign-out"></i> Jam Keluar</span>
        <span><i class="ph ph-shield-check"></i> Status</span>
      </div>
      ${attendance.map(({ name, shift, loginAt, status }) => {
        const initial = escapeHtml((name || "?").charAt(0).toUpperCase());
        const loginTime = loginAt
          ? new Date(loginAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : "-";
        const outTime = shift ? shiftEndTime(shift) : "-";
        
        let badgeHtml = "";
        if (status === "libur") {
          badgeHtml = `<span class="att-badge att-badge--leave"><i class="ph ph-palm-tree"></i> Libur</span>`;
        } else if (status === "hadir") {
          const shiftCls = normalizeShift(shift) === "Shift 1" ? "att-badge--shift1" : "att-badge--shift2";
          const iconCls = normalizeShift(shift) === "Shift 1" ? "ph-sun" : "ph-moon";
          badgeHtml = `<span class="att-badge ${shiftCls}"><i class="ph ${iconCls}"></i> ${escapeHtml(shift || "Hadir")}</span>`;
        } else {
          badgeHtml = `<span class="att-badge att-badge--absent"><i class="ph ph-clock"></i> Belum masuk</span>`;
        }

        return `<div class="attendance-row">
          <div class="att-user-cell">
            <span class="att-avatar">${initial}</span>
            <span class="att-name">${escapeHtml(name)}</span>
          </div>
          <span class="att-shift-text">${shift ? escapeHtml(shift) : "-"}</span>
          <span class="att-time-text">${loginTime}</span>
          <span class="att-time-text">${outTime}</span>
          <div>${badgeHtml}</div>
        </div>`;
      }).join("")}
    </div>
  `;
}

function renderStaffSummary() {
  const container = document.querySelector("#staffSummaryTable");
  if (!container) return;
  const fromInput = document.querySelector("#staffDateFrom");
  const toInput = document.querySelector("#staffDateTo");
  if (!fromInput?.value || !toInput?.value) {
    container.innerHTML = `<div class="empty-state">Pilih rentang tanggal lalu tekan Tampilkan.</div>`;
    return;
  }
  const summary = getAttendanceSummary(fromInput.value, toInput.value);
  if (!summary.length) {
    container.innerHTML = `<div class="empty-state">Belum ada crew terdaftar.</div>`;
    return;
  }
  const fromLabel = new Date(fromInput.value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const toLabel = new Date(toInput.value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  container.innerHTML = `
    <div class="staff-period-bar">
      <i class="ph ph-calendar"></i>
      <span>Periode Rekap: <strong>${fromLabel} – ${toLabel}</strong></span>
    </div>
    <div class="staff-summary-grid">
      ${summary.map(({ name, shift1, shift2, total }) => {
        const initial = escapeHtml((name || "?").charAt(0).toUpperCase());
        return `
        <div class="staff-summary-card">
          <div class="staff-summary-head">
            <div class="staff-summary-user">
              <span class="staff-avatar">${initial}</span>
              <strong class="staff-summary-name">${escapeHtml(name)}</strong>
            </div>
            <div class="staff-total-pill" title="Total Shift Bertugas">
              <i class="ph ph-check-square-offset"></i> ${total} Shift
            </div>
          </div>
          <div class="staff-summary-stats">
            <div class="staff-stat staff-stat--total">
              <i class="ph ph-calendar-check"></i>
              <span class="staff-stat-value">${total}</span>
              <span class="staff-stat-label">Total Shift</span>
            </div>
            <div class="staff-stat staff-stat--shift1">
              <i class="ph ph-sun"></i>
              <span class="staff-stat-value">${shift1}</span>
              <span class="staff-stat-label">Shift 1</span>
            </div>
            <div class="staff-stat staff-stat--shift2">
              <i class="ph ph-moon"></i>
              <span class="staff-stat-value">${shift2}</span>
              <span class="staff-stat-label">Shift 2</span>
            </div>
          </div>
        </div>
      `;
      }).join("")}
    </div>
  `;
}

function renderStaffView() {
  renderStaffTodayAttendance();
  renderStaffSummary();
}

// ─────────────────────────────────────────────────────────────────────────────

async function renderDeviceMonitor() {
  const container = document.querySelector("#activeDevicesContainer");
  if (!container || !isOwner()) return;

  container.innerHTML = `<div class="empty-state">Memuat perangkat terhubung...</div>`;
  try {
    // Pastikan presence device sendiri ter-update sebelum mengambil daftar terbaru
    await updateDevicePresence().catch(() => null);

    const result = await postSupabaseAction("list-devices");
    if (!result?.success || !Array.isArray(result.devices)) {
      container.innerHTML = `<div class="empty-state">Gagal memuat perangkat: ${escapeHtml(result?.error || "Koneksi bermasalah")}</div>`;
      return;
    }

    const currentDevId = ensureDeviceId();
    const now = Date.now();
    const devices = result.devices;

    if (!devices.length) {
      container.innerHTML = `<div class="empty-state">Tidak ada perangkat aktif terdeteksi.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="attendance-table">
        <div class="attendance-header" style="grid-template-columns: 2fr 1.5fr 1.5fr 1fr;">
          <span><i class="ph ph-desktop"></i> Perangkat / Device</span>
          <span><i class="ph ph-user"></i> Petugas</span>
          <span><i class="ph ph-clock"></i> Terakhir Aktif</span>
          <span><i class="ph ph-gear"></i> Aksi</span>
        </div>
        ${devices.map((dev) => {
          const isCurrent = dev.deviceId === currentDevId;
          const lastSeenDate = dev.lastSeenAt ? new Date(dev.lastSeenAt) : null;
          const diffMinutes = lastSeenDate ? Math.floor((now - lastSeenDate.getTime()) / 60000) : 999;
          const isOnline = diffMinutes < 3;
          const timeText = lastSeenDate
            ? diffMinutes < 1
              ? "Baru saja"
              : `${diffMinutes} mnt lalu`
            : "-";
          
          let uaShort = "Perangkat Web";
          if (dev.userAgent) {
            const ua = dev.userAgent;
            const isAndroid = /android/i.test(ua);
            const isIOS = /iphone|ipad|ipod/i.test(ua);
            const isMac = /mac/i.test(ua);
            const isWin = /windows/i.test(ua);
            const isChrome = /chrome|crios/i.test(ua) && !/edg/i.test(ua);
            const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
            const isFirefox = /firefox|fxios/i.test(ua);
            
            const b = isChrome ? "Chrome" : isSafari ? "Safari" : isFirefox ? "Firefox" : "Browser";
            const os = isAndroid ? "Android" : isIOS ? "iOS" : isMac ? "macOS" : isWin ? "Windows" : "";
            uaShort = [b, os].filter(Boolean).join(" · ") || "Perangkat Web";
          }

          const statusDot = isOnline ? "🟢 Online" : "⚪ Offline";
          const roleLabel = dev.role === "owner" ? `<span style="color:var(--accent); font-weight:bold; font-size:11px;"> (Owner)</span>` : "";

          return `
            <div class="attendance-row" style="grid-template-columns: 2fr 1.5fr 1.5fr 1fr;">
              <div class="att-user-cell">
                <span class="att-avatar"><i class="ph ph-device-mobile"></i></span>
                <div>
                  <strong class="att-name" style="font-size: 13px;">${escapeHtml(uaShort)}</strong>
                  <span style="font-size: 10px; color: var(--muted); display: block;">ID: ${escapeHtml((dev.deviceId || "").slice(0, 12))}... ${isCurrent ? "(Device Ini)" : ""}</span>
                </div>
              </div>
              <span class="att-shift-text">${escapeHtml(dev.employee || "Tanpa Nama")}${roleLabel}</span>
              <div>
                <span class="att-time-text" style="display: block;">${timeText}</span>
                <small style="font-size: 10px; color: var(--muted);">${statusDot}</small>
              </div>
              <div>
                ${isCurrent 
                  ? `<span class="att-badge att-badge--shift1">Device Ini</span>` 
                  : `<button type="button" class="secondary-button compact danger-text" data-force-logout="${escapeHtml(dev.deviceId)}"><i class="ph ph-power"></i> Keluar</button>`}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Gagal memuat data perangkat: ${escapeHtml(err.message)}</div>`;
  }
}

async function forceLogoutDeviceAction(deviceId) {
  if (!isOwner() || !deviceId) return;
  if (!confirm("Apakah Anda yakin ingin mengeluarkan (force logout) perangkat ini?")) return;

  try {
    const result = await postSupabaseAction("force-logout-device", { deviceId });
    if (result?.success) {
      toast("Perangkat berhasil dikeluarkan.");
      renderDeviceMonitor();
    } else {
      toast(result?.error || "Gagal mengeluarkan perangkat.");
    }
  } catch (err) {
    toast(`Gagal force logout: ${err.message}`);
  }
}

function setActiveView(viewName, { persist = true } = {}) {
  if ((viewName === "cashflow" || viewName === "staff") && !isOwner()) {
    viewName = "pos";
  }
  const target = document.querySelector(`#view-${viewName}`);
  const tab = [...els.tabs].find((entry) => entry.dataset.view === viewName);
  if (!target || !tab) return false;
  els.tabs.forEach((entry) => entry.classList.remove("active"));
  els.views.forEach((view) => view.classList.remove("active"));
  tab.classList.add("active");
  target.classList.add("active");
  if (persist) localStorage.setItem(storageKeys.activeView, viewName);
  if (viewName === "settings") {
    updateLabelPreview();
    if (isOwner()) renderDeviceMonitor();
  }
  if (viewName === "cashflow") {
    refreshCashflowSalesForSelection({ silent: true }).then((loaded) => {
      if (!loaded) renderCashflow();
    });
  }
  if (viewName === "analytics") {
    refreshAnalyticsPeriod({ silent: true }).then((loaded) => {
      if (!loaded) renderAnalytics();
    });
  }
  if (viewName === "staff") {
    initStaffDateRange();
    renderStaffView();
  }
  return true;
}

function restoreActiveView() {
  const savedView = localStorage.getItem(storageKeys.activeView);
  if (savedView) setActiveView(savedView, { persist: false });
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveView(tab.dataset.view);
  });
});

els.printerToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePrinterDropdown();
});

els.printerDropdown.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("click", () => {
  togglePrinterDropdown(false);
});

els.connectPrinter.addEventListener("click", connectPrinter);

// Tombol Sambungkan Printer di dalam modal order \u2014 trigger koneksi lalu update banner
// Icon printer struk di header modal — klik untuk sambungkan
els.receiptPrinterWarningBtn?.addEventListener("click", async () => {
  await connectPrinter();
  syncReceiptPrinterWarning();
});

// Icon printer label di header modal — informatif saja (cetak ulang dari tab Order)
els.labelPrinterWarningBtn?.addEventListener("click", () => {
  toast("Label bisa dicetak ulang dari tab Order setelah printer label tersambung.");
});
els.fullscreenToggle?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButton);

els.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  renderMenuGrid();
});

els.openCustomOrder?.addEventListener("click", openCustomOrderModal);
els.cancelCustomOrder?.addEventListener("click", closeCustomOrderModal);
els.customOrderCancelBtn?.addEventListener("click", closeCustomOrderModal);
els.customOrderIngredient?.addEventListener("change", syncCustomOrderIngredientUnit);
els.customOrderPrice?.addEventListener("blur", () => {
  const value = parseRupiah(els.customOrderPrice.value);
  els.customOrderPrice.value = value ? money(value) : "";
});
els.customOrderForm?.addEventListener("submit", addCustomOrderToCart);

els.itemCustomForm?.addEventListener("submit", saveItemCustomization);
els.closeItemCustom?.addEventListener("click", closeItemCustomModal);
const handleSegmentedClick = (event) => {
  const btn = event.target.closest("button[data-value]");
  if (!btn) return;
  const parent = btn.parentElement;
  parent.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  if (parent.id === "customTemp") syncCustomIceVisibility();
};
function syncCustomIceVisibility() {
  const isIce = els.customTemp?.querySelector("button.active")?.dataset.value === "ICE";
  if (els.customIceGroup) els.customIceGroup.hidden = !isIce;
}
els.customTemp?.addEventListener("click", handleSegmentedClick);
els.customIce?.addEventListener("click", handleSegmentedClick);
els.customSugar?.addEventListener("click", handleSegmentedClick);
els.customSize?.addEventListener("click", handleSegmentedClick);

els.ingredientCategorySelect?.addEventListener("change", syncIngredientCategoryField);
els.ingredientCategoryCustom?.addEventListener("input", syncIngredientCategoryField);
els.stockCategoryTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-stock-category]");
  if (!button) return;
  state.stockCategory = button.dataset.stockCategory;
  renderInventory();
});

els.menuGrid.addEventListener("click", (event) => {
  const decrease = event.target.closest("[data-menu-decrease]");
  if (decrease) {
    event.stopPropagation();
    changeQty(decrease.dataset.menuDecrease, -1);
    return;
  }
  const increase = event.target.closest("[data-menu-increase]");
  if (increase) {
    event.stopPropagation();
    changeQty(increase.dataset.menuIncrease, 1);
    return;
  }
  const button = event.target.closest(".menu-card");
  if (!button) return;
  addToCart(button.dataset.id);
});

els.menuGrid.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".menu-card");
  if (!card) return;
  event.preventDefault();
  addToCart(card.dataset.id);
});

els.cartList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "customize") {
    openItemCustomModal(button.dataset.id);
  } else {
    changeQty(button.dataset.id, action === "increase" ? 1 : -1);
  }
});

els.paymentMethods.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-payment]");
  if (!button) return;
  if (state.orderType === "staff_drink") return;
  const previousPayment = state.payment;
  state.payment = button.dataset.payment;
  els.paymentMethods.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
  if (state.payment !== previousPayment) {
    els.paidAmount.value = state.payment === "Tunai" ? "" : totals().grandTotal;
  }
  updateChange();
});

els.orderTypeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-order-type]");
  if (!button) return;
  if (button.dataset.orderType === "staff_drink" && staffDrinkItemCount() !== 1) {
    toast("Staff Drink hanya bisa dipilih untuk tepat 1 item.");
    return;
  }
  state.orderType = button.dataset.orderType || "normal";
  if (state.orderType === "staff_drink") {
    clearDiscountState();
  }
  renderCart();
});

els.dineTakeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-service-type]");
  if (!button) return;
  state.serviceType = button.dataset.serviceType || "dine_in";
  syncDineTakeUi();
});

els.discountVoucherSelect?.addEventListener("change", () => {
  const selected = els.discountVoucherSelect?.value || "";
  if (selected !== state.discountVoucherId) {
    state.discountType = "none";
    state.discountValue = 0;
    state.discountNote = "";
    state.discountVoucherId = "";
    state.pendingDiscountVoucherId = selected;
  }
  if (els.discountVoucherSelect) els.discountVoucherSelect.value = selected;
  renderDiscountVoucherControls();
  renderCart();
});

els.applyDiscountVoucher?.addEventListener("click", () => {
  const voucherId = els.discountVoucherSelect?.value || state.pendingDiscountVoucherId || "";
  if (!voucherId) {
    clearDiscountState();
    renderCart();
    return toast("Pilih voucher dulu.");
  }
  if (applyDiscountVoucher(voucherId)) toast("Voucher diterapkan.");
});

els.clearDiscountVoucher?.addEventListener("click", () => {
  clearDiscountState();
  renderCart();
});

els.orderChannels?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-channel]");
  if (!button) return;
  setOrderChannel(button.dataset.channel);
});

  els.orderStatusTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-order-status]");
  if (!button) return;
  state.orderStatus = button.dataset.orderStatus;
  els.orderStatusTabs.querySelectorAll("button[data-order-status]").forEach((entry) => entry.classList.toggle("active", entry === button));
  if (state.orderStatus === "paid") {
    const date = els.paidOrderDate?.value || dateKey();
    refreshAnalyticsPeriod({ month: date.slice(0, 7), range: "daily", silent: true }).then(() => renderOrders());
  } else {
    renderOrders();
  }
});

els.paidOrderCategoryTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-paid-order-category]");
  if (!button) return;
  state.paidOrderCategory = button.dataset.paidOrderCategory;
  renderOrders();
});

els.chartRangeTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-chart-range]");
  if (!button) return;
  state.chartRange = button.dataset.chartRange;
  els.chartRangeTabs.querySelectorAll("button[data-chart-range]").forEach((entry) => entry.classList.toggle("active", entry === button));
  renderAnalyticsControls();
  refreshAnalyticsPeriod({ range: state.chartRange, silent: true }).then((loaded) => {
    if (!loaded) renderAnalytics();
  });
});

els.discountVoucherForm?.addEventListener("submit", saveDiscountVoucher);

els.discountVoucherList?.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("button[data-toggle-voucher]");
  const deleteButton = event.target.closest("button[data-delete-voucher]");
  if (toggleButton) {
    const id = toggleButton.dataset.toggleVoucher;
    mutateDiscountVoucher(id, (voucher) => ({ ...voucher, active: voucher.active === false, updatedAt: new Date().toISOString() }));
    return;
  }
  if (deleteButton) {
    const id = deleteButton.dataset.deleteVoucher;
    mutateDiscountVoucher(id, (_voucher, vouchers) => vouchers.filter((entry) => entry.id !== id));
  }
});

els.orderList?.addEventListener("click", (event) => {
  const payButton = event.target.closest("button[data-pay-draft]");
  const editButton = event.target.closest("button[data-edit-draft]");
  const deleteButton = event.target.closest("button[data-delete-draft]");
  const reprintButton = event.target.closest("button[data-reprint-order]");
  const deleteTransactionButton = event.target.closest("button[data-delete-transaction]");
  const editTransactionButton = event.target.closest("button[data-edit-transaction]");
  const completeKitchenButton = event.target.closest("button[data-complete-kitchen-order]");
  const printLabelButton = event.target.closest("button[data-print-label]");
  if (payButton) {
    payDraftOrder(payButton.dataset.payDraft);
    return;
  }
  if (editButton) {
    editDraftOrder(editButton.dataset.editDraft);
    return;
  }
  if (deleteTransactionButton) {
    deletePaidTransaction(deleteTransactionButton.dataset.deleteTransaction);
    return;
  }
  if (editTransactionButton) {
    openTransactionEditModal(editTransactionButton.dataset.editTransaction);
    return;
  }
  if (completeKitchenButton) {
    completeKitchenOrder(completeKitchenButton.dataset.completeKitchenOrder);
    return;
  }
  if (reprintButton) {
    reprintOrder(reprintButton.dataset.reprintOrder, reprintButton.dataset.reprintKind);
    return;
  }
  if (printLabelButton) {
    const id = printLabelButton.dataset.printLabel;
    const kind = printLabelButton.dataset.printKind;
    const source = kind === "bill" ? getOrderDrafts() : getHistory();
    const transaction = source.find((entry) => entry.id === id);
    if (transaction) {
      if (!isLabelPrinterReady()) {
        toast("Printer Label belum tersambung.");
      } else {
        printCupLabels(transaction);
      }
    } else {
      toast("Data order tidak ditemukan.");
    }
    return;
  }
  if (deleteButton) {
    deleteDraftOrder(deleteButton.dataset.deleteDraft);
  }
});

els.orderList?.addEventListener("change", (event) => {
  const paymentSelect = event.target.closest("select[data-edit-payment]");
  if (!paymentSelect) return;
  editPaidPayment(paymentSelect.dataset.editPayment, paymentSelect.value);
});

els.pendingSyncList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-reprint-offline]");
  if (!button) return;
  const localId = button.dataset.reprintOffline;
  const transaction = (await getOfflineTransactions()).find((entry) => entry.localId === localId);
  if (!transaction) {
    toast("Transaksi offline tidak ditemukan.");
    return;
  }
  const printed = await printReceipt(transaction, isUnpaidTransaction(transaction) ? "bill" : "paid");
  await updateOfflineTransaction(localId, { printStatus: printed ? "PRINTED" : "PRINT_FAILED" }).catch(() => null);
  renderPendingSync();
});

els.manualSyncBtn?.addEventListener("click", () => refreshOnlineData({ render: true }).catch(() => null));
els.manualSyncOrdersBtn?.addEventListener("click", () => refreshOnlineData({ render: true }).catch(() => null));
els.closeShiftBtn?.addEventListener("click", closeActiveShift);
els.inputDailyCashBtn?.addEventListener("click", () => openDailyCashModal(selectedDailyDate()));
els.cancelDailyCash?.addEventListener("click", closeDailyCashModal);
els.dailyCashCancelBtn?.addEventListener("click", closeDailyCashModal);
els.dailyCashAmount?.addEventListener("input", () => {
  const amount = parseRupiah(els.dailyCashAmount.value);
  els.dailyCashAmount.value = amount ? money(amount) : "";
});
els.dailyCashForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner()) return toast("Kas Harian hanya dapat diinput Owner.");
  const amount = parseRupiah(els.dailyCashAmount.value);
  if (amount <= 0) {
    toast("Isi nominal kas harian untuk kembalian.");
    els.dailyCashAmount.focus();
    return;
  }
  const reportDateValue = els.dailyCashForm.dataset.reportDate || selectedDailyDate();
  saveDailyCashReport(reportDateValue, amount);
  closeDailyCashModal();
  renderHistory();
  if (navigator.onLine) {
    try {
      await syncSettingsToCloud({ force: true });
    } catch {
      toast("Kas tersimpan di perangkat dan akan disinkronkan saat online.");
    }
  }
  renderAnalytics();
  state.reportShareText = dailyReportText(dayTransactions(reportDateValue), reportDateValue);
  toast(`Kas Harian ${reportDateValue} tersimpan.`);
});
els.wifiSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner()) {
    toast("Pengaturan WiFi hanya untuk Owner.");
    return;
  }
  const enabled = els.wifiReceiptEnabled.checked;
  const ssid = els.wifiName.value.trim();
  const password = els.wifiPassword.value;
  if (enabled && (!ssid || !password)) {
    toast("Isi nama dan password WiFi sebelum mengaktifkan QR.");
    return;
  }
  saveWifiReceiptSettings({ enabled, ssid, password });
  syncCheckoutWifiOption({ reset: true });
  
  // Set status edit selesai agar form menyembunyikan diri
  state.wifiEditing = false;
  renderWifiReceiptSettings();

  try {
    await syncSettingsToCloud({ force: true });
    toast(enabled ? "QR WiFi akan dicetak pada struk lunas." : "QR WiFi pada struk dinonaktifkan.");
  } catch {
    toast("Pengaturan WiFi tersimpan lokal dan akan disinkronkan saat online.");
  }
});

// Listener interaksi WiFi tamu tambahan
els.wifiReceiptEnabled?.addEventListener("change", () => {
  state.wifiEditing = true;
  toggleWifiFields();
});

els.btnEditWifi?.addEventListener("click", () => {
  state.wifiEditing = true;
  toggleWifiFields();
  els.wifiName.focus();
});
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
window.addEventListener("storage", (event) => {
  if (event.key === storageKeys.logoutSignal && event.newValue && isLoggedIn()) {
    logout({ remote: true });
  }
});

els.menuSearch.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderMenuGrid();
});

els.resetFilter.addEventListener("click", () => {
  state.search = "";
  state.category = "Semua";
  els.menuSearch.value = "";
  renderAll();
});

els.clearCart.addEventListener("click", () => {
  clearActiveOrder();
});

els.clearCartPanel?.addEventListener("click", () => {
  clearActiveOrder();
});

els.paidAmount.addEventListener("input", updateChange);
els.checkoutBtn.addEventListener("click", checkout);
els.boothPackage.addEventListener("change", () => {
  if (hasPhotoboothCart()) upsertPendingBoothSession();
});
els.employeeAddForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner()) {
    toast("Tambah crew hanya untuk Owner.");
    return;
  }
  const name = els.employeeNewName?.value.trim();
  if (!name) return;
  if (!navigator.onLine) {
    toast("Tambah crew membutuhkan koneksi internet agar tersimpan di Supabase.");
    return;
  }
  try {
    await addEmployeeInCloud(name);
  } catch {
    toast("Crew belum tersimpan. Coba lagi saat koneksi stabil.");
    return;
  }
  forgetDeletedEmployee(name);
  clearEmployeeLeaveStatus(name);
  saveEmployeeRoster([...getEmployeeRoster(), name], { dirty: true });
  localStorage.setItem(storageKeys.employee, name);
  const auth = readJson(storageKeys.auth, null);
  if (auth?.loggedIn) writeJson(storageKeys.auth, { ...auth, employee: name });
  if (els.employeeNewName) els.employeeNewName.value = "";
  await loadCloudData().catch(() => null);
  renderEmployeeControls();
  toast(`${name} ditambahkan ke daftar crew.`);
});
els.employeeList?.addEventListener("click", (event) => {
  const leaveButton = event.target.closest("button[data-toggle-employee-leave]");
  const deleteButton = event.target.closest("button[data-delete-employee]");
  if (leaveButton) {
    if (!isOwner()) {
      toast("Status libur hanya untuk Owner.");
      return;
    }
    const name = decodeURIComponent(leaveButton.dataset.toggleEmployeeLeave);
    toggleEmployeeLeave(name);
    return;
  }
  if (deleteButton) {
    if (!isOwner()) {
      toast("Hapus role hanya untuk Owner.");
      return;
    }
    const name = decodeURIComponent(deleteButton.dataset.deleteEmployee);
    openEmployeeDeleteModal(name);
  }
});
els.employeeDeleteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  confirmEmployeeDelete();
});
els.cancelEmployeeDelete?.addEventListener("click", closeEmployeeDeleteModal);
els.employeeDeleteCancelBtn?.addEventListener("click", closeEmployeeDeleteModal);
els.transactionEditCloseBtn?.addEventListener("click", closeTransactionEditModal);
els.transactionEditCancelBtn?.addEventListener("click", closeTransactionEditModal);
els.transactionEditForm?.addEventListener("submit", saveTransactionEdit);
els.transactionEditAddBtn?.addEventListener("click", addEditingMenuItem);
els.transactionEditItems?.addEventListener("click", (event) => {
  const decrease = event.target.closest("[data-edit-item-decrease]");
  const increase = event.target.closest("[data-edit-item-increase]");
  const remove = event.target.closest("[data-edit-item-remove]");
  if (decrease) {
    changeEditingItem(Number(decrease.dataset.editItemDecrease), -1);
    return;
  }
  if (increase) {
    changeEditingItem(Number(increase.dataset.editItemIncrease), 1);
    return;
  }
  if (remove) {
    const index = Number(remove.dataset.editItemRemove);
    state.editingTransactionItems.splice(index, 1);
    renderTransactionEditModal();
  }
});
els.transactionEditPayment?.addEventListener("change", renderTransactionEditModal);
els.logoutBtn.addEventListener("click", logout);
els.testLogoPrint?.addEventListener("click", testLogoPrint);
els.connectLabelPrinter?.addEventListener("click", connectLabelPrinter);
els.testLabelPrint?.addEventListener("click", testLabelPrint);
els.printerTabKasir?.addEventListener("click", () => switchPrinterTab("kasir"));
els.printerTabLabel?.addEventListener("click", () => switchPrinterTab("label"));

els.printerPaperSize?.addEventListener("change", () => {
  localStorage.setItem("kasir-migi-printer-paper-size", els.printerPaperSize.value);
});
function openLabelSettingsModal() {
  const modal = els.labelSettingsModal;
  if (!modal) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  updateLabelPreview();
}
function closeLabelSettingsModal() {
  const modal = els.labelSettingsModal;
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

els.openLabelSettingsBtn?.addEventListener("click", openLabelSettingsModal);
els.closeLabelSettingsBtn?.addEventListener("click", closeLabelSettingsModal);
els.saveLabelSettingsBtn?.addEventListener("click", async () => {
  saveLabelPrinterSettingsFromUI();
  const synced = await syncSettingsToCloud({ force: true }).catch(() => false);
  closeLabelSettingsModal();
  toast(synced ? "Tata letak stiker tersimpan dan tersinkron." : "Tata letak stiker tersimpan lokal; sync cloud akan dicoba lagi.");
});

els.labelPrinterPrintEngine?.addEventListener("change", saveLabelPrinterSettingsFromUI);
els.labelPrinterPaperSize?.addEventListener("change", saveLabelPrinterSettingsFromUI);
els.labelPrinterFeedMethod?.addEventListener("change", saveLabelPrinterSettingsFromUI);
els.labelPrinterPitch?.addEventListener("input", saveLabelPrinterSettingsFromUI);
els.labelPrinterDelay?.addEventListener("input", saveLabelPrinterSettingsFromUI);
els.labelStickerOffsetX?.addEventListener("input", saveLabelPrinterSettingsFromUI);

const bindSettingListeners = (key) => {
  els[`label${key}Enabled`]?.addEventListener("change", saveLabelPrinterSettingsFromUI);
  els[`label${key}Bold`]?.addEventListener("change", saveLabelPrinterSettingsFromUI);
  els[`label${key}FontSize`]?.addEventListener("input", saveLabelPrinterSettingsFromUI);
};
  ["DrinkName", "Notes", "OrderCode", "Customer", "Counter", "CustomText"].forEach(bindSettingListeners);
els.labelCustomTextValue?.addEventListener("input", saveLabelPrinterSettingsFromUI);
els.labelBarcodeEnabled?.addEventListener("change", saveLabelPrinterSettingsFromUI);
els.labelLogoEnabled?.addEventListener("change", saveLabelPrinterSettingsFromUI);
els.labelCustomImageEnabled?.addEventListener("change", saveLabelPrinterSettingsFromUI);
els.labelCustomImageFile?.addEventListener("change", handleLabelCustomImageUpload);
els.removeLabelCustomImage?.addEventListener("click", removeLabelCustomImage);
els.labelServiceTypeEnabled?.addEventListener("change", saveLabelPrinterSettingsFromUI);
els.labelServiceTypeFontSize?.addEventListener("input", saveLabelPrinterSettingsFromUI);
els.labelDrinkNameHeight?.addEventListener("input", () => {
  const height = Math.max(20, Math.min(100, Number(els.labelDrinkNameHeight.value || 48)));
  if (els.labelDrinkNameHeightVal) els.labelDrinkNameHeightVal.textContent = String(height);
  if (els.labelPreviewDrinkName) {
    els.labelPreviewDrinkName.style.height = `${height}px`;
    els.labelPreviewDrinkName.style.maxHeight = `${height}px`;
  }
  saveLabelPrinterSettingsFromUI();
});

window.addEventListener("resize", () => {
  const viewSettings = document.getElementById("view-settings");
  if (viewSettings && viewSettings.classList.contains("active")) {
    updateLabelPreview();
  }
});

els.billOrderBtn.addEventListener("click", printBill);
els.copyDailyReport?.addEventListener("click", copyDailyReport);
els.shareDailyReport?.addEventListener("click", shareDailyReportToWhatsApp);
els.downloadDailyPdf?.addEventListener("click", downloadDailyReportPdf);

els.menuForm.addEventListener("submit", saveMenu);
els.purchaseForm?.addEventListener("submit", savePurchase);
els.syncTodayStockBtn?.addEventListener("click", () => {
  if (!window.confirm("Sinkronkan stok dari transaksi hari ini yang belum pernah dipotong stoknya?")) return;
  syncTodayStockFromSales();
});
els.priceListToggle?.addEventListener("click", () => {
  const isOpen = els.priceListToggle.getAttribute("aria-expanded") === "true";
  setPriceListOpen(!isOpen);
});
els.stockAvailabilityList?.addEventListener("click", (event) => {
  const stockCard = event.target.closest("[data-edit-active-stock]");
  if (!stockCard) return;
  openStockEditModal(stockCard.dataset.editActiveStock);
});
els.stockAvailabilityList?.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const stockCard = event.target.closest("[data-edit-active-stock]");
  if (!stockCard) return;
  event.preventDefault();
  openStockEditModal(stockCard.dataset.editActiveStock);
});
els.stockEditSlider?.addEventListener("input", () => syncStockEditControls("slider"));
els.stockEditInput?.addEventListener("input", () => syncStockEditControls("input"));
els.stockEditForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isOwner()) {
    toast("Edit stock aktif hanya untuk Owner.");
    return;
  }
  const id = els.stockEditForm.dataset.stockId;
  const inventory = getInventory();
  const record = inventory[id];
  const nextStock = Number(els.stockEditInput?.value || 0);
  if (!record || !Number.isFinite(nextStock) || nextStock < 0) {
    toast("Stock aktif tidak valid.");
    return;
  }
  inventory[id] = {
    ...record,
    stock: nextStock,
    updatedAt: new Date().toISOString(),
  };
  saveLocalInventoryChange(inventory);
  closeStockEditModal();
  renderInventory();
  syncInventoryToCloud().catch(() => null);
  toast(`Stock aktif ${record.name} diperbarui.`);
});
els.cancelStockEdit?.addEventListener("click", closeStockEditModal);
els.stockEditCancelBtn?.addEventListener("click", closeStockEditModal);

// ── Arus Kas: form pengeluaran ──────────────────────────────────────────────
els.cashflowExpenseForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isOwner()) {
    toast("Arus Kas hanya untuk Owner.");
    return;
  }
  const rawNoteValue = els.cfExpenseNote?.value?.trim();
  const amount = parseRupiah(els.cfExpenseAmount?.value);
  const category = els.cfExpenseCategory?.value;
  if (!rawNoteValue || !amount) {
    toast("Keterangan dan harga total wajib diisi.");
    return;
  }
  let note = rawNoteValue;
  const payload = {
    id: `EXP-${Date.now().toString(36).toUpperCase()}`,
    note,
    amount,
    category,
    createdAt: new Date().toISOString(),
  };

  if (category === "Bahan Baku") {
    const inventory = getInventory();
    const ingredientId = rawNoteValue;
    const ingredient = inventory[ingredientId];
    const qty = Number(els.cfExpenseQty?.value || 0);
    const unit = els.cfExpenseUnit?.value || ingredient?.unit || "gram";
    if (!ingredient || !ingredient.name || !unit || !Number.isFinite(qty) || qty <= 0) {
      toast("Pilih bahan dari Daftar Harga, lalu isi jumlah dan harga total.");
      return;
    }
    note = `Beli ${ingredient.name}`;
    payload.note = note;
    payload.ingredientId = ingredientId;
    payload.qty = qty;
    payload.unit = unit;
    inventory[ingredientId] = {
      ...ingredient,
      name: ingredient.name,
      category: ingredientCategory(ingredient),
      unit,
      stock: Number(ingredient.stock || 0) + qty,
      buyPrice: amount / qty,
      updatedAt: payload.createdAt,
    };
    saveLocalInventoryChange(inventory);
  }

  saveCashflowExpense({
    ...payload,
  });
  els.cfExpenseAmount.value = "";
  if (els.cfExpenseNote.tagName === "INPUT") els.cfExpenseNote.value = "";
  if (els.cfExpenseQty) els.cfExpenseQty.value = "";
  if (els.cfExpenseUnit) els.cfExpenseUnit.value = "gram";
  syncCfExpenseNoteField();
  renderInventory();
  renderCashflow();
  syncCashflowToCloud().catch(() => null);
  if (category === "Bahan Baku") syncInventoryToCloud().catch(() => null);
  toast("Pengeluaran dicatat.");
});

els.cfExpenseCategory?.addEventListener("change", syncCfExpenseNoteField);
els.cashflowExpenseForm?.addEventListener("change", (event) => {
  if (event.target.id !== "cfExpenseNote") return;
  if (els.cfExpenseCategory?.value !== "Bahan Baku") return;
  const ingredient = getInventory()[els.cfExpenseNote.value];
  if (els.cfExpenseUnit) els.cfExpenseUnit.value = ingredient?.unit || "gram";
});

els.cfExpenseAmount?.addEventListener("blur", () => {
  const value = parseRupiah(els.cfExpenseAmount.value);
  els.cfExpenseAmount.value = value ? money(value) : "";
});

els.cfFilterTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cf-filter]");
  if (!button) return;
  els.cfFilterTabs.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
  renderCashflow();
});

els.cashflowPeriodTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cashflow-period]");
  if (!button) return;
  els.cashflowPeriodTabs.querySelectorAll("button").forEach((entry) => entry.classList.toggle("active", entry === button));
  refreshCashflowSalesForSelection({ silent: true }).then((loaded) => {
    if (!loaded) renderCashflow();
  });
});

els.cashflowMonth?.addEventListener("change", () => {
  refreshCashflowSalesForSelection({ silent: true }).then((loaded) => {
    if (!loaded) renderCashflow();
  });
});
els.cashflowDate?.addEventListener("change", () => {
  refreshCashflowSalesForSelection({ silent: true }).then((loaded) => {
    if (!loaded) renderCashflow();
  });
});

els.cashflowList?.addEventListener("click", (event) => {
  const deleteBtn = event.target.closest("button[data-delete-expense]");
  if (!deleteBtn) return;
  if (!isOwner()) {
    toast("Arus Kas hanya untuk Owner.");
    return;
  }
  const id = deleteBtn.dataset.deleteExpense;
  const expense = getCashflowExpenses().find((entry) => entry.id === id);
  const label = expense?.note || "pengeluaran ini";
  if (!window.confirm(`Hapus "${label}"?`)) return;
  const expenses = getCashflowExpenses().filter((entry) => entry.id !== id);
  writeJson(storageKeys.cashflowExpenses, expenses);
  renderCashflow();
  deleteCashflowInCloud(id).catch(() => syncCashflowToCloud().catch(() => null));
  toast("Pengeluaran dihapus.");
});

// ── Cashflow search ──────────────────────────────────────────────────────────
els.cashflowSearch?.addEventListener("input", () => renderCashflow());

// ── Bahan Baku: edit & delete stock ────────────────────────────────────────
els.stockTable?.addEventListener("click", (event) => {
  const editBtn = event.target.closest("button[data-edit-stock]");
  const deleteBtn = event.target.closest("button[data-delete-stock]");

  if (editBtn) {
    if (!isOwner()) {
      toast("Edit bahan baku hanya untuk Owner.");
      return;
    }
    const id = editBtn.dataset.editStock;
    const inventory = getInventory();
    const record = inventory[id];
    if (!record) return;
    els.purchaseMenuId.value = record.name;
    if (els.ingredientCategory) els.ingredientCategory.value = ingredientCategory(record);
    renderIngredientCategoryOptions(ingredientCategory(record));
    els.purchaseQty.value = 1;
    els.ingredientUnit.value = record.unit || "gram";
    els.purchaseCost.value = record.buyPrice ? money(record.buyPrice) : "";
    els.purchaseForm.dataset.editingStockId = id;
    els.purchaseForm.querySelector("button[type=submit]").textContent = `Update Bahan: ${record.name}`;
    els.purchaseForm.scrollIntoView({ behavior: "smooth", block: "start" });
    toast(`Edit ${record.name}: ubah nama, satuan, dan harga per unit.`);
    return;
  }

  if (deleteBtn) {
    if (!isOwner()) {
      toast("Hapus bahan baku hanya untuk Owner.");
      return;
    }
    const id = deleteBtn.dataset.deleteStock;
    const inventory = getInventory();
    if (!inventory[id]) return;
    const name = inventory[id].name;
    if (!window.confirm(`Hapus bahan "${name}" dari daftar? Data stok dan harganya akan hilang.`)) return;
    delete inventory[id];
    saveLocalInventoryChange(inventory);
    renderInventory();
    renderCashflow();
    syncCfExpenseNoteField();
    deleteInventoryInCloud(id).catch(() => syncInventoryToCloud().catch(() => null));
    toast(`Bahan "${name}" dihapus dari stok.`);
  }
});
els.addRecipeIngredient?.addEventListener("click", (event) => {
  event.preventDefault();
  if (!els.recipeIngredientRows) return;
  const rows = recipeDraftRows();
  rows.push({ ingredientId: "", qty: "" });
  renderRecipeRowsFromRows(rows);
  els.recipeIngredientRows.querySelector(".recipe-ingredient-row:last-child .recipe-ingredient-select")?.focus();
});
els.recipeIngredientRows?.addEventListener("change", (event) => {
  if (event.target.closest(".recipe-ingredient-select")) updateRecipeRowUnits();
});
els.recipeIngredientRows?.addEventListener("click", (event) => {
  const button = event.target.closest(".recipe-remove-button");
  if (!button) return;
  const rows = els.recipeIngredientRows.querySelectorAll(".recipe-ingredient-row");
  if (rows.length <= 1) {
    const row = button.closest(".recipe-ingredient-row");
    row.querySelector(".recipe-ingredient-select").value = "";
    row.querySelector(".recipe-qty-input").value = "";
    updateRecipeRowUnits();
    return;
  }
  button.closest(".recipe-ingredient-row")?.remove();
});
els.cancelMenuEdit.addEventListener("click", resetMenuForm);
els.menuCategorySelect.addEventListener("change", syncMenuCategoryField);
els.menuCategoryCustom.addEventListener("input", syncMenuCategoryField);
els.menuImageFile?.addEventListener("change", readMenuImageFile);
els.menuPrice.addEventListener("blur", () => {
  const value = parseRupiah(els.menuPrice.value);
  els.menuPrice.value = value ? money(value) : "";
});
els.purchaseCost?.addEventListener("blur", () => {
  const value = parseRupiah(els.purchaseCost.value);
  els.purchaseCost.value = value ? money(value) : "";
});
els.menuEditCategoryTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-menu-edit-category]");
  if (!button) return;
  state.menuEditCategory = button.dataset.menuEditCategory;
  renderMenuTable();
});
els.menuEditSearch?.addEventListener("input", (event) => {
  state.menuEditSearch = event.target.value;
  renderMenuTable();
});
els.menuTable.addEventListener("click", async (event) => {
  const editButton = event.target.closest("button[data-edit-menu]");
  const deleteButton = event.target.closest("button[data-delete-menu]");
  const menu = getMenu();

    if (editButton) {
      const item = menu.find((entry) => entry.id === editButton.dataset.editMenu);
      if (!item) return;
      els.menuId.value = item.id;
      els.menuName.value = item.name;
      els.menuCategory.value = item.category;
      renderMenuCategoryOptions(item.category);
      els.menuPrice.value = money(item.price);
      setMenuImagePreview(item.image || "");
      if (els.menuPrintLabel) {
        els.menuPrintLabel.checked = item.printLabel !== false;
      }
      renderRecipeRows(item.id);
      els.menuForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }

  if (deleteButton) {
    const item = menu.find((entry) => entry.id === deleteButton.dataset.deleteMenu);
    if (!item) return;
    if (!window.confirm(`Hapus menu "${item.name}"? Resepnya juga akan ikut terhapus.`)) return;
    const recipes = getRecipes();
    delete recipes[deleteButton.dataset.deleteMenu];
    saveRecipes(recipes);
    writeJson(storageKeys.menu, menu.filter((entry) => entry.id !== deleteButton.dataset.deleteMenu));
    markSettingsDirty();
    renderAll();
    try {
      const synced = await persistMenuSettings();
      toast(synced ? "Menu dihapus dan tersinkron." : "Menu dihapus lokal.");
    } catch {
      toast("Menu dihapus lokal, tapi sync cloud belum berhasil.");
    }
  }
});

els.analyticsMonth.addEventListener("change", () => {
  if (els.analyticsYear) els.analyticsYear.value = els.analyticsMonth.value.slice(0, 4);
  refreshAnalyticsPeriod({ range: "daily", silent: true }).then((loaded) => {
    if (!loaded) {
      renderAnalytics();
      renderHistory();
    }
  });
});
els.analyticsDate?.addEventListener("change", () => {
  const month = els.analyticsDate.value.slice(0, 7);
  if (month && els.analyticsMonth.value !== month) els.analyticsMonth.value = month;
  if (els.analyticsYear && month) els.analyticsYear.value = month.slice(0, 4);
  if (els.paidOrderDate) els.paidOrderDate.value = els.analyticsDate.value || dateKey();
  refreshAnalyticsPeriod({ month, range: "daily", silent: true }).then((loaded) => {
    if (!loaded) renderHistory();
    renderOrders();
  });
});
els.analyticsYear?.addEventListener("change", () => {
  const year = selectedAnalyticsYear();
  if (els.analyticsMonth) els.analyticsMonth.value = `${year}-01`;
  refreshAnalyticsPeriod({ range: state.chartRange, silent: true }).then((loaded) => {
    if (!loaded) renderAnalytics();
  });
});
els.paidOrderDate?.addEventListener("change", () => {
  const date = els.paidOrderDate.value || dateKey();
  refreshAnalyticsPeriod({ month: date.slice(0, 7), range: "daily", silent: true }).then(() => renderOrders());
});
els.startCamera?.addEventListener("click", startCamera);
els.capturePhoto?.addEventListener("click", capturePhoto);
els.resetBooth?.addEventListener("click", resetBooth);
els.downloadBooth?.addEventListener("click", downloadBooth);
els.boothCustomer?.addEventListener("input", drawBoothCanvas);
els.boothSessionPackage?.addEventListener("change", drawBoothCanvas);
els.loginForm.addEventListener("submit", login);
els.toggleLoginPassword?.addEventListener("click", () => {
  const isHidden = els.loginPassword.type === "password";
  els.loginPassword.type = isHidden ? "text" : "password";
  els.toggleLoginPasswordIcon.className = isHidden ? "ph ph-eye-slash" : "ph ph-eye";
  els.toggleLoginPassword.setAttribute("aria-label", isHidden ? "Sembunyikan password" : "Tampilkan password");
});
els.toggleWifiPassword?.addEventListener("click", () => {
  const isHidden = els.wifiPassword.type === "password";
  els.wifiPassword.type = isHidden ? "text" : "password";
  els.toggleWifiPasswordIcon.className = isHidden ? "ph ph-eye-slash" : "ph ph-eye";
  els.toggleWifiPassword.setAttribute("aria-label", isHidden ? "Sembunyikan password" : "Tampilkan password");
});
els.loginDutyRole?.addEventListener("change", renderEmployeeControls);
els.roleAddForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner()) {
    toast("Tambah role hanya untuk Owner.");
    return;
  }
  const newRoleName = els.roleNewName?.value.trim();
  if (!newRoleName) return;
  const newRole = newRoleName.toLowerCase();
  
  const roles = getEmployeeRoles();
  if (roles.includes(newRole)) {
    toast(`Role "${newRoleName}" sudah terdaftar.`);
    return;
  }
  
  saveEmployeeRoles([...roles, newRole]);
  if (els.roleNewName) els.roleNewName.value = "";
  renderEmployeeRolesControls();
  renderEmployeeControls();
  toast(`Role "${newRoleName}" berhasil ditambahkan.`);
  
  if (navigator.onLine) {
    await syncSettingsToCloud({ force: true }).catch(() => null);
  }
});

els.roleList?.addEventListener("click", async (event) => {
  const deleteBtn = event.target.closest("button[data-delete-role]");
  if (!deleteBtn) return;
  if (!isOwner()) {
    toast("Hapus role hanya untuk Owner.");
    return;
  }
  const roleToDelete = decodeURIComponent(deleteBtn.dataset.deleteRole);
  if (roleToDelete === "karyawan" || roleToDelete === "helper") {
    toast("Role default tidak dapat dihapus.");
    return;
  }
  
  const roles = getEmployeeRoles();
  const nextRoles = roles.filter((r) => r !== roleToDelete);
  saveEmployeeRoles(nextRoles);
  renderEmployeeRolesControls();
  renderEmployeeControls();
  toast(`Role "${roleToDelete.charAt(0).toUpperCase() + roleToDelete.slice(1)}" berhasil dihapus.`);
  
  if (navigator.onLine) {
    await syncSettingsToCloud({ force: true }).catch(() => null);
  }
});
els.orderForm.addEventListener("submit", startOrder);
els.cancelOrderModal.addEventListener("click", closeOrderModal);

els.analyticsMonth.value = monthKey();
if (els.analyticsDate) els.analyticsDate.value = dateKey();
if (els.analyticsYear) els.analyticsYear.value = String(new Date().getFullYear());
if (els.paidOrderDate) els.paidOrderDate.value = dateKey();
if (els.cashflowMonth) els.cashflowMonth.value = monthKey();
if (els.cashflowDate) els.cashflowDate.value = dateKey();
if (state.payment === "Kartu") state.payment = "Tunai";
syncCfExpenseNoteField();
renderAnalyticsControls();
registerServiceWorker();
initAuth();
initPrinterSettings();
updateClock();
setInterval(updateClock, 1000);
setInterval(() => {
  if (document.visibilityState === "visible") updateDevicePresence().catch(() => null);
}, 60000);
setInterval(() => {
  if (document.visibilityState === "visible") refreshActiveCashierPresence().catch(() => null);
}, 60000);
setInterval(() => {
  if (document.visibilityState === "visible") checkRemoteLogout().catch(() => null);
}, 60000);
setInterval(() => {
  if (document.visibilityState === "visible") {
    // Refresh ringan di background: hanya tarik 30 transaksi terbaru setiap 10 menit saat kasir sedang bekerja
    syncPendingTransactions({ pull: false })
      .then(() => pullTransactionsFromSupabase({ render: false, limit: 30 }))
      .then(() => {
        renderHistory();
        renderOrders();
        renderCashflow();
        renderPendingSync();
      })
      .catch(() => null);
    refreshActiveCashflowSales();
  }
}, 600000);
setInterval(() => {
  if (document.visibilityState === "visible" && navigator.onLine && isLoggedIn()) {
    // Sync karyawan setiap 5 menit agar semua device selalu up-to-date
    pullSettingsFromSupabase({ render: false })
      .then(() => renderEmployeeControls())
      .catch(() => null);
  }
}, 300000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshOnlineData({ render: true }).catch(() => null);
    if (document.querySelector("#view-cashflow")?.classList.contains("active")) refreshActiveCashflowSales();
  }
});
document.querySelector("#staffRangeBtn")?.addEventListener("click", renderStaffSummary);
document.querySelector("#refreshDevicesBtn")?.addEventListener("click", renderDeviceMonitor);
document.querySelector("#activeDevicesContainer")?.addEventListener("click", (event) => {
  const forceLogoutBtn = event.target.closest("button[data-force-logout]");
  if (forceLogoutBtn) {
    forceLogoutDeviceAction(forceLogoutBtn.dataset.forceLogout);
  }
});
document.addEventListener("click", (event) => {
  const presetBtn = event.target.closest(".staff-preset-btn");
  if (presetBtn) {
    applyStaffPresetRange(presetBtn.dataset.rangePreset);
  }
});
restoreActiveView();
applyAccessControls();
renderAll();
updateConnectionStatus();
if (isLoggedIn()) {
  syncCloudData();
} else if (navigator.onLine) {
  pullTransactionsFromSupabase({ render: true }).catch(() => null);
}
if (navigator.onLine) pullSettingsFromSupabase({ render: true }).catch(() => null);
if (navigator.onLine) refreshActiveCashierPresence().catch(() => null);
if (navigator.onLine) checkRemoteLogout().catch(() => null);
