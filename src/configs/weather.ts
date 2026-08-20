import 'dotenv/config';

const API_KEY = process.env.OPENWEATHER_API_KEY;

if (!API_KEY) {
  console.warn(
    '⚠️ WARNING: OPENWEATHER_API_KEY tidak ditemukan di .env. Service cuaca (WeatherService) akan gagal melakukan fetch data.',
  );
}

export const weatherConfig = {
  apiKey: API_KEY || '',

  latitude: process.env.OPENWEATHER_LATITUDE ?? '-1.63806',
  longitude: process.env.OPENWEATHER_LONGITUDE ?? '103.64444',

  baseURL: 'https://api.openweathermap.org/data/2.5/forecast',
};
