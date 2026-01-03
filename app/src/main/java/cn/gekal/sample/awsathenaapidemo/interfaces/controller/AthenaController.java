package cn.gekal.sample.awsathenaapidemo.interfaces.controller;

import cn.gekal.sample.awsathenaapidemo.application.service.AthenaQueryService;
import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogDownloadUrlResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryRequest;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryStatusResponse;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.athena.model.QueryExecutionState;

@RestController
@RequestMapping("/api/athena")
public class AthenaController {

  private final AthenaQueryService athenaQueryService;

  public AthenaController(AthenaQueryService athenaQueryService) {
    this.athenaQueryService = athenaQueryService;
  }

  /** 1. 検索の発行 */
  @PostMapping("/query")
  public AuditLogQueryResponse submitQuery(@RequestBody AuditLogQueryRequest request) {
    // 監査ログ検索用のSQLを構築
    String sql =
        String.format(
            "SELECT * FROM audit_log_db.audit_logs WHERE year = '%s' AND month = '%s' AND day = '%s' AND user_id = '%s' LIMIT 10",
            request.getYear(), request.getMonth(), request.getDay(), request.getUserId());

    String queryExecutionId = athenaQueryService.submitQuery(sql);

    return new AuditLogQueryResponse(queryExecutionId);
  }

  /** 2. 実行結果のチェック */
  @GetMapping("/status/{queryExecutionId}")
  public AuditLogQueryStatusResponse getQueryStatus(@PathVariable String queryExecutionId) {
    QueryExecutionState queryStatus = athenaQueryService.getQueryStatus(queryExecutionId);

    return new AuditLogQueryStatusResponse(queryStatus);
  }

  /** 3. チェック結果の取得 */
  @GetMapping("/results/{queryExecutionId}")
  public List<AuditLog> getQueryResults(@PathVariable String queryExecutionId) {
    return athenaQueryService.getQueryResults(queryExecutionId);
  }

  /** 4. ダウンロードURLの取得 */
  @GetMapping("/download-url/{queryExecutionId}")
  public AuditLogDownloadUrlResponse getDownloadUrl(@PathVariable String queryExecutionId) {
    String downloadUrl = athenaQueryService.getDownloadUrl(queryExecutionId);
    return new AuditLogDownloadUrlResponse(downloadUrl);
  }
}
