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
  const [year, setYear] = useState('2024');
  const [month, setMonth] = useState('01');
  const [day, setDay] = useState('01');
  const [userId, setUserId] = useState('user-001');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setRows([]);
    setStatus('Submitting query...');

    try {
      // 1. Submit Query
      const queryRes = await fetch('/api/athena/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, day, userId }),
      });
      if (!queryRes.ok) throw new Error('Failed to submit query');
      const { queryExecutionId } = await queryRes.json();

      // 2. Poll Status
      let isFinished = false;
      while (!isFinished) {
        setStatus(`Query running... (ID: ${queryExecutionId})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        const statusRes = await fetch(`/api/athena/status/${queryExecutionId}`);
        if (!statusRes.ok) throw new Error('Failed to check status');
        const { state } = await statusRes.json();

        if (state === 'SUCCEEDED') {
          isFinished = true;
        } else if (state === 'FAILED' || state === 'CANCELLED') {
          throw new Error(`Query ${state.toLowerCase()}`);
        }
      }

      // 3. Get Results
      setStatus('Fetching results...');
      const resultsRes = await fetch(`/api/athena/results/${queryExecutionId}`);
      if (!resultsRes.ok) throw new Error('Failed to fetch results');
      const data = await resultsRes.json();
      
      setRows(data.map((item: AuditLog, index: number) => ({ ...item, id: index })));
      setStatus(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

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
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            onClick={handleSearch}
            disabled={loading}
          >
            Search
          </Button>
        </Stack>
      </Paper>

      {status && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {status}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
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
