#!/bin/bash

# Konfigurasi broker
BROKER_HOST="mqtt.binatra.id"
BROKER_PORT=1883
INTERVAL=900

# MQTT Auth
MQTT_USERNAME="binatra-device"
MQTT_PASSWORD="binatra_device_mqtt_25"

# Topik yang akan dikirim
TOPIC="binatra-device/68D08/sensor"

echo "Starting MQTT dummy sender..."
echo "Broker: $BROKER_HOST:$BROKER_PORT"
echo "Topic:  $TOPIC"
echo "----------------------------"

# Inisialisasi
WATERLEVEL=30
DEVICE_CODE="68D08"
DEVICE_CALIBRATION=100

while true; do
    CHANGE=$((RANDOM % 3 - 1))
    WATERLEVEL=$((WATERLEVEL + CHANGE))

    if [ "$WATERLEVEL" -lt 10 ]; then
        WATERLEVEL=10
    elif [ "$WATERLEVEL" -gt 50 ]; then
        WATERLEVEL=50
    fi

    DEPTH=$((DEVICE_CALIBRATION - WATERLEVEL))
    VOLTAGE=$(printf "%.1f" "$(echo "4 + $RANDOM/32767" | bc -l)")
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

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

    mosquitto_pub \
      -h "$BROKER_HOST" \
      -p "$BROKER_PORT" \
      -u "$MQTT_USERNAME" \
      -P "$MQTT_PASSWORD" \
      -t "$TOPIC" \
      -m "$PAYLOAD"

    echo "Published:"
    echo "$PAYLOAD"
    echo "----------------------------"

    sleep $INTERVAL
done
