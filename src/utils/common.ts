import dayjs from 'dayjs';
import mime from 'mime';
import { isMatch } from 'matcher';
import { WICConfig, WICTemplate, WICMatchResult } from '../types/models'
import { DEFAULT_CONFIG } from '@/constants/common';
import i18n from '@/i18n';

/**
 * The date/time format for `now`.
 */
const NOW_FORMAT = 'YYYYMMDDHHmmss';

/**
 * The date format for `today`.
 */
const TODAY_FORMAT = 'YYYYMMDD';


/**
 * Get the saved config, default config will be used when not found.
 * @returns The config object.
 */
export const loadConfig = async (): Promise<WICConfig> => {
  // Load save config, if any
  let config: WICConfig;

  const saved = await browser.storage.sync.get();
  if (saved && 'object' === typeof saved) {
    // Merge saved config to default config
    config = { ...DEFAULT_CONFIG, ...saved } as WICConfig;
  } else {
    // Just use the default config
    config = { ...DEFAULT_CONFIG };
  }
  return config;
};

/**
   * Check client browser setting and apply dark theme when needed.
   */
export const configBsTheme = () => {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
  }
};

/**
 * Generate readable size based on specified blob size.
 * @param value The numeric blob size.
 * @returns The readable size, such as "123.4 KB" / "4.6 MB".
 */
export const toDisplaySize = (value: number): string => {
  if (value && !isNaN(value)) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(1)} ${units[i]}`;
  }
  return 'N/A';
};

/**
 * Check the specified URL is matched to the pattern.
 * @param targetUrl Target URL, such as https://www.example.com/posts/123456
 * @param pattern The matching pattern, such as https://www.example.com/posts/*
 * @returns Return true if the URL matched to pattern.
 */
export const isUrlMatch = (targetUrl: string, pattern?: string): boolean => {
  if (pattern) {
    return isMatch(targetUrl, pattern);
  }
  return false;
};

/**
 * The file extension name by specified mime type.
 * @param mimeType Target mime type, such as `image/jpeg`.
 * @returns The file extension name, such as `jpg`.
 */
export const getExtName = (mimeType?: string) => {
  // Get file extension, and force to use `jpg` instead of `jpeg` from mime library :)
  return !mimeType || 'image/jpeg' === mimeType ? 'jpg' : mime.getExtension(mimeType);
};

/**
 * Match referrer with templates and generate destination directory and file name.
 * @param templates WIC naming templates.
 * @param referrer The URL contain target image.
 * @param imageFormat The content type of image, such as `image/jpeg`.
 * @returns The generated directory and file name.
 */
export const matchTemplate = (templates: WICTemplate[] | null, referrer: string, pageTitle: string, imageFormat?: string) => {
  // Define parameter values
  const now = dayjs(), refUrl = new URL(referrer);
  const extName = getExtName(imageFormat);

  // Define the replace function
  const replaceFunc = (input: string) => {
    let edited = input;
    const patterns = extractCurlyBracePatterns(input);
    if (patterns) {
      patterns.forEach(token => {
        if ('{host}' === token) {
          // Substitute with URL host, such as `www.example.com`
          edited = edited.replace(token, refUrl.host);
        } else if ('{title}' === token) {
          // Substitute with web page title
          edited = edited.replace(token, pageTitle);
        } else if ('{now}' === token) {
          // Substitute with current date/time with default format
          edited = edited.replace(token, now.format(NOW_FORMAT));
        } else if ('{today}' === token) {
          // Substitute with current date with default format
          edited = edited.replace(token, now.format(TODAY_FORMAT));
        } else if (0 === token.indexOf('{now-')) {
          // Substitute with current date/time with custom format
          const format = token.substring(5, token.length - 1);
          edited = edited.replace(token, now.format(format));
        } else if (0 === token.indexOf('{path-')) {
          // Substitute with URL path data
          let replacement = '';
          const rawPathNum = token.substring(6, token.length - 1);
          if (1 < refUrl.pathname.length) {
            const pathNum = parseInt(rawPathNum);
            if (!isNaN(pathNum)) {
              // The pathname is something like: /this/is/path/name/image.jpg
              const segments = refUrl.pathname.split('/');
              // Make sure the path number within segments
              if (0 < pathNum && pathNum < segments.length) {
                // Path segment found
                replacement = segments[pathNum];
              } else {
                // Segment not found
                throw `Invalid path# or out of boundary: ${pathNum}`;
              }
            } else {
              // Path name too short or invalid path number
              throw `Invalid path#: ${rawPathNum}`;
            }
          } else {
            // Path name too short or invalid path number
            throw `Too short pathname`;
          }
          edited = edited.replace(token, replacement);
        } else if (0 === token.indexOf('{query-')) {
          // Substitute with URL query data
          let replacement = '';
          const queryKey = token.substring(7, token.length - 1),
            queryValue = refUrl.searchParams.get(queryKey);
          if ('string' === typeof queryValue && 0 < queryValue.length) {
            // Key found
            replacement = queryValue;
          } else {
            // Key is not found
            throw `Query string parameter is not found: ${queryKey}`;
          }
          edited = edited.replace(token, replacement);
        } else {
          // Unknown template parameter
          throw `Unsupported parameter: ${token}`;
        }
      });
    }
    return edited;
  };

  // Define result object and apply template when matched
  const result = new WICMatchResult();
  if (templates && Array.isArray(templates)) {
    for (const template of templates) {
      if (isUrlMatch(referrer, template.url)) {
        console.debug('URL matched: ' + template.url);
        if (template.directory) {
          result.directory = replaceFunc(template.directory);
        }
        if (template.fileName) {
          result.fileName = replaceFunc(template.fileName);
        }
        result.extension = `.${extName}`;
        result.useEncryption = template.encryption;
        result.isMatched = true;
        break;
      }
    }
  }
  // Apply defaults
  if (!result.directory) {
    result.directory = `/WebImageCategorizer/${refUrl.host}`;
  }
  if (!result.fileName) {
    result.fileName = now.format(NOW_FORMAT);
    result.extension = `.${extName}`;
  }
  return result;
};

/**
 * Extract all curly brace patterns in specified text.
 * @param input The input text.
 * @returns Return an array of curly brace patterns, or null if the input text is not valid.
 */
export const extractCurlyBracePatterns = (input: string): string[] | null => {
  if ('string' === typeof input) {
    if (hasMatchedCurlyBraces(input)) {
      // Regular expression to match content inside braces, including the braces
      const regex = /\{[^{}]+\}/g;
      return input.match(regex) || []; // Return matches or an empty array if no matches
    }
  }
  return null;
};


/**
 * Check if the input string has matched number of curly braces.
 * @param input The input text.
 * @returns Return true when curly braces matched.
 */
export const hasMatchedCurlyBraces = (input: string): boolean => {
  // Regular expression to check for nested curly braces
  const nestedBracesRegex = /\{[^{}]*\{[^{}]*\}[^{}]*\}/;
  // Regular expression to check for balanced curly braces with at least one character between them
  const balancedBracesWithCharRegex = /^(?:[^{}]*\{[^{}]+\})*[^{}]*$/;
  // Test input text
  return !nestedBracesRegex.test(input) && balancedBracesWithCharRegex.test(input);
};

/**
 * Check if the specified input text is a valid WIC parameter. Such as {host} and {now-YYYY}.
 * @param {string} input Input text to be checked.
 * @returns {boolean} Return true if the text is valid.
 */
export const isValidWicParams = (input: string): boolean => {
  // Extract the content within braces
  const content = input.substring(1, input.length - 1);
  // Check input with exact matched
  if (['now', 'today', 'host', 'title'].some(item => content === item)) {
    return true;
  }
  // Check input with prefixes
  if (['now-', 'query-'].some(item => 0 === content.indexOf(item) && content.length > item.length)) {
    // Assume the format / query string parameter is correct
    return true;
  }
  // Check input with path- prefixes
  if (0 === content.indexOf('path-') && 5 < content.length) {
    // Make sure the path number is numeric
    const pathNum = parseInt(content.substring(5));
    if (!isNaN(pathNum) && 0 < pathNum) {
      // It is numeric
      return true;
    }
  }
  return false;
};


/**
 * Check if the specified input text in valid for file name.
 * @param input Input text to be checked.
 * @returns Return true if the text is valid.
 */
export const isValidForFileName = (input: string): boolean => {
  if (input && 'string' === typeof input) {
    const regex = new RegExp(`^[^<>:"/\\|?*\x00-\x1F]*$`);
    return regex.test(input);
  }
  return false;
};

export const validateTemplateInput = (input: string, isDirectory: boolean): string | null => {
  let itemError: string | null = null;
  // Check for directory path start character
  if (isDirectory && '/' !== input.charAt(0)) {
    itemError = i18n.t("directoryStartWithSlash");
  }
  if (!itemError) {
    // Check for WIC parameters
    const params = extractCurlyBracePatterns(input);
    if (!Array.isArray(params)) {
      // Not well-formed pattern
      itemError = i18n.t("templateNotWellFormed");
    } else {
      // Make sure each parameter is valid
      for (const item of params) {
        if (!isValidWicParams(item)) {
          itemError = i18n.t("unsupportedParameter") + item;
          break;
        } else if (!isValidForFileName(item)) {
          itemError = i18n.t("invalidCharacterInParameter") + item;
          break;
        }
      }
    }
  }
  // Final check on restricted charachers
  if (!itemError) {
    if (isDirectory && 1 < input.length) {
      // Check for invaid character(s)
      const segments = input.substring(1).split('/');
      if (segments && segments.length) {
        for (const segment of segments) {
          if (!isValidForFileName(segment)) {
            itemError = `Invalid character(s) found in directory path: ${segment}`;
            break;
          }
        }
      }
    } else if (!isDirectory) {
      // Check for invaid character(s)
      if (!isValidForFileName(input)) {
        itemError = `Invalid character(s) found.`;
      }
    }
  }
  return itemError;
};

/**
 * Convert blob to data URL.
 * @param blob
 * @returns The data URL.
 */
export const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};


/**
 * Sleep for a while.
 * @param time Number of time in ms.
 */
export const sleep = async (time: number): Promise<unknown> => {
  return new Promise(resolve => setTimeout(resolve, time));
};

/**
 * Extract error message from catch block.
 * @param ex The error oject or message.
 * @returns The error message.
 */
export const getErrorMessage = (ex: unknown): string => {
  if (ex instanceof Error) {
    return ex.message;
  } else if ('string' === typeof ex) {
    return ex;
  }
  return `${ex}`;
};


/**
 * Open side panel (or sidebar for Firefox) to allow user for editing image name / path before saving.
 * @param windowId
 * @returns
 */
export const openSidebar = async (windowId: number) => {
  return new Promise<void>((resolve, reject) => {
    let action: Promise<void> | null = null;
    if (browser.sidePanel) {
      // Chrome based
      action = browser.sidePanel.open({ windowId });
    } else {
      // Firefox, dirty trick
      const firefoxSidebar = (browser as any).sidebarAction;
      if (firefoxSidebar && 'function' === typeof firefoxSidebar.open) {
        action = firefoxSidebar.open();
      }
    }
    // Check the `open` promise defined
    if (action) {
      action.catch(err => {
        console.error('Failed to open sidebar...', err);
      }).finally(() => resolve());
    } else {
      console.warn('Side panel and sidebar are not found...');
      resolve();
    }
  });
};

export const arrayBufferToDataUrl = async (buffer: ArrayBuffer, mimeType: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: mimeType });
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string); // full data URL
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const dataUrlToArrayBuffer = (dataUrl: string): ArrayBuffer => {
  const base64 = dataUrl.split(",")[1]; // strip prefix
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const encodeImage = async (imageBlob: Blob, imageFormat: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx!.drawImage(img, 0, 0);

      // Convert to PNG Blob
      canvas.toBlob((outputBlob) => {
        if (outputBlob) {
          resolve(outputBlob);
        } else {
          reject(new Error(`Failed to encode image: ${imageFormat}`));
        }
      }, imageFormat);
    };

    img.onerror = reject;

    // Create a data URL for the image
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageBlob);
  });
}
