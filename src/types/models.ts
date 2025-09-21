
export interface WICConfig {
  provider?: WICProvider;
  wcipherPassword?: string;
  templates?: WICTemplate[];
  sidebarMode: number;
  notificationLevel: number;
  imageFormat: WICImageFormat;
}

export interface WICProvider {
  type: WICProviderType;
  apiKey?: string;
  accessId?: string;
  secretKey?: string;
}

export interface WICTemplate {
  url?: string;
  directory?: string;
  fileName?: string;
  encryption: boolean;
}

export class WICMatchResult {
  isMatched = false;
  directory: string = '';
  fileName: string = '';
  extension: string = '';
  useEncryption: boolean = false;
}

export interface WICImageData {
  mode: string;
  blobArray?: ArrayBuffer;
  blobType?: string;
  dimension?: string;
  fileName?: string;
}

export type WICProviderType = 'FileLu' | 'S3';

export type WICImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export type MessageModalMode = 'progress' | 'success' | 'failed';
