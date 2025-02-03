import browser from 'webextension-polyfill';
import WIC from './common';

document.addEventListener('DOMContentLoaded', () => {
  // Config dark theme
  WIC.configBsTheme();

  // Register event listeners
  document.querySelector('button')!.addEventListener('click', () => {
    browser.runtime.openOptionsPage().catch(error => {
      console.error('Error opening options page:', error);
    });
    window.close();
  });
});
