package cn.gekal.sample.awsathenaapidemo.interfaces.dto;

public class AuditLogQueryResponse {
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
