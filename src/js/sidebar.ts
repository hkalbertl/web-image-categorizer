import browser from 'webextension-polyfill';
import * as bootstrap from 'bootstrap';
import WIC from './common'
import { getElement, configBsTheme, setElementsVisibility, isElementVisible, setButtonLoading, showErrorAlert } from './common-ui';
import FILELU from './filelu';
import WCipher from 'wcipher';

document.addEventListener('DOMContentLoaded', async () => {
  // Define global variables
  let originalImageBlob: Blob | null = null, activeImageBlob: Blob | null = null;
  let originalFileExt: string | null = null, activeFileExt: string | null = null;
  const editForm = getElement<HTMLFormElement>('edit-form');
  const editDirectory = getElement<HTMLInputElement>('cloud-directory');
  const editFileName = getElement<HTMLInputElement>('cloud-file-name');
  const editFileExtDisplay = getElement<HTMLSpanElement>('cloud-file-ext-display');
  const editFileDimension = getElement<HTMLInputElement>('cloud-file-dimension');
  const editFileSize = getElement<HTMLInputElement>('cloud-file-size');
  const editFileEncryption = getElement<HTMLInputElement>('cloud-file-encryption');
  const imagePreview = getElement<HTMLImageElement>('cloud-image');
  const dirPickerModal = new bootstrap.Modal('#dir-picker-modal');
  let isProcessing = false;

  // Config dark theme
  configBsTheme();

  // Check config
  const config = await WIC.loadConfig();
  if (config.provider) {
    // Update title
    const titleSpan = document.querySelector('.navbar-brand .badge') as HTMLSpanElement;
    titleSpan.innerText = config.provider.type;
    // API Key found, show tips
    setElementsVisibility(['tips-save', titleSpan], true);
  } else {
    // Ask to config options
    setElementsVisibility('tips-setup', true);
  }

  // Register event listener
  browser.runtime.onMessage.addListener(async (message: any) => {
    if (!isProcessing) {
      // Handle messages only when sidebar is idle
      if ('reload-sidebar' === message.action) {
        // Reload to apply config
        self.location.reload();
      } else if ('prepare-image' === message.action) {
        // Hide elements
        setElementsVisibility(['tips-setup', 'tips-save', 'upload-success-alert', 'edit-panel', editForm, 'common-error'], false);
        // Show loading
        setElementsVisibility('retrieving-image', true);
        // Reset image data
        imagePreview.src = '';
        originalImageBlob = null;
        activeImageBlob = null;
      } else if ('fill-image' === message.action) {
        // Make sure loading message is shown
        if (isElementVisible('retrieving-image')) {
          // Image sent from background / content
          await fillImageData(message.blobArray, message.blobType, message.dimension, message.displaySize,
            message.directory, message.fileName, message.extension, message.useEncryption);
        }
      } else if ('show-error' === message.action) {
        // Problem occurred in background script, hide elements
        setElementsVisibility(['retrieving-image', 'tips-setup', 'tips-save', 'upload-success-alert', 'edit-panel', editForm], false);
        // Show error
        showErrorAlert(message.error);
      }
    }
    // Return true to indicate the response is asynchronous (optional)
    return true;
  });
  document.querySelectorAll('#cloud-file-ext-format a.dropdown-item').forEach(elem => {
    elem.addEventListener('click', updateImageFormat);
  });
  editForm.addEventListener('submit', async evt => {
    // Block submit
    evt.preventDefault();

    // Disable form
    const useEncryption = config.wcipherPassword && editFileEncryption.checked;
    const submitButton = editForm.querySelector('button[type=submit]') as HTMLButtonElement;
    setButtonLoading(submitButton, true);
    isProcessing = true;

    // Get file name / folder name
    const directory = editDirectory.value || '';
    let fileName = `${editFileName.value || ''}${activeFileExt || ''}`;
    let fileCode: string | null = null;
    try {
      const config = await WIC.loadConfig(), apiKey = config.provider?.apiKey;
      if (apiKey && activeImageBlob) {
        // Encrypt content when needed
        let uploadBlob: Blob;
        if (useEncryption) {
          // Use WCipher for encryption
          const imageBytes = await activeImageBlob.arrayBuffer();
          const encryptedBytes = await WCipher.encrypt(config.wcipherPassword, new Uint8Array(imageBytes));
          uploadBlob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
          // Append file extension
          fileName += '.enc';
        } else {
          // No encryption, use the image blob directly
          uploadBlob = activeImageBlob;
        }
        fileCode = await FILELU.uploadFileToDirectory(apiKey, directory, fileName, uploadBlob);
      }
    } catch (ex) {
      const message = WIC.getErrorMessage(ex);
      showErrorAlert(message);
    } finally {
      setButtonLoading(submitButton, false);
      isProcessing = false;
    }

    // Show success message
    if (fileCode) {
      // Hide edit form
      setElementsVisibility(editForm, false);

      // Show success alert
      const successAlert = getElement<HTMLDivElement>('upload-success-alert');
      setElementsVisibility(successAlert, true);

      // Config preview link
      const successLink = successAlert.querySelector('a');
      if (successLink) {
        if (!useEncryption) {
          // Set preview link when encryption is not used.
          successLink.href = `https://filelu.com/${fileCode}`;
        }
        setElementsVisibility(successLink, !useEncryption);
      }
    }
  });
  getElement<HTMLButtonElement>('cloud-directory-picker').addEventListener('click', () => {
    dirPickerModal.show();
  });
  getElement<HTMLDivElement>('dir-picker-modal').addEventListener('show.bs.modal', () => {
    // Load the root folder
    loadFolderList(0);
  });
  getElement<HTMLFormElement>('dir-picker-form').addEventListener('submit', evt => {
    evt.preventDefault();
    // Get selected directory
    const pickForm = evt.target as HTMLFormElement;
    const rawFolderId = pickForm.elements['dir-picker-folder'].value as string;
    const folderPath = getElement<HTMLInputElement>('dir-picker-folder-' + rawFolderId).dataset.path;
    editDirectory.value = folderPath || '/';
    dirPickerModal.hide();
  });

  async function updateImageFormat(evt: Event) {
    const eventTarget = evt.currentTarget as HTMLAnchorElement;
    const imageFormat = eventTarget.dataset.format;
    if (imageFormat && originalImageBlob) {
      activeImageBlob = null;
      if ('original' === imageFormat) {
        // Switch back to original format
        const arrayBuffer = await originalImageBlob.arrayBuffer();
        activeImageBlob = new Blob([arrayBuffer], { type: originalImageBlob.type });
        // Use original extension name
        activeFileExt = originalFileExt;
      } else if (imageFormat.startsWith('image/')) {
        // Encode image
        activeImageBlob = await encodeImage(originalImageBlob, imageFormat);
        // Update imagefile  extension
        activeFileExt = `.${WIC.getExtName(imageFormat)}`;
      }
      if (activeImageBlob) {
        // Convert encoded, set to preview
        imagePreview.src = URL.createObjectURL(activeImageBlob);
        // Update image size
        editFileSize.value = WIC.toDisplaySize(activeImageBlob.size);
        // Update imagefile  extension
        editFileExtDisplay.innerText = activeFileExt!;
      }
    }
  }

  async function encodeImage(imageBlob: Blob, imageFormat: string): Promise<Blob> {
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

  /**
   * Load image and show edit form.
   * @param blobArray The image blob data.
   * @param blobType The content type of blob, such as "image/png".
   * @param dimension Optional. The dimension of image.
   * @param displaySize
   * @param targetDirectory
   * @param targetFileName
   * @param targetExtension
   * @param useEncryption
   */
  async function fillImageData(blobArray: ArrayBuffer, blobType: string, dimension: string, displaySize: string,
    targetDirectory: string, targetFileName: string, targetExtension: string, useEncryption: boolean) {
    // Check API key defined
    const config = await WIC.loadConfig();
    if (!config || !config.provider) {
      console.warn('Provider is not defined...');
      return;
    }

    try {
      if (blobArray && blobType) {
        // Restore blob data
        originalImageBlob = new Blob([blobArray], { type: blobType });
        activeImageBlob = new Blob([blobArray], { type: blobType });
        imagePreview.src = URL.createObjectURL(activeImageBlob);
      } else {
        // Unknown format
        showErrorAlert('Failed to retrieve image...');
      }
    } catch (ex) {
      showErrorAlert(`Failed to retrieve image: ${ex}`);
    } finally {
      // Hide loading
      setElementsVisibility(['tips-save', 'retrieving-image'], false);
    }

    // When image loaded
    if (imagePreview.src) {
      // Set directory
      editDirectory.value = targetDirectory;

      // Split the file name and extension
      editFileName.value = targetFileName;
      editFileExtDisplay.innerText = targetExtension;
      originalFileExt = targetExtension;
      activeFileExt = targetExtension;

      // Add file dimension and size
      editFileDimension.value = dimension || '';
      editFileSize.value = displaySize || '';

      // Config encryption
      if (config.wcipherPassword) {
        editFileEncryption.disabled = false;
        editFileEncryption.checked = useEncryption;
      } else {
        // Encryption not available
        editFileEncryption.disabled = true;
        editFileEncryption.checked = false;
      }

      // Show edit panel and form
      setElementsVisibility(['edit-panel', editForm], true);
    }
  }

  async function loadFolderList(folderId: number) {
    const treeView = getElement<HTMLDivElement>('dir-picker-view');
    let directoryPath = '';
    if (!folderId) {
      // Clear all content
      treeView.innerHTML = '';

      // Add root
      createFolderRadio(treeView, directoryPath, 0, '/ <Root>');
    }

    // Select radio selected
    const currentFolderRadio = getElement<HTMLInputElement>('dir-picker-folder-' + folderId);
    currentFolderRadio.checked = true;
    directoryPath = currentFolderRadio.dataset.path || '';
    const subContainer = getElement<HTMLDivElement>('dir-picker-container-' + folderId);

    // Replace sub folder content with spinner
    subContainer.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div>';

    try {
      // Get config / API key
      const config = await WIC.loadConfig(), apiKey = config.provider?.apiKey;
      if (apiKey) {
        // Get folder list
        const folderList = await FILELU.getFolderList(apiKey, folderId);

        // Clear sub folder content
        subContainer.innerHTML = '';
        folderList.forEach(folder => {
          // Create radio
          createFolderRadio(subContainer, directoryPath, folder.fld_id, folder.name);
        });
      }
    } catch (ex) {
      // Failed to get folder list
      showErrorAlert(WIC.getErrorMessage(ex));
    }
  }

  function createFolderRadio(parentElem: HTMLElement, parentPath: string, folderId: number, displayName: string): HTMLElement {
    // Calculate current path
    let currentPath: string;
    if (folderId) {
      if (parentPath && 1 < parentPath.length) {
        currentPath = `${parentPath}/${displayName}`;
      } else {
        currentPath = `/${displayName}`;
      }
    } else {
      // Use root path
      currentPath = '/';
    }

    // Add container
    const elemId = 'dir-picker-folder-' + folderId;
    const container = document.createElement('div') as HTMLDivElement;
    container.classList.add('form-check');
    parentElem.appendChild(container);

    // Add radio
    const radioElem = document.createElement('input') as HTMLInputElement;
    radioElem.type = 'radio';
    radioElem.name = 'dir-picker-folder';
    radioElem.id = elemId;
    radioElem.value = folderId.toString();
    radioElem.classList.add('form-check-input');
    container.appendChild(radioElem);
    radioElem.dataset.path = currentPath;

    // Add label
    const labelElem = document.createElement('label');
    labelElem.setAttribute('for', elemId);
    labelElem.innerText = displayName;
    labelElem.classList.add('form-check-label');
    container.appendChild(labelElem);

    // Add refresh
    const refreshLink = document.createElement('a');
    refreshLink.id = 'dir-picker-refresh-' + folderId;
    refreshLink.href = '#';
    refreshLink.classList.add('ms-1');
    container.appendChild(refreshLink);
    refreshLink.addEventListener('click', refreshSubFolder);

    const refreshIcon = document.createElement('i');
    refreshIcon.classList.add('bi', 'bi-arrow-repeat');
    refreshLink.appendChild(refreshIcon);

    // Add sub-container
    const subContainer = document.createElement('div');
    subContainer.id = 'dir-picker-container-' + folderId;
    subContainer.classList.add('ps-4');
    parentElem.appendChild(subContainer);

    // Done
    return container;
  }

  async function refreshSubFolder(evt) {
    const callerId = evt.currentTarget.id, folderId = parseInt(callerId.substring(callerId.lastIndexOf('-') + 1));
    console.log('Refresh sub-folder: ' + folderId);

    await loadFolderList(folderId);
  }
});
