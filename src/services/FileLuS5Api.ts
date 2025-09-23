import AwsS3Api from "./AwsS3Api";

export default class FileLuS5Api extends AwsS3Api {

  private static readonly S5_HOSTNAME = "s5lu.com";
  private static readonly S5_REGION = "global";

  constructor(
    accessId: string,
    secretKey: string,
  ) {
    super(accessId, secretKey, FileLuS5Api.S5_HOSTNAME, FileLuS5Api.S5_REGION);
  }
}
