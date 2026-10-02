export type CloseEvidence = { quotationAccepted: boolean; agreementAccepted: boolean; verifiedPaidMinor: number; requiredPaidMinor: number };
export function canCloseWon(evidence: CloseEvidence): boolean {
  return evidence.quotationAccepted && evidence.agreementAccepted &&
    Number.isSafeInteger(evidence.verifiedPaidMinor) &&
    Number.isSafeInteger(evidence.requiredPaidMinor) &&
    evidence.requiredPaidMinor > 0 && evidence.verifiedPaidMinor >= evidence.requiredPaidMinor;
}

export { onboardingSteps } from "@/lib/client-kit";
