'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import { useMutation, useQuery } from '@tanstack/react-query';

interface AuditLog {
  year: string;
  month: string;
  day: string;
  userId: string;
  eventName: string;
  resourceId: string;
  ipAddress: string;
  timestamp: string;
  status: string;
}

const columns: GridColDef[] = [
  { field: 'timestamp', headerName: 'Timestamp', width: 200 },
  { field: 'userId', headerName: 'User ID', width: 120 },
  { field: 'eventName', headerName: 'Event', width: 150 },
  { field: 'resourceId', headerName: 'Resource ID', width: 150 },
  { field: 'ipAddress', headerName: 'IP Address', width: 130 },
  { field: 'status', headerName: 'Status', width: 100 },
];

export default function AthenaSearch() {
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('01');
  const [day, setDay] = useState('01');
  const [userId, setUserId] = useState('user_2');

  const [queryExecutionId, setQueryExecutionId] = useState<string | null>(null);

  // 1. クエリ実行ミューテーション
  const submitMutation = useMutation({
    mutationFn: async (params: { year: string; month: string; day: string; userId: string }) => {
      const res = await fetch('/api/athena/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to submit query');
      return res.json();
    },
    onSuccess: (data) => {
      setQueryExecutionId(data.queryExecutionId);
    },
  });

  // 2. ステータスポーリング
  const statusQuery = useQuery({
    queryKey: ['athenaStatus', queryExecutionId],
    queryFn: async () => {
      const res = await fetch(`/api/athena/status/${queryExecutionId}`);
      if (!res.ok) throw new Error('Failed to check status');
      return res.json();
    },
    enabled: !!queryExecutionId,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED') {
        return false;
      }
      return 2000;
    },
  });

  const queryState = statusQuery.data?.state;
  const isFinished = queryState === 'SUCCEEDED';
  const isFailed = queryState === 'FAILED' || queryState === 'CANCELLED';

  // 3. 結果取得
  const resultsQuery = useQuery({
    queryKey: ['athenaResults', queryExecutionId],
    queryFn: async () => {
      const res = await fetch(`/api/athena/results/${queryExecutionId}`);
      if (!res.ok) throw new Error('Failed to fetch results');
      const data = await res.json();
      return data.map((item: AuditLog, index: number) => ({ ...item, id: index }));
    },
    enabled: isFinished,
  });

  const handleSearch = () => {
    setQueryExecutionId(null);
    submitMutation.mutate({ year, month, day, userId });
  };

  const loading = submitMutation.isPending || (statusQuery.isLoading && !!queryExecutionId) || (statusQuery.data && !isFinished && !isFailed);
  const fetchingResults = resultsQuery.isFetching;

  return (
    <Box sx={{ width: '100%', mt: 4 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Audit Log Search (Athena)
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            size="small"
          />
          <TextField
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            size="small"
          />
          <TextField
            label="Day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            size="small"
          />
          <TextField
            label="User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            size="small"
          />
          <Button
            variant="contained"
            startIcon={(loading || fetchingResults) ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            onClick={handleSearch}
            disabled={loading || fetchingResults}
          >
            Search
          </Button>
        </Stack>
      </Paper>

      {submitMutation.isPending && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Submitting query...
        </Alert>
      )}

      {queryExecutionId && !isFinished && !isFailed && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Query running... (ID: {queryExecutionId}) - State: {queryState || 'PENDING'}
        </Alert>
      )}

      {isFailed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Query failed or cancelled. (ID: {queryExecutionId})
        </Alert>
      )}

      {isFinished && !resultsQuery.data && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Fetching results...
        </Alert>
      )}

      {(submitMutation.error || statusQuery.error || resultsQuery.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(submitMutation.error || statusQuery.error || resultsQuery.error)?.message || 'An error occurred'}
        </Alert>
      )}

      <Paper sx={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={resultsQuery.data || []}
          columns={columns}
          loading={fetchingResults}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 5 },
            },
          }}
          pageSizeOptions={[5, 10]}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
}
