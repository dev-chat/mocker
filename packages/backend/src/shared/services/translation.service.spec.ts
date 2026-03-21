import Axios from 'axios';
import { TranslationService } from './translation.service';

jest.mock('axios');

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TranslationService();
  });

  it('translates using spanish for roll >= 0.25', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    (Axios.post as jest.Mock).mockResolvedValue({
      data: { data: { translations: [{ translatedText: 'hola' }] } },
    });

    const out = await service.translate('hello');

    expect(out).toBe('hola');
    expect(Axios.post).toHaveBeenCalledWith(
      expect.stringContaining('translation.googleapis.com/language/translate/v2?key='),
      expect.objectContaining({ q: 'hello', source: 'en', target: 'es', format: 'text' }),
    );
  });

  it('selects russian for roll in [0.23, 0.25)', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.24);
    (Axios.post as jest.Mock).mockResolvedValue({ data: { data: { translations: [{ translatedText: 'privet' }] } } });

    await service.translate('hello');

    expect((Axios.post as jest.Mock).mock.calls[0][1].target).toBe('ru');
  });

  it('selects french for roll in [0.21, 0.23)', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.22);
    (Axios.post as jest.Mock).mockResolvedValue({ data: { data: { translations: [{ translatedText: 'salut' }] } } });

    await service.translate('hello');

    expect((Axios.post as jest.Mock).mock.calls[0][1].target).toBe('fr');
  });

  it('selects japanese for roll in [0.19, 0.21)', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.2);
    (Axios.post as jest.Mock).mockResolvedValue({
      data: { data: { translations: [{ translatedText: 'konnichiwa' }] } },
    });

    await service.translate('hello');

    expect((Axios.post as jest.Mock).mock.calls[0][1].target).toBe('ja');
  });

  it('selects german for roll < 0.19', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    (Axios.post as jest.Mock).mockResolvedValue({ data: { data: { translations: [{ translatedText: 'hallo' }] } } });

    await service.translate('hello');

    expect((Axios.post as jest.Mock).mock.calls[0][1].target).toBe('de');
  });

  it('returns original text when translation payload is missing', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    (Axios.post as jest.Mock).mockResolvedValue({ data: {} });

    const out = await service.translate('hello');

    expect(out).toBe('hello');
  });
});
