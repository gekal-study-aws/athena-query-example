package cn.gekal.sample.awsathenaapidemo.interfaces.controller;

import cn.gekal.sample.awsathenaapidemo.application.service.AthenaQueryService;
import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogDownloadUrlResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryRequest;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryResultResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryStatusResponse;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
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
    StringBuilder sqlBuilder = new StringBuilder();
    sqlBuilder.append(
        String.format(
            "SELECT * FROM audit_log_db.audit_logs WHERE year = '%s' AND month = '%s' AND day = '%s'",
            request.getYear(), request.getMonth(), request.getDay()));

    if (request.getUserId() != null && !request.getUserId().trim().isEmpty()) {
      sqlBuilder.append(String.format(" AND user_id = '%s'", request.getUserId()));
    }

    String queryExecutionId = athenaQueryService.submitQuery(sqlBuilder.toString());

    return new AuditLogQueryResponse(queryExecutionId);
  }

  /** 2. 実行結果のチェック */
  @GetMapping("/status/{queryExecutionId}")
  public AuditLogQueryStatusResponse getQueryStatus(@PathVariable String queryExecutionId) {
    return athenaQueryService.getQueryStatus(queryExecutionId);
  }

  /** 3. チェック結果の取得 */
  @GetMapping("/results/{queryExecutionId}")
  public AuditLogQueryResultResponse getQueryResults(
      @PathVariable String queryExecutionId,
      @RequestParam(required = false) String nextToken,
      @RequestParam(required = false) Integer maxResults) {
    return athenaQueryService.getQueryResults(queryExecutionId, nextToken, maxResults);
  }

  /** 4. チェック結果の取得（ストリーミング） */
  @GetMapping("/results-stream/{queryExecutionId}")
  public ResponseBodyEmitter getQueryResultsStream(@PathVariable String queryExecutionId) {
    ResponseBodyEmitter emitter = new ResponseBodyEmitter();
    try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
      executor.execute(
          () -> {
            try {
              athenaQueryService.getQueryResultsStream(
                  queryExecutionId,
                  auditLog -> {
                    try {
                      emitter.send(auditLog);
                    } catch (Exception e) {
                      throw new RuntimeException(e);
                    }
                  });
              emitter.complete();
            } catch (Exception e) {
              emitter.completeWithError(e);
            } finally {
              executor.shutdown();
            }
          });
      return emitter;
    }
  }

  /** 5. ダウンロードURLの取得 */
  @GetMapping("/download-url/{queryExecutionId}")
  public AuditLogDownloadUrlResponse getDownloadUrl(@PathVariable String queryExecutionId) {
    String downloadUrl = athenaQueryService.getDownloadUrl(queryExecutionId);
    return new AuditLogDownloadUrlResponse(downloadUrl);
  }
}
