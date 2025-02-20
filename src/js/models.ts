
export class WICConfig {
  provider?: WICProvider;
  wcipherPassword: string = '';
  templates: WICTemplate[] | null = null;
  sidebarMode: number = 0;
  notificationLevel: number = 4;
  imageFormat: string = 'image/jpeg';
}

export class WICProvider {
  apiKey?: string;
  type!: string;
}

export class WICTemplate {
  url?: string;
  directory?: string;
  fileName?: string;
  encryption: boolean = false;
}

export class WICMatchResult {
  isMatched = false;
  directory: string = '';
  fileName: string = '';
  useEncryption: boolean = false;
}

export class WICImageData {
  mode: string = 'fetch';
  blobArray?: ArrayBuffer;
  blobType: string | null = null;
  dimension: string | null = null;
  fileName: string | null = null;
}
