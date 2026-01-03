package cn.gekal.sample.awsathenaapidemo.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.athena.AthenaClient;
import software.amazon.awssdk.services.athena.model.*;

import java.util.ArrayList;
import java.util.List;

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
        QueryExecutionContext queryExecutionContext = QueryExecutionContext.builder()
                .database(databaseName)
                .build();

        ResultConfiguration resultConfiguration = ResultConfiguration.builder()
                .outputLocation(outputS3Bucket)
                .build();

        StartQueryExecutionRequest startQueryExecutionRequest = StartQueryExecutionRequest.builder()
                .queryString(queryString)
                .queryExecutionContext(queryExecutionContext)
                .resultConfiguration(resultConfiguration)
                .build();

        StartQueryExecutionResponse startQueryExecutionResponse = athenaClient.startQueryExecution(startQueryExecutionRequest);
        return startQueryExecutionResponse.queryExecutionId();
    }

    public QueryExecutionState getQueryStatus(String queryExecutionId) {
        GetQueryExecutionRequest getQueryExecutionRequest = GetQueryExecutionRequest.builder()
                .queryExecutionId(queryExecutionId)
                .build();

        GetQueryExecutionResponse getQueryExecutionResponse = athenaClient.getQueryExecution(getQueryExecutionRequest);
        return getQueryExecutionResponse.queryExecution().status().state();
    }

    public List<List<String>> getQueryResults(String queryExecutionId) {
        GetQueryResultsRequest getQueryResultsRequest = GetQueryResultsRequest.builder()
                .queryExecutionId(queryExecutionId)
                .build();

        GetQueryResultsResponse getQueryResultsResponse = athenaClient.getQueryResults(getQueryResultsRequest);

        List<List<String>> results = new ArrayList<>();

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
