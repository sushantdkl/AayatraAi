import { z } from "zod";
import { productFamilies } from "@/lib/domain";

const note = z.string().trim().max(2000).nullable().optional();
const date = z.iso.date().nullable().optional();
export const publicDemoUrl = z.url().max(500).refine((value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.hash &&
      !host.endsWith(".local") && host !== "localhost" && host !== "127.0.0.1" &&
      host !== "::1" && !/^\d+(?:\.\d+){3}$/.test(host) && !host.includes(":");
  } catch {
    return false;
  }
}, "Use a public HTTPS host without credentials or fragments");

export const commercialItemSchema = z.object({
  productFamily: z.enum(productFamilies),
  kind: z.enum(["SOFTWARE", "HARDWARE", "SERVICE"]),
  name: z.string().trim().min(3).max(160),
  billingType: z.enum(["ONE_TIME", "RECURRING"]),
  billingPeriod: z.enum(["MONTH", "YEAR"]).nullable(),
  currency: z.literal("NPR").default("NPR"),
  approvalRequired: z.boolean().default(true),
  negotiable: z.boolean().default(false),
  effectiveFrom: date,
  effectiveTo: date,
  source: z.string().trim().min(3).max(300),
  notes: note,
  priceMinor: z.number().int().min(0).max(1000000000000),
}).refine((value) => (value.billingType === "ONE_TIME") === (value.billingPeriod === null), "Billing period must match billing type");

export const priceSourceSchema = z.object({
  priceMinor: z.number().int().min(0).max(1000000000000),
  sourceName: z.string().trim().min(3).max(300),
  evidenceReference: z.string().trim().min(3).max(500).optional(),
  isCanonical: z.boolean().default(false),
});

export const commercialActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ADD_PRICE"), price: priceSourceSchema }),
  z.object({ action: z.literal("VERIFY"), evidenceReference: z.string().trim().min(8).max(500) }),
  z.object({ action: z.literal("ACTIVATE"), approvalRequired: z.boolean().default(true) }),
  z.object({ action: z.literal("RESOLVE_DISCREPANCY"), discrepancyId: z.uuid(), evidenceReference: z.string().trim().min(12).max(500) }),
  z.object({ action: z.literal("SET_FLOOR"), minPriceMinor: z.number().int().min(0).max(1000000000000), evidenceReference: z.string().trim().min(12).max(500) }),
  z.object({ action: z.literal("RETIRE") }),
]);

export const demoTargetSchema = z.object({
  productFamily: z.enum(productFamilies),
  name: z.string().trim().min(3).max(120),
  baseUrl: publicDemoUrl.nullable(),
  loginUrl: publicDemoUrl.nullable().optional(),
  environment: z.enum(["DEMO", "STAGING"]),
  enabled: z.boolean().default(false),
  requiresLogin: z.boolean().default(false),
  usernameSecretRef: z.string().regex(/^[A-Z][A-Z0-9_]{2,99}$/).nullable().optional(),
  passwordSecretRef: z.string().regex(/^[A-Z][A-Z0-9_]{2,99}$/).nullable().optional(),
  demoTenantReference: z.string().trim().max(150).nullable().optional(),
  allowMutations: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.enabled && !value.baseUrl) ctx.addIssue({ code: "custom", message: "A URL is required before enabling", path: ["baseUrl"] });
  if (value.requiresLogin && (!value.usernameSecretRef || !value.passwordSecretRef)) ctx.addIssue({ code: "custom", message: "Both secret references are required", path: ["requiresLogin"] });
  if (value.allowMutations && (value.environment !== "DEMO" || !value.demoTenantReference)) ctx.addIssue({ code: "custom", message: "Mutations require a named demo tenant", path: ["allowMutations"] });
});

export const demoScriptSchema = z.object({
  productFamily: z.enum(productFamilies),
  name: z.string().trim().min(3).max(120),
  steps: z.array(z.object({
    action: z.enum(["OPEN_ROUTE", "CLICK", "TYPE_DEMO_DATA", "SELECT", "WAIT", "SCROLL", "SHOW_TOOLTIP", "CAPTURE", "HIGHLIGHT"]),
    route: z.string().trim().max(300).nullable().optional(),
    selector: z.string().trim().max(300).nullable().optional(),
    expectedState: z.string().trim().max(300).nullable().optional(),
    caption: z.string().trim().max(300).nullable().optional(),
    isMutating: z.boolean().default(false),
    requiredCapabilityId: z.uuid().nullable().optional(),
  })).min(1).max(50),
});

export const salesSettingsSchema = z.object({
  primarySalesPhone: z.string().trim().max(40).nullable().optional(),
  secondarySalesPhone: z.string().trim().max(40).nullable().optional(),
  whatsappNumber: z.string().trim().max(40).nullable().optional(),
  salesEmail: z.email().max(320).nullable().optional(),
  supportEmail: z.email().max(320).nullable().optional(),
  websiteUrl: publicDemoUrl.nullable().optional(),
  companyAddress: z.string().trim().max(500).nullable().optional(),
  businessHours: z.string().trim().max(300).nullable().optional(),
});
