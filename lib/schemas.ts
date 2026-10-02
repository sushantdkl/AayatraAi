import { z } from "zod";
import {
  capabilityStatuses,
  industries,
  productFamilies,
  stages,
} from "@/lib/domain";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().nullable();
const httpUrl = z
  .url()
  .max(500)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "Use an HTTP or HTTPS URL");

export const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(160),
  industry: z.enum(industries),
  city: z.string().trim().max(100).default(""),
  website: httpUrl.optional().nullable(),
  notes: optionalTrimmed(4000),
  sourceType: z.enum([
    "MANUAL",
    "REFERRAL",
    "INBOUND",
    "CSV",
    "EXISTING_RELATIONSHIP",
  ]),
  sourceReference: optionalTrimmed(500),
  termsReference: optionalTrimmed(500),
  contactName: optionalTrimmed(160),
  contactEmail: z.email().max(320).optional().nullable(),
  contactPhone: optionalTrimmed(40),
  contactSource: optionalTrimmed(300),
});

export const updateLeadSchema = z.object({
  status: z.enum(["NEW", "QUALIFIED", "UNQUALIFIED", "ARCHIVED"]).optional(),
  fitScore: z.number().int().min(0).max(100).nullable().optional(),
  digitalMaturityScore: z.number().int().min(0).max(100).nullable().optional(),
  notes: optionalTrimmed(4000),
  campaignId: z.uuid().nullable().optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(3).max(160),
  segment: z.string().trim().min(3).max(160),
  hypothesis: z.string().trim().min(10).max(1500),
});

export const createOpportunitySchema = z.object({
  leadId: z.uuid(),
  title: z.string().trim().min(3).max(200),
  productFamily: z.enum(productFamilies),
  valueMinor: z.number().int().min(0).max(1000000000000).nullable().optional(),
  nextAction: optionalTrimmed(500),
  nextActionAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const updateStageSchema = z.object({
  stage: z.enum(stages),
  reason: z.string().trim().min(5).max(500),
});

export const createActivitySchema = z.object({
  leadId: z.uuid(),
  opportunityId: z.uuid().nullable().optional(),
  kind: z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "TASK"]),
  detail: z.string().trim().min(2).max(4000),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const createCapabilitySchema = z.object({
  productFamily: z.enum(productFamilies),
  capabilityName: z.string().trim().min(3).max(200),
  limitation: optionalTrimmed(2000),
});

export const approveCapabilitySchema = z.object({
  status: z.enum(capabilityStatuses),
  evidenceUrl: httpUrl.nullable().optional(),
  approvedLanguage: optionalTrimmed(1500),
  productVersion: optionalTrimmed(100),
  limitation: optionalTrimmed(2000),
});
