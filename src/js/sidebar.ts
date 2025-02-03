import browser from 'webextension-polyfill';
import * as bootstrap from 'bootstrap';
import WIC from './common'
import FILELU from './filelu';

document.addEventListener('DOMContentLoaded', async () => {
  // Define global variables
  let activeImageBlob: Blob | null = null;
  const editForm = WIC.getElement<HTMLFormElement>('edit-form');
  const editDirectory = WIC.getElement<HTMLInputElement>('cloud-directory');
  const editFileName = WIC.getElement<HTMLInputElement>('cloud-file-name');
  const editFileInfo = WIC.getElement<HTMLInputElement>('cloud-file-info');
  const imagePreview = WIC.getElement<HTMLImageElement>('cloud-image');
  const dirPickerModal = new bootstrap.Modal('#dir-picker-modal');

  // Config dark theme
  WIC.configBsTheme();

  // Check config
  const config = await WIC.loadConfig();
  if (config.provider) {
    // Update title
    const titleSpan = document.querySelector('.navbar-brand .badge') as HTMLSpanElement;
    titleSpan.classList.remove('d-none');
    titleSpan.innerText = config.provider.type;
    // API Key found, show tips
    WIC.setElementsVisibility('tips-save', true);
  } else {
    // Ask to config options
    WIC.setElementsVisibility('tips-setup', true);
  }

  // Register event listener
  browser.runtime.onMessage.addListener(async (message: any) => {
    if ('reload-sidebar' === message.action) {
      // Reload to apply config
      self.location.reload();
    } else if ('prepare-image' === message.action) {
      // Hide elements
      WIC.setElementsVisibility(['tips-setup', 'tips-save', 'upload-success-alert', 'edit-panel', editForm, 'common-error'], false);
      // Show loading
      WIC.setElementsVisibility('retrieving-image', true);
      // Reset image data
      imagePreview.src = '';
      activeImageBlob = null;
    } else if ('fill-image' === message.action) {
      // Image sent from background / content
      await fillImageData(message.blobArray, message.blobType, message.dimension, message.displaySize,
        message.directory, message.fileName);
    } else if ('show-error' === message.action) {
      // Problem occurred in background script, hide elements
      WIC.setElementsVisibility(['tips-setup', 'tips-save', 'upload-success-alert', 'edit-panel', editForm], false);
      // Show error
      WIC.showErrorAlert(message.error);
    }
    // Return true to indicate the response is asynchronous (optional)
    return true;
  });
  editForm.addEventListener('submit', async evt => {
    // Block submit
    evt.preventDefault();

    // Disable form
    const submitButton = editForm.querySelector('button[type=submit]') as HTMLButtonElement;
    WIC.setButtonLoading(submitButton, true);

    // Get file name / folder name
    const directory = editDirectory.value || '';
    const fileName = editFileName.value || '';

    let fileCode: string | null = null;
    try {
      const config = await WIC.loadConfig(), apiKey = config.provider?.apiKey;
      if (apiKey && activeImageBlob) {
        fileCode = await FILELU.uploadFileToDirectory(apiKey, directory, fileName, activeImageBlob);
      }
    } catch (ex) {
      const message = WIC.getErrorMessage(ex);
      WIC.showErrorAlert(message);
    } finally {
      WIC.setButtonLoading(submitButton, false);
    }

    // Show success message
    if (fileCode) {
      WIC.setElementsVisibility(editForm, false);

      const successAlert = document.getElementById('upload-success-alert') as HTMLDivElement;
      successAlert.classList.remove('d-none');
      successAlert.querySelector('a')!.href = 'https://filelu.com/' + fileCode;
    }
  });
  WIC.getElement<HTMLButtonElement>('cloud-directory-picker').addEventListener('click', () => {
    dirPickerModal.show();
  });
  WIC.getElement<HTMLDivElement>('dir-picker-modal').addEventListener('show.bs.modal', () => {
    // Load the root folder
    loadFolderList(0);
  });
  WIC.getElement<HTMLFormElement>('dir-picker-form').addEventListener('submit', evt => {
    evt.preventDefault();
    // Get selected directory
    const pickForm = evt.target as HTMLFormElement;
    const rawFolderId = pickForm.elements['dir-picker-folder'].value as string;
    const folderPath = WIC.getElement<HTMLInputElement>('dir-picker-folder-' + rawFolderId).dataset.path;
    editDirectory.value = folderPath || '/';
    dirPickerModal.hide();
  });

  /**
   * Load image and show edit form.
   * @param {ArrayBuffer} blobArray The image blob data.
   * @param {string} blobType The content type of blob, such as "image/png".
   * @param {string} dimension Optional. The dimension of image.
   * @param {string} displaySize
   * @param {string} targetDirectory
   * @param {string} targetFileName
   */
  async function fillImageData(blobArray: ArrayBuffer, blobType: string, dimension: string, displaySize: string, targetDirectory: string, targetFileName: string) {
    // Check API key defined
    const config = await WIC.loadConfig();
    if (!config || !config.provider) {
      console.warn('Provider is not defined...');
      return;
    }

    try {
      if (blobArray && blobType) {
        // Restore blob data
        activeImageBlob = new Blob([blobArray], { type: blobType });
        imagePreview.src = URL.createObjectURL(activeImageBlob);
      } else {
        // Unknown format
        WIC.showErrorAlert('Failed to retrieve image...');
      }
    } catch (ex) {
      WIC.showErrorAlert(`Failed to retrieve image: ${ex}`);
    } finally {
      // Hide loading
      WIC.setElementsVisibility(['tips-save', 'retrieving-image'], false);
    }

    // When image loaded
    if (imagePreview.src) {
      editDirectory.value = targetDirectory;
      editFileName.value = targetFileName;

      // Add file info, such as dimension and size
      let fileInfo: string;
      const fileInfoList: string[] = [];
      if (dimension) {
        fileInfoList.push(dimension);
      }
      if (displaySize) {
        fileInfoList.push(displaySize);
      }
      if (fileInfoList.length) {
        fileInfo = fileInfoList.join(', ');
      } else {
        fileInfo = 'N/A';
      }
      editFileInfo.value = fileInfo;

      // Show edit panel and form
      WIC.setElementsVisibility(['edit-panel', editForm], true);
    }
  }

  async function loadFolderList(folderId: number) {
    const treeView = WIC.getElement<HTMLDivElement>('dir-picker-view');
    let directoryPath = '';
    if (!folderId) {
      // Clear all content
      treeView.innerHTML = '';

      // Add root
      createFolderRadio(treeView, directoryPath, 0, '/ <Root>');
    }

    // Select radio selected
    const currentFolderRadio = WIC.getElement<HTMLInputElement>('dir-picker-folder-' + folderId);
    currentFolderRadio.checked = true;
    directoryPath = currentFolderRadio.dataset.path || '';
    const subContainer = WIC.getElement<HTMLDivElement>('dir-picker-container-' + folderId);

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
      WIC.showErrorAlert(WIC.getErrorMessage(ex));
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
    refreshLink.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
    container.appendChild(refreshLink);
    refreshLink.addEventListener('click', refreshSubFolder);

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
