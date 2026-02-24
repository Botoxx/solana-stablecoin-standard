export interface SssEvent {
  name: string;
  authority: string;
  timestamp: number;
  signature: string;
  slot: number;
  data: Record<string, any>;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: Date;
}

export interface MintBurnRequest {
  id: string;
  action: "mint" | "burn";
  amount: string;
  recipient?: string;
  tokenAccount?: string;
  status: "pending" | "processing" | "completed" | "failed";
  signature?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
  uptime: number;
}
