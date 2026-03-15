package cn.gekal.sample.awsathenaapidemo.interfaces.controller;

import cn.gekal.sample.awsathenaapidemo.application.service.AthenaQueryService;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogDownloadUrlResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryRequest;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryResultResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryStatusResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

@RestController
@RequestMapping("/api/athena")
@Tag(name = "Athena Query", description = "Athena を使用した監査ログの検索と結果取得 API")
public class AthenaController {

  private final AthenaQueryService athenaQueryService;

  public AthenaController(AthenaQueryService athenaQueryService) {
    this.athenaQueryService = athenaQueryService;
  }

  /** 1. 検索の発行 */
  @Operation(summary = "検索クエリの発行", description = "Athena に対して監査ログ検索用のクエリを発行します。")
  @PostMapping("/query")
  public AuditLogQueryResponse submitQuery(@RequestBody AuditLogQueryRequest request) {
    // 監査ログ検索用のSQLを構築
    String baseWhere =
        String.format(
            "WHERE year = '%s' AND month = '%s' AND day = '%s'",
            request.getYear(), request.getMonth(), request.getDay());

    if (request.getUserId() != null && !request.getUserId().trim().isEmpty()) {
      baseWhere += String.format(" AND user_id = '%s'", request.getUserId());
    }

    // トータル件数取得用のクエリとデータ取得用のクエリを結合（または個別に発行）
    // 効率のため、ウィンドウ関数を使用して1つのクエリでトータル件数も取得する
    String sql =
        String.format(
            "SELECT *, count(*) OVER() as full_count FROM audit_log_db.audit_logs %s", baseWhere);

    String queryExecutionId = athenaQueryService.submitQuery(sql);

    return new AuditLogQueryResponse(queryExecutionId);
  }

  /** 2. 実行結果のチェック */
  @Operation(summary = "クエリ実行ステータスの確認", description = "発行したクエリの実行状態、スキャンされたデータ量、トータル件数などを取得します。")
  @GetMapping("/status/{queryExecutionId}")
  public AuditLogQueryStatusResponse getQueryStatus(
      @Parameter(description = "クエリ実行ID") @PathVariable String queryExecutionId) {
    return athenaQueryService.getQueryStatus(queryExecutionId);
  }

  /** 3. チェック結果の取得 */
  @Operation(summary = "検索結果の取得", description = "クエリの実行結果をページネーション形式で取得します。")
  @GetMapping("/results/{queryExecutionId}")
  public AuditLogQueryResultResponse getQueryResults(
      @Parameter(description = "クエリ実行ID") @PathVariable String queryExecutionId,
      @Parameter(description = "次ページ取得用のトークン") @RequestParam(required = false) String nextToken,
      @Parameter(description = "1ページあたりの最大取得件数") @RequestParam(required = false)
          Integer maxResults) {
    return athenaQueryService.getQueryResults(queryExecutionId, nextToken, maxResults);
  }

  /** 4. チェック結果の取得（ストリーミング） */
  @Operation(
      summary = "検索結果の取得（ストリーミング）",
      description = "クエリの実行結果を JSON 形式でストリーミング取得します。各行は改行コードで区切られます。")
  @GetMapping("/download/{queryExecutionId}")
  public ResponseBodyEmitter getQueryResultsStream(
      @Parameter(description = "クエリ実行ID") @PathVariable String queryExecutionId) {
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
                      emitter.send("\n"); // 区切り文字として改行を送信
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
  @Operation(
      summary = "CSVダウンロードURLの取得",
      description = "Athena が S3 に出力した結果ファイルのプリサインド URL を取得します。")
  @GetMapping("/download/{queryExecutionId}/url")
  public AuditLogDownloadUrlResponse getDownloadUrl(
      @Parameter(description = "クエリ実行ID") @PathVariable String queryExecutionId) {
    String downloadUrl = athenaQueryService.getDownloadUrl(queryExecutionId);
    return new AuditLogDownloadUrlResponse(downloadUrl);
  }
}
