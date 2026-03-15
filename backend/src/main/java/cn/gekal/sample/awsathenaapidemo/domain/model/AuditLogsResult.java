package cn.gekal.sample.awsathenaapidemo.domain.model;

import java.util.List;

public class AuditLogsResult {
  private List<AuditLog> results;
  private Integer count;

  public AuditLogsResult(List<AuditLog> results, String nextToken) {
    this.results = results;
    this.count = results == null ? 0 : results.size();
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
}
