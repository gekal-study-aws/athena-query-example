package cn.gekal.sample.awsathenaapidemo.infrastructure.client;

import cn.gekal.sample.awsathenaapidemo.domain.model.AuditLog;
import cn.gekal.sample.awsathenaapidemo.domain.repository.AthenaQueryRepository;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryResultResponse;
import cn.gekal.sample.awsathenaapidemo.interfaces.dto.AuditLogQueryStatusResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.athena.AthenaClient;
import software.amazon.awssdk.services.athena.model.*;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

@Repository
public class AthenaQueryClient implements AthenaQueryRepository {

  private final AthenaClient athenaClient;
  private final S3Presigner s3Presigner;

  @Value("${athena.output-location}")
  private String outputS3Bucket;

  @Value("${athena.database}")
  private String databaseName;

  public AthenaQueryClient(AthenaClient athenaClient, S3Presigner s3Presigner) {
    this.athenaClient = athenaClient;
    this.s3Presigner = s3Presigner;
  }

  @Override
  public String submitQuery(String queryString) {
    QueryExecutionContext queryExecutionContext =
        QueryExecutionContext.builder().database(databaseName).build();

    ResultConfiguration resultConfiguration =
        ResultConfiguration.builder().outputLocation(outputS3Bucket).build();

    StartQueryExecutionRequest startQueryExecutionRequest =
        StartQueryExecutionRequest.builder()
            .queryString(queryString)
            .queryExecutionContext(queryExecutionContext)
            .resultConfiguration(resultConfiguration)
            .build();

    StartQueryExecutionResponse startQueryExecutionResponse =
        athenaClient.startQueryExecution(startQueryExecutionRequest);

    return startQueryExecutionResponse.queryExecutionId();
  }

  @Override
  public AuditLogQueryStatusResponse getQueryStatus(String queryExecutionId) {
    GetQueryExecutionRequest getQueryExecutionRequest =
        GetQueryExecutionRequest.builder().queryExecutionId(queryExecutionId).build();

    GetQueryExecutionResponse getQueryExecutionResponse =
        athenaClient.getQueryExecution(getQueryExecutionRequest);

    QueryExecution queryExecution = getQueryExecutionResponse.queryExecution();
    Long dataScannedInBytes =
        queryExecution.statistics() != null ? queryExecution.statistics().dataScannedInBytes() : null;

    Long totalRowCount = null;
    if (QueryExecutionState.SUCCEEDED.equals(queryExecution.status().state())) {
      GetQueryResultsResponse resultsResponse =
          athenaClient.getQueryResults(
              GetQueryResultsRequest.builder()
                  .queryExecutionId(queryExecutionId)
                  .maxResults(1)
                  .build());
      if (resultsResponse.resultSet().rows().size() > 1) {
        // ヘッダー行を考慮してデータ行を取得
        List<ColumnInfo> columnInfos = resultsResponse.resultSet().resultSetMetadata().columnInfo();
        List<Row> rows = resultsResponse.resultSet().rows();
        int dataIndex = 0;
        // 1行目がヘッダーかチェック
        Row firstRow = rows.get(0);
        boolean isHeader = true;
        for (int j = 0; j < Math.min(columnInfos.size(), firstRow.data().size()); j++) {
          if (!firstRow.data().get(j).varCharValue().equalsIgnoreCase(columnInfos.get(j).name())) {
            isHeader = false;
            break;
          }
        }
        dataIndex = isHeader ? 1 : 0;
        if (rows.size() > dataIndex) {
          // full_count カラムを探す
          for (int j = 0; j < columnInfos.size(); j++) {
            if ("full_count".equalsIgnoreCase(columnInfos.get(j).name())) {
              String val = rows.get(dataIndex).data().get(j).varCharValue();
              if (val != null) {
                totalRowCount = Long.parseLong(val);
              }
              break;
            }
          }
        }
      }
    }

    return new AuditLogQueryStatusResponse(
        queryExecution.status().state(), dataScannedInBytes, totalRowCount);
  }

  @Override
  public AuditLogQueryResultResponse getQueryResults(
      String queryExecutionId, String nextToken, Integer maxResults) {
    GetQueryResultsRequest.Builder requestBuilder =
        GetQueryResultsRequest.builder().queryExecutionId(queryExecutionId);

    if (nextToken != null && !nextToken.isEmpty()) {
      requestBuilder.nextToken(nextToken);
    }
    if (maxResults != null) {
      requestBuilder.maxResults(maxResults);
    }

    GetQueryResultsResponse getQueryResultsResponse =
        athenaClient.getQueryResults(requestBuilder.build());

    List<ColumnInfo> columnInfos =
        getQueryResultsResponse.resultSet().resultSetMetadata().columnInfo();
    List<Row> rows = getQueryResultsResponse.resultSet().rows();

    List<AuditLog> results = new ArrayList<>();

    // rowsの0番目がヘッダーかどうか判定（カラム名と一致するか）
    int startIndex = 0;
    if (nextToken == null || nextToken.isEmpty()) {
      if (!rows.isEmpty()) {
        Row firstRow = rows.getFirst();
        boolean isHeader = true;
        for (int j = 0; j < Math.min(columnInfos.size(), firstRow.data().size()); j++) {
          if (!firstRow.data().get(j).varCharValue().equalsIgnoreCase(columnInfos.get(j).name())) {
            isHeader = false;
            break;
          }
        }
        if (isHeader) {
          startIndex = 1;
        }
      }
    }

    for (int i = startIndex; i < rows.size(); i++) {
      AuditLog record = createAuditLog(rows, i, columnInfos);
      results.add(record);
    }
    return new AuditLogQueryResultResponse(results, getQueryResultsResponse.nextToken());
  }

  @Override
  public void getQueryResultsStream(String queryExecutionId, Consumer<AuditLog> consumer) {
    GetQueryResultsRequest getQueryResultsRequest =
        GetQueryResultsRequest.builder().queryExecutionId(queryExecutionId).build();

    Iterable<GetQueryResultsResponse> responses =
        athenaClient.getQueryResultsPaginator(getQueryResultsRequest);

    boolean isFirstPage = true;
    for (GetQueryResultsResponse response : responses) {
      List<ColumnInfo> columnInfos = response.resultSet().resultSetMetadata().columnInfo();
      List<Row> rows = response.resultSet().rows();

      int startIndex = 0;
      if (isFirstPage && !rows.isEmpty()) {
        Row firstRow = rows.getFirst();
        boolean isHeader = true;
        for (int j = 0; j < Math.min(columnInfos.size(), firstRow.data().size()); j++) {
          if (!firstRow.data().get(j).varCharValue().equalsIgnoreCase(columnInfos.get(j).name())) {
            isHeader = false;
            break;
          }
        }
        if (isHeader) {
          startIndex = 1;
        }
      }

      for (int i = startIndex; i < rows.size(); i++) {
        AuditLog record = createAuditLog(rows, i, columnInfos);
        consumer.accept(record);
      }
      isFirstPage = false;
    }
  }

  private static @NonNull AuditLog createAuditLog(
      List<Row> rows, int i, List<ColumnInfo> columnInfos) {
    Row row = rows.get(i);
    AuditLog record = new AuditLog();
    Map<String, String> otherDetails = new HashMap<>();

    for (int j = 0; j < columnInfos.size(); j++) {
      String columnName = columnInfos.get(j).name();
      String value = row.data().get(j).varCharValue();

      switch (columnName.toLowerCase()) {
        case "year":
          record.setYear(value);
          break;
        case "month":
          record.setMonth(value);
          break;
        case "day":
          record.setDay(value);
          break;
        case "user_id":
          record.setUserId(value);
          break;
        case "event_name":
          record.setEventName(value);
          break;
        case "resource_id":
          record.setResourceId(value);
          break;
        case "ip_address":
          record.setIpAddress(value);
          break;
        case "timestamp":
          record.setTimestamp(value);
          break;
        case "status":
          record.setStatus(value);
          break;
        case "full_count":
          // full_countはAuditLogモデルには含めず、無視する（または必要ならMapに入れる）
          break;
        default:
          otherDetails.put(columnName, value);
          break;
      }
    }
    if (!otherDetails.isEmpty()) {
      record.setOtherDetails(otherDetails);
    }
    return record;
  }

  @Override
  public String getDownloadUrl(String queryExecutionId) {
    GetQueryExecutionRequest getQueryExecutionRequest =
        GetQueryExecutionRequest.builder().queryExecutionId(queryExecutionId).build();

    GetQueryExecutionResponse getQueryExecutionResponse =
        athenaClient.getQueryExecution(getQueryExecutionRequest);
    String s3Location =
        getQueryExecutionResponse.queryExecution().resultConfiguration().outputLocation();

    // s3Location は s3://bucket-name/path/to/result.csv の形式
    String bucket = s3Location.substring(5, s3Location.indexOf("/", 5));
    String key = s3Location.substring(s3Location.indexOf("/", 5) + 1);

    GetObjectRequest getObjectRequest = GetObjectRequest.builder().bucket(bucket).key(key).build();

    GetObjectPresignRequest getObjectPresignRequest =
        GetObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(60))
            .getObjectRequest(getObjectRequest)
            .build();

    PresignedGetObjectRequest presignedGetObjectRequest =
        s3Presigner.presignGetObject(getObjectPresignRequest);
    return presignedGetObjectRequest.url().toString();
  }
}
