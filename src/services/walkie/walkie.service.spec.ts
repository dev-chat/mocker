import { WalkieService } from './walkie.service';

describe('slack-utils', () => {
  let walkieService: WalkieService;

  beforeEach(() => {
    walkieService = new WalkieService();
  });

  describe('walkieTalkie', () => {
    it('convert a user id to NATO alphabet', () => {
      const talked = walkieService.walkieTalkie('This this <@U2ZCMGB52 | whoever> test test');
      expect(talked).toBe(`:walkietalkie: *chk* This this Juliet Foxtrot test test over. *chk* :walkietalkie:`);
    });

    it('should handle multiple user ids', () => {
      const talked = walkieService.walkieTalkie(
        'This this <@U2ZCMGB52 | whoever> test test <@U45HMKFJR | charliemike>',
      );
      expect(talked).toBe(
        `:walkietalkie: *chk* This this Juliet Foxtrot test test Charlie Mike over. *chk* :walkietalkie:`,
      );
    });

    it('should handle nonexistent call signs', () => {
      const talked = walkieService.walkieTalkie('This this <@2222 | whoever> test test <@2222 | charliemike>');
      expect(talked).toBe(
        `:walkietalkie: *chk* This this <@2222 | whoever> test test <@2222 | charliemike> over. *chk* :walkietalkie:`,
      );
    });
  });
});
