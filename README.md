# ![WIC Logo](src/icons/wic-32.png) Web Image Categorizer

Web Image Categorizer (WIC) is a Firefox add-on that helps save images from webpages to [FileLu](https://filelu.com/), a secure and privacy-first cloud storage provider, using custom naming templates.

## Motivation
<details>
  <summary>Click to expand</summary>

  In 2024, there was a significant surge in the development of AI applications, and I was particularly impressed by the advancements in text-to-image generative AI technology. Over the course of a year, I used several applications, like Copilot, to generate images. As a result, I amassed a considerable collection of generated images, some of which were truly remarkable and worth preserving.

  To ensure the safekeeping of these images, I discovered FileLu, a platform that provides secure cloud storage and easy-to-integrate APIs. Given my preference for using Firefox, I decided to create this add-on to streamline the process of saving images from websites directly to my online storage. This add-on not only simplifies the workflow but also ensures that my valuable images are stored securely and efficiently.

  If you are new to FileLu, please consider to register by using my <a href="https://filelu.com/5155514948.html" target="_blank">referral link</a>.
</details>

## Features
* Downloads images from webpages in their original formats and save them to FileLu with just two clicks.
* Supports naming templates based on webpage URLs so that images are saved to your preferred directory with your chosen file name.
* Supports sidebar mode so that user can adjust the directory / file name just before saving to FileLu.

## Demo 1 - Without Sidebar
https://github.com/user-attachments/assets/80a826b5-4d8d-4b1d-830b-e2254b72a36f

## Demo 2 - With Sidebar
https://github.com/user-attachments/assets/a089d979-41c9-48f7-9620-0b193ba9f59e

## Installation
* Download and install the signed .xpi from [release page](https://github.com/hkalbertl/web-image-categorizer/releases) by using the [official instructions](https://extensionworkshop.com/documentation/publish/distribute-sideloading/#install-addon-from-file).
* (Coming soon) Install it from official FireFox add-on site.

## Usage / Options
Please check the [Wiki](https://github.com/hkalbertl/web-image-categorizer/wiki) for more information.

## Terms of Use
Thank you for using Web Image Categorizer. By using this add-on, you agree to the following terms:

* Usage:
  * You may use this add-on to save images to FileLu.
  * You, the user, are responsible for ensuring that your use of this add-on complies with all applicable laws and regulations.
* Prohibited Activities:
  * You may not use this add-on to download, save, or distribute illegal, copyrighted, or offensive images.
  * Any misuse of this add-on, including but not limited to downloading illegal content, is strictly prohibited.
* Disclaimer:
  * This add-on is provided "as is" without warranty of any kind, either express or implied.
  * The author makes no representations or warranties regarding the functionality or reliability of this add-on.
* Limitation of Liability:
  * The author shall not be liable for any damages arising out of or in connection with the use or inability to use this add-on. This includes, without limitation, direct, indirect, incidental, or consequential damages.
* Privacy:
  * This add-on does not track user activities or submit any data to third parties.
  * Your usage data and any information related to the images you save are not collected or shared.
* Modifications:
  * The author reserves the right to modify these terms at any time. Any changes will be updated in the README page.

## Limitations
* WIC uses the [context menu](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Context_menu_items) API to detect images with the [images](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/ContextType) context type. It may not work on images that are protected by security measures, such as webpages with right-click disabled or images covered by other HTML elements.
* WIC currently supports image URLs with the standard `https://*` and `data:image/*` formats. URLs like `blob:*` are not supported.

## License
Licensed under the [MIT](http://www.opensource.org/licenses/mit-license.php) license.
