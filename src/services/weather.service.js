import dotenv from 'dotenv'
import axios from "axios"

dotenv.config()

async function getWeather() {
    const apiKey = process.env.OPEN_WEATHER_KEY
  
    const res = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        q : 'Surabaya',
        appid: apiKey,
        units: "metric",
      },
    });
  
    const data = res.data;

    console.log("data : ", data)

    return data;
  }
  
  export default { getWeather };