import { WebService } from './web.service';

describe('WebService', () => {
  let webService: WebService;

  beforeEach(() => {
    webService = WebService.getInstance();
  });

  describe('sendMessage()', () => {
    it('should be defined', () => {
      expect(webService.sendMessage).toBeDefined();
    });
  });

  describe('deleteMessage()', () => {
    it('should be defined', () => {
      expect(webService.deleteMessage).toBeDefined();
    });
  });

  describe('getAllUsers()', () => {
    it('should be defined', () => {
      expect(webService.getAllUsers).toBeDefined();
    });
  });
});
