import i18n from "../i18n";
import WCipher from "wcipher";
import { loadConfig, initApiClient, sleep, toDisplaySize, matchTemplate, getErrorMessage, openSidebar, arrayBufferToDataUrl, dataUrlToArrayBuffer, downloadImageByImageElement } from "@/utils/common";
import { DEFAULT_CONFIG, ENCRYPTION_EXT_NAME, MIME_TYPE_BINARY, SUPPORT_PROVIDER_TYPES } from '@/constants/common';
import { WICConfig, WICImageData } from "@/types/common";

export default defineBackground(() => {
  // Write a log message to indicate the service worker is starting
  console.trace(`${i18n.t("appShortName")}'s service worker is starting: ${browser.runtime.id}`);

  // Constants
  const OPEN_SIDEBAR_DELAY = 500;
  const CONTEXT_MENU_ACTION = "wic-save-image";

  // Global variables
  let appConfig: WICConfig;

  // Background script cannot use `await` directly, using `Promise.then` to load config
  const refreshConfig = () => {
    loadConfig().then(config => {
      // Save to global variable for fast access
      appConfig = config;
      if (config.provider) {
        console.info(`Configuration loaded: ${config.provider.type}`);
        // Ensure offscreen page for Chrome when sidebar is not in used
        if (!config.sidebarMode && browser.sidePanel) {
          ensureOffscreenDocument();
        }
      } else {
        console.trace(`No provider defined in configuration. Configure it in option page.`);
      }
    });
  };
  refreshConfig();

  // Listen for changes in storage
  browser.storage.onChanged.addListener((_, area) => {
    if ("sync" === area) {
      refreshConfig();
    }
  });

  // Create a context menu entry for images
  browser.runtime.onInstalled.addListener(() => recreateContextMenus());
  browser.runtime.onStartup.addListener(() => recreateContextMenus());

  // Handle the click event on the context menu
  // ** Event handler must not be `async` if sidebar is used **
  browser.contextMenus.onClicked.addListener((info, tab) => {
    // Check menu ID
    if (CONTEXT_MENU_ACTION === info.menuItemId && info.srcUrl) {
      // Check provider defined
      if (!appConfig || !appConfig.provider) {
        // Open options page
        browser.runtime.openOptionsPage();
      } else {
        // Open sidebar, if enabled
        if (0 !== appConfig.sidebarMode) {
          console.debug('Opening sidebar...');
          openSidebar(tab!.windowId!).then(() => {
            // Add a small delay to allow sidebar to load
            sleep(OPEN_SIDEBAR_DELAY).then(() => {
              // Set retrieving image
              browser.runtime.sendMessage({ action: 'prepare-image' });
            });
          }).catch(err => {
            // Failed to open sidebar??
            console.error('Failed to open sidebar...', err);
          });
        }
        // Handle save menu clicked
        handleContextMenuSaveClicked(info.srcUrl, tab?.url || '', tab?.title || '').catch(err => {
          console.error('Failed to handle save menu clicked...', err);
        });
      }
    } else {
      console.error(`Unknown context menu action: ${info.menuItemId}`);
    }
  });

  console.info(`${i18n.t("appShortName")}'s service worker is running!`);

  /**
   * Re-create the context menu for saving images.
   */
  const recreateContextMenus = () => {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: CONTEXT_MENU_ACTION,
        title: i18n.t("contextMenuSaveImage"),
        contexts: ["image"]
      });
    });
  };

  /**
   * Handle image save context menu clicked.
   * @param imageUrl Source image URL.
   * @param tabUrl The tab page URL that contain the source image.
   * @param tabTitle The tab page title.
   */
  const handleContextMenuSaveClicked = async (imageUrl: string, tabUrl: string, tabTitle: string) => {
    // Validate config
    if (!appConfig.provider || !imageUrl) {
      return;
    }

    // Show loading notification
    const useSideBar = 0 !== appConfig.sidebarMode;
    const notifyLevel = appConfig.notificationLevel || DEFAULT_CONFIG.notificationLevel;
    const notifyId = `wic-${new Date().getTime()}`, notifyBase = {
      type: 'basic' as Browser.notifications.TemplateType,
      title: i18n.t("appName"),
      iconUrl: imageUrl
    };

    // Check the image URL format
    const isDataUrl = 0 === imageUrl.search(/^data\:image\//gi);
    if (!isDataUrl && -1 === imageUrl.search(/^https?\:\/\//gi)) {
      // Unsupported image URL detected
      const errorMsg = `Unsupported image format: ${imageUrl}`;
      if (useSideBar) {
        // Send the error message to sidebar
        sleep(OPEN_SIDEBAR_DELAY).then(() => {
          // Show error after open delay
          browser.runtime.sendMessage({
            action: 'show-error',
            error: errorMsg
          });
        });
      } else if (2 <= notifyLevel) {
        // Show error notification
        browser.notifications.create(notifyId, {
          ...notifyBase,
          message: `⚠ ${errorMsg}`
        });
      }
      return;
    }

    // Show processing notification if enabled
    if (!useSideBar && 4 <= notifyLevel) {
      browser.notifications.create(notifyId, {
        ...notifyBase,
        message: 'Processing image...'
      });
    }

    // Start process image
    try {
      // Download image
      let imageData: WICImageData;
      if (isDataUrl) {
        // Parse dataURL
        imageData = await parseDataUrl(imageUrl);
      } else {
        // Download image
        imageData = await downloadImageByUrl(imageUrl, tabUrl);
      }
      const imageBlob = new Blob([imageData.blobArray!], { type: imageData.blobType! });
      const displaySize = toDisplaySize(imageBlob.size);
      // Generate directory / file name
      const nameData = matchTemplate(appConfig.templates || null, tabUrl, tabTitle, imageData.blobType);
      // Check sidebar mode
      if (useSideBar) {
        // Add a small delay
        await sleep(800);
        // Prepare image data
        // * FireFox: Use ArrayBuffer directly
        // * Chrome: Cannot pass ArrayBuffer, encode to DataUrl first
        let msgImageData: ArrayBuffer | string | undefined;
        if (browser.sidePanel) {
          // Chrome
          msgImageData = await arrayBufferToDataUrl(imageData.blobArray!, imageData.blobType!);
        } else {
          // FireFox
          msgImageData = imageData.blobArray;
        }
        // Send data to sidebar
        browser.runtime.sendMessage({
          action: 'fill-image',
          referrer: tabUrl,
          imageData: msgImageData,
          imageType: imageData.blobType,
          dimension: imageData.dimension,
          displaySize: displaySize,
          srcFileName: imageData.fileName,
          directory: nameData.directory,
          fileName: nameData.fileName,
          extension: nameData.extension,
          useEncryption: nameData.encryption,
        });
      } else {
        // Upload to storage provider
        const providerName = SUPPORT_PROVIDER_TYPES.find(pv => pv.type === appConfig.provider?.type)?.display || appConfig.provider.type;
        const api = initApiClient(appConfig.provider);
        if (!api) {
          // Unknown provider
          throw new Error(i18n.t("invalidProviderOptions") + providerName);
        }

        // Encrypt file, if required
        let uploadBlob = imageBlob;
        let fileName = `${nameData.fileName}${nameData.extension}`;
        if (appConfig.wcipherPassword && nameData.encryption) {
          // Use WCipher for encryption
          const imageBytes = await imageBlob.arrayBuffer();
          const encryptedBytes = await WCipher.encrypt(appConfig.wcipherPassword, new Uint8Array<ArrayBuffer>(imageBytes));
          uploadBlob = new Blob([encryptedBytes as Uint8Array<ArrayBuffer>], { type: MIME_TYPE_BINARY });
          // Append file extension
          fileName += ENCRYPTION_EXT_NAME;
        }

        // Upload file
        await api.uploadFile(nameData.directory!, fileName, uploadBlob);

        // Update notification
        let notifyMessage: string | null = null, msgLevel = 3;
        if (nameData.isMatched) {
          notifyMessage = `✓ Image saved to ${providerName}!`;
        } else {
          notifyMessage = `⚠ No template matched and image saved to default path: ${nameData.directory}/${fileName}`;
          msgLevel = 2;
        }
        if (msgLevel <= notifyLevel) {
          // Add size and dimension to message
          notifyMessage += `\nSize=${displaySize}`;
          if (imageData.dimension) {
            notifyMessage += `, Dim.=${imageData.dimension}`
          }
          await browser.notifications.clear(notifyId);
          await browser.notifications.create(notifyId, {
            ...notifyBase,
            message: notifyMessage
          });
        }
      }
    } catch (ex) {
      // Error occurred
      const errorMsg = getErrorMessage(ex) || 'Unknown download error...';
      console.error('Failed to download image...', ex);
      if (useSideBar) {
        // Show error after delay
        sleep(OPEN_SIDEBAR_DELAY).then(() => {
          browser.runtime.sendMessage({
            action: 'show-error',
            error: errorMsg
          });
        });
      } else if (2 <= notifyLevel) {
        await browser.notifications.clear(notifyId);
        await browser.notifications.create(notifyId, {
          ...notifyBase,
          message: errorMsg
        });
      }
    }
  }

  /**
   * Download specified image and send it to sidebar.
   * @param imageUrl URL to source image.
   * @param referrer URL that contain above image.
   * @returns Downloaded image with meta data.
   */
  const downloadImageByUrl = (imageUrl: string, referrer: string): Promise<WICImageData> => {
    return new Promise(async (resolve, reject) => {
      // Load config
      const config = await loadConfig();

      // Prepare return object
      let result: WICImageData = { mode: 'fetch' };

      // Download image by fetch
      const res = await fetch(imageUrl, { referrer: referrer });
      if (res.ok) {
        // Get content type
        const contentType = res.headers.get('Content-Type');
        // Get the file name from the Content-Disposition header, if available
        const contentDisposition = res.headers.get('Content-Disposition');
        if (contentDisposition && contentDisposition.includes('filename=')) {
          // File name found in its value, extract it
          const match = contentDisposition.match(/filename="?(.+?)"?$/);
          if (match) {
            result.fileName = match[1];
          }
        }

        // Convert the download data as data URL
        const blob = await res.blob();
        result.blobArray = await blob.arrayBuffer();
        result.blobType = blob.type || contentType || undefined;

        // Get image dimension
        if ('function' === typeof createImageBitmap) {
          // Should be supported by Chrome and Firefox
          const bitmap = await createImageBitmap(blob);
          result.dimension = `${bitmap.width}x${bitmap.height}`;
          bitmap.close();
        } else {
          // Just send the image without dimension
          console.trace('Function `createImageBitmap` is not available, skip dimension checking...');
        }
        resolve(result);
      } else if ('function' === typeof Image) {
        // Cannot download by fetch? Use image element instead
        // ** Does not work on Chrome **
        result = await downloadImageByImageElement(imageUrl, config.imageFormat);
        resolve(result);
      } else if (browser.sidePanel) {
        // Process the image by using offscreen page for Chrome
        // ** Used by Chrome only **
        result = await downloadImageByOffscreen(imageUrl, config.imageFormat);
        resolve(result);
      } else {
        // Cannot download image
        reject(new Error('Image failed to load.'));
      }
    });
  }

  /**
   * Parse image in dataURL format.
   * @param imageUrl Target image data.
   * @returns Parsed image with meta data.
   */
  const parseDataUrl = async (imageUrl: string): Promise<WICImageData> => {
    /*
    Sample data:
    https://gist.github.com/drtaka/b5b77281ee523d3f61a3bbbe8a4ce3ee
    https://gistpreview.github.io/?b5b77281ee523d3f61a3bbbe8a4ce3ee
    https://jsfiddle.net/Jan_Miksovsky/yy7Zs/
    */
    return new Promise(async (resolve, reject) => {
      // Prepare return object
      const result: WICImageData = { mode: 'image' };

      // Extract image data from dataURL
      const [header, base64] = imageUrl.split(',');
      result.blobType = header.match(/:(.*?);/)![1];

      // Parse image data
      const binaryString = atob(base64);
      const length = binaryString.length;
      const buffer = new ArrayBuffer(length);
      const uintArray = new Uint8Array(buffer);
      for (let z = 0; z < length; z++) {
        uintArray[z] = binaryString.charCodeAt(z);
      }
      result.blobArray = buffer;

      // Create new image and config load event
      const img = new Image();
      img.onload = () => {
        // Image downloaded, get dimension
        if (img.naturalWidth && img.naturalHeight) {
          result.dimension = `${img.naturalWidth}x${img.naturalHeight}`;
        }
        // All done, return result
        resolve(result);
      };
      img.onerror = () => {
        // Error on loading image?
        reject(new Error('Image failed to load.'));
      };
      img.src = imageUrl;
    });
  }

  const ensureOffscreenDocument = async () => {
    const contexts = await browser.offscreen.hasDocument();
    if (!contexts) {
      browser.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Need <img/> to load and measure image size'
      });
    }
  }

  /**
   * Download image at offscreen page, supported by Chrome only.
   * @param imageUrl
   * @param imageFormat
   * @returns
   */
  const downloadImageByOffscreen = async (imageUrl: string, imageFormat: string): Promise<WICImageData> => {
    await ensureOffscreenDocument();

    return new Promise((resolve, reject) => {
      const listener = (message: any) => {
        if ('offscreen-image-completed' === message.action) {
          // Image downloaded at offscreen
          browser.runtime.onMessage.removeListener(listener);
          // Convert data URL back to array buffer
          const blobArray = dataUrlToArrayBuffer(message.imageData);
          resolve({
            mode: 'image',
            blobArray,
            blobType: message.imageType,
            dimension: message.dimension,
          });
        } else if ('offscreen-image-failed' === message.action) {
          // Failed to download at offscreen
          browser.runtime.onMessage.removeListener(listener);
          reject(new Error(message.error));
        }
      };
      browser.runtime.onMessage.addListener(listener);

      browser.runtime.sendMessage({
        action: 'offscreen-download-image',
        imageUrl,
        imageFormat,
      });
    });
  }
});
