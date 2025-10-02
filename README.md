# ![WIC Logo](public/icon/32.png) Web Image Categorizer

Web Image Categorizer (WIC) is a browser extension that lets you save images from webpages directly to [FileLu](https://filelu.com/), a secure, privacy-focused cloud storage provider.

WIC now supports FileLu's [S5 Object Storage API](https://filelu.com/pages/s5-object-storage/), providing an alternative upload method. Since S5 is AWS S3–compatible, WIC can also connect to other S3 storage providers.

You can define naming templates to preset default save directories and file names to match your preferences.

## Motivation
<details>
  <summary>Click to expand</summary>

  In 2024, there was a significant surge in the development of AI applications, and I was particularly impressed by the advancements in text-to-image generative AI technology. Over the course of a year, I used several applications, like Copilot, to generate images. As a result, I amassed a considerable collection of generated images, some of which were truly remarkable and worth preserving.

  To ensure the safekeeping of these images, I discovered FileLu, a platform that provides secure cloud storage and easy-to-integrate APIs. Given my preference for using Firefox, I decided to create this add-on to streamline the process of saving images from websites directly to my online storage. This add-on not only simplifies the workflow but also ensures that my valuable images are stored securely and efficiently.

  If you are new to FileLu, please consider to register by using my <a href="https://filelu.com/5155514948.html" target="_blank">referral link</a>.
</details>

## Features
* Downloads images from webpages in their original formats and save them to your storage provider with just two clicks.
* Supports naming templates based on webpage URLs so that images are saved to your preferred directory with your chosen file name.
* Supports sidebar mode so that user can adjust the directory / file name / image format just before saving to your storage provider.
* Supports client-side encryption by using [WCipher](https://github.com/hkalbertl/wcipher). Please check [Encryption](https://github.com/hkalbertl/web-image-categorizer/wiki/Documentation#encryption) section of project Wiki for more.
* User privacy is a top priority. This add-on does not collect any activity or personal data, and all data uploads go directly to the user's chosen storage provider.

## Demo 1 - Without Sidebar
https://github.com/user-attachments/assets/af1ace5e-f84a-4d86-ac43-5cf2ec43c768

## Demo 2 - With Sidebar, changing file name / description before uploading
https://github.com/user-attachments/assets/f10217fa-ba72-428b-866d-5bf422b798b6

## Demo 3 - With Sidebar, changing image format and encrypt image before uploading
https://github.com/user-attachments/assets/11c35704-aa86-4764-b4c4-0fcc0ed16971

## Installation
* FireFox
  * Download and install from the [official FireFox add-on site](https://addons.mozilla.org/en-GB/firefox/addon/web-image-categorizer/).
* Chromium-based (Chrome / Edge / Brave / etc)
  * Download and install the `-chrome.zip` from [release page](https://github.com/hkalbertl/web-image-categorizer/releases) by using the [load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) method.
  * WIC isn't on the Chrome Web Store yet. Please star this repository or open an issue if you'd like to see it there — a Chrome version will be published once there's enough community interest.

## Usage / Options
Please check the [Wiki](https://github.com/hkalbertl/web-image-categorizer/wiki) for more information.

## Terms of Use
By using this extension, you agree to the following terms:

* Usage
  * This extension may be used to save images to a supported storage provider.
  * Users are responsible for ensuring that their use of the extension complies with all applicable laws and regulations.
* Prohibited Activities
  * The extension must not be used to download, save, or distribute illegal, copyrighted, or offensive images.
  * Any misuse of the extension, including but not limited to downloading illegal content, is strictly prohibited.
* Disclaimer
  * The extension is provided "as is" without warranties of any kind, express or implied.
  * No guarantees are made regarding the functionality, reliability, or availability of the extension.
* Limitation of Liability
  * No liability shall be assumed for any damages arising from the use or inability to use the extension. This includes, without limitation, direct, indirect, incidental, or consequential damages.
* Privacy
  * The extension does not track user activity or transmit data to third parties.
  * Usage data and information related to saved images are not collected or shared.
* Modifications
  * These terms may be updated from time to time. Any changes will be reflected in the README.

## Limitations
* WIC uses the [context menu](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Context_menu_items) API to detect images with the [images](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/ContextType) context type. It may not work on images that are protected by security measures, such as webpages with right-click disabled or images covered by other HTML elements.
* WIC currently supports image URLs with the standard `https://*` and `data:image/*` formats. URLs like `blob:*` are not supported.

## License
Licensed under the [MIT](http://www.opensource.org/licenses/mit-license.php) license.
