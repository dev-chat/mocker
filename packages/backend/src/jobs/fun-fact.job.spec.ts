import { vi } from 'vitest';
import Axios from 'axios';
import { getRepository } from 'typeorm';
import { FunFactJob } from './fun-fact.job';
import { loggerMock } from '../test/mocks/logger.mock';
import type { FetchedFact, OnThisDayPayload, QuotePayload } from './fun-fact.model';

vi.mock('axios');

vi.mock('typeorm', async () => ({
  ...(await vi.importActual('typeorm')),
  getRepository: vi.fn(),
}));

// Use smaller iteration limits so tests run quickly without network
vi.mock('./fun-fact.const', async () => ({
  ...(await vi.importActual('./fun-fact.const')),
  FACT_TARGET_COUNT: 2,
  MAX_FACT_ATTEMPTS: 3,
  MAX_JOKE_ATTEMPTS: 2,
}));

import {
  FACT_TARGET_COUNT,
  MAX_FACT_ATTEMPTS,
  MAX_JOKE_ATTEMPTS,
  FUN_FACT_SLACK_CHANNEL,
  USELESS_FACTS_URL,
  API_NINJAS_URL,
} from './fun-fact.const';

type FunFactJobHarness = FunFactJob & {
  webService: { sendMessage: Mock };
  collectFacts: () => Promise<FetchedFact[]>;
  fetchJoke: () => Promise<string>;
  fetchQuote: () => Promise<QuotePayload>;
  fetchOnThisDay: () => Promise<OnThisDayPayload>;
  fetchFactFromApi: () => Promise<FetchedFact>;
};

describe('FunFactJob', () => {
  let job: FunFactJob;
  let harness: FunFactJobHarness;
  const count = vi.fn();
  const insert = vi.fn();
  const sendMessage = vi.fn();

  const stubFacts: FetchedFact[] = [
    { fact: 'Fact one', source: USELESS_FACTS_URL },
    { fact: 'Fact two', source: USELESS_FACTS_URL },
  ];

  const stubOnThisDay: OnThisDayPayload = {
    text: 'An event happened',
    url: 'https://en.wikipedia.org/wiki/Event',
    image: 'https://img.example.com/thumb.jpg',
    title: 'Event',
  };

  beforeEach(() => {
    job = new FunFactJob();
    harness = job as unknown as FunFactJobHarness;
    harness.webService = { sendMessage };
    (getRepository as Mock).mockReturnValue({ count, insert });
  });

  // ---------------------------------------------------------------------------
  // run()
  // ---------------------------------------------------------------------------

  describe('run()', () => {
    beforeEach(() => {
      vi.spyOn(harness, 'collectFacts').mockResolvedValue(stubFacts);
      vi.spyOn(harness, 'fetchJoke').mockResolvedValue('Why did the chicken cross the road?');
      vi.spyOn(harness, 'fetchQuote').mockResolvedValue({ text: 'Be yourself - Oscar Wilde' });
      vi.spyOn(harness, 'fetchOnThisDay').mockResolvedValue(stubOnThisDay);
    });

    it('collects all data, builds blocks, and posts to Slack', async () => {
      await job.run();

      expect(sendMessage).toHaveBeenCalledWith(FUN_FACT_SLACK_CHANNEL, "SimpleTech's SimpleFacts", expect.any(Array));
    });

    it('still posts to Slack and omits quote blocks when fetchQuote returns an error payload', async () => {
      // Override the default successful quote with an error payload
      (harness.fetchQuote as Mock).mockResolvedValue({ text: '', error: 'Quote service unavailable' });

      await job.run();

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith(FUN_FACT_SLACK_CHANNEL, "SimpleTech's SimpleFacts", expect.any(Array));

      const blocks = sendMessage.mock.calls[0][2];
      expect(Array.isArray(blocks)).toBe(true);
      // Ensure no block appears to be a quote header/section when the quote fetch fails
      const hasQuoteBlock = blocks.some(
        (block: Record<string, unknown>) =>
          block.text !== null &&
          typeof block.text === 'object' &&
          typeof (block.text as Record<string, unknown>).text === 'string' &&
          ((block.text as Record<string, unknown>).text as string).toLowerCase().includes('quote'),
      );
      expect(hasQuoteBlock).toBe(false);
    });

    it('resolves without throwing and logs the error when a sub-job throws', async () => {
      vi.spyOn(harness, 'fetchOnThisDay').mockRejectedValue(new Error('Wikipedia is down'));

      await expect(job.run()).resolves.toBeUndefined();

      expect(loggerMock.error).toHaveBeenCalledWith('Fun-fact job failed', expect.any(Error));
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('logs a warning when API_NINJA_KEY is not set', async () => {
      const saved = process.env.API_NINJA_KEY;
      delete process.env.API_NINJA_KEY;

      await job.run();

      expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('API_NINJA_KEY is not set'));

      if (saved !== undefined) process.env.API_NINJA_KEY = saved;
    });
  });

  // ---------------------------------------------------------------------------
  // fetchFactFromApi()
  // ---------------------------------------------------------------------------

  describe('fetchFactFromApi()', () => {
    afterEach(() => {
      delete process.env.API_NINJA_KEY;
    });

    it('fetches from uselessfacts when API_NINJA_KEY is absent', async () => {
      delete process.env.API_NINJA_KEY;
      (Axios.get as Mock).mockResolvedValue({ data: { text: 'Water is wet' } });

      const result = await harness.fetchFactFromApi();

      expect(Axios.get).toHaveBeenCalledWith(USELESS_FACTS_URL);
      expect(result).toEqual({ fact: 'Water is wet', source: USELESS_FACTS_URL });
    });

    it('fetches from API Ninjas when key is present and the API Ninjas branch is taken', async () => {
      process.env.API_NINJA_KEY = 'test-key';
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // force >= 0.5 branch
      (Axios.get as Mock).mockResolvedValue({ data: [{ fact: 'Ninja fact' }] });

      const result = await harness.fetchFactFromApi();

      expect(Axios.get).toHaveBeenCalledWith(API_NINJAS_URL, {
        headers: { 'X-Api-Key': 'test-key' },
      });
      expect(result).toEqual({ fact: 'Ninja fact', source: API_NINJAS_URL });
    });

    it('throws when API Ninjas returns an empty array', async () => {
      process.env.API_NINJA_KEY = 'test-key';
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      (Axios.get as Mock).mockResolvedValue({ data: [] });

      await expect(harness.fetchFactFromApi()).rejects.toThrow('API Ninjas returned an empty facts array');
    });
  });

  // ---------------------------------------------------------------------------
  // collectFacts()
  // ---------------------------------------------------------------------------

  describe('collectFacts()', () => {
    beforeEach(() => {
      delete process.env.API_NINJA_KEY;
      (Axios.get as Mock).mockResolvedValue({ data: { text: 'A cool fact' } });
    });

    it('collects unique facts up to FACT_TARGET_COUNT', async () => {
      count.mockResolvedValue(0);

      const facts = await harness.collectFacts();

      expect(facts).toHaveLength(FACT_TARGET_COUNT);
      expect(insert).toHaveBeenCalledTimes(FACT_TARGET_COUNT);
    });

    it('skips duplicate facts and retries until FACT_TARGET_COUNT is reached', async () => {
      count.mockResolvedValueOnce(1).mockResolvedValue(0); // first is duplicate

      const facts = await harness.collectFacts();

      expect(facts).toHaveLength(FACT_TARGET_COUNT);
      // one extra API call due to the skipped duplicate
      expect(Axios.get).toHaveBeenCalledTimes(FACT_TARGET_COUNT + 1);
    });

    it('continues past a failed API call and logs a warning', async () => {
      (Axios.get as Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ data: { text: 'A cool fact' } });
      count.mockResolvedValue(0);

      const facts = await harness.collectFacts();

      expect(facts).toHaveLength(FACT_TARGET_COUNT);
      expect(loggerMock.warn).toHaveBeenCalledWith('Failed to fetch fact from API', expect.any(Error));
    });

    it('returns an empty array and logs an error after MAX_FACT_ATTEMPTS failed fetches', async () => {
      vi.spyOn(harness, 'fetchFactFromApi').mockRejectedValue(new Error('Always fails'));

      const facts = await harness.collectFacts();

      expect(facts).toHaveLength(0);
      expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining(`after ${MAX_FACT_ATTEMPTS} attempts`));
    });
  });

  // ---------------------------------------------------------------------------
  // fetchJoke()
  // ---------------------------------------------------------------------------

  describe('fetchJoke()', () => {
    it('returns single joke text', async () => {
      count.mockResolvedValue(0);
      (Axios.get as Mock).mockResolvedValue({
        data: { id: 1, type: 'single', joke: 'Why did the chicken?' },
      });

      const result = await harness.fetchJoke();

      expect(result).toBe('Why did the chicken?');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ jokeApiId: '1' }));
    });

    it('returns twopart joke with setup and delivery separated by two newlines', async () => {
      count.mockResolvedValue(0);
      (Axios.get as Mock).mockResolvedValue({
        data: { id: 2, type: 'twopart', setup: 'Why?', delivery: 'Because.' },
      });

      const result = await harness.fetchJoke();

      expect(result).toBe('Why?\n\nBecause.');
    });

    it('retries when the fetched joke has already been seen', async () => {
      count.mockResolvedValueOnce(1).mockResolvedValue(0); // first is a duplicate
      (Axios.get as Mock).mockResolvedValue({
        data: { id: 5, type: 'single', joke: 'Fresh joke' },
      });

      const result = await harness.fetchJoke();

      expect(result).toBe('Fresh joke');
      expect(Axios.get).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting MAX_JOKE_ATTEMPTS with only duplicate jokes', async () => {
      count.mockResolvedValue(1); // always a duplicate
      (Axios.get as Mock).mockResolvedValue({
        data: { id: 99, type: 'single', joke: 'Old joke' },
      });

      await expect(harness.fetchJoke()).rejects.toThrow(
        `Unable to retrieve a unique joke after ${MAX_JOKE_ATTEMPTS} attempts`,
      );
      expect(Axios.get).toHaveBeenCalledTimes(MAX_JOKE_ATTEMPTS);
    });
  });

  // ---------------------------------------------------------------------------
  // fetchQuote()
  // ---------------------------------------------------------------------------

  describe('fetchQuote()', () => {
    it('returns formatted quote text on zenquotes success payload', async () => {
      (Axios.get as Mock).mockResolvedValue({
        data: [{ q: 'Be yourself', a: 'Oscar Wilde' }],
      });

      const result = await harness.fetchQuote();

      expect(result).toEqual({ text: 'Be yourself - Oscar Wilde' });
    });

    it('returns formatted quote text on legacy success payload', async () => {
      (Axios.get as Mock).mockResolvedValue({
        data: {
          contents: { quotes: [{ quote: 'Be yourself', author: 'Oscar Wilde', id: '1' }] },
        },
      });

      const result = await harness.fetchQuote();

      expect(result).toEqual({ text: 'Be yourself - Oscar Wilde' });
    });

    it('returns error payload when the API throws (non-200)', async () => {
      (Axios.get as Mock).mockRejectedValue(new Error('503 Unavailable'));

      const result = await harness.fetchQuote();

      expect(result).toEqual({ text: '', error: 'Issue with quote API - non 200 status code' });
    });

    it('returns error payload when the quotes array is empty', async () => {
      (Axios.get as Mock).mockResolvedValue({
        data: [],
      });

      const result = await harness.fetchQuote();

      expect(result).toEqual({ text: '', error: 'Quote API returned no quotes' });
    });

    it('returns error payload when contents is absent from the response', async () => {
      (Axios.get as Mock).mockResolvedValue({ data: {} });

      const result = await harness.fetchQuote();

      expect(result).toEqual({ text: '', error: 'Quote API returned no quotes' });
    });
  });

  // ---------------------------------------------------------------------------
  // fetchOnThisDay()
  // ---------------------------------------------------------------------------

  describe('fetchOnThisDay()', () => {
    const validPage = {
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Event' } },
      thumbnail: { source: 'https://img.example.com/thumb.jpg' },
      title: 'Event',
    };

    it('returns the full payload including image when thumbnail is present', async () => {
      (Axios.get as Mock).mockResolvedValue({
        data: { selected: [{ text: 'Something happened', pages: [validPage] }] },
      });

      const result = await harness.fetchOnThisDay();

      expect(result).toEqual({
        text: 'Something happened',
        url: 'https://en.wikipedia.org/wiki/Event',
        image: 'https://img.example.com/thumb.jpg',
        title: 'Event',
      });
    });

    it('returns null for image when thumbnail is absent', async () => {
      const pageWithoutThumb = { ...validPage, thumbnail: undefined };
      (Axios.get as Mock).mockResolvedValue({
        data: { selected: [{ text: 'Something happened', pages: [pageWithoutThumb] }] },
      });

      const result = await harness.fetchOnThisDay();

      expect(result.image).toBeNull();
    });

    it('throws a descriptive error when selected array is empty', async () => {
      (Axios.get as Mock).mockResolvedValue({ data: { selected: [] } });

      await expect(harness.fetchOnThisDay()).rejects.toThrow('Wikipedia OnThisDay API returned no "selected" events');
    });

    it('throws a descriptive error when selected is absent from the response', async () => {
      (Axios.get as Mock).mockResolvedValue({ data: {} });

      await expect(harness.fetchOnThisDay()).rejects.toThrow('Wikipedia OnThisDay API returned no "selected" events');
    });

    it('throws a descriptive error when pages array is empty', async () => {
      (Axios.get as Mock).mockResolvedValue({
        data: { selected: [{ text: 'Event', pages: [] }] },
      });

      await expect(harness.fetchOnThisDay()).rejects.toThrow(
        'Wikipedia OnThisDay API returned no pages for the selected event',
      );
    });
  });
});
