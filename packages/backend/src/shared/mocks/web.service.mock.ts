export const MockWebService = {
  WebService: {
    deleteMessage: jest.fn(),
    sendEphemeral: jest.fn(),
    sendMessage: jest.fn(),
    editMessage: jest.fn(),
    getAllUsers: jest.fn(),
    getAllChannels: jest.fn(),
    uploadFile: jest.fn(),
  },
};
