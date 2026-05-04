// THE BOX — C3 Dongle Bridge v1.0
// ESP32-C3 SuperMini: ESP-NOW receiver → USB Serial bridge
// No WiFi AP. No Supabase. Pure radio-to-serial.

#include <esp_now.h>
#include <WiFi.h>

#define LED_PIN 8
#define BAUD    115200
#define QUEUE_SIZE 16

typedef struct __attribute__((packed)) {
    uint8_t  msgType;
    uint8_t  action;
    uint16_t seq;
    uint32_t timestamp;
    uint8_t  senderMac[6];
} EspNowPacket;

static const char* ACTION_STRINGS[] = {
    "SCORE_A1", "SCORE_A2", "SCORE_A3",
    "SCORE_B1", "SCORE_B2", "SCORE_B3",
    "CLOCK_START", "CLOCK_STOP",
    "SHOT_CLOCK_24", "SHOT_CLOCK_14",
    "UNDO", "SETTINGS", "NEXT_PERIOD",
    "ADD_FOUL_A", "ADD_FOUL_B"
};
#define ACTION_COUNT (sizeof(ACTION_STRINGS) / sizeof(ACTION_STRINGS[0]))

static QueueHandle_t recvQueue;
static uint16_t      lastSeq[20];
static uint8_t       senderMacs[20][6];
static int           senderCount = 0;

void sendClockTick(uint32_t gameMs, bool running) {
    // Stub — bidirectional clock sync, not yet active
}

static void IRAM_ATTR onRecv(const esp_now_recv_info_t* info,
                              const uint8_t* data, int len) {
    if (len != sizeof(EspNowPacket)) return;
    EspNowPacket pkt;
    memcpy(&pkt, data, sizeof(EspNowPacket) - 6);
    memcpy(pkt.senderMac, info->src_addr, 6);
    BaseType_t woke = pdFALSE;
    xQueueSendFromISR(recvQueue, &pkt, &woke);
    portYIELD_FROM_ISR(woke);
}

static int getSenderIdx(const uint8_t* mac) {
    for (int i = 0; i < senderCount; i++)
        if (memcmp(senderMacs[i], mac, 6) == 0) return i;
    if (senderCount >= 20) return 0;
    memcpy(senderMacs[senderCount], mac, 6);
    lastSeq[senderCount] = 0xFFFF;
    return senderCount++;
}

static void bridgeTask(void* arg) {
    EspNowPacket pkt;
    for (;;) {
        if (xQueueReceive(recvQueue, &pkt, portMAX_DELAY) != pdTRUE) continue;
        if (pkt.msgType != 0) continue;
        int idx = getSenderIdx(pkt.senderMac);
        uint16_t diff = pkt.seq - lastSeq[idx];
        if (diff == 0 || diff > 32768) continue;
        lastSeq[idx] = pkt.seq;
        if (pkt.action < ACTION_COUNT) {
            Serial.println(ACTION_STRINGS[pkt.action]);
        } else {
            Serial.println("UNKNOWN_ACTION");
        }
        digitalWrite(LED_PIN, LOW);
        vTaskDelay(pdMS_TO_TICKS(50));
        digitalWrite(LED_PIN, HIGH);
    }
}

void setup() {
    Serial.begin(BAUD);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH);
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    recvQueue = xQueueCreate(QUEUE_SIZE, sizeof(EspNowPacket));
    if (esp_now_init() != ESP_OK) {
        Serial.println("ESPNOW_INIT_FAILED");
        return;
    }
    esp_now_register_recv_cb(onRecv);
    Serial.println("ESPNOW_READY");
    xTaskCreatePinnedToCore(bridgeTask, "bridge", 4096, NULL, 2, NULL, 0);
}

void loop() {
    if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.startsWith("CLK:")) {
            int c1 = line.indexOf(':', 4);
            if (c1 > 0) {
                uint32_t gameMs = line.substring(4, c1).toInt();
                bool running    = line.substring(c1 + 1).toInt() == 1;
                sendClockTick(gameMs, running);
            }
        }
    }
    delay(10);
}
