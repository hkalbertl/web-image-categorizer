/**
   * Check client browser setting and apply dark theme when needed.
   */
export function configBsTheme() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    document.documentElement.setAttribute('data-bs-theme', 'dark');
  }
}

/**
 * Show an alert with specified success message.
 * @param msg The success message.
 */
export function showSuccessAlert(msg: string) {
  const alertElem = document.getElementById('common-success')!,
    alertSpan = alertElem.querySelector('span')!;
  alertElem.classList.remove('d-none');
  alertSpan.innerText = msg;
}

/**
 * Show an alert with specified error message.
 * @param msg The error message.
 */
export function showErrorAlert(msg: string) {
  const alertElem = document.getElementById('common-error')!,
    alertSpan = alertElem.querySelector('span')!;
  alertElem.classList.remove('d-none');
  alertSpan.innerText = msg;
}

/**
 * Set the button with loading state or not.
 * @param targetButton The button element.
 * @param isLoading Is loading or not.
 */
export function setButtonLoading(targetButton: HTMLButtonElement, isLoading: boolean): void {
  const buttonIcon = targetButton.querySelector('i.bi')!,
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
}

/**
 * Show or hide the list of elements.
 * @param targets Target element(s) or element IDs.
 * @param isShow True to show or false to hide.
 */
export function setElementsVisibility(targets: string | HTMLElement | any[], isShow: boolean = true) {
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
  elements.forEach(element => {
    if (isShow) {
      element.classList.remove('d-none');
    } else {
      element.classList.add('d-none');
    }
  });
}

/**
   * Copy element value.
   * @param fromElemId From element ID.
   * @param toElemId To element ID.
   */
export function copyValue(fromElemId: string, toElemId: string) {
  const fromElem = document.getElementById(fromElemId) as HTMLInputElement;
  const toElem = document.getElementById(toElemId) as HTMLInputElement;
  if (fromElem && toElem) {
    toElem.value = fromElem.value;
  }
}

/**
   * Get the element by specified ID in specified type.
   * @param id Input ID.
   * @returns The element.
   */
export function getElement<T>(id: string): T {
  return document.getElementById(id) as T;
}

/**
 * Trigger specified event on target element.
 * @param element Element or element ID.
 * @param eventType Event type, such as `click` and `change`.
 */
export function triggerEvent(element: string | HTMLElement, eventType: string) {
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

/**
   * Open Firefox's sidebar or Chrome's sidepanel.
   * @param windowId Target windowId that required by Chrome's sidepanel.
   */
export async function openSidebar(windowId: number) {
  return new Promise<void>((resolve, reject) => {
    if ('undefined' !== typeof browser && browser.sidebarAction) {
      // Firefox: Use sidebarAction API
      browser.sidebarAction.open().then(() => {
        resolve();
      }).catch(err => {
        console.error('Failed to open sidebar...', err);
        resolve();
      });
    } else if (chrome && chrome.sidePanel && 'function' === typeof chrome.sidePanel.open) {
      // Chrome: Use sidePanel API
      chrome.sidePanel.open({ windowId }, () => {
        resolve();
      });
    } else {
      console.error('Side panel/sidebar API not supported.');
      reject();
    }
  });
}
