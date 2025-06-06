import dotenv from 'dotenv'
import axios from "axios"

dotenv.config()

export const getWeather = async (req, res) => {
    const apiKey = process.env.OPEN_WEATHER_KEY
    try { 
        const weatherApi = `https://api.openweathermap.org/data/2.5/weather?units=metric&q=Surabaya&appid=${apiKey}`
        const response = await axios.get(weatherApi)
        res.status(200).json({
            message: 'GET API CUACA SUKSES',
            data: {
                weather : response.data.weather,
                main : response.data.main,
                name : response.data.name,
            },
          })
    } catch (error) {
        console.log(error.message)
        res.status(500).json({
            message: 'GET API CUACA GAGAL',
            data: error.message,
          })
    }
}