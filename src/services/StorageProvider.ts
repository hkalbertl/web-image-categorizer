export default interface StorageProvider {
  validateCredentials(): Promise<boolean>;
  uploadFile(directory: string, fileName: string, fileBlob: Blob): Promise<string>;
}
