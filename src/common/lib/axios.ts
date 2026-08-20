import axios from 'axios';

const baseURL = process.env.ML_API_BASE_URL || 'http://localhost:8000';

const mlApiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export default mlApiClient;
