package cn.gekal.sample.awsathenaapidemo.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "クエリ実行IDのレスポンス")
public class AuditLogQueryResponse {
  @Schema(description = "クエリ実行ID", example = "abc-123-def")
  private String queryExecutionId;

  public AuditLogQueryResponse(String queryExecutionId) {
    this.queryExecutionId = queryExecutionId;
  }

  public String getQueryExecutionId() {
    return queryExecutionId;
  }

  public void setQueryExecutionId(String queryExecutionId) {
    this.queryExecutionId = queryExecutionId;
  }
}
