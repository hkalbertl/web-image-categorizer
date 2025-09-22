import i18n from "../i18n";
import { getErrorMessage } from "@/utils/common";
import StorageProvider from "./StorageProvider";

export default class FileLuApi implements StorageProvider {

  private static readonly API_BASE_URL = 'https://filelu.com/api/';

  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey || !apiKey.trim().length) {
      throw new Error(i18n.t('fileLuApiKeyMandatory'));
    }
    this.apiKey = apiKey;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Test API key by getting account info
      const res = await fetch(`${FileLuApi.API_BASE_URL}account/info`, {
        method: 'POST',
        body: new URLSearchParams({ key: this.apiKey })
      });
      if (res.ok) {
        // HTTP OK! Parse as JSON
        const json = await res.json();
        if (200 === json.status) {
          // Set success result
          return true;
        } else if (403 === json.status || 400 === json.status) {
          // Invalid key
          throw `Error occurred during validation (status: ${json.status}): ${json.msg}`;
        } else {
          // Unknown status
          throw `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      }
    } catch (ex) {
      // Unknown error
      console.error(getErrorMessage(ex));
    }
    return false;
  }

  uploadFile = async (directory: string, fileName: string, fileBlob: Blob): Promise<string> => {
    // Upload to FileLu, get target directory
    let level = 0, folderId = 0, parentId = folderId, isCreateMode = false;
    const segments = directory.substring(1).split('/');
    console.debug(`Look for the folder ID of saving path: ${segments.length}`);

    for (const segment of segments) {
      // Try to get directory list if not create mode
      if (!isCreateMode) {
        // Get folder list at current level
        const subFolderList = await this.getFolderList(parentId);
        if (subFolderList && subFolderList.length) {
          const lowerCaseSegment = segment.toLowerCase();
          const targetFolder = subFolderList.find(item => item.name.toLowerCase() === lowerCaseSegment);
          if (targetFolder) {
            // Target found
            parentId = targetFolder.fld_id;
            console.debug(`${level++}) Folder "${segment}" found: ${parentId}`);
            continue;
          }
        }
      }
      // Target directory is not found, create it
      parentId = await this.createFolder(parentId, segment);
      console.debug(`${level++}) Folder "${segment}" created: ${parentId}`);
      // Enable create mode
      isCreateMode = true;
    }
    // Use the final parent ID as folder ID
    folderId = parentId;

    // Upload file
    const fileCode = await this.uploadFileToServer(fileName, fileBlob);

    // Set folder
    if (folderId) {
      await this.setFileFolder(fileCode, folderId);
    }

    // All done
    console.info(`Image uploaded to FileLu successfully! ${directory}/${fileName}`);
    return fileCode;
  }

  /**
   * Get the list of sub-folder by specified folder ID.
   * @param {number} folderId
   * @returns { Promise<Array<any>>} Array of sub-folder.
   */
  private getFolderList = async (folderId: number): Promise<Array<any>> => {
    let errorMsg: string;
    try {
      // Get folder list
      const res = await fetch(`${FileLuApi.API_BASE_URL}folder/list?fld_id=${folderId}&key=${this.apiKey}`);
      if (res.ok) {
        // HTTP OK! Parse as JSON
        const json = await res.json();
        if (json.result && Array.isArray(json.result.folders)) {
          // Folder array found, sort it
          const folderList = json.result.folders;
          folderList.sort((a: { name: string; }, b: { name: string; }) => Intl.Collator().compare(a.name, b.name));
          return folderList;
        } else {
          // Unknown status
          errorMsg = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await res.text();
        errorMsg = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      errorMsg = `Unknown error: ${ex}`;
    }
    throw new Error(errorMsg);
  }

  /**
   * Create sub-folder under specified folder ID.
   * @param {number} parentId Parent folder ID.
   * @param {string} folderName The folder name to be created.
   * @returns {Promise<number>} The folder ID of created folder.
   */
  private createFolder = async (parentId: number, folderName: string): Promise<number> => {
    let errorMsg: string | undefined = undefined;
    try {
      // Create new folder
      const res = await fetch(`${FileLuApi.API_BASE_URL}folder/create?parent_id=${parentId}&name=${encodeURIComponent(folderName)}&key=${this.apiKey}`);
      if (res.ok) {
        // HTTP OK! Parse as JSON
        const json = await res.json();
        if (200 === json.status) {
          // Return new folder ID
          return json.result.fld_id;
        } else {
          // Unknown status
          errorMsg = `Failed to create folder (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await res.text();
        errorMsg = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      errorMsg = `Unknown error: ${ex}`;
    }
    throw errorMsg;
  };

  /**
   * Upload a file with blob content.
   * @param {string} fileName
   * @param {Blob} fileBlob
   * @returns {Promise<string>} File code.
   */
  private uploadFileToServer = async (fileName: string | undefined, fileBlob: Blob): Promise<string> => {
    let errorMsg: string | undefined = undefined;
    try {
      // Get upload server info
      let serverUrl = null, sessionId = null;
      let res = await fetch(`${FileLuApi.API_BASE_URL}upload/server?key=${this.apiKey}`);
      if (res.ok) {
        // HTTP OK! Parse as JSON
        const json = await res.json();
        if (200 === json.status) {
          serverUrl = json.result;
          sessionId = json.sess_id;
        } else {
          // Unknown status
          errorMsg = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await res.text();
        errorMsg = `Network error: ${msg}`;
      }
      if (serverUrl && sessionId) {
        // Prepare post data
        const formData = new FormData();
        formData.append('sess_id', sessionId);
        formData.append('utype', 'prem');
        formData.append('file_0', fileBlob, fileName);

        // Upload to server
        res = await fetch(serverUrl, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          // HTTP OK! Parse as JSON
          const json = await res.json();
          if (Array.isArray(json) && json.length && json[0].file_code) {
            // Uploaded successfully, return File Code
            return json[0].file_code;
          } else {
            // Unknown response
            errorMsg = `Unknown response from server: ${JSON.stringify(json)}`;
          }
        } else {
          // Network error?
          const msg = await res.text();
          errorMsg = `Network error: ${msg}`;
        }
      }
    } catch (ex) {
      // Unknown error?
      errorMsg = `Unknown error: ${ex}`;
    }
    throw new Error(errorMsg);
  }

  private setFileFolder = async (fileCode: string, folderId: number) => {
    let errorMsg: string | undefined = undefined;
    try {
      // Set folder
      const res = await fetch(`${FileLuApi.API_BASE_URL}file/set_folder?file_code=${fileCode}&fld_id=${folderId}&key=${this.apiKey}`);
      if (res.ok) {
        // HTTP OK! Parse as JSON
        const json = await res.json();
        if (200 === json.status) {
          // Folder changed
          console.info('Folder assigned to new upload image');
          return;
        } else {
          // Unknown status
          errorMsg = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await res.text();
        errorMsg = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      errorMsg = `Unknown error: ${ex}`;
    }
    throw errorMsg;
  }
}
