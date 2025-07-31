import { deviceService } from "../../services/device.service.js";

export default function deviceHandler(socket, mqttClient) {
  socket.on("device-setting", async (data) => {
    try {
      const code = data.deviceCode;
      const locationId = data.locationId;
      const calibration = data.calibration;
      const periode = data.periode;


      const device = await deviceService.findByCode(code);

      if (!device) {
        socket.emit('device-setting-error', {
          deviceCode: code,
          message: 'Device not found',
          error: 'DEVICE_NOT_FOUND'
        });
        return;
      }

      const updatedDevice = await deviceService.updateDevice(device.id, {
        code,
        locationId,
        calibration,
        periode,
      });

      // 3. Prepare MQTT payload for device configuration
      const mqttPayload = {
        type: "device_config_update",
        data : {
          deviceCode: code,
          timestamp: new Date().toISOString(),
          calibration: calibration,
          periode: periode,
          locationId: locationId
        }
      };

      const deviceSpecificTopic = `binatra-device/${code}/settings`;
      const generalTopic = 'binatra-device/settings';
      
      try {
        // Publish configuration to specific device topic
        await mqttClient.publish(deviceSpecificTopic, JSON.stringify(mqttPayload), {
          qos: 1,
          retain: false
        });

        socket.emit('device-setting-success', {
          deviceCode: code,
          message: 'Device setting updated successfully and sent to device',
        });

      } catch (mqttError) {        
        // Still send success for database update but note MQTT failure
        socket.emit('device-setting-success', {
          deviceCode: code,
          message: 'Device setting updated in database but failed to send to device',
          data: {
            database: updatedDevice,
            mqtt: {
              deviceTopic: deviceSpecificTopic,
              generalTopic: generalTopic,
              payload: mqttPayload,
              published: false,
              error: mqttError.message
            }
          },
          warning: 'MQTT_PUBLISH_FAILED'
        });
      }
    } catch (error) {
      console.error(`❌ Error updating device setting for ${data.deviceCode}:`, error);
      
      socket.emit('device-setting-error', {
        deviceCode: data.deviceCode,
        message: 'Failed to update device setting',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
}