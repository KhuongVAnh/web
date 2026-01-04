#include <Arduino.h>
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ========== WiFi ==========
const char *WIFI_SSID = "Nhan Home";
const char *WIFI_PASSWORD = "nhanhome";

// ========== MQTT HiveMQ Cloud ==========
const char *MQTT_BROKER = "5b91e3ce790f41e78062533f58758704.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char *MQTT_USERNAME = "ESP32";
const char *MQTT_PASSWORD = "Vanh080105";
const char *MQTT_TOPIC_DATA = "esp32/212/data";
const char *MQTT_TOPIC_CONFIG = "esp32/212/config";

// WiFi + MQTT Client
WiFiClientSecure espClient;
PubSubClient client(espClient);

// ========== HC-SR04 ==========
const int trigPin = 27;
const int echoPin = 25;

// ========== BH1750 ==========
BH1750 lightMeter;

// ========== DHT22 ==========
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ========== LED PWM ==========
const int ledPin = 23;
const int ledcChannel = 0;
const int ledcFreq = 5000;    // Tần số PWM 5kHz
const int ledcResolution = 8; // Độ phân giải 8 bit (0-255)

// ========== Tham số hệ thống ==========
volatile unsigned long measurementDurationMs = 10000; // Thời gian đo (ms), tối đa 10s, có thể điều chỉnh qua MQTT
volatile float fs1 = 3;                               // Tần số lấy mẫu HCSR04 (Hz)
volatile float fs2 = 2;                               // Tần số lấy mẫu BH1750 (Hz)
volatile float fs3 = 1;                               // Tần số lấy mẫu DHT (Hz), tối đa 2.5 Hz
volatile int distanceCm = 30;                         // Ngưỡng khoảng cách (cm)
volatile int room = 2;                                // Định danh phòng
volatile int row = 1;                                 // Định danh hàng
volatile int table = 2;                               // Định danh bàn
volatile bool lightOn = false;                        // Bật/tắt đèn cưỡng bức (true: luôn bật, false: luôn tắt)

// ========== Mảng dữ liệu đo ==========
float *distanceArray = nullptr;
float *luxArray = nullptr;
float *temperatureArray = nullptr;
float *humidityArray = nullptr;

size_t distanceArraySize = 0;
size_t distanceCount = 0;
size_t luxArraySize = 0;
size_t luxCount = 0;
size_t temperatureArraySize = 0;
size_t temperatureCount = 0;
size_t humidityArraySize = 0;
size_t humidityCount = 0;

// Flags
volatile bool shouldRestartMeasurement = false;
SemaphoreHandle_t configMutex;
SemaphoreHandle_t mqttMutex;

// ====================================================================
// KẾT NỐI WIFI
// ====================================================================
void connectWiFi()
{
    Serial.print("Dang ket noi WiFi...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi da ket noi!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
}

// ====================================================================
// KẾT NỐI MQTT
// ====================================================================
void connectMQTT()
{
    while (!client.connected())
    {
        Serial.print("Dang ket noi MQTT...");
        if (client.connect("ESP32_Client", MQTT_USERNAME, MQTT_PASSWORD))
        {
            Serial.println(" => Thanh cong!");
            client.subscribe(MQTT_TOPIC_CONFIG, 1);
            Serial.println("Da subscribe topic: " + String(MQTT_TOPIC_CONFIG));
        }
        else
        {
            Serial.print(" => Loi. rc=");
            Serial.println(client.state());
            delay(2000);
        }
    }
}

// ====================================================================
// CALLBACK MQTT - Xử lý lệnh từ broker
// ====================================================================
void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    char message[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';
    Serial.println("Nhan tin nhan tu MQTT: " + String(message));

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, message, length);

    if (error)
    {
        Serial.println("Loi parse JSON: " + String(error.c_str()));
        return;
    }

    if (xSemaphoreTake(configMutex, portMAX_DELAY))
    {
        bool configChanged = false;

        if (doc.containsKey("fs1"))
        {
            float new_fs1 = doc["fs1"].as<float>();
            if (new_fs1 > 0 && new_fs1 != fs1)
            {
                fs1 = new_fs1;
                Serial.println("Cap nhat fs1 = " + String(fs1));
                configChanged = true;
            }
        }
        if (doc.containsKey("fs2"))
        {
            float new_fs2 = doc["fs2"].as<float>();
            if (new_fs2 > 0 && new_fs2 != fs2)
            {
                fs2 = new_fs2;
                Serial.println("Cap nhat fs2 = " + String(fs2));
                configChanged = true;
            }
        }
        if (doc.containsKey("fs3"))
        {
            float new_fs3 = doc["fs3"].as<float>();
            if (new_fs3 > 2.5)
            {
                new_fs3 = 2.5;
                Serial.println("Canh bao: fs3 vuot qua 2.5 Hz, da gioi han ve 2.5 Hz");
            }
            if (new_fs3 > 0 && new_fs3 != fs3)
            {
                fs3 = new_fs3;
                Serial.println("Cap nhat fs3 = " + String(fs3) + " Hz");
                configChanged = true;
            }
        }
    if (doc.containsKey("distanceCm"))
    {
      int new_distanceCm = doc["distanceCm"].as<int>();
      if (new_distanceCm > 0 && new_distanceCm != distanceCm)
      {
        distanceCm = new_distanceCm;
        Serial.println("Cap nhat distanceCm = " + String(distanceCm));
        configChanged = true;
      }
    }
    // Bật/tắt đèn cưỡng bức (giống cách xử lý distanceCm)
    if (doc.containsKey("lightOn"))
    {
      bool new_lightOn = doc["lightOn"].as<bool>();
      if (new_lightOn != lightOn)
      {
        lightOn = new_lightOn;
        Serial.println("Cap nhat lightOn = " + String(lightOn ? "true" : "false"));
        configChanged = true;
      }
    }
    if (doc.containsKey("duration"))
        {
            unsigned long new_duration = doc["duration"].as<unsigned long>();
            if (new_duration < 1000)
            {
                new_duration = 1000;
                Serial.println("Canh bao: duration nho hon 1000ms, da gioi han ve 1000ms");
            }
            else if (new_duration > 60000)
            {
                new_duration = 60000;
                Serial.println("Canh bao: duration lon hon 60000ms, da gioi han ve 60000ms");
            }
            if (new_duration != measurementDurationMs)
            {
                measurementDurationMs = new_duration;
                Serial.println("Cap nhat duration = " + String(measurementDurationMs) + " ms");
                configChanged = true;
            }
        }
        if (doc.containsKey("lightOn"))
        {
            bool new_lightOn = doc["lightOn"].as<bool>();
            if (new_lightOn != lightOn)
            {
                lightOn = new_lightOn;
                Serial.println("Cap nhat lightOn = " + String(lightOn ? "true" : "false"));
                configChanged = true;
            }
        }

        xSemaphoreGive(configMutex);

        if (configChanged)
        {
            shouldRestartMeasurement = true;
            Serial.println("Co thay doi cau hinh, se restart do...");
        }
    }
}

// ====================================================================
// Đọc khoảng cách từ HC-SR04
// ====================================================================
float readDistance()
{
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    long duration = pulseIn(echoPin, HIGH);
    return duration * 0.034 / 2.0;
}

// ====================================================================
// Giải phóng tất cả mảng
// ====================================================================
void freeAllArrays()
{
    if (distanceArray != nullptr)
    {
        free(distanceArray);
        distanceArray = nullptr;
    }
    if (luxArray != nullptr)
    {
        free(luxArray);
        luxArray = nullptr;
    }
    if (temperatureArray != nullptr)
    {
        free(temperatureArray);
        temperatureArray = nullptr;
    }
    if (humidityArray != nullptr)
    {
        free(humidityArray);
        humidityArray = nullptr;
    }

    distanceArraySize = 0;
    luxArraySize = 0;
    temperatureArraySize = 0;
    humidityArraySize = 0;
}

// ====================================================================
// Reset index về 0
// ====================================================================
void resetCounters()
{
    distanceCount = 0;
    luxCount = 0;
    temperatureCount = 0;
    humidityCount = 0;
}

// ====================================================================
// Cấp phát mảng nếu cần
// ====================================================================
bool allocateArraysIfNeeded(size_t size1, size_t size2, size_t size3)
{
    bool needRealloc = false;

    if (distanceArraySize != size1)
    {
        if (distanceArray != nullptr)
        {
            free(distanceArray);
        }
        distanceArray = (float *)malloc(size1 * sizeof(float));
        if (distanceArray == nullptr)
            return false;
        distanceArraySize = size1;
        needRealloc = true;
    }

    if (luxArraySize != size2)
    {
        if (luxArray != nullptr)
        {
            free(luxArray);
        }
        luxArray = (float *)malloc(size2 * sizeof(float));
        if (luxArray == nullptr)
            return false;
        luxArraySize = size2;
        needRealloc = true;
    }

    if (temperatureArraySize != size3)
    {
        if (temperatureArray != nullptr)
        {
            free(temperatureArray);
        }
        temperatureArray = (float *)malloc(size3 * sizeof(float));
        if (temperatureArray == nullptr)
            return false;
        temperatureArraySize = size3;
        needRealloc = true;
    }

    if (humidityArraySize != size3)
    {
        if (humidityArray != nullptr)
        {
            free(humidityArray);
        }
        humidityArray = (float *)malloc(size3 * sizeof(float));
        if (humidityArray == nullptr)
            return false;
        humidityArraySize = size3;
        needRealloc = true;
    }

    return true;
}

// ====================================================================
// Gửi dữ liệu lên MQTT broker
// ====================================================================
void sendDataToMQTT(int qos = 0)
{
    if (xSemaphoreTake(mqttMutex, pdMS_TO_TICKS(5000)) == pdTRUE)
    {
        if (!client.connected())
        {
            connectMQTT();
        }

        float local_fs1, local_fs2, local_fs3;
        int local_distanceCm;
        unsigned long local_duration;
        int local_room, local_row, local_table;
        bool local_lightOn;

        if (xSemaphoreTake(configMutex, portMAX_DELAY))
        {
            local_fs1 = fs1;
            local_fs2 = fs2;
            local_fs3 = fs3;
            local_distanceCm = distanceCm;
            local_duration = measurementDurationMs;
            local_room = room;
            local_row = row;
            local_table = table;
            local_lightOn = lightOn;
            xSemaphoreGive(configMutex);
        }

        Serial.println("Bat dau gui du lieu len broker (QoS=" + String(qos) + ")...");

        size_t estimatedSize = (distanceCount + luxCount + temperatureCount + humidityCount) * 15 + 500;
        DynamicJsonDocument doc(estimatedSize < 4096 ? 4096 : estimatedSize);

        JsonObject distanceObj = doc.createNestedObject("distance");
        distanceObj["fs"] = local_fs1;
        JsonArray distanceData = distanceObj.createNestedArray("data");
        if (distanceArray != nullptr)
        {
            for (size_t i = 0; i < distanceCount; i++)
            {
                distanceData.add(distanceArray[i]);
            }
        }

        if (luxCount > 0 && luxArray != nullptr)
        {
            JsonObject luxObj = doc.createNestedObject("lux");
            luxObj["fs"] = local_fs2;
            JsonArray luxData = luxObj.createNestedArray("data");
            for (size_t i = 0; i < luxCount; i++)
            {
                luxData.add(luxArray[i]);
            }
        }

        JsonObject dhtObj = doc.createNestedObject("dht");
        dhtObj["fs"] = local_fs3;

        JsonArray tempData = dhtObj.createNestedArray("temperature");
        if (temperatureArray != nullptr)
        {
            for (size_t i = 0; i < temperatureCount; i++)
            {
                tempData.add(temperatureArray[i]);
            }
        }

        JsonArray humiData = dhtObj.createNestedArray("humidity");
        if (humidityArray != nullptr)
        {
            for (size_t i = 0; i < humidityCount; i++)
            {
                humiData.add(humidityArray[i]);
            }
        }

        JsonObject metaObj = doc.createNestedObject("meta");
        metaObj["duration"] = local_duration;
        metaObj["distanceCm"] = local_distanceCm;
        metaObj["room"] = local_room;
        metaObj["row"] = local_row;
        metaObj["table"] = local_table;
        metaObj["lightOn"] = local_lightOn;

        size_t jsonSize = measureJson(doc) + 1;
        char *payload = (char *)malloc(jsonSize);

        if (payload != nullptr)
        {
            serializeJson(doc, payload, jsonSize);
            Serial.println("Kich thuoc JSON: " + String(jsonSize - 1) + " bytes");

            if (!client.connected())
            {
                Serial.println("MQTT da mat ket noi, dang ket noi lai...");
                connectMQTT();
            }

            bool publishResult = client.publish(MQTT_TOPIC_DATA, (uint8_t *)payload, jsonSize - 1, qos > 0);

            if (publishResult)
            {
                Serial.println("Gui du lieu thanh cong!");
            }
            else
            {
                Serial.print("Loi khi gui du lieu! State: ");
                Serial.println(client.state());
                if (client.state() != MQTT_CONNECTED)
                {
                    client.disconnect();
                    connectMQTT();
                }
            }

            free(payload);
        }
        else
        {
            Serial.println("LOI: Khong the cap phat bo nho cho JSON payload!");
        }

        xSemaphoreGive(mqttMutex);
    }
    else
    {
        Serial.println("LOI: Khong the lay mutex MQTT!");
    }
}

// ====================================================================
// LUỒNG 1: Đo dữ liệu và gửi MQTT
// ====================================================================
void measurementTask(void *parameter)
{
    Serial.println("Luong do du lieu va gui MQTT bat dau...");

    while (true)
    {
        float local_fs1, local_fs2, local_fs3;
        int local_distanceCm;
        unsigned long local_duration;
        bool local_lightOn;

        if (xSemaphoreTake(configMutex, portMAX_DELAY))
        {
            local_fs1 = fs1;
            local_fs2 = fs2;
            local_fs3 = fs3;
            local_distanceCm = distanceCm;
            local_duration = measurementDurationMs;
            local_lightOn = lightOn;
            xSemaphoreGive(configMutex);
        }

        if (local_fs3 > 2.5)
        {
            local_fs3 = 2.5;
            Serial.println("Canh bao: fs3 da duoc gioi han ve 2.5 Hz trong measurementTask");
        }

        float durationSeconds = local_duration / 1000.0;
        size_t size1 = (local_fs1 > 0) ? (size_t)(local_fs1 * durationSeconds) + 1 : 1;
        size_t size2 = (local_fs2 > 0) ? (size_t)(local_fs2 * durationSeconds) + 1 : 1;
        size_t size3 = (local_fs3 > 0) ? (size_t)(local_fs3 * durationSeconds) + 1 : 1;

        Serial.println("Cau hinh: fs1=" + String(local_fs1) + "Hz, fs2=" + String(local_fs2) + "Hz, fs3=" + String(local_fs3) + "Hz");

        if (!allocateArraysIfNeeded(size1, size2, size3))
        {
            Serial.println("LOI: Khong the cap phat bo nho!");
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        resetCounters();
        shouldRestartMeasurement = false;

        unsigned long period1_ms = (local_fs1 > 0) ? (unsigned long)(1000.0 / local_fs1) : 1000;
        unsigned long period2_ms = (local_fs2 > 0) ? (unsigned long)(1000.0 / local_fs2) : 1000;
        unsigned long period3_ms = (local_fs3 > 0) ? (unsigned long)(1000.0 / local_fs3) : 1000;

        Serial.println("Bat dau do du lieu trong " + String(local_duration) + " ms...");

        unsigned long startTime = millis();
        unsigned long lastTime1 = 0;
        unsigned long lastTime2 = 0;
        unsigned long lastTime3 = 0;

        while ((millis() - startTime) < local_duration)
        {
            if (shouldRestartMeasurement)
            {
                Serial.println("Co thay doi cau hinh, dung do va bat dau lai...");
                shouldRestartMeasurement = false;
                break;
            }

            unsigned long currentTime = millis();

            if ((currentTime - lastTime1) >= period1_ms)
            {
                float dist = readDistance();
                if (distanceCount < distanceArraySize)
                {
                    distanceArray[distanceCount++] = dist;
                }
                lastTime1 = currentTime;
            }

            if (!local_lightOn)
            {
                ledcWrite(ledcChannel, 0); // Tắt đèn cưỡng bức
            }
            else if ((currentTime - lastTime2) >= period2_ms)
            {
                float lux = lightMeter.readLightLevel();
                if (luxCount < luxArraySize)
                {
                    luxArray[luxCount++] = lux;
                }

                int duty = (int)(255 - 255 * lux / 200);
                if (duty < 0)
                {
                    duty = 0;
                }
                if (duty > 255)
                {
                    duty = 255;
                }
                ledcWrite(ledcChannel, duty);

                lastTime2 = currentTime;
            }

            if ((currentTime - lastTime3) >= period3_ms)
            {
                float temp = dht.readTemperature();
                float humi = dht.readHumidity();

                if (temperatureCount < temperatureArraySize)
                {
                    temperatureArray[temperatureCount++] = temp;
                }
                if (humidityCount < humidityArraySize)
                {
                    humidityArray[humidityCount++] = humi;
                }
                lastTime3 = currentTime;
            }

            vTaskDelay(pdMS_TO_TICKS(100));
        }

        if (!shouldRestartMeasurement)
        {
            Serial.println("Ket thuc do du lieu:");
            Serial.println("  Distance: " + String(distanceCount));
            Serial.println("  Lux: " + String(luxCount));
            Serial.println("  Temperature: " + String(temperatureCount));
            Serial.println("  Humidity: " + String(humidityCount));

            int qos = local_lightOn ? 1 : 0;
            Serial.println("Gui du lieu theo chu ky (QoS " + String(qos) + ")...");
            sendDataToMQTT(qos);
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

// ====================================================================
// LUỒNG 2: Lắng nghe sự kiện MQTT
// ====================================================================
void mqttListenerTask(void *parameter)
{
    Serial.println("Luong lang nghe MQTT bat dau...");

    while (true)
    {
        if (xSemaphoreTake(mqttMutex, pdMS_TO_TICKS(100)) == pdTRUE)
        {
            if (!client.connected())
            {
                connectMQTT();
            }
            client.loop();
            xSemaphoreGive(mqttMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// ====================================================================
// SETUP
// ====================================================================
void setup()
{
    Serial.begin(9600);
    delay(1000);

    Serial.println("\n=== KHOI DONG HE THONG ===");

    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);

    Wire.begin(21, 22);
    if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE))
    {
        Serial.println("BH1750 khoi tao thanh cong");
    }

    dht.begin();

    ledcSetup(ledcChannel, ledcFreq, ledcResolution);
    ledcAttachPin(ledPin, ledcChannel);
    ledcWrite(ledcChannel, 0);
    Serial.println("LED PWM khoi tao thanh cong");

    connectWiFi();
    espClient.setInsecure();
    client.setServer(MQTT_BROKER, MQTT_PORT);
    client.setCallback(mqttCallback);
    client.setBufferSize(1024);
    client.setKeepAlive(60);
    connectMQTT();

    configMutex = xSemaphoreCreateMutex();
    mqttMutex = xSemaphoreCreateMutex();

    if (configMutex == NULL || mqttMutex == NULL)
    {
        Serial.println("LOI: Khong the tao mutex!");
        while (1)
            delay(1000);
    }

    xTaskCreatePinnedToCore(
        measurementTask,
        "MeasurementTask",
        8192,
        NULL,
        2,
        NULL,
        1);

    xTaskCreatePinnedToCore(
        mqttListenerTask,
        "MQTTListenerTask",
        4096,
        NULL,
        1,
        NULL,
        0);

    Serial.println("=== HE THONG SAN SANG ===");
}

// ====================================================================
// LOOP
// ====================================================================
void loop()
{
    vTaskDelay(pdMS_TO_TICKS(1000));
}
