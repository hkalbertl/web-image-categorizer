import browser from 'webextension-polyfill';
import { configBsTheme } from './common-ui';

document.addEventListener('DOMContentLoaded', () => {
  // Config dark theme
  configBsTheme();

  // Register event listeners
  document.querySelector('button')!.addEventListener('click', () => {
    browser.runtime.openOptionsPage().catch(error => {
      console.error('Error opening options page:', error);
    });
    window.close();
  });
});
