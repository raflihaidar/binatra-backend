import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nilai konfigurasi sensor
const TANK_HEIGHT = 120; // cm

async function main() {
  console.log("Generating dummy device data...");

  // Ambil semua data dari device 1
  const device1Data = await prisma.sensorLog.findMany({
    where: { deviceCode: '68D08' },
    orderBy: { timestamp: "asc" },
  });

  console.log(`Found ${device1Data.length} records from device 68D08.`);

  if (device1Data.length > 0) {
    // Ambil timestamp terakhir dari device1Data
    const lastTimestamp = device1Data[device1Data.length - 1].timestamp;

    const location = await prisma.location.create({
      data: {
        name: "Sungai Pak Nur",
        address: "",
        city: "",
        province: "Jawa Timur",
        latitude: -7.307812373,
        longitude: 112.80023485,
        currentStatus: 'AMAN',
        currentWaterLevel: 57,
        currentRainfall: 0,
        amanMax: 80,
        waspadaMin: 81,
        waspadaMax: 110,
        siagaMin: 111,
        siagaMax: 120,
        bahayaMin: 121,
        isActive: true,
      }
    });

    const device2 = await prisma.device.create({
      data: {
        code: '68D05',
        description: 'Device 2',
        status: 'DISCONNECTED',
        locationId: location.id,
        calibration: TANK_HEIGHT,
        name: '',
        periode : 900,
        updatedAt: lastTimestamp
      }
    });

    let prevStatus = 'AMAN';
    for (const row of device1Data) {

      // Hitung rawValue dummy
      let rawValue = row.waterLevel - 10.000;
      rawValue = Math.floor(rawValue * 1000) / 1000;

      let levelAir = TANK_HEIGHT - rawValue;
      levelAir =  Math.floor(levelAir * 1000) / 1000;

      let newStatus = 'AMAN';

      if (levelAir <= location.amanMax) newStatus = 'AMAN';
      else if (levelAir >= location.waspadaMin && levelAir <= location.waspadaMax) newStatus = 'WASPADA';
      else if (levelAir >= location.siagaMin && levelAir <= location.siagaMax) newStatus = 'SIAGA';
      else if (levelAir >= location.bahayaMin) newStatus = 'BAHAYA';

      await prisma.sensorLog.create({
        data: {
          waterLevel: rawValue,
          rainfall: row.rainfall,
          deviceCode: device2.code,
          depth: levelAir,
          deviceCalibration: TANK_HEIGHT,
          voltage: row.voltage,
          timestamp : row.timestamp
        }
      });

      await prisma.locationStatusHistory.create({
        data: {
          locationId: location.id,
          waterLevel: levelAir,
          previousStatus: prevStatus,
          newStatus: newStatus,
          recordedAt: row.createdAt,
        }
      });

      prevStatus = newStatus;
    }

    console.log("Dummy data for device 68D05 and locationStatusHistory generated successfully.");
  } else {
    console.log("No data found for device 68D08, nothing to generate.");
  }
}

main()
  .catch(err => {
    console.error("Seeder error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
