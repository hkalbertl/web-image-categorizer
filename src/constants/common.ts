import i18n from '@/i18n';
import { WICConfig, WICImageFormat } from "@/types/common";

/**
 * The default WIC config.
 */
export const DEFAULT_CONFIG = {
  sidebarMode: 0,
  notificationLevel: 4,
  imageFormat: 'image/jpeg'
} as WICConfig;

/**
 * Supported image types.
 */
export const SUPPORT_IMAGE_TYPES = [
  { mime: 'image/jpeg' as WICImageFormat, extName: '.jpg', saveAs: i18n.t("saveAsJpg"), selectText: i18n.t("imageJpg") },
  { mime: 'image/png' as WICImageFormat, extName: '.png', saveAs: i18n.t("saveAsPng"), selectText: i18n.t("imagePng") },
  { mime: 'image/webp' as WICImageFormat, extName: '.webp', saveAs: i18n.t("saveAsWebp"), selectText: i18n.t("imageWebp") }
];

export const MIME_TYPE_BINARY = 'application/octet-stream';

export const ENCRYPTION_EXT_NAME = '.enc';

