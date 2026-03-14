package cn.gekal.sample.awsathenaapidemo.interfaces.dto;
import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import java.util.List;

public class AuditLogQueryResultResponse {
  private List<AuditLog> results;
  private String nextToken;

  public AuditLogQueryResultResponse(List<AuditLog> results, String nextToken) {
    this.results = results;
    this.nextToken = nextToken;
  }

  public List<AuditLog> getResults() {
    return results;
  }

  public void setResults(List<AuditLog> results) {
    this.results = results;
  }

  public String getNextToken() {
    return nextToken;
  }

  public void setNextToken(String nextToken) {
    this.nextToken = nextToken;
  }
}
