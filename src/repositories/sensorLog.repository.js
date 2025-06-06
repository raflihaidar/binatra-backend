import { prisma } from "../prisma/prismaClient.js";

class SensorLogRepository {
  async create(data) {
    return await prisma.sensorLog.create({
      data: {
        deviceCode: data.deviceCode,
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
        device: true
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
    return await prisma.sensorLog.findMany({
      where: {
        deviceCode,
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      include: {
        device: true
      }
    });
  }

  async findByTimeRange(startTime, endTime, deviceCode = null) {
    const whereClause = {
      timestamp: {
        gte: startTime,
        lte: endTime
      }
    };

    if (deviceCode) {
      whereClause.deviceCode = deviceCode;
    }

    return await prisma.sensorLog.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: true
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

  async getHourlyAverage(deviceCode, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await prisma.$queryRaw`
      SELECT 
        EXTRACT(hour FROM timestamp) as hour,
        AVG(rainfall) as avg_rainfall,
        AVG(water_level) as avg_water_level,
        COUNT(*) as count
      FROM sensor_logs 
      WHERE device_id = ${deviceCode} 
        AND timestamp >= ${startOfDay} 
        AND timestamp <= ${endOfDay}
      GROUP BY EXTRACT(hour FROM timestamp)
      ORDER BY hour
    `;
  }

  async getDailyAverage(deviceCode, month, year) {
    return await prisma.$queryRaw`
      SELECT 
        DATE(timestamp) as date,
        AVG(rainfall) as avg_rainfall,
        AVG(water_level) as avg_water_level,
        MAX(rainfall) as max_rainfall,
        MAX(water_level) as max_water_level,
        MIN(rainfall) as min_rainfall,
        MIN(water_level) as min_water_level,
        COUNT(*) as count
      FROM sensor_logs 
      WHERE device_id = ${deviceCode} 
        AND EXTRACT(month FROM timestamp) = ${month}
        AND EXTRACT(year FROM timestamp) = ${year}
      GROUP BY DATE(timestamp)
      ORDER BY date
    `;
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

  async getCount(deviceCode = null) {
    const whereClause = deviceCode ? { deviceCode } : {};
    
    return await prisma.sensorLog.count({
      where: whereClause
    });
  }

  async findHighRainfall(threshold = 5.0, deviceCode = null) {
    const whereClause = {
      rainfall: {
        gte: threshold
      }
    };

    if (deviceCode) {
      whereClause.deviceCode = deviceCode;
    }

    return await prisma.sensorLog.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: true
      }
    });
  }

  async findHighWaterLevel(threshold = 90.0, deviceCode = null) {
    const whereClause = {
      waterLevel: {
        gte: threshold
      }
    };

    if (deviceCode) {
      whereClause.deviceCode = deviceCode;
    }

    return await prisma.sensorLog.findMany({
      where: whereClause,
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