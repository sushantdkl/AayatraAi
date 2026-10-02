export type DeliveryResult =
  | { status: "SENT"; providerReference: string }
  | { status: "FAILED" | "NOT_CONFIGURED" | "SIMULATED"; reason: string };

export interface OutboundProvider {
  readonly name: string;
  deliver(input: { channel: "EMAIL" | "WHATSAPP" | "SMS"; destination: string; body: string; idempotencyKey: string }): Promise<DeliveryResult>;
}

export class NotConfiguredProvider implements OutboundProvider {
  readonly name = "NOT_CONFIGURED";
  async deliver(input: Parameters<OutboundProvider["deliver"]>[0]): Promise<DeliveryResult> { void input; return { status: "NOT_CONFIGURED", reason: "No approved messaging provider is configured" }; }
}

export class SimulatedProvider implements OutboundProvider {
  readonly name = "SIMULATED_TEST";
  async deliver(input: Parameters<OutboundProvider["deliver"]>[0]): Promise<DeliveryResult> { void input; return { status: "SIMULATED", reason: "Test adapter only; nothing was delivered" }; }
}
