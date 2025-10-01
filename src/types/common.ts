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
  hostName?: string;
  region?: string;
}

export interface BaseEntry {
  directory?: string;
  fileName?: string;
  description?: string;
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

export type WICProviderType = 'FileLu' | 'FileLuS5' | 'AwsS3';

export enum WICTemplateField {
  Directory,
  FileName,
  Description
}

export type WICImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export type MessageModalMode = 'hidden' | 'progress' | 'success' | 'failed';
