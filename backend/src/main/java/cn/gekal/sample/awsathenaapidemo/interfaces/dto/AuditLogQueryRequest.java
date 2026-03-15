package cn.gekal.sample.awsathenaapidemo.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "監査ログ検索リクエスト")
public class AuditLogQueryRequest {
  @Schema(description = "検索対象の年 (yyyy)", example = "2026")
  private String year;

  @Schema(description = "検索対象の月 (mm)", example = "01")
  private String month;

  @Schema(description = "検索対象の日 (dd)", example = "01")
  private String day;

  @Schema(description = "ユーザーID (未指定の場合は全ユーザー)", example = "user_001")
  private String userId;

  public boolean isUserSpecified() {
    return userId != null && !userId.trim().isEmpty();
  }

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
}
