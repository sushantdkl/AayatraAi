import type { productFamilies } from "@/lib/domain";

type Family = (typeof productFamilies)[number];
export type SnapshotItem = {
  productFamily: Family;
  kind: "SOFTWARE" | "HARDWARE";
  name: string;
  billingType: "ONE_TIME" | "RECURRING";
  billingPeriod: "MONTH" | "YEAR" | null;
  priceMinor: number;
  negotiable: boolean;
  notes: string;
};

const software = (
  productFamily: Family,
  name: string,
  billingPeriod: "MONTH" | "YEAR" | null,
  rupees: number,
  notes: string,
): SnapshotItem => ({
  productFamily,
  kind: "SOFTWARE",
  name,
  billingType: billingPeriod ? "RECURRING" : "ONE_TIME",
  billingPeriod,
  priceMinor: rupees * 100,
  negotiable: false,
  notes,
});

export const marketingSnapshot: SnapshotItem[] = [
  software("RETAIL_ERP", "Retail POS setup", null, 30000, "Marketing snapshot; scope and terms unverified"),
  software("RETAIL_ERP", "Retail POS yearly", "YEAR", 10000, "Marketing snapshot; inclusions unverified"),
  software("RETAIL_ERP", "Retail POS monthly", "MONTH", 1000, "Marketing snapshot; inclusions unverified"),
  software("RESTAURANT_SYSTEM", "Starter yearly", "YEAR", 15000, "Marketing snapshot; features and limits unverified"),
  software("RESTAURANT_SYSTEM", "Starter monthly", "MONTH", 1500, "Marketing snapshot; features and limits unverified"),
  software("RESTAURANT_SYSTEM", "Growth yearly", "YEAR", 25000, "Marketing snapshot; features and limits unverified"),
  software("RESTAURANT_SYSTEM", "Growth monthly", "MONTH", 2500, "Marketing snapshot; features and limits unverified"),
  software("RESTAURANT_SYSTEM", "Enterprise yearly", "YEAR", 40000, "COMMERCIAL_PRICE_REVIEW_REQUIRED: client kit says from NPR 50,000/year; this is an unverified marketing draft"),
  software("RESTAURANT_SYSTEM", "Enterprise monthly", "MONTH", 4000, "Marketing draft; monthly Enterprise option is not specified in the client-kit quotation template"),
  { productFamily: "RETAIL_ERP", kind: "HARDWARE", name: "Thermal + label printer", billingType: "ONE_TIME", billingPeriod: null, priceMinor: 2000000, negotiable: true, notes: "Marketing snapshot; model, tax, warranty and procurement cost unverified" },
  { productFamily: "RETAIL_ERP", kind: "HARDWARE", name: "Thermal printer", billingType: "ONE_TIME", billingPeriod: null, priceMinor: 1400000, negotiable: true, notes: "COMMERCIAL_PRICE_REVIEW_REQUIRED: kit indicates NPR 8,000–10,000 for an unspecified thermal receipt printer; confirm exact model, tax and warranty" },
  { productFamily: "RETAIL_ERP", kind: "HARDWARE", name: "Barcode scanner gun", billingType: "ONE_TIME", billingPeriod: null, priceMinor: 800000, negotiable: true, notes: "Marketing snapshot; model, tax, warranty and procurement cost unverified" },
];
