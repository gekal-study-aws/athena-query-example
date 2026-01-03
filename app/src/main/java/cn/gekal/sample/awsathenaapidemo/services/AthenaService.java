package cn.gekal.sample.awsathenaapidemo.services;

import cn.gekal.sample.awsathenaapidemo.dto.AuditLogRecord;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.athena.AthenaClient;
import software.amazon.awssdk.services.athena.model.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AthenaService {

    private final AthenaClient athenaClient;

    @Value("${athena.output-location}")
    private String outputS3Bucket;

    @Value("${athena.database}")
    private String databaseName;

    public AthenaService(AthenaClient athenaClient) {
        this.athenaClient = athenaClient;
    }

    public String submitQuery(String queryString) {
        QueryExecutionContext queryExecutionContext = QueryExecutionContext.builder().database(databaseName).build();

        ResultConfiguration resultConfiguration = ResultConfiguration.builder().outputLocation(outputS3Bucket).build();

        StartQueryExecutionRequest startQueryExecutionRequest = StartQueryExecutionRequest.builder().queryString(queryString).queryExecutionContext(queryExecutionContext).resultConfiguration(resultConfiguration).build();

        StartQueryExecutionResponse startQueryExecutionResponse = athenaClient.startQueryExecution(startQueryExecutionRequest);
        return startQueryExecutionResponse.queryExecutionId();
    }

    public QueryExecutionState getQueryStatus(String queryExecutionId) {
        GetQueryExecutionRequest getQueryExecutionRequest = GetQueryExecutionRequest.builder().queryExecutionId(queryExecutionId).build();

        GetQueryExecutionResponse getQueryExecutionResponse = athenaClient.getQueryExecution(getQueryExecutionRequest);
        return getQueryExecutionResponse.queryExecution().status().state();
    }

    public List<AuditLogRecord> getQueryResults(String queryExecutionId) {
        GetQueryResultsRequest getQueryResultsRequest = GetQueryResultsRequest.builder().queryExecutionId(queryExecutionId).build();

        GetQueryResultsResponse getQueryResultsResponse = athenaClient.getQueryResults(getQueryResultsRequest);

        List<ColumnInfo> columnInfos = getQueryResultsResponse.resultSet().resultSetMetadata().columnInfo();
        List<Row> rows = getQueryResultsResponse.resultSet().rows();

        // 最初の行がヘッダーの場合はスキップするロジックが必要な場合があるが、
        // Athenaの結果は通常ResultSetMetadataに含まれるため、データ行のみを処理する。
        // ただし、AthenaのGetQueryResultsは1行目にヘッダーが含まれることがあるため確認が必要。

        List<AuditLogRecord> results = new ArrayList<>();

        // rowsの0番目がヘッダーかどうか判定（簡易的に"year"などのカラム名が含まれているか）
        int startIndex = 0;
        if (!rows.isEmpty()) {
            Row firstRow = rows.getFirst();
            if (firstRow.data().getFirst().varCharValue().equalsIgnoreCase("year")) {
                startIndex = 1;
            }
        }

        for (int i = startIndex; i < rows.size(); i++) {
            AuditLogRecord record = createAuditLogRecord(rows, i, columnInfos);
            results.add(record);
        }
        return results;
    }

    private static @NonNull AuditLogRecord createAuditLogRecord(List<Row> rows, int i, List<ColumnInfo> columnInfos) {
        Row row = rows.get(i);
        AuditLogRecord record = new AuditLogRecord();
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
}
