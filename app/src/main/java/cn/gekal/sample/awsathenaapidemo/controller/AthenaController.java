package cn.gekal.sample.awsathenaapidemo.controller;

import cn.gekal.sample.awsathenaapidemo.dto.AuditLogQueryRequest;
import cn.gekal.sample.awsathenaapidemo.services.AthenaService;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.athena.model.QueryExecutionState;

import java.util.List;

@RestController
@RequestMapping("/api/athena")
public class AthenaController {

    private final AthenaService athenaService;

    public AthenaController(AthenaService athenaService) {
        this.athenaService = athenaService;
    }

    /**
     * 1. 検索の発行
     */
    @PostMapping("/query")
    public String submitQuery(@RequestBody AuditLogQueryRequest request) {
        // 監査ログ検索用のSQLを構築
        String sql = String.format(
                "SELECT * FROM audit_log_db.audit_logs WHERE year = '%s' AND month = '%s' AND day = '%s' AND user_id = '%s' LIMIT 10",
                request.getYear(), request.getMonth(), request.getDay(), request.getUserId()
        );
        return athenaService.submitQuery(sql);
    }

    /**
     * 2. 実行結果のチェック
     */
    @GetMapping("/status/{queryExecutionId}")
    public QueryExecutionState getQueryStatus(@PathVariable String queryExecutionId) {
        return athenaService.getQueryStatus(queryExecutionId);
    }

    /**
     * 3. チェック結果の取得
     */
    @GetMapping("/results/{queryExecutionId}")
    public List<List<String>> getQueryResults(@PathVariable String queryExecutionId) {
        return athenaService.getQueryResults(queryExecutionId);
    }
}
