export const FACT_TARGET_COUNT = parseInt(process.env.FACT_TARGET_COUNT ?? '5', 10);
export const MAX_FACT_ATTEMPTS = parseInt(process.env.MAX_FACT_ATTEMPTS ?? '50', 10);
export const MAX_JOKE_ATTEMPTS = parseInt(process.env.MAX_JOKE_ATTEMPTS ?? '20', 10);
export const FUN_FACT_SLACK_CHANNEL = process.env.FUN_FACT_SLACK_CHANNEL ?? '#general';

export const USELESS_FACTS_URL = 'https://uselessfacts.jsph.pl/random.json?language=en';
export const API_NINJAS_URL = 'https://api.api-ninjas.com/v1/facts?limit=1';
export const QUOTE_URL = 'https://quotes.rest/qod.json?category=inspire';
export const JOKE_URL =
  'https://v2.jokeapi.dev/joke/Miscellaneous,Pun,Spooky?blacklistFlags=racist,sexist';
