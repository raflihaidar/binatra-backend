#!/bin/bash

# Konfigurasi broker
BROKER_HOST="localhost"
BROKER_PORT=1883
INTERVAL=900  # detik

# Topik yang akan dikirim
TOPIC="binatra-device/68D08/sensor"

echo "Starting MQTT dummy sender..."
echo "Broker: $BROKER_HOST:$BROKER_PORT"
echo "Topic:  $TOPIC"
echo "----------------------------"

# Inisialisasi waterlevel awal (misal 30)
WATERLEVEL=30
DEVICE_CODE="68D08"
DEVICE_CALIBRATION=100

while true; do
    # Buat perubahan kecil: ±1 atau ±2
    CHANGE=$((RANDOM % 3 - 1))  # -1, 0, atau +1
    WATERLEVEL=$((WATERLEVEL + CHANGE))

    # Batasi supaya tetap di range 10-50
    if [ "$WATERLEVEL" -lt 10 ]; then
        WATERLEVEL=10
    elif [ "$WATERLEVEL" -gt 50 ]; then
        WATERLEVEL=50
    fi

    # Hitung depth
    DEPTH=$((DEVICE_CALIBRATION - WATERLEVEL))

    # Voltage random tipis
    VOLTAGE=$(printf "%.1f" "$(echo "4 + $RANDOM/32767" | bc -l)")

    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

    # Format payload
    PAYLOAD=$(cat <<EOF
{
  "deviceCode": "$DEVICE_CODE",
  "waterlevel": $WATERLEVEL,
  "depth": $DEPTH,
  "voltage": $VOLTAGE,
  "deviceCalibration": $DEVICE_CALIBRATION,
  "timestamp": "$TIMESTAMP"
}
EOF
)

    # Publish ke MQTT
    mosquitto_pub -h "$BROKER_HOST" -p "$BROKER_PORT" -t "$TOPIC" -m "$PAYLOAD"

    echo "Published:"
    echo "$PAYLOAD"
    echo "----------------------------"

    sleep $INTERVAL
done
