const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL must be set. Add it to your .env file (see .env.example).');
}

export const API_BASE_URL: string = apiBaseUrl;
