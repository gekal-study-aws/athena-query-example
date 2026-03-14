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
  id: string; // Add id for DataGrid
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

interface QueryResult {
  results: AuditLog[];
  nextToken: string | null;
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
  const [userId, setUserId] = useState('user_001');

  const [queryExecutionId, setQueryExecutionId] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<AuditLog[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });

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
      setAllResults([]);
      setNextToken(null);
      setPaginationModel({ page: 0, pageSize: 10 });
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
    enabled: !!queryExecutionId && allResults.length === 0,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED') {
        return false;
      }
      return 2000;
    },
  });

  const queryState = statusQuery.data?.state;
  const dataScanned = statusQuery.data?.dataScannedInBytes;
  const isFinished = queryState === 'SUCCEEDED';
  const isFailed = queryState === 'FAILED' || queryState === 'CANCELLED';

  // 3. 結果取得 (ページネーション対応)
  const resultsQuery = useQuery({
    queryKey: ['athenaResults', queryExecutionId, nextToken],
    queryFn: async () => {
      let url = `/api/athena/results/${queryExecutionId}?maxResults=50`;
      if (nextToken) {
        url += `&nextToken=${encodeURIComponent(nextToken)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch results');
      const data: QueryResult = await res.json();
      return {
        results: data.results.map((item: AuditLog, index: number) => ({
          ...item,
          id: `${allResults.length + index}`
        })),
        nextToken: data.nextToken
      };
    },
    enabled: isFinished && (allResults.length === 0 || !!nextToken),
  });

  // 結果が取得できたら蓄積する
  React.useEffect(() => {
    if (resultsQuery.data) {
      setAllResults(prev => [...prev, ...resultsQuery.data.results]);
      // 自動的に次のページを取得しない（ユーザーの操作を待つか、DataGridのページネーションに任せる）
    }
  }, [resultsQuery.data]);

  const handleSearch = () => {
    setQueryExecutionId(null);
    setAllResults([]);
    setNextToken(null);
    submitMutation.mutate({ year, month, day, userId });
  };

  const handleFetchNext = () => {
    if (resultsQuery.data?.nextToken) {
      setNextToken(resultsQuery.data.nextToken);
    }
  };

  // DataGridのページが最後に近づいたら次をフェッチする
  React.useEffect(() => {
    const lastLoadedIndex = allResults.length;
    const currentMaxIndex = (paginationModel.page + 1) * paginationModel.pageSize;
    if (currentMaxIndex > lastLoadedIndex && resultsQuery.data?.nextToken && !resultsQuery.isFetching) {
      handleFetchNext();
    }
  }, [paginationModel, allResults.length, resultsQuery.data?.nextToken, resultsQuery.isFetching]);

  const loading = submitMutation.isPending || (statusQuery.isLoading && !!queryExecutionId && allResults.length === 0) || (statusQuery.data && !isFinished && !isFailed);
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
        {dataScanned !== undefined && (
          <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
            Data scanned: {(dataScanned / (1024 * 1024)).toFixed(2)} MB
          </Typography>
        )}
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

      {isFinished && allResults.length === 0 && resultsQuery.isFetching && (
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
          rows={allResults}
          columns={columns}
          loading={fetchingResults && allResults.length === 0}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 10, 25]}
          disableRowSelectionOnClick
          rowCount={resultsQuery.data?.nextToken ? allResults.length + 1 : allResults.length}
          paginationMode="server"
        />
      </Paper>
    </Box>
  );
}
