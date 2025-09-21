/**
 * The application configuration saved to browser.storage.sync.
 */
export interface WICConfig {
  provider?: WICProvider;
  wcipherPassword?: string;
  templates?: WICTemplate[];
  sidebarMode: number;
  notificationLevel: number;
  imageFormat: WICImageFormat;
}

/**
 * Storage provider configuration.
 */
export interface WICProvider {
  type: WICProviderType;
  apiKey?: string;
  accessId?: string;
  secretKey?: string;
}

export interface BaseEntry {
  directory?: string;
  fileName?: string;
  encryption: boolean;
}

export interface WICTemplate extends BaseEntry {
  url: string;
}

export interface WICMatchResult extends BaseEntry {
  isMatched: boolean;
  extension?: string;
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
