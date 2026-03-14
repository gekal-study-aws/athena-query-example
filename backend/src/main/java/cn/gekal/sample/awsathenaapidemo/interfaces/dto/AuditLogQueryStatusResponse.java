package cn.gekal.sample.awsathenaapidemo.interfaces.dto;

import software.amazon.awssdk.services.athena.model.QueryExecutionState;

public class AuditLogQueryStatusResponse {
  private QueryExecutionState state;
  private Long dataScannedInBytes;

  public AuditLogQueryStatusResponse(QueryExecutionState state) {
    this.state = state;
  }

  public AuditLogQueryStatusResponse(QueryExecutionState state, Long dataScannedInBytes) {
    this.state = state;
    this.dataScannedInBytes = dataScannedInBytes;
  }

  public QueryExecutionState getState() {
    return state;
  }

  public void setState(QueryExecutionState state) {
    this.state = state;
  }

  public Long getDataScannedInBytes() {
    return dataScannedInBytes;
  }

  public void setDataScannedInBytes(Long dataScannedInBytes) {
    this.dataScannedInBytes = dataScannedInBytes;
  }
}
