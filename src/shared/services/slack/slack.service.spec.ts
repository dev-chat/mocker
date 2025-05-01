import { SlackService } from './slack.service';

describe('slack-utils', () => {
  let slackService: SlackService;

  beforeEach(() => {
    slackService = new SlackService();
  });
  // describe('getUserNameById()', () => {
  //   it('should return the user.name property of a known user by id', () => {
  //     expect(slackService.getUserName('123')).toBe('test_user123');
  //   });

  //   it('should return an empty string for a user that does not exist', () => {
  //     expect(slackService.getUserName('1010')).toBe('');
  //   });

  //   it('should handle empty strings values', () => {
  //     expect(slackService.getUserName('')).toBe('');
  //   });
  // });

  describe('getUserId()', () => {
    it('should return a userId when one is passed in without a username', () => {
      expect(slackService.getUserId('<@U2TYNKJ>')).toBe('U2TYNKJ');
    });

    it('should return a userId when one is passed in with a username with spaces', () => {
      expect(slackService.getUserId('<@U2TYNKJ | jrjrjr>')).toBe('U2TYNKJ');
    });

    it('should return a userId when one is passed in with a username without spaces', () => {
      expect(slackService.getUserId('<@U2TYNKJ|jrjrjr>')).toBe('U2TYNKJ');
    });

    it('should return empty string when no userId exists', () => {
      expect(slackService.getUserId('total waste of time')).toBe('');
    });

    it('should return the string when it exists inside of another string', () => {
      expect(slackService.getUserId('Posted by: <@U2YJQN2KB> | Search: test')).toBe('U2YJQN2KB');
    });
  });

  describe('containsTag()', () => {
    it('should return false if a word has @ in it and is not a tag', () => {
      const testWord = '.@channel';
      expect(slackService.containsTag(testWord)).toBe(false);
    });

    it('should return false if a word does not include @', () => {
      const testWord = 'test';
      expect(slackService.containsTag(testWord)).toBe(false);
    });

    it('should return false if no text is passed in', () => {
      expect(slackService.containsTag('')).toBe(false);
    });

    it('should return false if undefined is passed in', () => {
      expect(slackService.containsTag(undefined)).toBe(false);
    });

    it('should return true if a word has <!channel> in it', () => {
      const testWord = '<!channel>';
      expect(slackService.containsTag(testWord)).toBe(true);
    });

    it('should return true if a word has <!here> in it', () => {
      const testWord = '<!here>';
      expect(slackService.containsTag(testWord)).toBe(true);
    });

    it('should return true if a word has a tagged user', () => {
      const testUser = '<@UTJFJKL>';
      expect(slackService.containsTag(testUser)).toBe(true);
    });
  });

  describe('getUserIdByCallbackId()', () => {
    it('should return a userId when there is one present', () => {
      const callbackId = 'JSLKDJLFJ_U25JKLMN';
      expect(slackService.getUserIdByCallbackId(callbackId)).toBe('U25JKLMN');
    });

    it('should return an empty string when there is no id present', () => {
      const callbackId = 'LJKSDLFJSF';
      expect(slackService.getUserIdByCallbackId(callbackId)).toBe('');
    });

    it('should handle an empty string callbackId', () => {
      expect(slackService.getUserIdByCallbackId('')).toBe('');
    });
  });

  describe('getBotId()', () => {
    describe('it should handle undefined values', () => {
      it('should return an id fromText if it is the only id present', () => {
        expect(slackService.getBotId('12345', undefined, undefined, undefined)).toBe('12345');
      });

      it('should return an id fromAttachmentText if it is the only id present', () => {
        expect(slackService.getBotId(undefined, '12345', undefined, undefined)).toBe('12345');
      });

      it('should return an id fromPretext if it is the only id present', () => {
        expect(slackService.getBotId(undefined, undefined, '12345', undefined)).toBe('12345');
      });

      it('should return an id fromCallBackId if it is the only id present', () => {
        expect(slackService.getBotId(undefined, undefined, undefined, '12345')).toBe('12345');
      });
    });

    describe('it should handle empty strings', () => {
      it('should return an id fromText if it is the only id present', () => {
        expect(slackService.getBotId('12345', '', '', '', '')).toBe('12345');
      });

      it('should return an id fromAttachmentText if it is the only id present', () => {
        expect(slackService.getBotId('', '12345', '', '', '')).toBe('12345');
      });

      it('should return an id fromPretext if it is the only id present', () => {
        expect(slackService.getBotId('', '', '12345', '', '')).toBe('12345');
      });

      it('should return an id fromCallBackId if it is the only id present', () => {
        expect(slackService.getBotId('', '', '', '12345', '')).toBe('12345');
      });
    });

    describe('it should return in the proper order', () => {
      it('should return the first available id - fromText', () => {
        expect(slackService.getBotId('1', '2', '3', '4', '')).toBe('1');
      });

      it('should return the first available id - fromAttachmentText', () => {
        expect(slackService.getBotId(undefined, '2', '3', '4', '')).toBe('2');
      });

      it('should return the first available id - fromPretext', () => {
        expect(slackService.getBotId(undefined, undefined, '3', '4', '')).toBe('3');
      });

      it('should return the first available id - fromCallbackId', () => {
        expect(slackService.getBotId(undefined, undefined, undefined, '4', '')).toBe('4');
      });
    });
  });
});
