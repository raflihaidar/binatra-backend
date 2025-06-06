import { deviceRepository } from '../repositories/device.repository.js';

class DeviceService {
    async getAllDevice(options = {}){
        try {
            return await deviceRepository.findAll(options)
        } catch (error) {
            throw error
        }
    }

    async createDevice(data){
        try {
            return await deviceRepository.create(data)
        } catch (error) {
            throw error;
        }
    }

    async findByCode(data){
        try {
            return await deviceRepository.findByCode(data)
        } catch (error) {
            throw error
        }
    }
}

export const deviceService = new DeviceService();