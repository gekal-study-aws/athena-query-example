package cn.gekal.sample.awsathenaapidemo.controller;

import cn.gekal.sample.awsathenaapidemo.services.AthenaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/athena")
public class AthenaController {

    private final AthenaService athenaService;

    public AthenaController(AthenaService athenaService) {
        this.athenaService = athenaService;
    }

    @GetMapping("/search")
    public List<List<String>> search(@RequestParam String keyword) {
        // SQLインジェクション対策のため、実運用ではPreparedStatement的な処理や入力値チェックを推奨
        // ここでは例として単純なSELECT文を構築
        String sql = "SELECT * FROM your_table WHERE column_name = '" + keyword + "' LIMIT 10";

        try {
            return athenaService.executeQuery(sql);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Query interrupted", e);
        }
    }
}
