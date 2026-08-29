import type { Branch } from "./branch";

export type MonthlyTarget = {
  id: string;
  branch: Branch;
  year: number;
  month: number; // 1-12
  targetAmount: number;
};

export type MechanicStatus = "Active" | "On Leave";
export type MechanicCategory = "Heavy Repair" | "Normal Repair";
export const MECHANIC_CATEGORIES: MechanicCategory[] = ["Heavy Repair", "Normal Repair"];
export type Mechanic = {
  id: string;
  branch: Branch;
  fullName: string;
  shortName: string;
  shortCode: string;
  status: MechanicStatus;
  category: MechanicCategory;
  createdAt: string;
};

export type ClaimStatus = "Proceed" | "In Process" | "Close Ticket" | "Rejected";
export const CLAIM_STATUSES: ClaimStatus[] = ["Proceed", "In Process", "Close Ticket", "Rejected"];

// A claim still needing action — used for the dashboard's "open claims"
// count, so approved/rejected/closed ones drop out of it.
export const OPEN_CLAIM_STATUSES: ClaimStatus[] = ["In Process"];
export function isOpenClaim(status: ClaimStatus): boolean {
  return OPEN_CLAIM_STATUSES.includes(status);
}

export type StockStatus = "Sold" | "In Stock";
export const STOCK_STATUSES: StockStatus[] = ["Sold", "In Stock"];
export type BikeMake = "Yamaha" | "Non-Yamaha";
export const BIKE_MAKES: BikeMake[] = ["Yamaha", "Non-Yamaha"];
export type WarrantyClaim = {
  id: string;
  branch: Branch;
  ticketId: string;
  customerName: string;
  plateNo: string;
  model: string;
  phone: string;
  description: string;
  stockStatus: StockStatus;
  bikeMake: BikeMake;
  status: ClaimStatus;
  submittedDate: string;
  createdAt: string;
  // Who's handling the claim, plus the running follow-up notes their
  // spreadsheet keeps in its "Latest Status" and "Reason" columns.
  pic: string;
  latestStatus: string;
  reason: string;
};

// Mirrors "DELIVERY CLAIM FOR YAMAHA/NON-YAMAHA BMM (DAMAGE)" — a separate
// sheet from Warranty Claim, tracking damage found on a bike before it's
// delivered to the customer rather than a fault reported after sale.
export type DeliveryClaim = {
  id: string;
  branch: Branch;
  ticketId: string;
  pic: string;
  model: string;
  chassisNo: string;
  engineNo: string;
  problem: string;
  status: ClaimStatus;
  stockStatus: StockStatus;
  plateNo: string;
  // Free text on the sheet, not a clean date (e.g. "29/7 EMBLEM") — which
  // part arrived and when, in one note.
  dateParts: string;
  delivery: string;
  reason: string;
  submittedDate: string;
  createdAt: string;
};

export type JobType = "Restore Bike" | "Walk-in";
export const JOB_TYPES: JobType[] = ["Restore Bike", "Walk-in"];
// "QC" sits between a mechanic finishing the repair (End Date stamped) and
// "Completed" — Restore Bike jobs land there first and need the branch
// PIC to pass them before they're truly done. Walk-in jobs skip QC
// entirely and go straight to Completed.
export type RepairStatus = "Pending" | "In Progress" | "QC" | "Completed";
export const REPAIR_STATUSES: RepairStatus[] = ["Pending", "In Progress", "QC", "Completed"];
export type ApprovalStatus = "Pending" | "Approved" | "Not Approved";
export const APPROVAL_STATUSES: ApprovalStatus[] = ["Pending", "Approved", "Not Approved"];
export type QcResult = "Passed" | "Failed";

export type RepairJobItem = {
  id: string;
  code: string;
  description: string;
  quantity: number;
  price: number;
};

export type RepairJob = {
  id: string;
  branch: Branch;
  jobNo: string;
  customerName: string;
  // Walk-in only — lets membership visit-matching use phone as well as
  // name, since names can be typo'd/spelled differently between visits.
  customerPhone: string;
  plateNo: string;
  jobType: JobType;
  mechanicId: string | null;
  description: string;
  status: RepairStatus;
  revenueAmount: number;
  dealType: string;
  // Restore Bike: null until the "Start" stage is clicked (gated on
  // approval). Walk-in: always set from the form, as before.
  startedDate: string | null;
  completedDate: string | null;
  createdAt: string;
  // Restore Bike only — the date the PIC filled in this form, independent
  // of when the repair actually starts.
  formDate: string | null;
  // Restore Bike only — mirrors the "PIC / N.PLATE / MODEL / TAHUN /
  // CONDITION / MECHANIC / LOCATION / ..." tracking sheet.
  picName: string;
  model: string;
  bikeYear: string;
  condition: string;
  location: string;
  // Estimated-cost-sheet fields: parts list, stock ordering, approval.
  items: RepairJobItem[];
  stockOrderDate: string | null;
  stockArriveDate: string | null;
  preparedBy: string;
  approvalStatus: ApprovalStatus;
  // Manually flags a job as heavy even when it has 3 or fewer items (e.g.
  // one big engine part) — jobs with more than 3 items count as heavy too.
  isBigItem: boolean;
  // Walk-in only — mirrors the paper jobsheet's boxes.
  customerCode: string;
  colour: string;
  engineNo: string;
  chassisNo: string;
  jobsheetNo: string;
  salesNo: string;
  salesDate: string;
  warrantyCardNo: string;
  mileageKm: string;
  nextMileageKm: string;
  serviceType: string;
  nextServiceDate: string;
  jobsheetUserId: string;
  // Restore Bike only — up to 5 photos of the bike, stored the same way as
  // GenBlu screenshots (private bucket, paths only; resolved to signed
  // URLs on read).
  imagePaths: string[];
  // Restore Bike — Arrived is set on the form; Quotation is a click-to-
  // stamp on the list. GM approval is just the existing approvalStatus
  // field (Approved), not a separate date.
  arrivedDate: string | null;
  quotationDate: string | null;
  // Restore Bike only — set once the branch PIC passes or fails QC.
  // Passing moves the job to Completed; failing sends it back to In
  // Progress for the mechanic to redo, but keeps the "Failed" result and
  // reason visible (rather than clearing them) so it's clear why.
  qcResult: QcResult | null;
  qcDate: string | null;
  qcFailReason: string | null;
  // Set once the branch PIC confirms they've actually looked into the QC
  // failure reason above — required before the repair can be re-submitted
  // to QC, so a failure can't just get quietly redone without addressing
  // why it failed in the first place.
  qcFailFollowupDate: string | null;
  // Walk-in only — what the jobsheet scan actually found for the customer
  // signature, separate from the staff confirmation checkbox: "detected",
  // "not_detected" (scan ran, found nothing, but staff confirmed anyway),
  // "unchecked" (scan couldn't tell), or "" (no scan — manual entry).
  signatureStatus: string;
  // Walk-in only — the original photo of the paper jobsheet, uploaded
  // through Scan Jobsheet. Kept so a manager can look at the real thing
  // whenever the automated reading (item rows, signature check) needs a
  // human double-check. Stored the same way as GenBlu screenshots and
  // Restore Bike photos (private bucket, path only; resolved to a signed
  // URL on read). Null for jobs entered by hand, without scanning.
  jobsheetPhotoPath: string | null;
};

export const RESTORE_BIKE_CONDITIONS = ["L", "H"] as const;
export type RestoreBikeCondition = (typeof RESTORE_BIKE_CONDITIONS)[number];

// Heavy is a purely manual flag — the "Big / heavy item repair" checkbox on
// the job form — so a PIC can always assign any mechanic unless they've
// explicitly marked the job heavy.
export function isHeavyRepairJob(job: { isBigItem: boolean }): boolean {
  return job.isBigItem;
}

export const DEAL_TYPES = ["Trade In", "Tarik", "Jual"] as const;

// Every mechanic's monthly KPI: RM10,000 in Restore Bike revenue and at
// least 2 Restore Bike jobs completed.
export const MECHANIC_KPI_REVENUE = 10000;
export const MECHANIC_KPI_RESTORE_BIKE_COUNT = 2;
// The RM10,000 monthly target spread over a 25-day working month — RM400/day
// minimum, used as a pace reference rather than a separate pass/fail KPI.
export const MECHANIC_KPI_WORKING_DAYS = 25;
export const MECHANIC_KPI_DAILY_TARGET = Math.round(MECHANIC_KPI_REVENUE / MECHANIC_KPI_WORKING_DAYS);
// Branches run a 6-day working week (closed Sundays), so the weekly
// commitment tracker's revenue target is 6x the daily KPI reference above
// rather than a separate number invented from scratch.
export const MECHANIC_WEEKLY_REVENUE_TARGET = MECHANIC_KPI_DAILY_TARGET * 6;

export type GenbluRegistration = {
  id: string;
  branch: Branch;
  salespersonName: string;
  salespersonCode: string;
  customerName: string;
  customerPlateNo: string;
  screenshotPath: string | null;
  // Read straight off the screenshot's "Points Accrued" field via OCR when
  // the screenshot is uploaded — null if extraction failed or no
  // screenshot-derived value is on file yet (falls back to the estimate).
  pointsAccrued: number | null;
  createdAt: string;
};

// One row per GenBlu points award, read from the app screenshot via OCR —
// separate from GenbluRegistration (customer enrollment). This is what the
// monthly Counts/Points-by-branch summary is built from.
export type GenbluTransaction = {
  id: string;
  branch: Branch;
  customerName: string;
  membershipNumber: string | null;
  productCategory: string | null;
  points: number;
  transactionDate: string | null;
  transactionTime: string | null;
  // The one field admin picks by hand — whether a service coupon was
  // applied isn't shown on the GenBlu screenshot itself.
  serviceCoupon: boolean;
  screenshotPath: string | null;
  uploadedBy: string | null;
  createdAt: string;
  // Which Tracker registration this award was applied to — set
  // automatically by matching customer name within the branch, creating a
  // new registration if none matched yet. Lets the two GenBlu views (award
  // log, enrollment tracker) come from a single upload instead of two.
  registrationId: string | null;
};

export type Package = {
  id: string;
  name: string;
  price: number;
  spec: string;
  description: string;
  createdAt: string;
};

export const LOW_STOCK_THRESHOLD = 10;

export type CatalogBrand = "Yamalube" | "Rock Oil" | "Motul" | "Yamaha Spare Parts";
export const CATALOG_BRANDS: CatalogBrand[] = ["Yamalube", "Rock Oil", "Motul", "Yamaha Spare Parts"];
export type CatalogProduct = {
  id: string;
  brand: CatalogBrand;
  category: string;
  productName: string;
  spec: string;
  price: number;
  code: string;
};

// The loyalty/membership card concept — separate from the Services Combo
// packages themselves. Digital version of the physical Yamaha Cares stamp
// card, with specific rewards at specific stamps (see STAMP_REWARDS in
// lib/membership.ts) rather than a tier that climbs forever.
export type CustomerCard = {
  id: string;
  branch: Branch;
  customerName: string;
  customerPhone: string;
  cardNumber: string;
  // The bike the customer registered with — matches the plate/model fields
  // on the physical card.
  plateNo: string;
  model: string;
  // Eligibility for the stamp-reward card — only customers who bought
  // their bike from us can earn/redeem the stamp rewards.
  boughtBikeHere: boolean;
  issuedDate: string;
  expiryDate: string | null;
  notes: string;
  createdAt: string;
  // Which of the 10 stamps on the current card are ticked — set by admin
  // only, never derived from jobsheet/visit counts.
  stamps: number[];
};

export type LabourCharge = {
  id: string;
  description: string;
  price0to125cc: string;
  price125to200cc: string;
  price200ccPlus: string;
};
