package cn.gekal.sample.awsathenaapidemo.domain.repository;

import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import java.util.List;
import java.util.function.Consumer;
import software.amazon.awssdk.services.athena.model.QueryExecutionState;

public interface AthenaQueryRepository {
  String submitQuery(String queryString);

  QueryExecutionState getQueryStatus(String queryExecutionId);

  List<AuditLog> getQueryResults(String queryExecutionId);

  void getQueryResultsStream(String queryExecutionId, Consumer<AuditLog> consumer);

  String getDownloadUrl(String queryExecutionId);
}
