import Axios from 'axios';
import { getRepository } from 'typeorm';
import type { Block, KnownBlock } from '@slack/web-api';
import { Fact } from '../shared/db/models/Fact';
import { Joke } from '../shared/db/models/Joke';
import { WebService } from '../shared/services/web/web.service';
import { logger } from '../shared/logger/logger';

export const FACT_TARGET_COUNT = parseInt(process.env.FACT_TARGET_COUNT ?? '5', 10);
export const MAX_FACT_ATTEMPTS = parseInt(process.env.MAX_FACT_ATTEMPTS ?? '50', 10);
export const MAX_JOKE_ATTEMPTS = parseInt(process.env.MAX_JOKE_ATTEMPTS ?? '20', 10);
export const FUN_FACT_SLACK_CHANNEL = process.env.FUN_FACT_SLACK_CHANNEL ?? '#general';

const USELESS_FACTS_URL = 'https://uselessfacts.jsph.pl/random.json?language=en';
const API_NINJAS_URL = 'https://api.api-ninjas.com/v1/facts?limit=1';
const QUOTE_URL = 'https://quotes.rest/qod.json?category=inspire';
const JOKE_URL = 'https://v2.jokeapi.dev/joke/Miscellaneous,Pun,Spooky?blacklistFlags=racist,sexist';

interface FetchedFact {
  fact: string;
  source: string;
}

interface QuotePayload {
  text: string;
  error?: string;
}

interface OnThisDayPayload {
  text: string;
  url: string;
  image: string | null;
  title: string;
}

export class FunFactJob {
  private webService = new WebService();
  private jobLogger = logger.child({ module: 'FunFactJob' });

  async run(): Promise<void> {
    this.jobLogger.info('Starting fun-fact job run');

    if (!process.env.API_NINJA_KEY) {
      this.jobLogger.warn('API_NINJA_KEY is not set; fun-fact job will only use uselessfacts API');
    }

    try {
      const [facts, jokeText, quotePayload, onThisDayPayload] = await Promise.all([
        this.collectFacts(),
        this.fetchJoke(),
        this.fetchQuote(),
        this.fetchOnThisDay(),
      ]);

      const blocks = this.buildBlocks(quotePayload, facts, onThisDayPayload, jokeText);
      await this.webService.sendMessage(
        FUN_FACT_SLACK_CHANNEL,
        "SimpleTech's SimpleFacts",
        blocks,
      );
      this.jobLogger.info(`Fun-fact job complete — posted to ${FUN_FACT_SLACK_CHANNEL}`);
    } catch (e) {
      this.jobLogger.error('Fun-fact job failed', e);
    }
  }

  private async isNewFact(fact: string, source: string): Promise<boolean> {
    const count = await getRepository(Fact).count({ where: { fact, source } });
    return count === 0;
  }

  private async saveFact(fact: string, source: string): Promise<void> {
    const entity = new Fact();
    entity.fact = fact;
    entity.source = source;
    await getRepository(Fact).insert(entity);
  }

  private async fetchFactFromApi(): Promise<FetchedFact> {
    if (Math.random() < 0.5) {
      const response = await Axios.get<{ text: string }>(USELESS_FACTS_URL);
      return { fact: response.data.text, source: USELESS_FACTS_URL };
    } else {
      const response = await Axios.get<Array<{ fact: string }>>(API_NINJAS_URL, {
        headers: { 'X-Api-Key': process.env.API_NINJA_KEY ?? '' },
      });
      return { fact: response.data[0].fact, source: API_NINJAS_URL };
    }
  }

  private async collectFacts(): Promise<FetchedFact[]> {
    const facts: FetchedFact[] = [];
    let attempts = 0;

    while (facts.length < FACT_TARGET_COUNT) {
      attempts++;
      if (attempts > MAX_FACT_ATTEMPTS) {
        this.jobLogger.error(
          `Unable to collect ${FACT_TARGET_COUNT} unique facts after ${MAX_FACT_ATTEMPTS} attempts`,
        );
        break;
      }

      const fetched = await this.fetchFactFromApi().catch((e) => {
        this.jobLogger.warn('Failed to fetch fact from API', e);
        return null;
      });

      if (!fetched) {
        continue;
      }

      const isNew = await this.isNewFact(fetched.fact, fetched.source);
      if (isNew) {
        await this.saveFact(fetched.fact, fetched.source);
        facts.push(fetched);
        this.jobLogger.info(`Collected fact ${facts.length}/${FACT_TARGET_COUNT} from ${fetched.source}`);
      }
    }

    return facts;
  }

  private async isNewJoke(jokeApiId: string): Promise<boolean> {
    const count = await getRepository(Joke).count({ where: { jokeApiId } });
    return count === 0;
  }

  private async saveJoke(jokeApiId: string): Promise<void> {
    const entity = new Joke();
    entity.jokeApiId = jokeApiId;
    await getRepository(Joke).insert(entity);
  }

  private async fetchJoke(): Promise<string> {
    for (let attempt = 0; attempt < MAX_JOKE_ATTEMPTS; attempt++) {
      const response = await Axios.get<{
        id: number;
        type: 'single' | 'twopart';
        joke?: string;
        setup?: string;
        delivery?: string;
      }>(JOKE_URL);
      const jokeApiId = String(response.data.id);

      if (await this.isNewJoke(jokeApiId)) {
        await this.saveJoke(jokeApiId);
        if (response.data.type === 'single') {
          return response.data.joke ?? '';
        }
        return `${response.data.setup ?? ''}\n\n${response.data.delivery ?? ''}`;
      }
    }

    throw new Error(`Unable to retrieve a unique joke after ${MAX_JOKE_ATTEMPTS} attempts`);
  }

  private async fetchQuote(): Promise<QuotePayload> {
    try {
      const response = await Axios.get<{
        contents: { quotes: Array<{ quote: string; author: string; id: string }> };
      }>(QUOTE_URL);
      const quote = response.data.contents.quotes[0];
      return { text: `${quote.quote} - ${quote.author}` };
    } catch {
      return { text: '', error: 'Issue with quote API - non 200 status code' };
    }
  }

  private async fetchOnThisDay(): Promise<OnThisDayPayload> {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const response = await Axios.get<{
      selected: Array<{
        text: string;
        pages: Array<{
          content_urls: { desktop: { page: string } };
          thumbnail?: { source: string };
          title: string;
        }>;
      }>;
    }>(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}`);

    const selected = response.data.selected[0];
    const page = selected.pages[0];
    return {
      text: selected.text,
      url: page.content_urls.desktop.page,
      image: page.thumbnail?.source ?? null,
      title: page.title,
    };
  }

  private buildBlocks(
    quotePayload: QuotePayload,
    facts: FetchedFact[],
    onThisDay: OnThisDayPayload,
    jokeText: string,
  ): Array<Block | KnownBlock> {
    const factsText = facts.map((f) => `• ${f.fact}`).join('\n');

    const blocks: Array<Block | KnownBlock> = [
      {
        type: 'header',
        text: { type: 'plain_text', text: "SimpleTech's SimpleFacts :tm:", emoji: true },
      },
    ];

    if (!quotePayload.error) {
      blocks.push(
        { type: 'divider' },
        {
          type: 'section',
          fields: [{ type: 'mrkdwn', text: '*Inspirational Quote of the Day* \n' }],
        },
        { type: 'section', text: { type: 'mrkdwn', text: quotePayload.text } },
      );
    }

    blocks.push(
      { type: 'divider' },
      { type: 'section', fields: [{ type: 'mrkdwn', text: '*Daily Joke:*' }] },
      { type: 'section', text: { type: 'mrkdwn', text: jokeText } },
      { type: 'divider' },
      { type: 'section', fields: [{ type: 'mrkdwn', text: '*Daily Facts:*' }] },
      { type: 'section', text: { type: 'mrkdwn', text: factsText } },
      { type: 'divider' },
      { type: 'section', fields: [{ type: 'mrkdwn', text: '*On This Day:*' }] },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${onThisDay.text} \n\n <${onThisDay.url}|Learn More>`,
        },
      },
    );

    if (onThisDay.image) {
      blocks.push({ type: 'image', image_url: onThisDay.image, alt_text: onThisDay.title });
    }

    blocks.push(
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: "Disclaimer: SimpleTech's SimpleFacts :tm: offer no guarantee to the validity of the facts provided.",
          },
        ],
      },
    );

    return blocks;
  }
}
