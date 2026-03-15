package cn.gekal.sample.awsathenaapidemo.interfaces.dto;

import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "クエリ実行結果のページネーションレスポンス")
public class AuditLogQueryResultResponse {
  @Schema(description = "検索結果のリスト")
  private List<AuditLog> results;

  @Schema(description = "現在のページに含まれる件数", example = "10")
  private Integer count;

  @Schema(description = "次ページ取得用のトークン。次ページがない場合は null")
  private String nextToken;

  public AuditLogQueryResultResponse(List<AuditLog> results, String nextToken) {
    this.results = results;
    this.count = results == null ? 0 : results.size();
    this.nextToken = nextToken;
  }

  public List<AuditLog> getResults() {
    return results;
  }

  public void setResults(List<AuditLog> results) {
    this.results = results;
  }

  public Integer getCount() {
    return count;
  }

  public void setCount(Integer count) {
    this.count = count;
  }

  public String getNextToken() {
    return nextToken;
  }

  public void setNextToken(String nextToken) {
    this.nextToken = nextToken;
  }
}
