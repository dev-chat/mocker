export interface UrbanDictionaryResponse {
  list: Definition[];
}

export interface Definition {
  definition: string;
  permalink: string;
  thumbs_up: number;
  author: string;
  word: string;
  defid: number;
  written_on: string; // ISO Date
  example: string;
  thumbs_down: number;
  current_vote?: string;
  sound_urls?: any[];
}
