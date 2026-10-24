import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AskResponse,
  BacktestRow,
  BenchmarkResponse,
  CaseData,
  CaseName,
  CompanyResponse,
  CovenantSet,
  MarketResponse,
  OutboundCall,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, init);
  } catch {
    throw new Error(`Cannot reach the NorthStar API at ${API_BASE}. Is the backend running?`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      const d = body?.detail ?? body;
      detail = typeof d === "string" ? d : JSON.stringify(d);
    } catch {
      // body was not JSON
    }
    throw new Error(`API error ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await res.json()) as T;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function getCase(name: CaseName): Promise<CaseData> {
  return request<CaseData>(`/cases/${name}`);
}

export function analyze(body: AnalyzeRequest): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function createCompany(form: FormData): Promise<CompanyResponse> {
  return request<CompanyResponse>("/company", { method: "POST", body: form });
}

export async function getBacktest(): Promise<BacktestRow[]> {
  const r = await request<{ rows: BacktestRow[] }>("/backtest/nortech");
  return r.rows;
}

export function getBenchmark(): Promise<BenchmarkResponse> {
  return request<BenchmarkResponse>("/benchmark");
}

export function ask(caseName: string, question: string, covenants: CovenantSet): Promise<AskResponse> {
  return request<AskResponse>("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case: caseName, question, covenants }),
  });
}

export function getMarket(name: string): Promise<MarketResponse> {
  return request<MarketResponse>(`/market/${name}`);
}

export async function getOutbound(): Promise<OutboundCall[]> {
  const r = await request<{ calls: OutboundCall[] }>("/outbound");
  return r.calls;
}
