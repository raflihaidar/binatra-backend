import { deviceService } from "../../services/device.service.js";

export class DeviceHandler {
  constructor(notificationEmitter) {
    this.notificationEmitter = notificationEmitter;
  }

  async updateDevice(message, deviceCode){
    try {
      const json = JSON.parse(message);
      const locationId = json.locationId;
      const calibration = json.calibration;
      const periode = json.periode;

      const device = await deviceService.findByCode(deviceCode)
      if(device){
        await deviceService.updateDevice(device.id, {
          code : deviceCode,
          locationId, 
          calibration,
          periode
        })
      }
    } catch (error) {
        console.log(error)
    }
  }
}
