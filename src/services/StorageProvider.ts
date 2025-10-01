/**
 * Interface for storage provider classes/
 */
export default interface StorageProvider {
  /**
   * Validate the credentials defined in API client's constructor.
   */
  validateCredentials(): Promise<boolean>;
  /**
   * Upload file in blob format to specified directory and file name.
   * @param directory Target directory that started with slash. Such as `/path/to/directory`.
   * @param fileName Target file name. Such as `MyImage-20250101.jpg`.
   * @param description Optional. File description.
   * @param fileBlob File content in blob format.
   */
  uploadFile(directory: string, fileName: string, description: string | undefined, fileBlob: Blob): Promise<string>;
}
