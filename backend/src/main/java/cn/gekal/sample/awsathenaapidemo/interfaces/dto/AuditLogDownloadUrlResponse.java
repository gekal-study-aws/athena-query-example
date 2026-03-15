package cn.gekal.sample.awsathenaapidemo.interfaces.dto;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "CSVダウンロードURLのレスポンス")
public class AuditLogDownloadUrlResponse {
  @Schema(description = "S3からファイルをダウンロードするためのプリサインドURL", example = "https://s3.amazonaws.com/...")
  private String downloadUrl;

  public AuditLogDownloadUrlResponse(String downloadUrl) {
    this.downloadUrl = downloadUrl;
  }

  public String getDownloadUrl() {
    return downloadUrl;
  }

  public void setDownloadUrl(String downloadUrl) {
    this.downloadUrl = downloadUrl;
  }
}
