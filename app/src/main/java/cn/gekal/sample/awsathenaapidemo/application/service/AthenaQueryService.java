package cn.gekal.sample.awsathenaapidemo.application.service;

import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import cn.gekal.sample.awsathenaapidemo.infrastructure.client.AthenaQueryClient;
import java.util.List;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.athena.model.QueryExecutionState;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Service
public class AthenaQueryService {

  private final AthenaQueryClient athenaClient;

  public AthenaQueryService(AthenaQueryClient athenaClient, S3Presigner s3Presigner) {
    this.athenaClient = athenaClient;
  }

  public String submitQuery(String queryString) {

    return athenaClient.submitQuery(queryString);
  }

  public QueryExecutionState getQueryStatus(String queryExecutionId) {

    return athenaClient.getQueryStatus(queryExecutionId);
  }

  public List<AuditLog> getQueryResults(String queryExecutionId) {

    return athenaClient.getQueryResults(queryExecutionId);
  }

  public String getDownloadUrl(String queryExecutionId) {

    return athenaClient.getDownloadUrl(queryExecutionId);
  }
}
