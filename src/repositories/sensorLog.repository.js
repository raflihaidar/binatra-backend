import { prisma } from "../prisma/prismaClient.js";

class SensorLogRepository {
  async create(data) {
    return await prisma.sensorLog.create({
      data: {
        deviceCode: data.deviceCode,
        deviceCalibration : data.deviceCalibration,
        depth : data.depth,
        voltage : data.voltage,
        rainfall: data.rainfall,
        waterLevel: data.waterLevel,
        timestamp: data.timestamp || new Date()
      },
      include: {
        device: true
      }
    });
  }

  async createMany(dataArray) {
    return await prisma.sensorLog.createMany({
      data: dataArray.map(data => ({
        deviceCode: data.deviceCode,
        deviceCalibration : data.deviceCalibration,
        depth : data.depth,
        voltage : data.voltage,
        rainfall: data.rainfall,
        waterLevel: data.waterLevel,
        timestamp: data.timestamp || new Date()
      }))
    });
  }

  async findBydeviceCode(deviceCode) {
    return await prisma.sensorLog.findMany({
      where: {
        deviceCode
      },
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: {
          select : {
            name : true,
            code : true,
            location : {
              select : {
                name : true,
                currentStatus : true
              }
            }
          },
        }
      }
    });
  }

  async findLatestBydeviceCode(deviceCode, limit = 10) {
    return await prisma.sensorLog.findMany({
      where: {
        deviceCode
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      include: {
        device: true
      }
    });
  }

  async findByDateRange(deviceCode, startDate, endDate) {
    // Jika tidak ada date range, return semua data untuk device
    if (!startDate) {
      return null
    }
  
    // Buat where clause conditionally
    const whereClause = {
      deviceCode
    };
  
    // Tambahkan timestamp filter jika ada startDate atau endDate
    if (startDate || endDate) {
      whereClause.timestamp = {};
      
      if (startDate) {
        // Konversi startDate ke awal hari
        const start = startDate;
        start.setHours(0, 0, 0, 0);
        whereClause.timestamp.gte = start;
      }
      
      if (endDate) {
        // Konversi endDate ke akhir hari
        const end = endDate;
        end.setHours(23, 59, 59, 999);
        whereClause.timestamp.lte = end;
      }
    }
    
    return await prisma.sensorLog.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: {
          select : {
            name : true,
            code : true,
            location : {
              select : {
                name : true,
                currentStatus : true
              }
            }
          },
        }
      }
    });
  }

  async findAll(page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    
    return await prisma.sensorLog.findMany({
      skip,
      take: limit,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: true
      }
    });
  }

  async findById(id) {
    return await prisma.sensorLog.findUnique({
      where: {
        id
      },
      include: {
        device: true
      }
    });
  }

  async update(id, data) {
    return await prisma.sensorLog.update({
      where: {
        id
      },
      data: {
        deviceCalibration : data.deviceCalibration,
        depth : data.depth,
        voltage : data.voltage,
        rainfall: data.rainfall,
        waterLevel: data.waterLevel,
        timestamp: data.timestamp
      },
      include: {
        device: true
      }
    });
  }

  async delete(id) {
    return await prisma.sensorLog.delete({
      where: {
        id
      }
    });
  }

  async deleteBydeviceCode(deviceCode) {
    return await prisma.sensorLog.deleteMany({
      where: {
        deviceCode
      }
    });
  }

  async getStatistics(deviceCode, startDate, endDate) {
    return await prisma.sensorLog.aggregate({
      where: {
        deviceCode,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      _avg: {
        rainfall: true,
        waterLevel: true
      },
      _max: {
        rainfall: true,
        waterLevel: true
      },
      _min: {
        rainfall: true,
        waterLevel: true
      },
      _count: true
    });
  }

  async getLatestReading(deviceCode) {
    return await prisma.sensorLog.findFirst({
      where: {
        deviceCode
      },
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: true
      }
    });
  }
}

export const sensorLogRepository = new SensorLogRepository();