package cn.gekal.sample.awsathenaapidemo.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import software.amazon.awssdk.services.athena.model.QueryExecutionState;

@Schema(description = "クエリ実行ステータスのレスポンス")
public class AuditLogQueryStatusResponse {
  @Schema(description = "クエリの実行状態")
  private QueryExecutionState state;

  @Schema(description = "スキャンされたデータ量（バイト）", example = "1024")
  private Long dataScannedInBytes;

  @Schema(description = "検索結果の総件数", example = "100")
  private Long totalRowCount;

  public AuditLogQueryStatusResponse(QueryExecutionState state) {
    this.state = state;
  }

  public AuditLogQueryStatusResponse(
      QueryExecutionState state, Long dataScannedInBytes, Long totalRowCount) {
    this.state = state;
    this.dataScannedInBytes = dataScannedInBytes;
    this.totalRowCount = totalRowCount;
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

  public Long getTotalRowCount() {
    return totalRowCount;
  }

  public void setTotalRowCount(Long totalRowCount) {
    this.totalRowCount = totalRowCount;
  }
}
