import { downloadImageByImageElement, arrayBufferToDataUrl, getErrorMessage } from "@/utils/common";

// Register the message listener
browser.runtime.onMessage.addListener(async (message) => {
  if ("offscreen-download-image" === message.action) {
    try {
      const result = await downloadImageByImageElement(message.imageUrl, message.imageFormat);
      const dataUrl = await arrayBufferToDataUrl(result.blobArray!, result.blobType!);
      browser.runtime.sendMessage({
        action: 'offscreen-image-completed',
        mode: result.mode,
        dimension: result.dimension,
        imageData: dataUrl,
        imageType: result.blobType,
      });
      console.info(`Image downloaded at offscreen page: ${message.imageUrl}`);
    } catch (ex) {
      console.error(`Failed to download image at offscreen page...`, ex);
      browser.runtime.sendMessage({
        action: 'offscreen-image-failed',
        error: getErrorMessage(ex),
      });
    }
  }
});
