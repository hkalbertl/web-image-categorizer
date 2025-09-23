import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { XMLParser } from "fast-xml-parser";
import { getErrorMessage } from "@/utils/common";
import StorageProvider from "./StorageProvider";

export default class AwsS3Api implements StorageProvider {

  private static readonly S3_PROTOCOL = "https";

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
    // Build the path
    const bodyData = await data.arrayBuffer();
    let path: string = directory.replace(/[\/]+$/g, '');
    path += `/${fileName}`;
    path = path.replace(/^[\/]+/g, '');

    // Create signature and sign the request
    const signer = this.createSignature();
    const request = new HttpRequest({
      protocol: AwsS3Api.S3_PROTOCOL,
      hostname: this.hostName,
      method: 'PUT',
      path,
      body: bodyData,
    });
    const signed = await signer.sign(request);

    const res = await fetch(`${signed.protocol}//${signed.hostname}${signed.path}`, {
      method: signed.method,
      headers: signed.headers,
      body: bodyData,
    });
    if (!res.ok) {
      const httpResponseText = await res.text();
      throw new Error(`[Status=${res.status}]: ${httpResponseText}`);
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

  listBuckets = async (): Promise<string[]> => {
    const res = await this.makeListBucketsRequest();
    const rawXml = await res.text();
    const parser = new XMLParser();
    const result = parser.parse(rawXml);
    const buckets = result?.ListAllMyBucketsResult?.Buckets?.Bucket || [];
    return Array.isArray(buckets) ? buckets.map((b) => b.Name) : [buckets.Name];
  };
}
