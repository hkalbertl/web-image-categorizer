import { S3Client, HeadBucketCommand, ListBucketsCommand, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import StorageProvider from './StorageProvider';

export default class AwsS3Api implements StorageProvider {

  /**
   * Create new AWS S3 API client.
   */
  constructor(
    private accessId: string,
    private secretKey: string,
    private hostName: string,
    private bucketName?: string,
    private region?: string,
    private usePathStyle?: boolean
  ) { }

  async validateCredentials(): Promise<boolean> {
    const s3Client = this.createS3Client();

    // Validate credentials by using HEAD bucket command first
    try {
      const command = new HeadBucketCommand({ Bucket: this.bucketName });
      await s3Client.send(command);

      return true;
    } catch (ex) {
      // Unknown error
      console.error(getErrorMessage(ex));
    }

    // When HEAD bucket command failed, try list bucket
    try {
      const command = new ListBucketsCommand({});
      await s3Client.send(command)

      return true;
    } catch (ex) {
      // Unknown error
      console.error(getErrorMessage(ex));
    }

    return false;
  }

  async uploadFile(directory: string, fileName: string, description: string | undefined, data: Blob): Promise<string> {
    let path = '';
    try {
      path = directory.replace(/[\/]+$/g, '');
      path += `/${fileName}`;
      path = path.replace(/^[\/]+/g, '');

      const bodyData = new Uint8Array(await data.arrayBuffer());;
      const putParams: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: path,
        ContentType: data.type,
        Body: bodyData
      };
      if (description) {
        putParams.Metadata = {
          description
        };
      }

      // Upload file
      const s3Client = this.createS3Client();
      const command = new PutObjectCommand(putParams);
      await s3Client.send(command);
    } catch (ex) {
      throw new Error(`Failed to upload file: ${getErrorMessage(ex)}`);
    }
    return path;
  }

  private createS3Client() {
    return new S3Client({
      region: this.region || 'auto',
      endpoint: `https://${this.hostName}`,
      credentials: {
        accessKeyId: this.accessId,
        secretAccessKey: this.secretKey
      },
      forcePathStyle: this.usePathStyle,
    });
  }
}
