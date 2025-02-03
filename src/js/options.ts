import browser from 'webextension-polyfill';
import * as bootstrap from 'bootstrap';
import WIC from './common';
import FILELU from './filelu';
import { WICTemplate } from './models';

document.addEventListener('DOMContentLoaded', async () => {
  // Define variables
  const editForm = WIC.getElement<HTMLFormElement>('edit-form');
  const templateModalElement = WIC.getElement<HTMLDivElement>('template-modal');
  const templateModal = new bootstrap.Modal(templateModalElement);
  const secondaryBackdrop = WIC.getElement<HTMLDivElement>('secondary-modal-backdrop');
  const urlTestModalElement = WIC.getElement<HTMLDivElement>('url-test-modal');
  const templateUrlTesterModal = new bootstrap.Modal(urlTestModalElement, {
    backdrop: false // Disable default backdrop for the second modal
  });
  const onScreenTemplates: WICTemplate[] = [];

  // Config dark theme
  WIC.configBsTheme();

  // Register event listeners
  registerEventListeners();

  // Restore saved options, if any
  await restoreOptions();

  /**
   * Register event listeners on elements like forms and buttons.
   */
  function registerEventListeners() {
    // Sidebar mode change event
    WIC.getElement<HTMLSelectElement>('sidebar-mode').addEventListener('change', evt => {
      const caller = evt.target as HTMLSelectElement,
        sidebarMode = parseInt(caller.value);
      // Show / hide notification row
      WIC.setElementsVisibility('notification-row', !sidebarMode);
    });

    // Add edit form submit event
    editForm.addEventListener('submit', evt => {
      // Stop standard form submit
      evt.preventDefault();

      // Set loading
      const submitButton = editForm.querySelector('button[type=submit]') as HTMLButtonElement;
      WIC.setButtonLoading(submitButton, true);

      // Fill the config object
      const config = {
        ...WIC.DEFAULT_CONFIG, ...{
          // TODO: Support other providers?
          provider: {
            type: 'FileLu',
            apiKey: editForm.elements['filelu-api-key'].value
          },
          templates: onScreenTemplates,
          sidebarMode: parseInt(editForm.elements['sidebar-mode'].value),
          notificationLevel: parseInt(editForm.elements['notification-level'].value),
          imageFormat: editForm.elements['image-format'].value
        }
      };

      // Open sidebar, if enabled
      if (0 !== config.sidebarMode) {
        browser.sidebarAction.open();
      }

      // Test API Key
      FILELU.validateApiKey(config.provider.apiKey).then(() => {
        // Save config
        browser.storage.sync.set(config).then(() => {
          // Show success message
          WIC.showSuccessAlert('Options saved successfully!');
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
        WIC.showErrorAlert(WIC.getErrorMessage(ex));
      }).finally(() => {
        // Stop loading
        WIC.setButtonLoading(submitButton, false);
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
      const urlElem = WIC.getElement<HTMLInputElement>('template-url'),
        directoryElem = WIC.getElement<HTMLInputElement>('template-directory'),
        fileNameElem = WIC.getElement<HTMLInputElement>('template-file-name');
      [urlElem, directoryElem, fileNameElem].forEach(elem => {
        elem.setCustomValidity('');
        elem.classList.remove('invalid', 'is-valid', 'is-invalid');
      });

      // Perform basic validation
      const record = {
        url: urlElem.value.trim(),
        directory: directoryElem.value.trim(),
        fileName: fileNameElem.value.trim()
      };
      let isValid = urlElem.checkValidity();

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

    document.getElementById('url-test-form')!.addEventListener('submit', evt => {
      evt.preventDefault();
      const form = evt.target as HTMLFormElement,
        successAlert = form.querySelector('.alert-success') as HTMLDivElement,
        errorAlert = form.querySelector('.alert-danger') as HTMLDivElement;
      const patternElement = WIC.getElement<HTMLInputElement>('url-test-pattern'),
        pattern = patternElement.value,
        input = WIC.getElement<HTMLInputElement>('url-test-input').value;
      if (WIC.isUrlMatch(input, pattern)) {
        WIC.setElementsVisibility(successAlert, true);
        WIC.setElementsVisibility(errorAlert, false);
      } else {
        WIC.setElementsVisibility(successAlert, false);
        WIC.setElementsVisibility(errorAlert, true);
      }
    }, false);

    document.getElementById('template-add-button')!.addEventListener('click', () => {
      showTemplateEditModal(-1);
    });

    document.getElementById('url-test-modal-button')!.addEventListener('click', () => {
      showTemplateUrlTesterModal();
    });

    templateModalElement.addEventListener('show.bs.modal', () => {
      // Reset form
      const form = document.getElementById('template-form') as HTMLFormElement;
      form.classList.remove('was-validated');
      form.querySelectorAll('input').forEach(element => element.value = '');
    });
    templateModalElement.addEventListener('shown.bs.modal', () => {
      document.getElementById('template-url')!.focus();
    });

    urlTestModalElement.addEventListener('show.bs.modal', () => {
      // Show backdrop
      secondaryBackdrop.classList.replace('d-none', 'show');
      // Prepare form
      WIC.copyValue('template-url', 'url-test-pattern');
      WIC.getElement<HTMLInputElement>('url-test-input').value = '';
      // Hide alerts
      WIC.setElementsVisibility([...document.querySelectorAll('#url-test-form .alert')], false);
    });
    urlTestModalElement.addEventListener('hide.bs.modal', () => {
      // Hide backdrop
      secondaryBackdrop.classList.replace('show', 'd-none');
    });
    urlTestModalElement.querySelector('.modal-footer .btn-outline-primary')!.addEventListener('click', () => {
      // Send current pattern back to template edit modal
      WIC.copyValue('url-test-pattern', 'template-url');
      // Close modal
      templateUrlTesterModal.hide();
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

    // Bulid template table
    buildTemplateTable(config.templates);

    // Others
    editForm.elements['sidebar-mode'].value = config.sidebarMode;
    editForm.elements['notification-level'].value = config.notificationLevel;
    editForm.elements['image-format'].value = config.imageFormat;

    // Trigger change
    WIC.triggerEvent('sidebar-mode', 'change');
  }

  /**
   * Build template table with specified template data.
   * @param {Array<object>} templates
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
          const itemRow = (evt.currentTarget as HTMLButtonElement).value;
          const rowIndex = parseInt(itemRow);
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

  function validateTemplateInput(input: string, isDirectory: boolean) {
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
      WIC.getElement<HTMLInputElement>('template-url').value = record.url || '';
      WIC.getElement<HTMLInputElement>('template-directory').value = record.directory || '';
      WIC.getElement<HTMLInputElement>('template-file-name').value = record.fileName || '';
    }
    // Save editing row
    templateModalElement.dataset.row = rowIndex.toString();
  }

  function showTemplateUrlTesterModal() {
    templateUrlTesterModal.show();
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
