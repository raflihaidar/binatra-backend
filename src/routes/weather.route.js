import express from 'express'
import { getWeather } from '../controllers/weather.controller.js'

export const router = express.Router()

router.get('/', getWeather)

