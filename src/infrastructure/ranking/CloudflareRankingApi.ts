export interface PublicRankingEntry {
  rank: number;
  display_name: string;
  score: number;
  accuracy: number;
  completed_at: number;
}

interface RankingResponse {
  entries: PublicRankingEntry[];
  error?: string;
}

export function buildRankingUrl(baseUrl: string, mode: 'frequency' | 'notes' = 'frequency', limit = 25): string {
  const origin = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams({ mode, limit: String(Math.min(Math.max(limit, 1), 100)) });
  return `${origin}/api/rankings/solo?${params.toString()}`;
}

export class CloudflareRankingApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string = import.meta.env.VITE_RANKING_API_URL || '') {
    this.baseUrl = baseUrl;
  }

  async getSoloRanking(limit = 25): Promise<PublicRankingEntry[]> {
    const response = await fetch(buildRankingUrl(this.baseUrl, 'frequency', limit));
    const data = await response.json().catch(() => ({})) as RankingResponse;
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el ranking público.');
    return Array.isArray(data.entries) ? data.entries : [];
  }
}
