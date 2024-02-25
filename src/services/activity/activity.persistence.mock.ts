export const mockEventRequest = {
  event: {
    type: 'abc',
    user: 'abc',
    channel: 'abc',
    channel_type: 'abc',
  },
  team_id: 'abc',
};

export const mockEventRequestWithNoUser = {
  event: {
    type: 'abc',
    user: 'abc',
  },
};

export const mockEventRequestWithNumberUser = {
  event: {
    type: 'abc',
    user: 123,
  },
};

export const mockEventRequestWithUserProfileChanged = {
  event: {
    type: 'user_profile_changed',
  },
};
