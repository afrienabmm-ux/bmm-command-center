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

export type ClaimStatus = "Pending" | "In Progress" | "Approved" | "Rejected" | "Closed";
export const CLAIM_STATUSES: ClaimStatus[] = ["Pending", "In Progress", "Approved", "Rejected", "Closed"];

// A claim still needing action — used for the dashboard's "open claims"
// count, so approved/rejected/closed ones drop out of it.
export const OPEN_CLAIM_STATUSES: ClaimStatus[] = ["Pending", "In Progress"];
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

export type JobType = "Restore Bike" | "Walk-in";
export const JOB_TYPES: JobType[] = ["Restore Bike", "Walk-in"];
export type RepairStatus = "Pending" | "In Progress" | "Completed";
export const REPAIR_STATUSES: RepairStatus[] = ["Pending", "In Progress", "Completed"];
export type ApprovalStatus = "Pending" | "Approved" | "Not Approved";
export const APPROVAL_STATUSES: ApprovalStatus[] = ["Pending", "Approved", "Not Approved"];

export type RepairJobItem = {
  id: string;
  description: string;
  quantity: number;
  price: number;
};

export type RepairJob = {
  id: string;
  branch: Branch;
  jobNo: string;
  customerName: string;
  plateNo: string;
  jobType: JobType;
  mechanicId: string | null;
  description: string;
  status: RepairStatus;
  revenueAmount: number;
  dealType: string;
  startedDate: string;
  completedDate: string | null;
  createdAt: string;
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
  // Restore Bike only — a required photo of the bike, stored the same way
  // as GenBlu screenshots (private bucket, path only; resolved to a signed
  // URL on read).
  imagePath: string | null;
  // Restore Bike workflow tracker — click-to-stamp milestones shown as a
  // row of buttons on the list. Repair Start/Last reuse startedDate and
  // completedDate above rather than duplicating them.
  arrivedDate: string | null;
  quotationDate: string | null;
  gmApprovedDate: string | null;
};

export const RESTORE_BIKE_CONDITIONS = ["L", "H"] as const;
export type RestoreBikeCondition = (typeof RESTORE_BIKE_CONDITIONS)[number];

export const HEAVY_ITEM_COUNT_THRESHOLD = 3;
export function isHeavyRepairJob(job: { items: RepairJobItem[]; isBigItem: boolean }): boolean {
  return job.items.length > HEAVY_ITEM_COUNT_THRESHOLD || job.isBigItem;
}

export const DEAL_TYPES = ["Trade In", "Tarik"] as const;

// Every mechanic's monthly KPI: RM10,000 in Restore Bike revenue and at
// least 2 Restore Bike jobs completed.
export const MECHANIC_KPI_REVENUE = 10000;
export const MECHANIC_KPI_RESTORE_BIKE_COUNT = 2;

export type GenbluRegistration = {
  id: string;
  branch: Branch;
  salespersonName: string;
  salespersonCode: string;
  customerPlateNo: string;
  screenshotPath: string | null;
  createdAt: string;
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

export type CatalogBrand = "Yamalube" | "Rock Oil" | "Motul";
export const CATALOG_BRANDS: CatalogBrand[] = ["Yamalube", "Rock Oil", "Motul"];
export type CatalogProduct = {
  id: string;
  brand: CatalogBrand;
  category: string;
  productName: string;
  spec: string;
  price: number;
};
