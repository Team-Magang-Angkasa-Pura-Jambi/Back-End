import 'dotenv/config';

/**
 * Configuration for the OpenWeatherMap API.
 * It's recommended to store sensitive information like API keys
 * in environment variables.
 */
export const weatherConfig = {
  apiKey: process.env.OPENWEATHER_API_KEY ?? '6953d3a5c74bbd94157aa3455bd9dd87',
  latitude: process.env.OPENWEATHER_LATITUDE ?? '-1.63806',
  longitude: process.env.OPENWEATHER_LONGITUDE ?? '103.64444',
  baseURL: 'https://api.openweathermap.org/data/2.5/forecast',
};

if (!weatherConfig.apiKey) {
  console.warn(
    'WARNING: OPENWEATHER_API_KEY is not set in your .env file. The WeatherService will not function.',
  );
}
