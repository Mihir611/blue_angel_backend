const https = require('https');

const fetchWeatherForLocation = (location) => {
  return new Promise((resolve, reject) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${process.env.OPEN_WEATHER_API_KEY}&units=metric`;
    
    https.get(url, (response) => {
      let data = '';
      
      // Set encoding to handle response properly
      response.setEncoding('utf8');
    
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          if (response.statusCode === 200) {
            const weatherData = JSON.parse(data);
            resolve(weatherData);
          } else {
            const errorData = JSON.parse(data);
            reject(new Error(`API Error (${response.statusCode}): ${errorData.message || 'Failed to fetch weather data'}`));
          }
        } catch (parseError) {
          reject(new Error(`Invalid JSON response: ${parseError.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
  });
};

const getWeatherUpdates = async (source, destination) => {
  try {
    console.log(`Fetching weather for: ${source} and ${destination}`);
    
    // Fetch weather for both locations concurrently
    const [sourceWeather, destinationWeather] = await Promise.all([
      fetchWeatherForLocation(source),
      fetchWeatherForLocation(destination)
    ]);

    console.log('Weather data fetched successfully');
    
    return {
      weather: {
        source: sourceWeather,
        destination: destinationWeather
      }
    };
  } catch (error) {
    console.error('Weather fetch error:', error.message);
    throw error; // Re-throw the original error for better debugging
  }
};

module.exports = getWeatherUpdates;