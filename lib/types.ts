import type { Branch } from "./branch";

export type MonthlyTarget = {
  id: string;
  branch: Branch;
  year: number;
  month: number; // 1-12
  targetAmount: number;
};

export type MechanicStatus = "Active" | "On Leave";
export type Mechanic = {
  id: string;
  branch: Branch;
  fullName: string;
  shortName: string;
  shortCode: string;
  status: MechanicStatus;
  createdAt: string;
};

export type ClaimStatus = "Submitted" | "Approved" | "Rejected" | "Completed";
export const CLAIM_STATUSES: ClaimStatus[] = ["Submitted", "Approved", "Rejected", "Completed"];
export type WarrantyClaim = {
  id: string;
  branch: Branch;
  claimNo: string;
  customerName: string;
  plateNo: string;
  description: string;
  status: ClaimStatus;
  submittedDate: string;
  createdAt: string;
};

export type JobType = "Restore Bike" | "Walk-in";
export const JOB_TYPES: JobType[] = ["Restore Bike", "Walk-in"];
export type RepairStatus = "Pending" | "In Progress" | "Completed";
export const REPAIR_STATUSES: RepairStatus[] = ["Pending", "In Progress", "Completed"];
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
  startedDate: string;
  completedDate: string | null;
  createdAt: string;
};

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
};
