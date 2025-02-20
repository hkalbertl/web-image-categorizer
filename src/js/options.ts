import browser from 'webextension-polyfill';
import * as bootstrap from 'bootstrap';
import WIC from './common';
import { getElement, configBsTheme, setElementsVisibility, setButtonLoading, openSidebar, showSuccessAlert, showErrorAlert, copyValue, triggerEvent } from './common-ui';
import FILELU from './filelu';
import { WICConfig, WICTemplate } from './models';

document.addEventListener('DOMContentLoaded', async () => {
  // Define variables
  const editForm = getElement<HTMLFormElement>('edit-form');
  const templateModalElement = getElement<HTMLDivElement>('template-modal');
  const templateModal = new bootstrap.Modal(templateModalElement);
  const secondaryBackdrop = getElement<HTMLDivElement>('secondary-modal-backdrop');
  const urlTestForm = getElement<HTMLFormElement>('url-test-form');
  const urlTestModalElement = getElement<HTMLDivElement>('url-test-modal');
  const urlTestModal = new bootstrap.Modal(urlTestModalElement, {
    backdrop: false // Disable default backdrop for the second modal
  });
  const paramTestForm = getElement<HTMLFormElement>('param-test-form');
  const paramTestModalElement = getElement<HTMLDivElement>('param-test-modal');
  const paramTestModal = new bootstrap.Modal(paramTestModalElement, {
    backdrop: false // Disable default backdrop for the second modal
  });
  const onScreenTemplates: WICTemplate[] = [];

  // Get windowId for chrome
  let currentWindowId = 0;
  if (chrome && chrome.sidePanel) {
    chrome.windows.getCurrent().then(window => {
      currentWindowId = window.id!;
    });
  }

  // Config dark theme
  configBsTheme();

  // Register event listeners
  registerEventListeners();

  // Restore saved options, if any
  await restoreOptions();

  /**
   * Register event listeners on elements like forms and buttons.
   */
  function registerEventListeners() {
    // Sidebar mode change event
    getElement<HTMLSelectElement>('sidebar-mode').addEventListener('change', evt => {
      const caller = evt.target as HTMLSelectElement,
        sidebarMode = parseInt(caller.value);
      // Show / hide notification row
      setElementsVisibility('notification-row', !sidebarMode);
    });

    // Add edit form submit event
    editForm.addEventListener('submit', evt => {
      // Stop standard form submit
      evt.preventDefault();

      // Set loading
      const submitButton = editForm.querySelector('button[type=submit]') as HTMLButtonElement;
      setButtonLoading(submitButton, true);

      // Fill the config object
      const config = {
        ...WIC.DEFAULT_CONFIG, ...{
          // TODO: Support other providers?
          provider: {
            type: 'FileLu',
            apiKey: editForm.elements['filelu-api-key'].value
          },
          wcipherPassword: editForm.elements['wcipher-password'].value || '',
          templates: onScreenTemplates,
          sidebarMode: parseInt(editForm.elements['sidebar-mode'].value),
          notificationLevel: parseInt(editForm.elements['notification-level'].value),
          imageFormat: editForm.elements['image-format'].value
        }
      };

      // Open sidebar, if enabled
      if (0 !== config.sidebarMode) {
        openSidebar(currentWindowId);
      }

      // Test API Key
      FILELU.validateApiKey(config.provider.apiKey).then(() => {
        // Save config
        browser.storage.sync.set(config).then(() => {
          // Show success message
          showSuccessAlert('Options saved successfully!');
          // Trigger reload config in background
          browser.runtime.sendMessage({ action: 'reload-config' });
          // Open sidebar, if enabled
          if (0 !== config.sidebarMode) {
            // Reload sidebar if enabled
            browser.runtime.sendMessage({ action: 'reload-sidebar' });
          }
        });
      }).catch(ex => {
        // Unknown error?
        showErrorAlert(WIC.getErrorMessage(ex));
      }).finally(() => {
        // Stop loading
        setButtonLoading(submitButton, false);
      });
    });

    // Reset button
    document.getElementById('reset-button')!.addEventListener('click', () => {
      if (confirm('Are you sure to discard all settings?')) {
        // Clear all settings
        browser.storage.sync.clear().then(() => {
          // Send reload sidebar message
          browser.runtime.sendMessage({ action: 'reload-sidebar' }).then(() => {
            // Reload current option page
            self.location.reload();
          });
        });
      }
    });

    // Add provider tab changed event
    /*
    document.querySelectorAll('#provider-tabs li button.nav-link').forEach(tabButton => {
      tabButton.addEventListener('shown.bs.tab', evt => {
        console.log(evt.target.id);
      })
    });
    */

    // Template form submit event
    document.getElementById('template-form')!.addEventListener('submit', evt => {
      // Prevent form submission
      const form = evt.target as HTMLFormElement;
      evt.preventDefault();
      evt.stopPropagation();

      // Reset form elements
      const urlPatternElem = getElement<HTMLInputElement>('template-url-pattern'),
        directoryElem = getElement<HTMLInputElement>('template-directory'),
        fileNameElem = getElement<HTMLInputElement>('template-file-name');
      [urlPatternElem, directoryElem, fileNameElem].forEach(elem => {
        elem.setCustomValidity('');
        elem.classList.remove('invalid', 'is-valid', 'is-invalid');
      });

      // Perform basic validation
      const record: WICTemplate = {
        url: urlPatternElem.value.trim(),
        directory: directoryElem.value.trim(),
        fileName: fileNameElem.value.trim(),
        encryption: getElement<HTMLInputElement>('template-use-encryption').checked
      };
      let isValid = urlPatternElem.checkValidity();

      // Check for directory / file name patterns
      if (record.directory) {
        let itemError = validateTemplateInput(record.directory, true);
        if (itemError) {
          directoryElem.setCustomValidity(itemError);
          document.getElementById('template-directory-error')!.innerText = itemError;
          isValid = false;
        }
      }
      if (record.fileName) {
        let itemError = validateTemplateInput(record.fileName, false);
        if (itemError) {
          fileNameElem.setCustomValidity(itemError);
          document.getElementById('template-file-name-error')!.innerText = itemError;
          isValid = false;
        }
      }

      if (isValid) {
        // All good! Rebuild the template table
        const templates = [...onScreenTemplates];
        const recordIndex = parseInt(templateModalElement.dataset.row!.toString());
        if (-1 === recordIndex) {
          templates.push(record);
        } else {
          templates[recordIndex] = record;
        }
        buildTemplateTable(templates);
        templateModal.hide();
      }
      form.classList.add('was-validated');
    }, false);

    urlTestForm.addEventListener('submit', evt => {
      // Stop standard form submit
      evt.preventDefault();
      evt.stopPropagation();

      // Get elements
      const successAlert = urlTestForm.querySelector('.alert-success') as HTMLDivElement,
        errorAlert = urlTestForm.querySelector('.alert-danger') as HTMLDivElement,
        patternElem = getElement<HTMLInputElement>('url-test-pattern'),
        sourceUrlElem = getElement<HTMLInputElement>('url-test-input');

      // Reset form
      [patternElem, sourceUrlElem].forEach(elem => {
        elem.setCustomValidity('');
        elem.classList.remove('invalid', 'is-valid', 'is-invalid');
      });
      setElementsVisibility([successAlert, errorAlert], false);
      urlTestForm.classList.remove('was-validated');

      // Perform basic validation
      let isValid = true, itemError: string | null = null;
      const pattern = patternElem.value.trim();
      if (!pattern) {
        itemError = 'Required';
      } else {
        patternElem.value = pattern;
      }
      if (itemError) {
        getElement<HTMLDivElement>('url-test-pattern-error').innerText = itemError;
        patternElem.setCustomValidity(itemError);
        isValid = false;
      }
      itemError = null;

      const sourceUrl = sourceUrlElem.value.trim();
      if (!sourceUrl) {
        itemError = 'Required';
      } else if (-1 === sourceUrl.search(/^https?\:\/\/[^\s]+/)) {
        itemError = 'Invalid URL format.';
      } else {
        sourceUrlElem.value = sourceUrl;
      }
      if (itemError) {
        getElement<HTMLDivElement>('url-test-input-error').innerText = itemError;
        sourceUrlElem.setCustomValidity(itemError);
        isValid = false;
      }
      itemError = null;

      // Perform basic validation
      if (isValid) {
        // Check URL is matched
        if (WIC.isUrlMatch(sourceUrl, pattern)) {
          setElementsVisibility(successAlert, true);
          setElementsVisibility(errorAlert, false);
        } else {
          setElementsVisibility(successAlert, false);
          setElementsVisibility(errorAlert, true);
        }
      }

      urlTestForm.classList.add('was-validated');
    }, false);

    // Template modal related
    getElement<HTMLButtonElement>('template-add-button').addEventListener('click', () => {
      showTemplateEditModal(-1);
    });
    templateModalElement.addEventListener('show.bs.modal', () => {
      // Reset form
      const form = document.getElementById('template-form') as HTMLFormElement;
      form.classList.remove('was-validated');
      form.querySelectorAll('input').forEach(element => element.value = '');
    });
    templateModalElement.addEventListener('shown.bs.modal', () => {
      document.getElementById('template-url-pattern')!.focus();
    });

    // URL test modal related
    getElement<HTMLButtonElement>('template-url-pattern-test-button').addEventListener('click', () => {
      showTemplateUrlTesterModal();
    });
    urlTestModalElement.addEventListener('show.bs.modal', () => {
      // Show backdrop
      secondaryBackdrop.classList.replace('d-none', 'show');
      // Reset form
      urlTestForm.classList.remove('was-validated');
      urlTestForm.querySelectorAll('input').forEach(element => element.value = '');
      copyValue('template-url-pattern', 'url-test-pattern');
      // Hide alerts
      setElementsVisibility([...urlTestForm.querySelectorAll('.alert')], false);
    });
    urlTestModalElement.addEventListener('hide.bs.modal', () => {
      // Hide backdrop
      secondaryBackdrop.classList.replace('show', 'd-none');
    });
    urlTestModalElement.querySelector('.modal-footer .btn-outline-primary')!.addEventListener('click', () => {
      // Send current pattern back to template edit modal
      copyValue('url-test-pattern', 'template-url-pattern');
      // Close modal
      urlTestModal.hide();
    });

    // Param test modal related
    getElement<HTMLButtonElement>('template-directory-test-button').addEventListener('click', () => {
      paramTestModal.show();
      paramTestForm.dataset.mode = 'dir';
      copyValue('template-directory', 'param-test-pattern');
    });
    getElement<HTMLButtonElement>('template-file-name-test-button').addEventListener('click', () => {
      paramTestModal.show();
      paramTestForm.dataset.mode = 'file';
      copyValue('template-file-name', 'param-test-pattern');
    });
    paramTestModalElement.addEventListener('show.bs.modal', () => {
      // Show backdrop
      secondaryBackdrop.classList.replace('d-none', 'show');
      // Reset form
      paramTestForm.classList.remove('was-validated');
      paramTestForm.querySelectorAll('input').forEach(element => element.value = '');
      // Hide alerts
      setElementsVisibility([...paramTestForm.querySelectorAll('.alert')], false);
    });
    paramTestModalElement.addEventListener('shown.bs.modal', () => {
      getElement<HTMLInputElement>('param-test-pattern').focus();
    });
    paramTestModalElement.addEventListener('hide.bs.modal', () => {
      // Hide backdrop
      secondaryBackdrop.classList.replace('show', 'd-none');
    });
    paramTestModalElement.querySelector('button.btn-outline-primary')!.addEventListener('click', () => {
      // Copy pattern back to previous screen
      let targetId = 'dir' === paramTestForm.dataset.mode ? 'template-directory' : 'template-file-name';
      copyValue('param-test-pattern', targetId);
      // Close modal
      paramTestModal.hide();
    });
    paramTestForm.addEventListener('submit', evt => {
      // Stop standard form submit
      evt.preventDefault();
      evt.stopPropagation();

      // Reset form elements
      const successAlert = paramTestForm.querySelector('.alert-success') as HTMLDivElement,
        errorAlert = paramTestForm.querySelector('.alert-danger') as HTMLDivElement,
        patternElem = getElement<HTMLInputElement>('param-test-pattern'),
        sourceUrlElem = getElement<HTMLInputElement>('param-test-url');
      [patternElem, sourceUrlElem].forEach(elem => {
        elem.setCustomValidity('');
        elem.classList.remove('invalid', 'is-valid', 'is-invalid');
      });
      setElementsVisibility([successAlert, errorAlert], false);
      paramTestForm.classList.remove('was-validated');

      // Perform basic validation
      let isValid = true, itemError: string | null = null;
      const isDirMode = 'dir' === paramTestForm.dataset.mode;
      const pattern = patternElem.value.trim();
      if (!pattern) {
        itemError = 'Required';
      } else {
        itemError = validateTemplateInput(pattern, isDirMode);
      }
      if (itemError) {
        getElement<HTMLDivElement>('param-test-pattern-error').innerText = itemError;
        patternElem.setCustomValidity(itemError);
        isValid = false;
      } else {
        patternElem.value = pattern;
      }
      itemError = null;

      const sourceUrl = sourceUrlElem.value.trim();
      if (!sourceUrl) {
        itemError = 'Required';
      } else if (-1 === sourceUrl.search(/^https?\:\/\/[^\s]+/)) {
        itemError = 'Invalid URL format.';
      } else {
        sourceUrlElem.value = sourceUrl;
      }
      if (itemError) {
        getElement<HTMLDivElement>('param-test-url-error').innerText = itemError;
        sourceUrlElem.setCustomValidity(itemError);
        isValid = false;
      }

      if (isValid) {
        itemError = null;
        try {
          const matchTemplate: WICTemplate = { url: '*', encryption: false };
          if (isDirMode) {
            matchTemplate.directory = pattern;
          } else {
            matchTemplate.fileName = pattern;
          }
          const matching = WIC.matchTemplate([matchTemplate], sourceUrl, 'Sample-Page-Title', 'image/jpeg');
          if (matching && matching.isMatched) {
            // Data matched
            successAlert.querySelector('span')!.innerText = isDirMode ? matching.directory : matching.fileName;
            setElementsVisibility(successAlert, true);
          } else {
            // Failed to match or required parameter does not exist
            itemError = 'Failed to match, please double check parameters defined in pattern.';
          }
        } catch (ex) {
          itemError = WIC.getErrorMessage(ex);
        }
        if (itemError) {
          // Show error alert
          errorAlert.querySelector('span')!.innerText = itemError;
          setElementsVisibility(errorAlert, true);
        }
      }
      paramTestForm.classList.add('was-validated');
    });
  }

  /**
   * Restore saved options.
   */
  async function restoreOptions() {
    // Load save config, if any
    const config = await WIC.loadConfig();

    // Restore options
    if (config.provider) {
      if ('FileLu' === config.provider.type) {
        // FileLu settings
        editForm.elements['filelu-api-key'].value = config.provider.apiKey;
      }
    }

    // Privacy
    editForm.elements['wcipher-password'].value = config.wcipherPassword;

    // Bulid template table
    buildTemplateTable(config.templates);

    // Others
    editForm.elements['sidebar-mode'].value = config.sidebarMode;
    editForm.elements['notification-level'].value = config.notificationLevel;
    editForm.elements['image-format'].value = config.imageFormat;

    // Trigger change
    triggerEvent('sidebar-mode', 'change');
  }

  /**
   * Build template table with specified template data.
   * @param templates
   */
  function buildTemplateTable(templates: WICTemplate[] | null) {
    // Reset table
    const table = document.getElementById('template-list-table') as HTMLTableElement,
      tbody = table.querySelector('tbody') as HTMLTableSectionElement,
      tfoot = table.querySelector('tfoot') as HTMLTableSectionElement;
    tbody.innerHTML = '';
    onScreenTemplates.length = 0;
    // Check argument records
    if (templates && Array.isArray(templates) && templates.length) {
      tfoot.classList.add('d-none');
      // Process on each template record
      templates.forEach((item, index) => {
        // Add table row
        const tr = document.createElement('tr');
        tbody.appendChild(tr);
        // Add URL cell
        const firstTd = document.createElement('td') as HTMLTableCellElement;
        tr.appendChild(firstTd);
        firstTd.innerText = item.url!;
        // Add button cell
        const secondTd = document.createElement('td');
        secondTd.classList.add('text-end');
        tr.appendChild(secondTd);
        // Add `edit` button
        const editButton = createIconButton('btn-primary', 'fa-edit', index.toString());
        secondTd.appendChild(editButton);
        editButton.addEventListener('click', evt => {
          const rawRowIndex = (evt.currentTarget as HTMLButtonElement).value,
            rowIndex = parseInt(rawRowIndex);
          showTemplateEditModal(rowIndex);
        });
        // Add `delete` button
        const deleteButton = createIconButton('btn-danger', 'fa-trash', index.toString());
        secondTd.appendChild(deleteButton);
        // Push to global list
        onScreenTemplates.push(item);
      });
    } else {
      // No template data
      tfoot.classList.remove('d-none');
    }
  }

  function validateTemplateInput(input: string, isDirectory: boolean): string | null {
    let itemError: string | null = null;
    // Check for directory path start character
    if (isDirectory && '/' !== input.charAt(0)) {
      itemError = 'Directory path should started with / character.';
    }
    if (!itemError) {
      // Check for WIC parameters
      const params = WIC.extractCurlyBracePatterns(input);
      if (!Array.isArray(params)) {
        // Not well-formed pattern
        itemError = 'Number of curly braces should be matched and well-formed.';
      } else {
        // Make sure each parameter is valid
        for (const item of params) {
          if (!WIC.isValidWicParams(item)) {
            itemError = `Unsupported parameter: ${item}`;
            break;
          } else if (!WIC.isValidForFileName(item)) {
            itemError = `Invalid character(s) found in parameter: ${item}`;
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
            if (!WIC.isValidForFileName(segment)) {
              itemError = `Invalid character(s) found in directory path: ${segment}`;
              break;
            }
          }
        }
      } else if (!isDirectory) {
        // Check for invaid character(s)
        if (!WIC.isValidForFileName(input)) {
          itemError = `Invalid character(s) found.`;
        }
      }
    }
    return itemError;
  }

  function showTemplateEditModal(rowIndex: number) {
    // Show modal
    templateModal.show();
    // Fill template values, if available
    if (-1 !== rowIndex) {
      const record = onScreenTemplates[rowIndex];
      getElement<HTMLInputElement>('template-url-pattern').value = record.url || '';
      getElement<HTMLInputElement>('template-directory').value = record.directory || '';
      getElement<HTMLInputElement>('template-file-name').value = record.fileName || '';
      getElement<HTMLInputElement>('template-use-encryption').checked = record.encryption;
    }
    // Save editing row
    templateModalElement.dataset.row = rowIndex.toString();
  }

  function showTemplateUrlTesterModal() {
    urlTestModal.show();
  }

  /**
   * Create Bootstrap button with a font-awesome icon.
   * @param buttonClass
   * @param faIcon
   * @param value
   * @returns The generated button element.
   */
  function createIconButton(buttonClass: string, faIcon: string, value: string): HTMLButtonElement {
    const button = document.createElement('button') as HTMLButtonElement;
    button.type = 'button';
    button.classList.add('btn', 'btn-sm', buttonClass);
    button.value = value;
    const icon = document.createElement('i');
    icon.classList.add('fa-solid', faIcon);
    button.appendChild(icon);
    return button;
  }
});
