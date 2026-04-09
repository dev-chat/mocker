import { vi } from 'vitest';
import { WebService } from './web.service';

type MockWebClient = {
  chat: {
    postMessage: Mock;
    delete: Mock;
    postEphemeral: Mock;
    update: Mock;
  };
  users: { list: Mock; setPhoto: Mock };
  conversations: { list: Mock };
  files: { upload: Mock };
};

type WebServicePrivate = WebService & { web: MockWebClient };

type SlackApiError = Error & { data?: { error?: string } };

describe('WebService', () => {
  let webService: WebService;
  let mockWebClient: MockWebClient;

  beforeEach(() => {
    vi.clearAllMocks();
    webService = new WebService();
    mockWebClient = (webService as unknown as WebServicePrivate).web;
  });

  describe('sendMessage', () => {
    it('sends message successfully', async () => {
      const result = { ok: true, ts: '1.1' };
      mockWebClient.chat.postMessage.mockResolvedValue(result);

      await expect(webService.sendMessage('C1', 'hello')).resolves.toEqual(result);
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C1', text: 'hello', unfurl_links: false }),
      );
    });

    it('throws and logs when postMessage fails', async () => {
      const error = new Error('boom');
      (error as SlackApiError).data = { error: 'bad' };
      const loggerSpy = vi.spyOn(webService.logger, 'error');
      mockWebClient.chat.postMessage.mockRejectedValue(error);

      await expect(webService.sendMessage('C1', 'hello')).rejects.toThrow('boom');
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('calls delete API', async () => {
      mockWebClient.chat.delete.mockResolvedValue({ ok: true });

      webService.deleteMessage('C1', '1.23', 'U1');
      await Promise.resolve();

      expect(mockWebClient.chat.delete).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C1', ts: '1.23', as_user: true }),
      );
    });

    it('returns early when retries exceed max', async () => {
      webService.deleteMessage('C1', '1.23', 'U1', 6);
      await Promise.resolve();

      expect(mockWebClient.chat.delete).not.toHaveBeenCalled();
    });

    it('does not retry when message_not_found', async () => {
      const error = new Error('not found');
      (error as SlackApiError).data = { error: 'message_not_found' };
      mockWebClient.chat.delete.mockRejectedValue(error);

      webService.deleteMessage('C1', '1.23', 'U1');
      await Promise.resolve();

      expect(mockWebClient.chat.delete).toHaveBeenCalledTimes(1);
    });

    it('logs and schedules retry for non-message_not_found errors', async () => {
      const loggerSpy = vi.spyOn(webService.logger, 'error');
      const timeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(() => 0 as never);
      const error = new Error('rate');
      (error as SlackApiError).data = { error: 'rate_limited' };
      mockWebClient.chat.delete.mockRejectedValue(error);

      webService.deleteMessage('C1', '1.23', 'U1');
      await new Promise((resolve) => setImmediate(resolve));

      expect(loggerSpy).toHaveBeenCalled();
      expect(timeoutSpy).toHaveBeenCalled();
      timeoutSpy.mockRestore();
    });

    it('logs slack api error in successful delete response', async () => {
      const loggerSpy = vi.spyOn(webService.logger, 'error');
      mockWebClient.chat.delete.mockResolvedValue({ ok: false, error: 'cant_delete_message' });

      webService.deleteMessage('C1', '1.23', 'U1');
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('sendEphemeral', () => {
    it('sends ephemeral and returns result', async () => {
      const result = { ok: true };
      mockWebClient.chat.postEphemeral.mockResolvedValue(result);

      await expect(webService.sendEphemeral('C1', 'hello', 'U1')).resolves.toEqual(result);
    });

    it('returns error value on failure', async () => {
      const error = new Error('oops');
      mockWebClient.chat.postEphemeral.mockRejectedValue(error);

      await expect(webService.sendEphemeral('C1', 'hello', 'U1')).resolves.toEqual(error);
    });
  });

  describe('editMessage', () => {
    it('calls update API', async () => {
      mockWebClient.chat.update.mockResolvedValue({ ok: true });

      webService.editMessage('C1', 'updated', '1.23');
      await Promise.resolve();

      expect(mockWebClient.chat.update).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C1', text: 'updated', ts: '1.23' }),
      );
    });
  });

  describe('setProfilePhoto', () => {
    it('uploads the profile photo successfully', async () => {
      const result = { ok: true };
      const image = Buffer.from('png-bytes');
      mockWebClient.users.setPhoto.mockResolvedValue(result);

      await expect(webService.setProfilePhoto(image)).resolves.toEqual(result);
      expect(mockWebClient.users.setPhoto).toHaveBeenCalledWith(expect.objectContaining({ image }));
    });

    it('throws and logs when Slack responds with ok false', async () => {
      const loggerSpy = vi.spyOn(webService.logger, 'error');
      mockWebClient.users.setPhoto.mockResolvedValue({ ok: false, error: 'bad_image' });

      await expect(webService.setProfilePhoto(Buffer.from('png-bytes'))).rejects.toThrow('bad_image');
      expect(loggerSpy).toHaveBeenCalled();
    });

    it('throws and logs when the upload rejects', async () => {
      const loggerSpy = vi.spyOn(webService.logger, 'error');
      const error = new Error('upload failed');
      (error as SlackApiError).data = { error: 'ratelimited' };
      mockWebClient.users.setPhoto.mockRejectedValue(error);

      await expect(webService.setProfilePhoto(Buffer.from('png-bytes'))).rejects.toThrow('upload failed');
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('getAllUsers/getAllChannels', () => {
    it('returns users and channels', async () => {
      mockWebClient.users.list.mockResolvedValue({ ok: true, members: [{ id: 'U1' }] });
      mockWebClient.conversations.list.mockResolvedValue({ ok: true, channels: [{ id: 'C1' }] });

      await expect(webService.getAllUsers()).resolves.toEqual({ ok: true, members: [{ id: 'U1' }] });
      await expect(webService.getAllChannels()).resolves.toEqual({ ok: true, channels: [{ id: 'C1' }] });
    });
  });

  describe('uploadFile', () => {
    it('uploads file', async () => {
      mockWebClient.files.upload.mockResolvedValue({ ok: true });

      webService.uploadFile('C1', 'content', 'title', 'U1');
      await Promise.resolve();

      expect(mockWebClient.files.upload).toHaveBeenCalledWith(
        expect.objectContaining({ channels: 'C1', content: 'content', title: 'title', filetype: 'auto' }),
      );
    });

    it('falls back with not_in_channel message', async () => {
      const error = new Error('upload fail');
      (error as SlackApiError).data = { error: 'not_in_channel' };
      mockWebClient.files.upload.mockRejectedValue(error);
      mockWebClient.chat.postEphemeral.mockResolvedValue({ ok: true });

      webService.uploadFile('C1', 'content', 'title', 'U1');
      await Promise.resolve();
      await Promise.resolve();

      expect(mockWebClient.chat.postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C1', user: 'U1', text: expect.stringContaining("haven't been added") }),
      );
    });

    it('logs if fallback postEphemeral also fails', async () => {
      const loggerSpy = vi.spyOn(webService.logger, 'error');
      const error = new Error('upload fail');
      (error as SlackApiError).data = { error: 'not_in_channel' };
      mockWebClient.files.upload.mockRejectedValue(error);
      mockWebClient.chat.postEphemeral.mockRejectedValue(new Error('fallback fail'));

      webService.uploadFile('C1', 'content', 'title', 'U1');
      await Promise.resolve();
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
