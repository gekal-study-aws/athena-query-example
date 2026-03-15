package cn.gekal.sample.awsathenaapidemo.domain.model;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

@Schema(description = "監査ログの情報")
public class AuditLog {
  @Schema(description = "年", example = "2026")
  private String year;

  @Schema(description = "月", example = "03")
  private String month;

  @Schema(description = "日", example = "15")
  private String day;

  @Schema(description = "ユーザーID", example = "user_001")
  private String userId;

  @Schema(description = "イベント名", example = "Login")
  private String eventName;

  @Schema(description = "リソースID", example = "res-123")
  private String resourceId;

  @Schema(description = "IPアドレス", example = "192.168.1.1")
  private String ipAddress;

  @Schema(description = "タイムスタンプ", example = "2026-03-15T10:00:00Z")
  private String timestamp;

  @Schema(description = "ステータス", example = "SUCCESS")
  private String status;

  @Schema(description = "その他の詳細情報")
  private Map<String, String> otherDetails;

  public String getYear() {
    return year;
  }

  public void setYear(String year) {
    this.year = year;
  }

  public String getMonth() {
    return month;
  }

  public void setMonth(String month) {
    this.month = month;
  }

  public String getDay() {
    return day;
  }

  public void setDay(String day) {
    this.day = day;
  }

  public String getUserId() {
    return userId;
  }

  public void setUserId(String userId) {
    this.userId = userId;
  }

  public String getEventName() {
    return eventName;
  }

  public void setEventName(String eventName) {
    this.eventName = eventName;
  }

  public String getResourceId() {
    return resourceId;
  }

  public void setResourceId(String resourceId) {
    this.resourceId = resourceId;
  }

  public String getIpAddress() {
    return ipAddress;
  }

  public void setIpAddress(String ipAddress) {
    this.ipAddress = ipAddress;
  }

  public String getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(String timestamp) {
    this.timestamp = timestamp;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public Map<String, String> getOtherDetails() {
    return otherDetails;
  }

  public void setOtherDetails(Map<String, String> otherDetails) {
    this.otherDetails = otherDetails;
  }
}
