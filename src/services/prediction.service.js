import axios from "axios";
import { prisma } from "../prisma/prismaClient.js";

export const getPrediction = async (locationId, data) => {
    try {  
      // Call Flask API
      const response = await axios.post(`https://model.binatra.id/predict`, data);

      console.log("status model : ", response.status)
  
      if (response.status !== 200) return [];
  
      const { prediction_cm, step_minutes } = response.data;
      const now = new Date();
  
      // Ambil threshold dari table Location
      const location = await prisma.location.findUnique({
        where: { id: locationId }
      });
  
      if (!location) {
        console.log("Location tidak ditemukan");
        return [];
      }
  
      // threshold yg dipakai
      const t = {
        amanMax: location.amanMax,
        waspadaMin: location.waspadaMin,
        waspadaMax: location.waspadaMax,
        siagaMin: location.siagaMin,
        siagaMax: location.siagaMax,
        bahayaMin: location.bahayaMin,
      };
  
      // Fungsi menentukan kondisi
      const getCondition = (val) => {
        if (val <= t.amanMax) return "aman";
        if (val >= t.waspadaMin && val <= t.waspadaMax) return "waspada";
        if (val >= t.siagaMin && val <= t.siagaMax) return "siaga";
        if (val >= t.bahayaMin) return "bahaya";
        return "unknown";
      };
  
      // Buat hasil akhir lengkap dengan kondisi
      const predictions = prediction_cm.map((value, idx) => {
        const ts = new Date(now.getTime() + idx * step_minutes * 60000);
  
        return {
          x: ts.getTime(),
          y: value,
          condition: getCondition(value)
        };
      });
  
  
      return predictions;
  
    } catch (err) {
      console.log("error:", err);
      return [];
    }
  };
  