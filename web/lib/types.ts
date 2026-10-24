// built-in samples ("nortech", "sample_uk") or an uploaded company ("u-...")
export type CaseName = string;

export type CovenantKind = "leverage" | "interest_cover" | "fixed_charge_cover" | "min_ebitda";

export interface Scenario {
  revenue_pct: number;
  ebitda_pct: number;
  dso_delta: number;
  dio_delta: number;
  capex_extra: number;
  rate_bp: number;
}

export interface StepDown {
  date: string;
  threshold: number;
}

export interface Covenant {
  kind: CovenantKind;
  comparator: "max" | "min";
  threshold: number | null;
  step_downs: StepDown[];
  effective_from: string | null;
  test_frequency: string;
  measurement_quarters: number;
  nets_cash: boolean;
  addbacks: string[];
  addback_cap_pct: number | null;
  source_quote: string;
}

export interface Facility {
  size: number | null;
  maturity: string | null;
  margin_pct: number | null;
  base_rate_name: string | null;
  source_quote: string;
}

export interface CovenantSet {
  covenants: Covenant[];
  facility: Facility;
}

export interface Quarter {
  period_end: string;
  revenue: number;
  cogs: number;
  ebit: number;
  da: number;
  interest_expense: number;
  capex: number;
  principal_paid: number;
  addbacks: number;
  cash: number;
  debt: number;
  receivables: number;
  inventory: number;
  payables: number;
}

export interface CaseMeta {
  name: string;
  display_name: string;
  currency: "$" | "£";
  unit: "m";
  description: string;
  as_of?: string;
  sector?: string;
  country?: string;
  lender?: string;
  base_rate?: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AskResponse {
  answer: string;
  tool_calls: ToolCall[];
  unverified_numbers: string[];
  latency_s: number;
  cost_usd: number;
  model: string;
}

export interface MarketItem {
  query: string;
  answer: string | null;
  sources: { title: string; url: string }[];
}

export interface MarketResponse {
  items: MarketItem[];
  cached: boolean;
}

export interface CaseData {
  quarters: Quarter[];
  covenants: CovenantSet;
  meta: CaseMeta;
}

export interface CovenantPoint {
  period_end: string;
  kind: string;
  value: number;
  threshold: number;
  headroom_pct: number;
  is_forecast: boolean;
  breached: boolean;
}

export interface Refi {
  est_breach_cost: number;
  breach_cost_assumption: string;
  months_to_maturity?: number;
  start_talks_by?: string;
  maturity?: string;
  talks_overdue?: boolean;
}

export interface Analysis {
  points: CovenantPoint[];
  first_breach: CovenantPoint | null;
  binding_kind: string | null;
  needs_input: string[];
  reverse_stress: { ebitda_fall_pct: number; dso_days: number };
  refi: Refi;
  forecast: Quarter[];
  budget_until: string | null;
}

export interface Insight {
  title: string;
  body: string;
}

export interface AnalyzeRequest {
  case: string;
  covenants?: CovenantSet | null;
  scenario: Scenario;
  insights: boolean;
}

export interface AnalyzeResponse {
  analysis: Analysis;
  insights: Insight[];
  cached: boolean;
}

export interface ExtractionStats {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_s: number;
  cost_usd: number;
}

export interface AgreementResponse {
  covenants: CovenantSet;
  stats: ExtractionStats;
}

export interface MappedLine {
  name: string;
  category: string;
  confidence: number;
}

export interface CompanyResponse {
  case: string;
  covenants: CovenantSet;
  mapping: MappedLine[];
  quarters: number;
  budget_quarters: number;
  budget_until: string | null;
  stats: { agreement: ExtractionStats; financials: ExtractionStats };
}

export interface BacktestRow {
  as_of: string;
  current: CovenantPoint[];
  predicted_first_breach: CovenantPoint | null;
  actual_in_compliance: boolean | null;
  quote: string | null;
  note: string | null;
}

export interface BenchmarkRow {
  model: string;
  open: boolean;
  docs: number;
  kind_recall: number;
  threshold_acc: number;
  stepdown_acc: number;
  invented_covenants?: number;
  cost_per_doc_usd: number;
  latency_s: number | null;
}

export interface BenchmarkError {
  doc: string;
  field: string;
  expected: string;
  got: string;
}

export interface BenchmarkResponse {
  rows: BenchmarkRow[];
  errors: Record<string, BenchmarkError[]>;
  notes?: string[];
}

export interface OutboundCall {
  time: string;
  service: string;
  query: string;
}

export const ZERO_SCENARIO: Scenario = {
  revenue_pct: 0,
  ebitda_pct: 0,
  dso_delta: 0,
  dio_delta: 0,
  capex_extra: 0,
  rate_bp: 0,
};
