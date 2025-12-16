#!/bin/bash

# Konfigurasi broker
BROKER_HOST="mqtt.binatra.id"
BROKER_PORT=1883
INTERVAL=900            # interval data sensor (15 menit)
HEARTBEAT_INTERVAL=300  # interval heartbeat (5 menit)

# MQTT Auth
MQTT_USERNAME="binatra-device"
MQTT_PASSWORD="binatra_device_mqtt_25"

# Topik
DEVICE_CODE="68D08"
TOPIC_SENSOR="binatra-device/$DEVICE_CODE/sensor"
TOPIC_HEARTBEAT="binatra-device/$DEVICE_CODE/heartbeat"

# Inisialisasi
WATERLEVEL=30
DEVICE_CALIBRATION=100
VOLTAGE=4.5
LAST_HEARTBEAT=$(date +%s)

while true; do
    NOW=$(date +%s)

    # ===== Data sensor =====
    CHANGE=$((RANDOM % 3 - 1))
    WATERLEVEL=$((WATERLEVEL + CHANGE))
    WATERLEVEL=$(( WATERLEVEL < 10 ? 10 : WATERLEVEL > 50 ? 50 : WATERLEVEL ))
    DEPTH=$((DEVICE_CALIBRATION - WATERLEVEL))
    VOLTAGE=$(printf "%.1f" "$(echo "$VOLTAGE + ($RANDOM%3 - 1)*0.1" | bc -l)")
    VOLTAGE=$(printf "%.1f" "$(echo "$VOLTAGE < 4 ? 4 : $VOLTAGE > 5 ? 5 : $VOLTAGE" | bc -l)")
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

    PAYLOAD_SENSOR=$(cat <<EOF
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

    mosquitto_pub -h "$BROKER_HOST" -p "$BROKER_PORT" -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
                   -t "$TOPIC_SENSOR" -m "$PAYLOAD_SENSOR"

    echo "Published sensor data:"
    echo "$PAYLOAD_SENSOR"
    echo "----------------------------"

    # ===== Heartbeat setiap 5 menit =====
    if [ $((NOW - LAST_HEARTBEAT)) -ge $HEARTBEAT_INTERVAL ]; then
        PAYLOAD_HEARTBEAT="{\"deviceCode\":\"$DEVICE_CODE\"}"
        mosquitto_pub -h "$BROKER_HOST" -p "$BROKER_PORT" -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" \
                       -t "$TOPIC_HEARTBEAT" -m "$PAYLOAD_HEARTBEAT"
        echo "Published heartbeat:"
        echo "$PAYLOAD_HEARTBEAT"
        echo "----------------------------"
        LAST_HEARTBEAT=$NOW
    fi

    sleep $INTERVAL
done
