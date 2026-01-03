package cn.gekal.sample.awsathenaapidemo.dto;

import software.amazon.awssdk.services.athena.model.QueryExecutionState;

public class AuditLogQueryStatusResponse {
    private QueryExecutionState state;

    public AuditLogQueryStatusResponse(QueryExecutionState state) {
        this.state = state;
    }

    public QueryExecutionState getState() {
        return state;
    }

    public void setState(QueryExecutionState state) {
        this.state = state;
    }
}
