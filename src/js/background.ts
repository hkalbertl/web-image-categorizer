import browser from 'webextension-polyfill';
import WIC from './common';
import { openSidebar } from './common-ui';
import FILELU from './filelu';
import { WICConfig, WICImageData } from './models';

(function () {
  // Global variables
  const openSidebarDelay = 200;

  // Background script cannot use `await` directly, using `Promise.then` to load config
  WIC.loadConfig().then(config => {
    // Save a copy of the config to localStorage to be used for determinating sidebar mode
    // As localStorage is not async, it is suitable here for non-async calls
    localStorage.setItem('config', JSON.stringify(config));
  });

  // Register message listener
  browser.runtime.onMessage.addListener(async (message: any) => {
    if ('reload-config' === message.action) {
      // Reload config when options updated
      const config = await WIC.loadConfig();
      localStorage.setItem('config', JSON.stringify(config));
      console.debug('Background config reloaded!');
    }
  });

  // Create a context menu entry for images
  browser.runtime.onInstalled.addListener(() => {
    // Add the standard option
    browser.contextMenus.create({
      id: 'wic-save-image',
      title: 'WIC Save Image...',
      contexts: ['image']
    });
  });

  // Handle the click event on the context menu
  // ** Event handler must not be `async` if sidebar is used **
  browser.contextMenus.onClicked.addListener((info, tab) => {
    // Check menu ID
    if ('wic-save-image' === info.menuItemId && info.srcUrl) {
      // Load config from localStorage
      const rawConfig = localStorage.getItem('config');
      if (!rawConfig) {
        console.warn('No config in local storage...');
        return;
      }
      const config = JSON.parse(rawConfig) as WICConfig;

      // Check provider defined
      if (!config || !config.provider) {
        // Open options page
        browser.runtime.openOptionsPage();
      } else {
        // Open sidebar, if enabled
        if (0 !== config.sidebarMode) {
          console.debug('Opening sidebar...');
          openSidebar(tab!.windowId!).then(() => {
            // Add a small delay to allow sidebar to load
            WIC.sleep(openSidebarDelay).then(() => {
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

  /**
   * Handle image save context menu clicked.
   * @param imageUrl Source image URL.
   * @param tabUrl The tab page URL that contain the source image.
   * @param tabTitle The tab page title.
   */
  async function handleContextMenuSaveClicked(imageUrl: string, tabUrl: string, tabTitle: string) {
    // Load config
    const config = await WIC.loadConfig();
    if (!config.provider || !imageUrl) {
      return;
    }

    // Show loading notification
    const useSideBar = 0 !== config.sidebarMode;
    const notifyLevel = config.notificationLevel || WIC.DEFAULT_CONFIG.notificationLevel;
    const notifyId = `wic-${new Date().getTime()}`, notifyBase = {
      type: 'basic' as browser.Notifications.TemplateType,
      title: 'Web Image Categorizer',
      iconUrl: imageUrl
    };

    // Check the image URL format
    const isDataUrl = 0 === imageUrl.search(/^data\:image\//gi);
    if (!isDataUrl && -1 === imageUrl.search(/^https?\:\/\//gi)) {
      // Unsupported image URL detected
      const errorMsg = `Unsupported image format: ${imageUrl}`;
      if (useSideBar) {
        // Send the error message to sidebar
        WIC.sleep(openSidebarDelay).then(() => {
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
      const displaySize = WIC.toDisplaySize(imageBlob.size);
      // Generate directory / file name
      const nameData = WIC.matchTemplate(config.templates, tabUrl, tabTitle, imageData.blobType);

      if (useSideBar) {
        // Add a small delay
        await WIC.sleep(800);
        // Send data to sidebar
        browser.runtime.sendMessage({
          action: 'fill-image',
          referrer: tabUrl,
          blobArray: imageData.blobArray,
          blobType: imageData.blobType,
          dimension: imageData.dimension,
          displaySize: displaySize,
          srcFileName: imageData.fileName,
          directory: nameData.directory,
          fileName: nameData.fileName
        });
      } else {
        // Upload to storage provider
        if ('FileLu' === config.provider.type && config.provider.apiKey) {
          // Upload to FileLu, get target directory
          console.debug(`Saving image to ${nameData.directory}/${nameData.fileName}`);
          await FILELU.uploadFileToDirectory(config.provider.apiKey, nameData.directory, nameData.fileName, imageBlob);
        } else {
          // Unknown provider
          throw 'Unknown provider: ' + config.provider.type;
        }
        // Update notification
        let notifyMessage: string | null = null, msgLevel = 3;
        if (nameData.isMatched) {
          notifyMessage = `✓ Image saved to ${config.provider.type}!`;
        } else {
          notifyMessage = `⚠ No template matched and image saved to default path: ${nameData.directory}/${nameData.fileName}`;
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
      const errorMsg = WIC.getErrorMessage(ex) || 'Unknown download error...';
      console.error('Failed to download image...', ex);
      if (useSideBar) {
        // Show error after delay
        WIC.sleep(openSidebarDelay).then(() => {
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
  async function downloadImageByUrl(imageUrl: string, referrer: string): Promise<WICImageData> {
    return new Promise(async (resolve, reject) => {
      // Load config
      const config = await WIC.loadConfig();

      // Prepare return object
      const result = new WICImageData();

      // Download image by fetch
      const resp = await fetch(imageUrl, { referrer: referrer });
      if (resp.ok) {
        // Get content type
        const contentType = resp.headers.get('Content-Type');
        // Get the file name from the Content-Disposition header, if available
        const contentDisposition = resp.headers.get('Content-Disposition');
        if (contentDisposition && contentDisposition.includes('filename=')) {
          // File name found in its value, extract it
          const match = contentDisposition.match(/filename="?(.+?)"?$/);
          if (match) {
            result.fileName = match[1];
          }
        }

        // Convert the download data as data URL
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob); // Does not work on chrome :(
        result.blobArray = await blob.arrayBuffer();
        result.blobType = blob.type || contentType;

        // Load image and get dimension
        const img = new Image();
        img.onload = () => {
          // Get image dimension
          result.dimension = `${img.naturalWidth}x${img.naturalHeight}`;

          // Revoke the object URL to free memory
          URL.revokeObjectURL(objectUrl);

          // All done, return result
          resolve(result);
        };
        img.onerror = () => {
          // Error on loading image so ignore the dimension
          console.warn('Failed to identify image dimension.');

          // Revoke the object URL to free memory
          URL.revokeObjectURL(objectUrl);

          // Return result without dimension
          resolve(result);
        };
        img.src = objectUrl;
      } else {
        // Cannot download by fetch? Use image element instead
        result.mode = 'image';
        // Create new image and config load event
        const img = new Image();
        img.onload = () => {
          // Image download successfully, draw image to canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx!.drawImage(img, 0, 0);

          // Convert to download data to blob
          const imageFormat = config.imageFormat || WIC.DEFAULT_CONFIG.imageFormat;
          result.dimension = `${canvas.width}x${canvas.height}`;
          canvas.toBlob(async blob => {
            // Canvas converted to blob
            result.blobArray = await blob!.arrayBuffer();
            result.blobType = imageFormat;

            // All done, return result
            resolve(result);
          }, imageFormat);
        };
        img.onerror = () => {
          // Error on loading image?
          reject(new Error('Image failed to load.'));
        };
        img.crossOrigin = 'anonymous'; // Magic
        img.src = imageUrl;
      }
    });
  }

  /**
   * Parse image in dataURL format.
   * @param imageUrl Target image data.
   * @returns Parsed image with meta data.
   */
  async function parseDataUrl(imageUrl: string): Promise<WICImageData> {
    /*
    Sample data:
    https://gist.github.com/drtaka/b5b77281ee523d3f61a3bbbe8a4ce3ee
    https://gistpreview.github.io/?b5b77281ee523d3f61a3bbbe8a4ce3ee
    https://jsfiddle.net/Jan_Miksovsky/yy7Zs/
    */
    return new Promise(async (resolve, reject) => {
      // Prepare return object
      const result = new WICImageData();
      result.mode = 'image';

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
})();
