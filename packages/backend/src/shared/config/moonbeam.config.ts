export const MoonbeamConfig = {
  // Memory (PR 2-3)
  memoryEnabled: process.env.MOONBEAM_MEMORY_ENABLED === 'true',

  // Attention (PR 4)
  attentionEnabled: process.env.MOONBEAM_ATTENTION_ENABLED === 'true',
  attentionThreshold: parseInt(process.env.MOONBEAM_ATTENTION_THRESHOLD || '8', 10),
  attentionWindowMinutes: parseInt(process.env.MOONBEAM_ATTENTION_WINDOW_MINUTES || '10', 10),
  attentionCooldownMinutes: parseInt(process.env.MOONBEAM_ATTENTION_COOLDOWN_MINUTES || '30', 10),
  attentionChannels: process.env.MOONBEAM_ATTENTION_CHANNELS || '*',

  // Feedback (PR 7)
  feedbackEnabled: process.env.MOONBEAM_FEEDBACK_ENABLED === 'true',

  // Threads (PR 5)
  threadsEnabled: process.env.MOONBEAM_THREADS_ENABLED === 'true',

  // Cross-channel (PR 8)
  crossChannelEnabled: process.env.MOONBEAM_CROSS_CHANNEL_ENABLED === 'true',

  // History
  historyMaxMessages: parseInt(process.env.MOONBEAM_HISTORY_MAX_MESSAGES || '50', 10),
  historyWindowMinutes: parseInt(process.env.MOONBEAM_HISTORY_WINDOW_MINUTES || '30', 10),

  // AI Provider
  primaryProvider: (process.env.MOONBEAM_PRIMARY_PROVIDER || 'openai') as 'openai' | 'gemini',
  gateProvider: (process.env.MOONBEAM_GATE_PROVIDER || 'openai') as 'openai' | 'gemini',
  gateModel: process.env.MOONBEAM_GATE_MODEL || 'gpt-4.1-nano',

  // Reactions (PR 7)
  reactionsEnabled: process.env.MOONBEAM_REACTIONS_ENABLED === 'true',
  reactionsProbability: parseFloat(process.env.MOONBEAM_REACTIONS_PROBABILITY || '0.05'),
};
