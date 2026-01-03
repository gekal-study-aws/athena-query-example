package cn.gekal.sample.awsathenaapidemo.services;

import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.athena.AthenaClient;
import software.amazon.awssdk.services.athena.model.*;

import java.util.ArrayList;
import java.util.List;

@Service
public class AthenaService {

    private final AthenaClient athenaClient;

    // Athenaのクエリ結果を出力するS3バケット（必須）
    private static final String OUTPUT_S3_BUCKET = "s3://your-athena-output-bucket/results/";
    private static final String DATABASE_NAME = "your_database_name";

    public AthenaService(AthenaClient athenaClient) {
        this.athenaClient = athenaClient;
    }

    public List<List<String>> executeQuery(String queryString) throws InterruptedException {
        // 1. クエリ実行IDを取得 (StartQueryExecution)
        String queryExecutionId = submitQuery(queryString);

        // 2. クエリの完了を待機 (ポーリング)
        waitForQueryToComplete(queryExecutionId);

        // 3. 結果を取得 (GetQueryResults)
        return getQueryResults(queryExecutionId);
    }

    private String submitQuery(String queryString) {
        QueryExecutionContext queryExecutionContext = QueryExecutionContext.builder()
                .database(DATABASE_NAME)
                .build();

        ResultConfiguration resultConfiguration = ResultConfiguration.builder()
                .outputLocation(OUTPUT_S3_BUCKET)
                .build();

        StartQueryExecutionRequest startQueryExecutionRequest = StartQueryExecutionRequest.builder()
                .queryString(queryString)
                .queryExecutionContext(queryExecutionContext)
                .resultConfiguration(resultConfiguration)
                .build();

        StartQueryExecutionResponse startQueryExecutionResponse = athenaClient.startQueryExecution(startQueryExecutionRequest);
        return startQueryExecutionResponse.queryExecutionId();
    }

    private void waitForQueryToComplete(String queryExecutionId) throws InterruptedException {
        GetQueryExecutionRequest getQueryExecutionRequest = GetQueryExecutionRequest.builder()
                .queryExecutionId(queryExecutionId)
                .build();

        GetQueryExecutionResponse getQueryExecutionResponse;
        boolean isQueryStillRunning = true;

        while (isQueryStillRunning) {
            getQueryExecutionResponse = athenaClient.getQueryExecution(getQueryExecutionRequest);
            QueryExecutionStatus status = getQueryExecutionResponse.queryExecution().status();
            QueryExecutionState state = status.state();

            if (state == QueryExecutionState.FAILED) {
                throw new RuntimeException("Query Failed: " + status.stateChangeReason());
            } else if (state == QueryExecutionState.CANCELLED) {
                throw new RuntimeException("Query Cancelled");
            } else if (state == QueryExecutionState.SUCCEEDED) {
                isQueryStillRunning = false;
            } else {
                // QUEUED または RUNNING の場合、少し待機して再確認
                Thread.sleep(1000);
            }
        }
    }

    private List<List<String>> getQueryResults(String queryExecutionId) {
        GetQueryResultsRequest getQueryResultsRequest = GetQueryResultsRequest.builder()
                .queryExecutionId(queryExecutionId)
                .build();

        GetQueryResultsResponse getQueryResultsResponse = athenaClient.getQueryResults(getQueryResultsRequest);

        List<List<String>> results = new ArrayList<>();

        // シンプルなリスト形式に変換
        for (Row row : getQueryResultsResponse.resultSet().rows()) {
            List<String> rowData = new ArrayList<>();
            for (Datum datum : row.data()) {
                rowData.add(datum.varCharValue());
            }
            results.add(rowData);
        }
        return results;
    }
}
