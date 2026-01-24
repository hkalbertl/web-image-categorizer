import AwsS3SmithyApi from "./AwsS3SmithyApi";

export default class FileLuS5Api extends AwsS3SmithyApi {

  private static readonly S5_HOSTNAME = "s5lu.com";
  private static readonly S5_REGION = "global";

  constructor(
    accessId: string,
    secretKey: string,
  ) {
    super(accessId, secretKey, FileLuS5Api.S5_HOSTNAME, FileLuS5Api.S5_REGION);
  }
}
