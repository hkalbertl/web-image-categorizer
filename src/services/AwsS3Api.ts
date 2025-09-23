import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { XMLParser } from "fast-xml-parser";
import { getErrorMessage } from "@/utils/common";
import StorageProvider from "./StorageProvider";

export default class AwsS3Api implements StorageProvider {

  private static readonly S3_PROTOCOL = "https";

  /**
   * Create new AWS S3 API client.
   */
  constructor(
    private accessId: string,
    private secretKey: string,
    private hostName: string,
    private region?: string,
  ) { }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await this.makeListBucketsRequest();
      return res.ok;
    } catch (ex) {
      // Unknown error
      console.error(getErrorMessage(ex));
    }
    return false;
  }

  async uploadFile(directory: string, fileName: string, data: Blob): Promise<string> {
    // Build the path, removing the tail slashes
    // For AWS S3, the immedicate directory at root directory is the bucket name
    let path: string = directory.replace(/[\/]+$/g, '');
    // Append file name at the end of path
    path += `/${fileName}`;
    // Remove the head slash(es)
    path = path.replace(/^[\/]+/g, '');
    // The final path should be something like: bucket-name/path/to/directory/filename.jpg

    // Create signature and sign the request
    const signer = this.createSignature();
    const bodyData = await data.arrayBuffer();
    const request = new HttpRequest({
      protocol: AwsS3Api.S3_PROTOCOL,
      hostname: this.hostName,
      method: 'PUT',
      path,
      body: bodyData,
    });
    const signed = await signer.sign(request);

    // Send the request with signed headers
    const res = await fetch(`${signed.protocol}//${signed.hostname}${signed.path}`, {
      method: signed.method,
      headers: signed.headers,
      body: signed.body,
    });
    if (!res.ok) {
      // Try to extract the error message in response content
      const rawContent = await res.text(), xmlError = this.extractXmlError(rawContent);
      throw new Error(`[Status=${res.status}]: ${xmlError || rawContent}`);
    }
    return path;
  }

  /**
   * Create signature V4 used for S3 requests.
   */
  private createSignature = () => {
    return new SignatureV4({
      credentials: {
        accessKeyId: this.accessId,
        secretAccessKey: this.secretKey,
      },
      region: this.region || '',
      service: "s3",
      sha256: Sha256,
    });
  }

  /**
   * Create and send signed request to S3 server.
   * @param path The target file path, included bucket name. Such as `TestS3/Inner/Sub/image4.jpg`.
   * @param query Optional. Additional query string parameters.
   * @param method Optional HTTP request method. Default is `GET`.
   * @returns The HTTP response object.
   */
  makeSignedRequest = async (path: string, query?: Record<string, string>, method: string = 'GET') => {
    // Create signature and sign the request
    const signer = this.createSignature();
    const request = new HttpRequest({
      protocol: AwsS3Api.S3_PROTOCOL,
      hostname: this.hostName,
      method,
      path,
      query,
    });
    const signed = await signer.sign(request);

    // Build the request URL
    let url = `${signed.protocol}//${signed.hostname}${signed.path}`;
    if (query && signed.query) {
      url += `?${new URLSearchParams(
        signed.query as Record<string, string>
      ).toString()}`;
    }

    // Submit request by fetch
    return await fetch(url, {
      method: signed.method,
      headers: signed.headers,
    });
  };

  private makeListBucketsRequest = async (): Promise<Response> => {
    return await this.makeSignedRequest("/", { "x-id": "ListBuckets" });
  };

  /**
   * List all available buckets.
   * @returns The bucket names as string array.
   */
  listBuckets = async (): Promise<string[] | undefined> => {
    const res = await this.makeListBucketsRequest();
    const rawContent = await res.text();
    if (res.ok) {
      // Response OK! Parse XML content
      const parser = new XMLParser();
      const result = parser.parse(rawContent);
      const buckets = result?.ListAllMyBucketsResult?.Buckets?.Bucket || [];
      return Array.isArray(buckets) ? buckets.map((b) => b.Name) : [buckets.Name];
    } else {
      // Try to extract the error message in response content
      const xmlError = this.extractXmlError(rawContent);
      throw new Error(`[Status=${res.status}]: ${xmlError || rawContent}`);
    }
  };

  /**
   * Extract the error message from AWS S3 response.
   * @param rawXml AWS S3 response XML.
   * @returns The extracted error message, or undefined when failed.
   */
  private extractXmlError = (rawXml: string): string | undefined => {
    try {
      const parser = new XMLParser({ ignoreDeclaration: true });
      const parsed = parser.parse(rawXml);
      if (parsed?.Error?.Message) {
        return parsed?.Error?.Message as string;
      }
    } catch (ex) {
      console.error(`Failed to extract XML error: ${getErrorMessage(ex)}`);
    }
    return undefined;
  };
}
