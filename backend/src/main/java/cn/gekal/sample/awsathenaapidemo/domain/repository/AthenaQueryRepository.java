package cn.gekal.sample.awsathenaapidemo.domain.repository;

import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryResultResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryStatusResponse;
import java.util.function.Consumer;

public interface AthenaQueryRepository {
  String submitQuery(String queryString);

  AuditLogQueryStatusResponse getQueryStatus(String queryExecutionId);

  AuditLogQueryResultResponse getQueryResults(
      String queryExecutionId, String nextToken, Integer maxResults);

  void getQueryResultsStream(String queryExecutionId, Consumer<AuditLog> consumer);

  String getDownloadUrl(String queryExecutionId);
}
