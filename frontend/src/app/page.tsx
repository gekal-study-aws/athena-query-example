import { Container, Typography, Box } from '@mui/material';
import AthenaSearch from '../components/AthenaSearch';

export default function Home() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          AWS Athena Query Dashboard
        </Typography>
        <AthenaSearch />
      </Box>
    </Container>
  );
}
