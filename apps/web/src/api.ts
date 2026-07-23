import type {
  ClientPurchaseProfile,
  EventPaymentConfig,
  EventStandBatch,
  ExpoEvent,
  Lead,
  LeadInput,
  ServiceStatus,
  Stand,
  StandStatus
} from "@expomanage/shared";

type LoginResponse = {
  token: string;
};

type CreatePurchaseInput = {
  eventSlug?: string;
  clientName: string;
  clientEmail: string;
  clientDocument?: string;
  standId: string;
  contractUrl: string;
};

type ReceiptUploadInput = {
  fileName: string;
  dataUrl: string;
  contentType: string;
};

type CnpjCompanyData = {
  cnpj: string;
  legalName: string;
  address: string;
};

type GenerateContractInput = {
  sponsor: {
    documentType: "cpf" | "cnpj";
    document: string;
    legalName?: string;
    representativeName: string;
    representativeRole: string;
    representativeRg: string;
    representativeCpf: string;
    phone: string;
    email: string;
  };
  stand: {
    code: string;
    size: string;
    area?: number;
  };
  sponsorSignatureDataUrl: string;
};

type ContractRecord = {
  id: string;
  contractUrl: string;
};

const defaultApiBaseUrl = import.meta.env.PROD ? "/api" : "http://localhost:3000";
let adminToken: string | null = null;

export const expoApi = {
  async loginAdmin(email: string, password: string) {
    adminToken = await loginAdmin(email, password);
    return adminToken;
  },
  listEvents() {
    return request<ExpoEvent[]>("/events", {}, true);
  },
  upsertEvent(input: Pick<ExpoEvent, "name"> & Partial<Pick<ExpoEvent, "slug" | "year">>) {
    return request<ExpoEvent>("/events", { method: "POST", body: JSON.stringify(input) }, true);
  },
  deleteEvent(eventSlug: string) {
    return request<{ deleted: boolean; slug: string }>(
      `/events/${encodeURIComponent(eventSlug)}`,
      { method: "DELETE" },
      true
    );
  },
  generateEventStands(eventSlug: string, batches: EventStandBatch[]) {
    return request<Stand[]>(
      `/events/${encodeURIComponent(eventSlug)}/stands/generate`,
      { method: "POST", body: JSON.stringify({ batches }) },
      true
    );
  },
  getPaymentConfig(eventSlug: string) {
    return request<EventPaymentConfig>(`/events/${encodeURIComponent(eventSlug)}/payment-config`, {}, true);
  },
  upsertPaymentConfig(eventSlug: string, input: Pick<EventPaymentConfig, "pixCopyPaste" | "installments">) {
    return request<EventPaymentConfig>(
      `/events/${encodeURIComponent(eventSlug)}/payment-config`,
      { method: "POST", body: JSON.stringify(input) },
      true
    );
  },
  listStands(eventSlug?: string) {
    return request<Stand[]>(withQuery("/stands", { eventSlug }));
  },
  reserveStand(id: string) {
    return request<Stand>(`/stands/${encodeURIComponent(id)}/reserve`, { method: "POST" });
  },
  updateStandStatus(id: string, status: StandStatus) {
    return request<Stand>(
      `/stands/${encodeURIComponent(id)}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      true
    );
  },
  listLeads(eventSlug?: string) {
    return request<Lead[]>(withQuery("/leads", { eventSlug }), {}, true);
  },
  createLead(input: LeadInput) {
    return request<Lead>("/leads/interest", { method: "POST", body: JSON.stringify(input) });
  },
  lookupCnpj(document: string) {
    return request<CnpjCompanyData>(`/cnpj/${encodeURIComponent(document.replace(/\D/g, ""))}`);
  },
  updateLeadStatus(id: string, serviceStatus: ServiceStatus) {
    return request<Lead>(
      `/leads/${encodeURIComponent(id)}/service-status`,
      { method: "PATCH", body: JSON.stringify({ serviceStatus }) },
      true
    );
  },
  listPurchases(eventSlug?: string) {
    return request<ClientPurchaseProfile[]>(withQuery("/purchases", { eventSlug }), {}, true);
  },
  getPurchaseByClientDocument(document: string) {
    return request<ClientPurchaseProfile>(`/purchases/client/${encodeURIComponent(document.replace(/\D/g, ""))}`);
  },
  listPurchasesByClientDocument(document: string) {
    return request<ClientPurchaseProfile[]>(`/purchases/client/${encodeURIComponent(document.replace(/\D/g, ""))}/profiles`);
  },
  createPurchase(input: CreatePurchaseInput) {
    return request<ClientPurchaseProfile>("/purchases", { method: "POST", body: JSON.stringify(input) });
  },
  generateContract(input: GenerateContractInput) {
    return request<ContractRecord>("/contracts/generate", { method: "POST", body: JSON.stringify(input) });
  },
  attachReceipt(purchaseId: string, installmentId: string, input: ReceiptUploadInput) {
    return request<ClientPurchaseProfile>(
      `/purchases/${encodeURIComponent(purchaseId)}/installments/${encodeURIComponent(installmentId)}/receipt`,
      { method: "POST", body: JSON.stringify(input) }
    );
  },
  markInstallmentPaid(purchaseId: string, installmentId: string) {
    return request<ClientPurchaseProfile>(
      `/purchases/${encodeURIComponent(purchaseId)}/installments/${encodeURIComponent(installmentId)}/paid`,
      { method: "PATCH" },
      true
    );
  },
  contractDownloadUrl(purchaseId: string) {
    return buildApiUrl(`/purchases/${encodeURIComponent(purchaseId)}/contract/download`);
  }
};

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Falha ao ler comprovante.")));
    reader.readAsDataURL(file);
  });
}

async function request<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (admin) {
    headers.set("Authorization", `Bearer ${await getAdminToken()}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

async function getAdminToken(): Promise<string> {
  if (import.meta.env.VITE_ADMIN_TOKEN) {
    return import.meta.env.VITE_ADMIN_TOKEN;
  }

  if (adminToken) {
    return adminToken;
  }

  adminToken = await loginAdmin(
    import.meta.env.VITE_ADMIN_EMAIL || "admin@expomanage.local",
    import.meta.env.VITE_ADMIN_PASSWORD || "admin123"
  );
  return adminToken;
}

async function loginAdmin(email: string, password: string): Promise<string> {
  const response = await fetch(buildApiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const session = (await response.json()) as LoginResponse;
  return session.token;
}

function buildApiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;
  return `${baseUrl.replace(/\/+$/g, "")}/${path.replace(/^\/+/g, "")}`;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(" ") : body.message || "Erro na API.";
  } catch {
    return "Erro na API.";
  }
}
