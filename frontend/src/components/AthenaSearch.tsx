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
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
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
  const [currentResults, setCurrentResults] = useState<AuditLog[]>([]);
  const [tokens, setTokens] = useState<(string | null)[]>([null]); // tokens[page] stores the nextToken for page+1
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
      setCurrentResults([]);
      setTokens([null]);
      setPaginationModel({ ...paginationModel, page: 0 });
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
    enabled: !!queryExecutionId && currentResults.length === 0 && paginationModel.page === 0,
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
  const totalRowCount = statusQuery.data?.totalRowCount;
  const isFinished = queryState === 'SUCCEEDED';
  const isFailed = queryState === 'FAILED' || queryState === 'CANCELLED';

  const [isDownloading, setIsDownloading] = useState(false);

  // 3. 結果取得 (通常のAPI)
  const resultsQuery = useQuery({
    queryKey: ['athenaResults', queryExecutionId, paginationModel.page, paginationModel.pageSize],
    queryFn: async () => {
      const currentToken = tokens[paginationModel.page];
      let url = `/api/athena/results/${queryExecutionId}?maxResults=${paginationModel.pageSize}`;
      if (currentToken) {
        url += `&nextToken=${encodeURIComponent(currentToken)}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch results');
      const data = await response.json();

      const newLogs = data.results.map((item: AuditLog, index: number) => ({
        ...item,
        id: `${paginationModel.page * paginationModel.pageSize + index}`,
      }));

      return {
        results: newLogs,
        nextToken: data.nextToken,
      };
    },
    enabled: isFinished && (paginationModel.page === 0 || !!tokens[paginationModel.page]),
  });

  const handleDownloadCsv = async () => {
    if (!queryExecutionId) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/athena/download/${queryExecutionId}`);
      if (!response.ok) throw new Error('Failed to start download');
      if (!response.body) throw new Error('No response body');

      // CSVのヘッダー定義
      const csvHeader = 'Timestamp,User ID,Event,Resource ID,IP Address,Status\n';

      // 文字列をエスケープしてCSVの1フィールドにする関数
      const escapeCsv = (val: string) => {
        if (val === undefined || val === null) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // ブラウザが FileSystemWritableFileStream をサポートしているか確認
      let writer: any = null;
      let fileHandle: any = null;

      const supportsFileSystemAccess = 'showSaveFilePicker' in window;

      if (supportsFileSystemAccess) {
        try {
          fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `audit_logs_${queryExecutionId}.csv`,
            types: [
              {
                description: 'CSV Files',
                accept: { 'text/csv': ['.csv'] },
              },
            ],
          });
          writer = await fileHandle.createWritable();
          // ヘッダーを書き込む
          await writer.write(csvHeader);
        } catch (e) {
          // ユーザーがキャンセルした場合は中断
          console.log('User cancelled save picker or error occurred', e);
          setIsDownloading(false);
          return;
        }
      }

      // Fallback用のBlob管理 (FileSystemAccessが使えない場合)
      const fallbackChunks: BlobPart[] = [];
      if (!writer) {
        fallbackChunks.push(csvHeader);
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          console.log('Processing line:', line);
          try {
            const data = JSON.parse(line);
            // data.results は AuditLog[]
            if (data.results && Array.isArray(data.results)) {
              let csvRows = '';
              for (const log of data.results) {
                const row = [
                  escapeCsv(log.timestamp),
                  escapeCsv(log.userId),
                  escapeCsv(log.eventName),
                  escapeCsv(log.resourceId),
                  escapeCsv(log.ipAddress),
                  escapeCsv(log.status),
                ].join(',');
                csvRows += row + '\n';
              }

              if (writer) {
                await writer.write(csvRows);
              } else {
                fallbackChunks.push(csvRows);
              }
            }
          } catch (err) {
            console.warn('Failed to parse line:', line, err);
          }
        }
      }

      // 最後の残りを処理 (通常は空のはずだが念のため)
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.results && Array.isArray(data.results)) {
            let csvRows = '';
            for (const log of data.results) {
              const row = [
                escapeCsv(log.timestamp),
                escapeCsv(log.userId),
                escapeCsv(log.eventName),
                escapeCsv(log.resourceId),
                escapeCsv(log.ipAddress),
                escapeCsv(log.status),
              ].join(',');
              csvRows += row + '\n';
            }
            if (writer) {
              await writer.write(csvRows);
            } else {
              fallbackChunks.push(csvRows);
            }
          }
        } catch (err) {
          /* ignore last partial line if not valid json */
          console.warn('Failed to parse last partial line:', buffer, err);
        }
      }

      if (writer) {
        await writer.close();
        alert('CSV download completed.');
      } else {
        // Fallback: 全データをBlobにしてダウンロード
        console.log('Using fallback method for downloading CSV');
        const blob = new Blob(fallbackChunks, { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${queryExecutionId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('CSV Download failed', e);
      alert('Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  // 結果が取得できたら現在の表示データを更新し、次のページのトークンを保存する
  React.useEffect(() => {
    if (resultsQuery.data) {
      setCurrentResults(resultsQuery.data.results);
      if (resultsQuery.data.nextToken) {
        setTokens((prev) => {
          const newTokens = [...prev];
          newTokens[paginationModel.page + 1] = resultsQuery.data!.nextToken!;
          return newTokens;
        });
      }
    }
  }, [resultsQuery.data, paginationModel.page]);

  const handleSearch = () => {
    setQueryExecutionId(null);
    setCurrentResults([]);
    setTokens([null]);
    setPaginationModel({ ...paginationModel, page: 0 });
    submitMutation.mutate({ year, month, day, userId });
  };

  const loading =
    submitMutation.isPending ||
    (statusQuery.isLoading &&
      !!queryExecutionId &&
      currentResults.length === 0 &&
      paginationModel.page === 0) ||
    (statusQuery.data && !isFinished && !isFailed);
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
            startIcon={
              loading || fetchingResults ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SearchIcon />
              )
            }
            onClick={handleSearch}
            disabled={loading || fetchingResults}
          >
            Search
          </Button>
          {isFinished && (
            <Tooltip title="Download as CSV">
              <span>
                <IconButton
                  color="primary"
                  onClick={handleDownloadCsv}
                  disabled={isDownloading}
                >
                  {isDownloading ? <CircularProgress size={24} /> : <DownloadIcon />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
        {dataScanned !== undefined && (
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
              Data scanned: {(dataScanned / (1024 * 1024)).toFixed(2)} MB
            </Typography>
            {totalRowCount !== undefined && totalRowCount !== null && (
              <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                Total records: {totalRowCount}
              </Typography>
            )}
          </Stack>
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

      {isFinished && currentResults.length === 0 && resultsQuery.isFetching && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Fetching results...
        </Alert>
      )}

      {(submitMutation.error || statusQuery.error || resultsQuery.error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(submitMutation.error || statusQuery.error || resultsQuery.error)?.message ||
            'An error occurred'}
        </Alert>
      )}

      <Paper sx={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={currentResults}
          columns={columns}
          loading={fetchingResults}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[5, 10, 25]}
          disableRowSelectionOnClick
          rowCount={
            totalRowCount !== undefined && totalRowCount !== null
              ? Number(totalRowCount)
              : resultsQuery.data?.nextToken
                ? (paginationModel.page + 1) * paginationModel.pageSize + 1
                : paginationModel.page * paginationModel.pageSize + currentResults.length
          }
          paginationMode="server"
        />
      </Paper>
    </Box>
  );
}
