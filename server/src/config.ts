import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.BFF_PORT || '3001', 10),
  ragflow: {
    baseUrl: process.env.RAGFLOW_BASE_URL || 'http://localhost:9380',
    apiKey: process.env.RAGFLOW_API_KEY || '',
  },
};
