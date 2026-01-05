#include <Arduino.h>
#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <cstring>

// Chương trình ESP32 đọc cảm biến (HC-SR04, BH1750, DHT), lưu dữ liệu vào đệm cố định (pre-allocate một lần),
// phát hiện thay đổi trạng thái (khoảng cách) để gửi MQTT ngay lập tức, và gửi theo chu kỳ với QoS tùy cấu hình.
// Các biến trạng thái chính:
// - previousTriggeredState: trạng thái bàn học lần trước (dựa trên khoảng cách) để phát hiện đổi trạng thái.
// - stateChanged: bật khi giá trị hiện tại khác previousTriggeredState; gửi MQTT ngay với các mẫu đã đo đến thời điểm đó.
// - shouldRestartMeasurement: được MQTT config đặt khi có thay đổi cấu hình; measurementTask kiểm tra và dừng chu kỳ hiện tại.
// - restartRequested: cờ nội bộ measurementTask, true khi shouldRestartMeasurement được phát hiện, để bỏ gửi cuối chu kỳ.
// - distanceCount/luxCount/temperatureCount/humidityCount: số mẫu đã ghi trong đệm cố định; sendDataToMQTT chỉ serialize đến các count này.
// Sau mỗi lần gửi chỉ reset đệm/counters để tránh phân mảnh bộ nhớ.

// ========== WiFi ==========
const char *WIFI_SSID = "Vankkk";
const char *WIFI_PASSWORD = "vanhhhhh";

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

const float FS_MAX = 10.0f;
const unsigned long DURATION_MAX_MS = 60000;
const size_t MAX_SAMPLES = (size_t)(FS_MAX * (DURATION_MAX_MS / 1000.0f)) + 1;

// ========== Tham số hệ thống ==========
volatile unsigned long measurementDurationMs = 4000; // Thời gian đo (ms), tối đa 60s, có thể điều chỉnh qua MQTT
volatile float fs1 = 3;                              // Tần số lấy mẫu HCSR04 (Hz)
volatile float fs2 = 2;                              // Tần số lấy mẫu BH1750 (Hz)
volatile float fs3 = 1;                              // Tần số lấy mẫu DHT (Hz), tối đa 2.5 Hz
volatile int distanceCm = 60;                        // Ngưỡng khoảng cách (cm)
volatile int room = 2;                               // Định danh phòng
volatile int row = 1;                                // Định danh hàng
volatile int table = 2;                              // Định danh bàn
volatile bool lightOn = false;                       // Bật/tắt đèn cưỡng bức (true: luôn bật, false: luôn tắt)

// ========== Mảng dữ liệu đo ==========
float *distanceArray = nullptr;
float *luxArray = nullptr;
float *temperatureArray = nullptr;
float *humidityArray = nullptr;

size_t distanceArraySize = MAX_SAMPLES;
size_t distanceCount = 0;
size_t luxArraySize = MAX_SAMPLES;
size_t luxCount = 0;
size_t temperatureArraySize = MAX_SAMPLES;
size_t temperatureCount = 0;
size_t humidityArraySize = MAX_SAMPLES;
size_t humidityCount = 0;

// Flags
volatile bool shouldRestartMeasurement = false;
SemaphoreHandle_t configMutex;
SemaphoreHandle_t mqttMutex;
bool buffersInitialized = false;

// ====================================================================
// KẾT NỐI WIFI
// ====================================================================
// Kết nối WiFi, chờ đến khi thành công và in ra địa chỉ IP.
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
// Kết nối MQTT broker, subscribe topic cấu hình, retry khi lỗi.
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
// Parse JSON cấu hình, cập nhật tham số đo và bật cờ shouldRestartMeasurement khi có thay đổi.
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
// Phát xung, đo thời gian phản hồi và đổi ra cm.
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
// Free mọi đệm và reset kích thước/cờ khởi tạo.
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

    distanceArraySize = MAX_SAMPLES;
    luxArraySize = MAX_SAMPLES;
    temperatureArraySize = MAX_SAMPLES;
    humidityArraySize = MAX_SAMPLES;
    buffersInitialized = false;
}

// ====================================================================
// Reset index về 0
// ====================================================================
// Đặt lại counters của đệm về 0.
void resetCounters()
{
    distanceCount = 0;
    luxCount = 0;
    temperatureCount = 0;
    humidityCount = 0;
}

// ====================================================================
// Khởi tạo bộ đệm cố định một lần
// ====================================================================
// Cấp phát 4 đệm theo MAX_SAMPLES, đặt buffersInitialized; freeAll nếu lỗi.
bool initBuffersOnce()
{
    if (buffersInitialized)
    {
        return true;
    }

    distanceArray = (float *)malloc(distanceArraySize * sizeof(float));
    luxArray = (float *)malloc(luxArraySize * sizeof(float));
    temperatureArray = (float *)malloc(temperatureArraySize * sizeof(float));
    humidityArray = (float *)malloc(humidityArraySize * sizeof(float));

    if (!distanceArray || !luxArray || !temperatureArray || !humidityArray)
    {
        Serial.println("LOI: Khong the cap phat bo nho co dinh!");
        freeAllArrays();
        return false;
    }

    buffersInitialized = true;
    return true;
}

// ====================================================================
// Xóa dữ liệu đã dùng trong đệm (không giải phóng)
// ====================================================================
// Ghi 0 vào phần dữ liệu đã sử dụng theo các count đầu vào.
void clearUsedBuffers(size_t dCount, size_t lCount, size_t tCount, size_t hCount)
{
    if (distanceArray && dCount > 0)
    {
        memset(distanceArray, 0, dCount * sizeof(float));
    }
    if (luxArray && lCount > 0)
    {
        memset(luxArray, 0, lCount * sizeof(float));
    }
    if (temperatureArray && tCount > 0)
    {
        memset(temperatureArray, 0, tCount * sizeof(float));
    }
    if (humidityArray && hCount > 0)
    {
        memset(humidityArray, 0, hCount * sizeof(float));
    }
}

// ====================================================================
// Gửi dữ liệu lên MQTT broker
// ====================================================================
// Serialize dữ liệu từ đệm đến số mẫu được truyền vào, publish với QoS lựa chọn.
void sendDataToMQTT(size_t dCount, size_t lCount, size_t tCount, size_t hCount, int qos = 0)
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

        size_t estimatedSize = (dCount + lCount + tCount + hCount) * 15 + 500;
        DynamicJsonDocument doc(estimatedSize < 4096 ? 4096 : estimatedSize);

        JsonObject distanceObj = doc.createNestedObject("distance");
        distanceObj["fs"] = local_fs1;
        JsonArray distanceData = distanceObj.createNestedArray("data");
        if (distanceArray != nullptr)
        {
            for (size_t i = 0; i < dCount; i++)
            {
                distanceData.add(distanceArray[i]);
            }
        }

        if (lCount > 0 && luxArray != nullptr)
        {
            JsonObject luxObj = doc.createNestedObject("lux");
            luxObj["fs"] = local_fs2;
            JsonArray luxData = luxObj.createNestedArray("data");
            for (size_t i = 0; i < lCount; i++)
            {
                luxData.add(luxArray[i]);
            }
        }

        JsonObject dhtObj = doc.createNestedObject("dht");
        dhtObj["fs"] = local_fs3;

        JsonArray tempData = dhtObj.createNestedArray("temperature");
        if (temperatureArray != nullptr)
        {
            for (size_t i = 0; i < tCount; i++)
            {
                tempData.add(temperatureArray[i]);
            }
        }

        JsonArray humiData = dhtObj.createNestedArray("humidity");
        if (humidityArray != nullptr)
        {
            for (size_t i = 0; i < hCount; i++)
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
// Vòng lặp đo theo fs1/fs2/fs3, lưu vào đệm cố định, 
// phát hiện stateChanged từ cảm biến khoảng cách để gửi ngay; gửi chu kỳ khi hết duration trừ khi restartRequested.
void measurementTask(void *parameter)
{
    Serial.println("Luong do du lieu va gui MQTT bat dau...");

    bool previousTriggeredState = false; // Trạng thái kích hoạt trước đó

    if (!initBuffersOnce())
    {
        Serial.println("Dung measurementTask vi khong co bo dem hop le");
        vTaskDelay(portMAX_DELAY);
    }

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

        Serial.println("Cau hinh: fs1=" + String(local_fs1) + "Hz, fs2=" + String(local_fs2) + "Hz, fs3=" + String(local_fs3) + "Hz");

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
        bool stateChanged = false;
        bool restartRequested = false;

        while ((millis() - startTime) < local_duration)
        {
            if (shouldRestartMeasurement)
            {
                Serial.println("Co thay doi cau hinh, dung do va bat dau lai...");
                restartRequested = true;
                shouldRestartMeasurement = false;
                break;
            }

            unsigned long currentTime = millis();

            if ((currentTime - lastTime1) >= period1_ms)
            {
                float dist = readDistance();

                bool currentTriggered = (local_distanceCm > 4) && ((dist < local_distanceCm) || (dist>1200));

                // Kiểm tra thay đổi trạng thái
                if (currentTriggered != previousTriggeredState)
                {
                    stateChanged = true;
                    previousTriggeredState = currentTriggered;
                    Serial.println("Phat hien thay doi trang thai: " + String(currentTriggered ? "Kich hoat" : "Khong kich hoat"));
                }

                if (distanceCount < distanceArraySize)
                {
                    distanceArray[distanceCount++] = dist;
                }
                else
                {
                    Serial.println("Canh bao: Bo dem distance day, bo qua mau");
                }
                lastTime1 = currentTime;
            }

            if (!local_lightOn || local_distanceCm <=4)
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
                else
                {
                    Serial.println("Canh bao: Bo dem lux day, bo qua mau");
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
                else
                {
                    Serial.println("Canh bao: Bo dem temperature day, bo qua mau");
                }
                if (humidityCount < humidityArraySize)
                {
                    humidityArray[humidityCount++] = humi;
                }
                else
                {
                    Serial.println("Canh bao: Bo dem humidity day, bo qua mau");
                }
                lastTime3 = currentTime;
            }

            // Nếu có thay đổi trạng thái, gửi ngay lập tức với QoS 1
            if (stateChanged)
            {
                Serial.println("Gui ngay lap tuc do thay doi trang thai (QoS 1)...");
                sendDataToMQTT(distanceCount, luxCount, temperatureCount, humidityCount, 1);
                clearUsedBuffers(distanceCount, luxCount, temperatureCount, humidityCount);
                resetCounters();
                stateChanged = false;
                restartRequested = true; // bắt đầu chu kỳ đo mới sau khi gửi ngay
                break;
            }

            vTaskDelay(pdMS_TO_TICKS(100));
        }

        if (!restartRequested)
        {
            Serial.println("Ket thuc do du lieu:");
            Serial.println("  Distance: " + String(distanceCount));
            Serial.println("  Lux: " + String(luxCount));
            Serial.println("  Temperature: " + String(temperatureCount));
            Serial.println("  Humidity: " + String(humidityCount));

            int qos = local_lightOn ? 1 : 0;
            Serial.println("Gui du lieu theo chu ky (QoS " + String(qos) + ")...");
            sendDataToMQTT(distanceCount, luxCount, temperatureCount, humidityCount, qos);
            clearUsedBuffers(distanceCount, luxCount, temperatureCount, humidityCount);
            resetCounters();
        }
        else
        {
            clearUsedBuffers(distanceCount, luxCount, temperatureCount, humidityCount);
            resetCounters();
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

// ====================================================================
// LUỒNG 2: Lắng nghe sự kiện MQTT
// ====================================================================
// Vòng lặp duy trì kết nối MQTT và xử lý client.loop() an toàn mutex.
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
// Khởi tạo serial, cảm biến, PWM, WiFi/MQTT, mutex, bộ đệm và tạo các task.
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

    if (!initBuffersOnce())
    {
        Serial.println("LOI: Khong the khoi tao bo dem, dung chuong trinh");
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
// Nhường CPU vì mọi việc chạy trong FreeRTOS task.
void loop()
{
    vTaskDelay(pdMS_TO_TICKS(1000));
}
