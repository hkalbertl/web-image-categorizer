import browser from 'webextension-polyfill';
import dayjs from 'dayjs';
import mime from 'mime';
import { isMatch } from 'matcher';
import { WICConfig, WICTemplate, WICMatchResult } from './models'

/**
 * The object that hold all properties / functions of UNV Image Saver.
 */
const WIC = {
  /**
   * Default config.
   */
  DEFAULT_CONFIG: new WICConfig(),
  /**
   * The date/time format for `now`.
   */
  NOW_FORMAT: 'YYYYMMDDHHmmss',
  /**
   * The date format for `today`.
   */
  TODAY_FORMAT: 'YYYYMMDD',
  /**
   * Check client browser setting and apply dark theme when needed.
   */
  configBsTheme: function () {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
  },
  /**
   * Show an alert with specified success message.
   * @param msg The success message.
   */
  showSuccessAlert: function (msg: string) {
    const alertElem = document.getElementById('common-success')!,
      alertSpan = alertElem.querySelector('span')!;
    alertElem.classList.remove('d-none');
    alertSpan.innerText = msg;
  },
  /**
   * Show an alert with specified error message.
   * @param msg The error message.
   */
  showErrorAlert: function (msg: string) {
    const alertElem = document.getElementById('common-error')!,
      alertSpan = alertElem.querySelector('span')!;
    alertElem.classList.remove('d-none');
    alertSpan.innerText = msg;
  },
  /**
   * Set the button with loading state or not.
   * @param targetButton The button element.
   * @param isLoading Is loading or not.
   */
  setButtonLoading: function (targetButton: HTMLButtonElement, isLoading: boolean) {
    const buttonIcon = targetButton.querySelector('i.fa-solid')!,
      buttonSpinner = targetButton.querySelector('span.spinner-border')!;
    if (isLoading) {
      targetButton.disabled = true;
      buttonIcon.classList.add('d-none');
      buttonSpinner.classList.remove('d-none');

      document.getElementById('common-error')!.classList.add('d-none');
    } else {
      targetButton.disabled = false;
      buttonIcon.classList.remove('d-none');
      buttonSpinner.classList.add('d-none');
    }
  },
  /**
   * Show or hide the list of elements.
   * @param targets Target element(s) or element IDs.
   * @param isShow True to show or false to hide.
   */
  setElementsVisibility: function (targets: string | HTMLElement | any[], isShow: boolean = true) {
    let elements: HTMLElement[] = [];
    if (Array.isArray(targets)) {
      // For array targets
      targets.forEach(item => {
        if (item instanceof HTMLElement) {
          elements.push(item);
        } else if ('string' === typeof item) {
          const target = document.getElementById(item);
          if (target) {
            elements.push(target);
          }
        }
      });
    } else if (targets instanceof HTMLElement) {
      elements.push(targets);
    } else if ('string' === typeof targets) {
      const target = document.getElementById(targets);
      if (target) {
        elements.push(target);
      }
    }
    // Set visibility
    debugger;
    elements.forEach(element => {
      if (isShow) {
        element.classList.remove('d-none');
      } else {
        element.classList.add('d-none');
      }
    });
  },
  /**
   * Get the saved config, default config will be used when not found.
   * @returns {Promise<WICConfig>} The config object.
   */
  loadConfig: async function (): Promise<WICConfig> {
    // Load save config, if any
    let config: WICConfig;

    const saved = await browser.storage.sync.get();
    if (saved && 'object' === typeof saved) {
      // Merge saved config to default config
      config = { ...WIC.DEFAULT_CONFIG, ...saved } as WICConfig;
    } else {
      // Just use the default config
      config = { ...WIC.DEFAULT_CONFIG };
    }
    return config;
  },
  /**
   * Generate readable size based on specified blob size.
   * @param {number} value The numeric blob size.
   * @returns {string} The readable size, such as "123.4 KB" / "4.6 MB".
   */
  toDisplaySize: function (value: number): string {
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
  },
  /**
   * Copy element value.
   * @param fromElemId From element ID.
   * @param toElemId To element ID.
   */
  copyValue: function (fromElemId: string, toElemId: string) {
    const fromElem = document.getElementById(fromElemId) as HTMLInputElement;
    const toElem = document.getElementById(toElemId) as HTMLInputElement;
    if (fromElem && toElem) {
      toElem.value = fromElem.value;
    }
  },
  /**
   * Check the specified URL is matched to the pattern.
   * @param targetUrl Target URL, such as https://www.example.com/posts/123456
   * @param pattern The matching pattern, such as https://www.example.com/posts/*
   * @returns Return true if the URL matched to pattern.
   */
  isUrlMatch: function (targetUrl: string, pattern?: string): boolean {
    if (pattern) {
      return isMatch(targetUrl, pattern);
    }
    return false;
  },
  /**
   * Match referrer with templates and generate destination directory and file name.
   * @param templates WIC naming templates.
   * @param referrer The URL contain target image.
   * @param imageFormat The content type of image, such as `image/jpeg`.
   * @returns The generated directory and file name.
   */
  matchTemplate: function (templates: WICTemplate[] | null, referrer: string, pageTitle: string, imageFormat: string | null) {
    // Define parameter values
    const now = dayjs(), refUrl = new URL(referrer);

    // Get file extension, and force to use `jpg` instead of `jpeg` from mime library :)
    const extName = !imageFormat || 'image/jpeg' === imageFormat ? 'jpg' : mime.getExtension(imageFormat);

    // Define the replace function
    const replaceFunc = (input: string) => {
      let edited = input;
      const patterns = WIC.extractCurlyBracePatterns(input);
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
            edited = edited.replace(token, now.format(WIC.NOW_FORMAT));
          } else if ('{today}' === token) {
            // Substitute with current date with default format
            edited = edited.replace(token, now.format(WIC.TODAY_FORMAT));
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
        if (WIC.isUrlMatch(referrer, template.url)) {
          console.debug('URL matched: ' + template.url);
          if (template.directory) {
            result.directory = replaceFunc(template.directory);
          }
          if (template.fileName) {
            result.fileName = `${replaceFunc(template.fileName)}.${extName}`;
          }
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
      result.fileName = `${now.format(WIC.NOW_FORMAT)}.${extName}`;
    }
    return result;
  },
  /**
   * Extract all curly brace patterns in specified text.
   * @param input
   * @returns Return an array of curly brace patterns, or null if the input text is not valid.
   */
  extractCurlyBracePatterns: function (input: string): string[] | null {
    if ('string' === typeof input) {
      if (WIC.hasMatchedCurlyBraces(input)) {
        // Regular expression to match content inside braces, including the braces
        const regex = /\{[^{}]+\}/g;
        return input.match(regex) || []; // Return matches or an empty array if no matches
      }
    }
    return null;
  },
  /**
   * Check if the input string has matched number of curly braces.
   * @param input The input text.
   * @returns Return true when curly braces matched.
   */
  hasMatchedCurlyBraces: function (input: string): boolean {
    // Regular expression to check for nested curly braces
    const nestedBracesRegex = /\{[^{}]*\{[^{}]*\}[^{}]*\}/;
    // Regular expression to check for balanced curly braces with at least one character between them
    const balancedBracesWithCharRegex = /^(?:[^{}]*\{[^{}]+\})*[^{}]*$/;
    // Test input text
    return !nestedBracesRegex.test(input) && balancedBracesWithCharRegex.test(input);
  },
  /**
   * Check if the specified input text is a valid WIC parameter. Such as {host} and {now-YYYY}.
   * @param {string} input Input text to be checked.
   * @returns {boolean} Return true if the text is valid.
   */
  isValidWicParams: function (input: string): boolean {
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
  },
  /**
   * Check if the specified input text in valid for file name.
   * @param input Input text to be checked.
   * @returns Return true if the text is valid.
   */
  isValidForFileName: function (input: string): boolean {
    if (input && 'string' === typeof input) {
      const regex = new RegExp(`^[^<>:"/\\|?*\x00-\x1F]*$`);
      return regex.test(input);
    }
    return false;
  },
  /**
   * Sleep for a while.
   * @param time Number of time in ms.
   */
  sleep: async function (time: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, time));
  },
  /**
   * Extract error message from catch block.
   * @param ex The error oject or message.
   * @returns The error message.
   */
  getErrorMessage: function (ex: unknown): string {
    if (ex instanceof Error) {
      return ex.message;
    } else if ('string' === typeof ex) {
      return ex;
    }
    return `${ex}`;
  },
  /**
   * Get the element by specified ID in specified type.
   * @param id Input ID.
   * @returns The element.
   */
  getElement: function <T>(id: string): T {
    return document.getElementById(id) as T;
  },
  /**
   * Trigger specified event on target element.
   * @param element Element or element ID.
   * @param eventType Event type, such as `click` and `change`.
   */
  triggerEvent: function (element: string | HTMLElement, eventType: string) {
    let targetElement: HTMLElement | undefined;
    if ('string' === typeof element) {
      const foundElement = document.getElementById(element);
      if (foundElement) {
        targetElement = foundElement;
      }
    } else {
      targetElement = element;
    }
    if (targetElement) {
      targetElement.dispatchEvent(new Event(eventType));
    } else {
      console.warn('Failed to trigger event, element not found.');
    }
  }
};

export default WIC;
