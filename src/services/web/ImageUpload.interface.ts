import { WebAPICallResult } from '@slack/web-api';

export interface ImageUpload extends WebAPICallResult {
  ok: boolean;
  files: ImageUploadFile[];
}

export interface ImageUploadFile {
  ok: boolean;
  file: any;
  comments: string[];
  response_metadata: any;
}
