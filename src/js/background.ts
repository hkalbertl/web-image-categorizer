import browser from 'webextension-polyfill';
import WIC from './common';
import FILELU from './filelu';
import { WICConfig, WICImageData } from './models';

(function () {
  // Save a copy of the config to be used for determinating sidebar mode
  let preloadedConfig: WICConfig;
  WIC.loadConfig().then(config => {
    // Background script cannot use `await` directly, using `Promise.then` to load config
    preloadedConfig = config;
  });

  // Register message listener
  browser.runtime.onMessage.addListener(async (message: any) => {
    if ('reload-config' === message.action) {
      // Reload config when options saved at option page
      preloadedConfig = await WIC.loadConfig();
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
  // ** Event handler must not be `async` if `sidebarAction.open()` is used **
  browser.contextMenus.onClicked.addListener((info, tab) => {
    // Check menu ID
    if ('wic-save-image' === info.menuItemId && info.srcUrl) {
      // Check provider defined
      if (!preloadedConfig.provider) {
        // Open options page
        browser.runtime.openOptionsPage();
      } else {
        // Open sidebar, if enabled
        if (0 !== preloadedConfig.sidebarMode) {
          console.debug('Opening sidebar...');
          browser.sidebarAction.open().then(() => {
            // Add a small delay to allow sidebar to load
            WIC.sleep(500).then(() => {
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
    if (!config.provider) {
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

    if (!useSideBar && 4 <= notifyLevel) {
      browser.notifications.create(notifyId, {
        ...notifyBase,
        message: 'Processing image...'
      });
    }

    // Start process image
    try {
      // Download image
      const imageData = await downloadImageByUrl(imageUrl, tabUrl);
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
      console.error('Failed to download image...', ex);
      if (2 <= notifyLevel) {
        let message: string;
        if (ex instanceof Error) {
          message = ex.message;
        } else if ('string' === typeof ex) {
          message = ex;
        } else {
          message = 'Unknown download error...';
        }
        await browser.notifications.clear(notifyId);
        await browser.notifications.create(notifyId, {
          ...notifyBase,
          message: message
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
  function downloadImageByUrl(imageUrl: string, referrer: string): Promise<WICImageData> {
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
        const objectUrl = URL.createObjectURL(blob);
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
})();
