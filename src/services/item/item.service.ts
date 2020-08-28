import { StorePersistenceService } from '../store/store.persistence.service';
import { WebService } from '../web/web.service';
import { SuppressorService } from '../../shared/services/suppressor.service';

export class ItemService {
  storePersistenceService = StorePersistenceService.getInstance();
  webService = WebService.getInstance();
  suppressorService = new SuppressorService();

  items = {
    id: 3,
    interaction: (userId: string, teamId: string) => this.suppressorService.removeSuppression(userId, teamId),
  };
}
