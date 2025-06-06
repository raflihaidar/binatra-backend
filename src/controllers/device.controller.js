import { deviceService } from '../services/device.service.js';
import logger from '../utils/logger.js';

class DeviceController {
  getAllDevices = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const devices = await deviceService.getAllDevice({ skip, take : limit })
      
      return res.json({
        page,
        limit,
        data: devices
      });
    } catch (error) {
      logger.error('Error getting device status:', error);
      return res.status(500).json({ message: 'Failed to get device status' });
    }
  }

  createDevice = async (req, res) => {
    try {
      const { code, location, description } = req.body;
  
      if (!code) {
        return res.status(400).json({ message: 'code are required' });
      }
  
      const device = await deviceService.createDevice({ code, location, description });
  
      res.status(201).json({
        message: 'Device created successfully',
        data: device
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create device', error: error.message });
    }
  };

  findDeviceByCode = async (req, res) => {
    try {
      const { code } = req.params;
      
  
      if (!code) {
        return res.status(400).json({ message: 'code are required' });
      }
  
      const device = await deviceService.findByCode(code );
  
      res.status(201).json({
        message: 'Device Founded',
        data: device
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to find device', error: error.message });
    }
  };
}

export const deviceController = new DeviceController();