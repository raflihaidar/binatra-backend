import { deviceService } from "../../services/device.service.js";

export default function deviceHandler(socket) {
  socket.on("device-setting", async (data) => {
    try {
      const code = data.deviceCode
      const locationId = data.locationId;
      const calibration = data.calibration;
      const periode = data.periode;

      const device = await deviceService.findByCode(code);
      if (device) {
        await deviceService.updateDevice(device.id, {
          code,
          locationId,
          calibration,
          periode,
        });
      }
    } catch (error) {
      console.log(error);
    }
  });
}
