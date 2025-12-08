import logger from "../logger/index.js";
import { getPrediction } from "../services/prediction.service.js";

class PredictionController {

  async getPrediction(req, res) {
    const {locationId, data} = req.body
    try {
        const predictions = await getPrediction(locationId, data);

        return res.json({
            message : "get prediction successfully",
            data : predictions
        })
    } catch (error) {
      logger.error("Error :", error);
      return res.status(500).json({
        success: false,
        message: "Failed to get locations",
        error: error.message,
      });
    }
  }
}


export const predictionController = new PredictionController();