export interface FetchedFact {
  fact: string;
  source: string;
}

export interface QuotePayload {
  text: string;
  error?: string;
}

export interface OnThisDayPayload {
  text: string;
  url: string;
  image: string | null;
  title: string;
}
