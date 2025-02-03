/**
 * The FileLu API.
 * @link https://filelu.com/pages/api/
 */
const FILELU = {
  /**
     * The FileLu API URL.
     */
  API_URL: 'https://filelu.com/api/',
  /**
   * Validate the spcified API Key.
   * @param {string} apiKey
   */
  validateApiKey: async function (apiKey: string) {
    let error: string | null = null;
    try {
      // Test API key
      const resp = await fetch(`${FILELU.API_URL}account/info`, {
        method: 'POST',
        body: new URLSearchParams({ key: apiKey })
      });
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // Set success result
          return;
        } else if (400 === json.status) {
          // Invalid key
          error = `Error occurred during validation (status: ${json.status}): ${json.msg}`;
        } else {
          // Unknown status
          error = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${ex}`;
    }
    throw error;
  },
  /**
   * Get the list of sub-folder by specified folder ID.
   * @param {string} apiKey
   * @param {number} folderId
   * @returns { Promise<Array<any>>} Array of sub-folder.
   */
  getFolderList: async function (apiKey: string, folderId: number): Promise<Array<any>> {
    let error: string | null = null;
    try {
      // Get folder list
      const resp = await fetch(`${FILELU.API_URL}folder/list?fld_id=${folderId}&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (json.result && Array.isArray(json.result.folders)) {
          // Folder array found, sort it
          const folderList = json.result.folders;
          folderList.sort((a: { name: string; }, b: { name: string; }) => Intl.Collator().compare(a.name, b.name));
          return folderList;
        } else {
          // Unknown status
          error = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${ex}`;
    }
    throw error;
  },
  /**
   * Create sub-folder under specified folder ID.
   * @param {string} apiKey FileLu API key.
   * @param {number} parentId Parent folder ID.
   * @param {string} folderName The folder name to be created.
   * @returns {Promise<number>} The folder ID of created folder.
   */
  createFolder: async function (apiKey: string, parentId: number, folderName: string): Promise<number> {
    let error: string | null = null;
    try {
      // Create new folder
      const resp = await fetch(`${FILELU.API_URL}folder/create?parent_id=${parentId}&name=${encodeURIComponent(folderName)}&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // Return new folder ID
          return json.result.fld_id;
        } else {
          // Unknown status
          error = `Failed to create folder (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${ex}`;
    }
    throw error;
  },
  /**
   * Get of create sub-folder under specified folder ID.
   * @param {string} apiKey FileLu API key.
   * @param {number} parentId Parent folder ID.
   * @param {string} folderName The folder name to be retrieved / created.
   * @returns {Promise<number>} Folder ID.
   */
  getOrCreateFolder: async function (apiKey: string, parentId: number, folderName: string): Promise<number> {
    let error: string | null = null;
    try {
      // Get folder list
      const folderList = await FILELU.getFolderList(apiKey, parentId);

      // Find target folder by name
      const targetFolder = folderList.find(item => item.name === folderName);
      if (targetFolder) {
        // Folder found, return its ID
        return targetFolder.fld_id;
      } else {
        // Create new folder
        return await FILELU.createFolder(apiKey, parentId, folderName);
      }
    }
    catch (ex) {
      // Unknown error?
      error = `Unknown error: ${ex}`;
    }
    throw error;
  },
  /**
   * Upload file in blob format to specified directory path and name.
   * @param apiKey FileLu API key.
   * @param directory Directory path, such as `/Web/Image/`.
   * @param fileName File name, such as `20241231_01.jpg`.
   * @param fileBlob The file content in blob format.
   * @returns The FileLu file code.
   */
  uploadFileToDirectory: async function (apiKey: any, directory: string, fileName: string, fileBlob: Blob): Promise<string> {
    // Upload to FileLu, get target directory
    let level = 0, folderId = 0, parentId = folderId, isCreateMode = false;
    const segments = directory.substring(1).split('/');
    console.debug(`Look for the folder ID of saving path: ${segments.length}`);

    for (const segment of segments) {
      // Try to get directory list if not create mode
      if (!isCreateMode) {
        // Get folder list at current level
        const subFolderList = await FILELU.getFolderList(apiKey, parentId);
        if (subFolderList && subFolderList.length) {
          const targetFolder = subFolderList.find(item => item.name === segment);
          if (targetFolder) {
            // Target found
            parentId = targetFolder.fld_id;
            console.debug(`${level++}) Folder "${segment}" found: ${parentId}`);
            continue;
          }
        }
      }
      // Target directory is not found, create it
      parentId = await FILELU.createFolder(apiKey, parentId, segment);
      console.debug(`${level++}) Folder "${segment}" created: ${parentId}`);
      // Enable create mode
      isCreateMode = true;
    }
    // Use the final parent ID as folder ID
    folderId = parentId;

    // Upload file
    const fileCode = await FILELU.uploadFile(apiKey, fileName, fileBlob);

    // Set folder
    if (folderId) {
      await FILELU.setFileFolder(apiKey, fileCode, folderId);
    }

    // All done
    console.info(`Image uploaded to FileLu successfully! ${directory}/${fileName}`);
    return fileCode;
  },
  /**
   * Upload a file with blob content.
   * @param {string} apiKey
   * @param {string} fileName
   * @param {Blob} fileBlob
   * @returns {Promise<string>} File code.
   */
  uploadFile: async function (apiKey: any, fileName: string | undefined, fileBlob: Blob): Promise<string> {
    let error: string | null = null;
    try {
      // Get upload server info
      let serverUrl = null, sessionId = null;
      let resp = await fetch(`${FILELU.API_URL}upload/server?key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          serverUrl = json.result;
          sessionId = json.sess_id;
        } else {
          // Unknown status
          error = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
      if (serverUrl && sessionId) {
        // Prepare post data
        const formData = new FormData();
        formData.append('sess_id', sessionId);
        formData.append('utype', 'prem');
        formData.append('file_0', fileBlob, fileName);

        // Upload to server
        resp = await fetch(serverUrl, {
          method: "POST",
          body: formData,
        });
        if (resp.ok) {
          // HTTP OK! Parse as JSON
          const json = await resp.json();
          if (Array.isArray(json) && json.length && json[0].file_code) {
            // Uploaded successfully, return File Code
            return json[0].file_code;
          } else {
            // Unknown response
            error = `Unknown response from server: ${JSON.stringify(json)}`;
          }
        } else {
          // Network error?
          const msg = await resp.text();
          error = `Network error: ${msg}`;
        }
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${ex}`;
    }
    throw error;
  },
  /**
   * Set the folder of file by file code.
   * @param {string} apiKey
   * @param {string} fileCode
   * @param {number} folderId
   */
  setFileFolder: async function (apiKey: string, fileCode: string, folderId: number) {
    let error: string | null = null;
    try {
      // Set folder
      const resp = await fetch(`${FILELU.API_URL}file/set_folder?file_code=${fileCode}&fld_id=${folderId}&key=${apiKey}`);
      if (resp.ok) {
        // HTTP OK! Parse as JSON
        const json = await resp.json();
        if (200 === json.status) {
          // Folder changed
          console.info('Folder assigned to new upload image');
          return;
        } else {
          // Unknown status
          error = `Unknown response from server (status: ${json.status}): ${json.msg}`;
        }
      } else {
        // Network error?
        const msg = await resp.text();
        error = `Network error: ${msg}`;
      }
    } catch (ex) {
      // Unknown error?
      error = `Unknown error: ${ex}`;
    }
    throw error;
  }
};

export default FILELU;
