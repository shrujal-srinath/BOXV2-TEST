/*
 * ================================================================
 * THE BOX — ESP32 Firmware v8.0
 * BMSCE Sports Tech Division
 * ================================================================
 *
 * CHANGES FROM v7.0:
 *
 * [FIX 1]  CRITICAL: Session code now persists across reboots via NVS
 *          Preferences. A reboot mid-game no longer generates a new
 *          code and loses the website pairing.
 *
 * [FIX 2]  CRITICAL: supaRegister() no longer overwrites status,
 *          host_id or active_game_id when the row already exists.
 *          Only local_ip is patched. An active game survives a reboot.
 *
 * [FIX 3]  Settings overlay: static bool drawn now resets correctly
 *          on close so it redraws on second open.
 *
 * [PERF 1] Broadcast queue now uses fixed char[512] structs instead
 *          of heap-allocated String* pointers. Eliminates malloc/free
 *          churn per broadcast — kills long-session heap fragmentation.
 *
 * [PERF 2] broadcastTask reuses a single persistent WiFiClientSecure
 *          + HTTPClient connection. Reconnects only on failure.
 *          Drops per-broadcast latency from ~300ms to ~50ms by
 *          skipping the TLS handshake on every message.
 *
 * [PERF 3] buildBroadcastJson() replaced with snprintf into char[512].
 *          No String heap allocation anywhere in the hot broadcast path.
 *
 * [PERF 4] supaRegister() and pollTask use WiFiClientSecure with
 *          setInsecure() — already correct. No change needed.
 *
 * [PERF 5] clkSecs() and shotSecs() called once per frame and cached
 *          in local variables. Eliminates repeated millis() arithmetic
 *          in tight display paths.
 *
 * [PERF 6] heartbeatTask interval increased 10s → 15s. Heartbeat is
 *          only used for online/offline detection — 15s is fine and
 *          halves the number of background HTTP requests.
 *
 * [UX 1]   Boot screen shows "RESUMING..." when NVS code is reused,
 *          making it clear the device remembers its pairing.
 *
 * REQUIRES: TFT_eSPI library with User_Setup.h configured:
 *   #define ST7789_DRIVER
 *   #define TFT_WIDTH  240 / TFT_HEIGHT 320
 *   #define TFT_CS 17 / TFT_DC 22 / TFT_RST 16 / TFT_MOSI 23 / TFT_SCLK 18
 *   #define SPI_FREQUENCY 80000000
 *
 * TFT: ST7789 320x240  CS=17 DC=22 RST=16 BL=2 MOSI=23 SCK=18
 * Buttons: A=19 B=4 C=13 D=26 E=15 F=32 G=27 H=33 I=14 J=25
 * ================================================================
 */

#include <ArduinoJson.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <esp_now.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>

// ─── TFT ──────────────────────────────────────────────────────────
#define TFT_BL 2
#define DW 320
#define DH 240
TFT_eSPI tft = TFT_eSPI();

// ─── Buttons ──────────────────────────────────────────────────────
#define PIN_BTN_A 19
#define PIN_BTN_B 4
#define PIN_BTN_C 13
#define PIN_BTN_D 26
#define PIN_BTN_E 15
#define PIN_BTN_F 32
#define PIN_BTN_G 27
#define PIN_BTN_H 33
#define PIN_BTN_I 14
#define PIN_BTN_J 25

// ─── Supabase ─────────────────────────────────────────────────────
#define SUPABASE_URL "https://eoowagimooxsqcrrihbw.supabase.co"
#define SUPABASE_KEY                                                           \
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."                                      \
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvb3dhZ2ltb294c3FjcnJpaGJ3Iiwicm9sZSI6Im" \
  "Fub24iLCJpYXQiOjE3NzE0MDIwOTAsImV4cCI6MjA4Njk3ODA5MH0."                     \
  "goB7TMo3Sv3RQhez4kjvGLzikBz37XB3OZV-cRmUXn0"
#define SUPABASE_HOST "eoowagimooxsqcrrihbw.supabase.co"

// ─── Game config ──────────────────────────────────────────────────
#define QUARTER_SECONDS 600
#define OT_SECONDS 300
#define SHOT_CLOCK_FULL 24
#define SHOT_CLOCK_SHORT 14
#define DOUBLE_TAP_MS 400
#define HOLD_PERIOD_MS 2000
#define HOLD_SETTINGS_MS 1500

// ─── Colors (RGB565) ──────────────────────────────────────────────
#define C_BG 0x0841
#define C_CHROME 0x0000
#define C_LINE 0x18C3
#define C_DIM 0x294A
#define C_MID 0x39E7
#define C_TEXT 0xEF5C
#define C_MUTED 0x4228
#define C_GREEN 0x2784
#define C_RED 0xF184
#define C_AMBER 0xDBC0
#define C_YELLOW 0xEF20
#define C_BLUE 0x2DBB
uint16_t C_A = 0xF800; // pure red
uint16_t C_B = 0xEF20;

// ─── Layout zones ─────────────────────────────────────────────────
#define ZONE_STATUS_Y 0
#define ZONE_STATUS_H 20
#define ZONE_TEAM_Y 20
#define ZONE_TEAM_H 24
#define ZONE_SCORE_Y 44
#define ZONE_SCORE_H 152
#define ZONE_CLOCK_Y 196
#define ZONE_CLOCK_H 22
#define ZONE_HINT_Y 218
#define ZONE_HINT_H 22

// ─── Menu helper struct ───────────────────────────────────────────
struct MenuItem {
  const char *label;
  const char *sub;
};

// ─── Device state ─────────────────────────────────────────────────
static const char CHARSET[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
static char sessionCode[5] = {0};
static char activeGameId[16] = {0};
static char teamAName[16] = "HOME";
static char teamBName[16] = "AWAY";
static bool codeIsResumed = false; // true if loaded from NVS

static volatile int deviceState = 0;
static volatile int pollCount = 0;
static volatile int lastHttpCode = 0;
static volatile int lastBcastCode = 0;
static char dbStatusRaw[16] = "waiting";

#define SCR_BOOT 0
#define SCR_GAME 1
#define SCR_MENU 2
#define SCR_NET 3
#define MODE_ONLINE 0
#define MODE_OFFLINE 1
#define MODE_BROADCAST 2
static int deviceMode = -1; // -1 = not chosen yet

static int currentScreen = SCR_BOOT;
static bool gameInit = false;

// ─── [PERF 1] Fixed-size broadcast message struct ─────────────────
// Replaces heap-allocated String* — eliminates malloc/free per broadcast
#define BCAST_BUF_SIZE 512
struct BcastMsg {
  char buf[BCAST_BUF_SIZE];
};
static QueueHandle_t broadcastQueue = nullptr;

// ─── [PERF 2] Persistent HTTP connection for broadcastTask ────────
static WiFiClientSecure *bcastClient = nullptr;
static HTTPClient *bcastHttp = nullptr;
static unsigned long bcastLastUse = 0;
#define BCAST_CONN_TIMEOUT_MS 25000 // close idle connection after 25s

// ─── LAN broadcast server (MODE_BROADCAST) ────────────────────────
static AsyncWebServer lanServer(80);
static AsyncEventSource *sseSource = nullptr;

// ═══════════════════════════════════════════════════════════════════
//  BUTTON
// ═══════════════════════════════════════════════════════════════════
class Button {
public:
  uint8_t pin;
  bool pressed = false, released = false, held = false;
  unsigned long pressTime = 0;
  bool holdFired = false, lastRaw = false, stableState = false;
  unsigned long debounceEnd = 0;
  Button(uint8_t p) : pin(p) {}
  void begin() { pinMode(pin, INPUT_PULLUP); }
  void update() {
    pressed = false;
    released = false;
    bool raw = (digitalRead(pin) == LOW);
    if (raw != lastRaw) {
      debounceEnd = millis() + 8;
      lastRaw = raw;
    }
    if (millis() >= debounceEnd && raw != stableState) {
      stableState = raw;
      if (stableState) {
        pressed = true;
        held = true;
        pressTime = millis();
        holdFired = false;
      } else {
        released = true;
        held = false;
        holdFired = false;
      }
    }
  }
  bool heldFor(unsigned long ms) {
    if (held && !holdFired && millis() - pressTime >= ms) {
      holdFired = true;
      return true;
    }
    return false;
  }
  unsigned long heldMs() { return held ? millis() - pressTime : 0; }
  void consume() {
    pressed = false;
    released = false;
  }
};

Button btnA(PIN_BTN_A), btnB(PIN_BTN_B), btnC(PIN_BTN_C), btnD(PIN_BTN_D);
Button btnE(PIN_BTN_E), btnF(PIN_BTN_F), btnG(PIN_BTN_G), btnH(PIN_BTN_H);
Button btnI(PIN_BTN_I), btnJ(PIN_BTN_J);
Button *allButtons[] = {&btnA, &btnB, &btnC, &btnD, &btnE,
                        &btnF, &btnG, &btnH, &btnI, &btnJ};
void updateAllButtons() {
  for (auto b : allButtons)
    b->update();
}

// ═══════════════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════════════
struct GameState {
  int scoreA = 0, scoreB = 0, foulsA = 0, foulsB = 0, period = 1, poss = 0;
  bool paused = true, clockRunning = false, shotRunning = false;
  unsigned long clockStartedAt = 0, shotStartedAt = 0;
  int clockValueAtStart = QUARTER_SECONDS, shotValueAtStart = SHOT_CLOCK_FULL;
  bool pendingActive = false;
  int pendingTeam = 0, pendingValue = 1;
  bool isLocked = false;
} gs;

struct GameConfig {
  uint8_t sport;       // 0=basketball, 1=netsports
  uint8_t bballFormat; // 0=5v5quarters, 1=5v5halves, 2=3x3
  uint8_t periodMins;  // 5/8/10/12/20
  bool shotClockOn;
  int totalPeriods;
  int periodSeconds;
  int shotClockDefault;
  int foulBonus;
  bool is3x3;
} gcfg;

// ─── Net sports state ─────────────────────────────────────────────
// ─── ESP-NOW ──────────────────────────────────────────────────────
#define ESPNOW_ENABLED false
#define C3_DONGLE_MAC  { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF }

typedef struct __attribute__((packed)) {
    uint8_t  msgType;
    uint8_t  action;
    uint16_t seq;
    uint32_t timestamp;
} EspNowPacket;

#define ACTION_SCORE_A1    0
#define ACTION_SCORE_A2    1
#define ACTION_SCORE_A3    2
#define ACTION_SCORE_B1    3
#define ACTION_SCORE_B2    4
#define ACTION_SCORE_B3    5
#define ACTION_CLOCK_START 6
#define ACTION_CLOCK_STOP  7
#define ACTION_SHOT_24     8
#define ACTION_SHOT_14     9
#define ACTION_UNDO        10
#define ACTION_SETTINGS    11
#define ACTION_NEXT_PERIOD 12
#define ACTION_FOUL_A      13
#define ACTION_FOUL_B      14

static uint16_t espNowSeq   = 0;
static bool     espNowReady = false;
static uint8_t  c3Mac[]     = C3_DONGLE_MAC;

void initEspNow() {
    if (!ESPNOW_ENABLED) return;
    if (esp_now_init() != ESP_OK) { Serial.println("[espnow] Init failed"); return; }
    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, c3Mac, 6);
    peer.channel = 0; peer.encrypt = false;
    esp_now_add_peer(&peer);
    espNowReady = true;
    Serial.println("[espnow] Ready");
}

void sendEspNow(uint8_t action) {
    if (!ESPNOW_ENABLED || !espNowReady) return;
    EspNowPacket pkt = { 0, action, ++espNowSeq, (uint32_t)millis() };
    esp_now_send(c3Mac, (uint8_t*)&pkt, sizeof(pkt));
}

struct NetState {
  int scoreA = 0, scoreB = 0;
  int setsA = 0, setsB = 0;
  int currentSet = 1;
  int ptsToWin = 21;
  int setsToWin = 2; // sets needed to win match (best-of = setsToWin*2-1)
  bool matchOver = false;
  int winnerTeam = -1;  // 0=A, 1=B
  uint8_t subSport = 0; // 0=Badminton,1=Volleyball,2=TableTennis
} ns;

// [PERF 5] cached per-frame clock values — set once at top of tickDisplay()
static int frameClock = 0;
static int frameShot = 0;

int clkSecs() {
  if (!gs.clockRunning)
    return gs.clockValueAtStart;
  int v = gs.clockValueAtStart - (int)((millis() - gs.clockStartedAt) / 1000);
  return v < 0 ? 0 : v;
}
int shotSecs() {
  if (!gs.shotRunning)
    return gs.shotValueAtStart;
  int v = gs.shotValueAtStart - (int)((millis() - gs.shotStartedAt) / 1000);
  return v < 0 ? 0 : v;
}
void startClock() {
  if (gs.clockRunning)
    return;
  gs.clockValueAtStart = clkSecs();
  gs.clockStartedAt = millis();
  gs.clockRunning = true;
  gs.shotValueAtStart = shotSecs();
  gs.shotStartedAt = millis();
  gs.shotRunning = (gcfg.shotClockDefault > 0);
  gs.paused = false;
}
void pauseClock() {
  if (!gs.clockRunning)
    return;
  gs.clockValueAtStart = clkSecs();
  gs.shotValueAtStart = shotSecs();
  gs.clockRunning = false;
  gs.shotRunning = false;
  gs.paused = true;
}
void resetShot(int s) {
  gs.shotValueAtStart = s;
  gs.shotStartedAt = millis();
  gs.shotRunning = gs.clockRunning;
}

enum ActType { ACT_SA, ACT_SB, ACT_FA, ACT_FB, ACT_SC };
struct Undo {
  ActType t;
  int d, ps;
  bool pr;
};
Undo undoStack[5];
int undoTop = 0;
void pushUndo(ActType t, int d, int ps = -1, bool pr = false) {
  if (undoTop < 5)
    undoStack[undoTop++] = {t, d, ps, pr};
  else {
    for (int i = 0; i < 4; i++)
      undoStack[i] = undoStack[i + 1];
    undoStack[4] = {t, d, ps, pr};
  }
}
bool popUndo() {
  if (!undoTop)
    return false;
  Undo e = undoStack[--undoTop];
  switch (e.t) {
  case ACT_SA:
    gs.scoreA -= e.d;
    if (gs.scoreA < 0)
      gs.scoreA = 0;
    break;
  case ACT_SB:
    gs.scoreB -= e.d;
    if (gs.scoreB < 0)
      gs.scoreB = 0;
    break;
  case ACT_FA:
    gs.foulsA -= e.d;
    if (gs.foulsA < 0)
      gs.foulsA = 0;
    break;
  case ACT_FB:
    gs.foulsB -= e.d;
    if (gs.foulsB < 0)
      gs.foulsB = 0;
    break;
  case ACT_SC:
    if (e.ps >= 0) {
      gs.shotValueAtStart = e.ps;
      gs.shotStartedAt = millis();
      gs.shotRunning = e.pr;
    }
    break;
  }
  return true;
}

void broadcastState();
void triggerFlash(int t);
void drawNetScreen();
void handleNetButtons();
void runOfflineMenu();
void pushSseUpdate();
void applyQuickBasketball();
void startLanServer();

static unsigned long pendMs = 0;
void commitPending() {
  if (!gs.pendingActive)
    return;
  int ps = shotSecs();
  bool pr = gs.shotRunning;
  if (gs.pendingTeam == 0) {
    gs.scoreA += gs.pendingValue;
    pushUndo(ACT_SA, gs.pendingValue, ps, pr);
  } else {
    gs.scoreB += gs.pendingValue;
    pushUndo(ACT_SB, gs.pendingValue, ps, pr);
  }
  resetShot(gcfg.shotClockDefault > 0 ? gcfg.shotClockDefault
                                      : SHOT_CLOCK_FULL);
  gs.pendingActive = false;
  triggerFlash(gs.pendingTeam); broadcastState();
  if(gs.pendingTeam==0) sendEspNow(gs.pendingValue<=1?ACTION_SCORE_A1:gs.pendingValue==2?ACTION_SCORE_A2:ACTION_SCORE_A3);
  else                  sendEspNow(gs.pendingValue<=1?ACTION_SCORE_B1:gs.pendingValue==2?ACTION_SCORE_B2:ACTION_SCORE_B3);
}
void startPending(int team) {
  if (gs.pendingActive && gs.pendingTeam == team &&
      millis() - pendMs < DOUBLE_TAP_MS) {
    gs.pendingValue = 2;
    commitPending();
    return;
  }
  if (gs.pendingActive)
    commitPending();
  gs.pendingActive = true;
  gs.pendingTeam = team;
  gs.pendingValue = 1;
  pendMs = millis();
}
void tickPending() {
  if (gs.pendingActive && millis() - pendMs >= DOUBLE_TAP_MS)
    commitPending();
}

static bool foulPopup = false, settingsOpen = false;
static bool settingsWasOpen = false;

void handleFoulButtons() {
  if (!foulPopup)
    return;
  if(btnA.pressed){ btnA.consume(); gs.foulsA++; pushUndo(ACT_FA,1); foulPopup=false; broadcastState(); sendEspNow(ACTION_FOUL_A); }
  else if(btnC.pressed){ btnC.consume(); gs.foulsB++; pushUndo(ACT_FB,1); foulPopup=false; broadcastState(); sendEspNow(ACTION_FOUL_B); }
  else if (btnE.pressed) {
    btnE.consume();
    foulPopup = false;
  }
}

void advancePeriod() {
  pauseClock();
  gs.period++;
  int secs = (gs.period > gcfg.totalPeriods) ? OT_SECONDS : gcfg.periodSeconds;
  gs.clockValueAtStart = secs;
  gs.clockRunning = false;
  gs.shotValueAtStart = gcfg.shotClockDefault;
  gs.shotRunning = false;
  gs.paused = true;
  undoTop = 0;
  if (!gcfg.is3x3) {
    gs.foulsA = 0;
    gs.foulsB = 0;
  }
  broadcastState(); sendEspNow(ACTION_NEXT_PERIOD);
}

static bool clkExpFired = false, shotExpFired = false;
void tickExpiry() {
  if (gs.clockRunning) {
    int s = clkSecs();
    if (s <= 0 && !clkExpFired) {
      clkExpFired = true;
      pauseClock();
      broadcastState();
    }
    if (s > 0)
      clkExpFired = false;
  }
  if (gs.shotRunning) {
    int s = shotSecs();
    if (s <= 0 && !shotExpFired) {
      shotExpFired = true;
      broadcastState();
    }
    if (s > 0)
      shotExpFired = false;
  }
}

void handleButtons() {
  if (gs.isLocked)
    return;
  if (foulPopup) {
    handleFoulButtons();
    return;
  }
  if (settingsOpen) {
    if (btnG.heldFor(HOLD_SETTINGS_MS) || btnE.pressed) {
      btnE.consume();
      settingsOpen = false;
      settingsWasOpen = true;
    }
    return;
  }
  if (btnG.heldFor(HOLD_SETTINGS_MS)) {
    settingsOpen = true;
    if (gs.clockRunning)
      pauseClock();
    return;
  }

  if (btnA.pressed) {
    btnA.consume();
    startPending(0);
  }
  if (btnB.pressed) {
    btnB.consume();
    if (gs.pendingActive && gs.pendingTeam == 0)
      gs.pendingActive = false;
    else if (gs.scoreA > 0) {
      gs.scoreA--;
      pushUndo(ACT_SA, -1);
      broadcastState();
    }
  }
  if (btnC.pressed) {
    btnC.consume();
    startPending(1);
  }
  if (btnD.pressed) {
    btnD.consume();
    if (gs.pendingActive && gs.pendingTeam == 1)
      gs.pendingActive = false;
    else if (gs.scoreB > 0) {
      gs.scoreB--;
      pushUndo(ACT_SB, -1);
      broadcastState();
    }
  }
  if (btnE.pressed) {
    btnE.consume();
    if (gs.pendingActive)
      gs.pendingActive = false;
    else if(popUndo()){ broadcastState(); sendEspNow(ACTION_UNDO); }
  }
  if(btnF.heldFor(600)){
    int p=shotSecs(); bool pr=gs.shotRunning;
    resetShot(SHOT_CLOCK_SHORT); pushUndo(ACT_SC,0,p,pr); broadcastState(); sendEspNow(ACTION_SHOT_14);
  } else if(btnF.released&&btnF.heldMs()<600){
    int p=shotSecs(); bool pr=gs.shotRunning;
    resetShot(SHOT_CLOCK_FULL); pushUndo(ACT_SC,0,p,pr); broadcastState(); sendEspNow(ACTION_SHOT_24);
  }
  if (btnH.pressed) {
    btnH.consume();
    foulPopup = true;
  }
  if(btnI.pressed){ btnI.consume();
    bool wasRunning=gs.clockRunning;
    if(gs.clockRunning) pauseClock(); else startClock();
    broadcastState();
    sendEspNow(wasRunning ? ACTION_CLOCK_STOP : ACTION_CLOCK_START);
  }
  if (btnJ.heldFor(HOLD_PERIOD_MS))
    advancePeriod();
  else if (btnJ.released && !btnJ.holdFired && btnJ.heldMs() < HOLD_PERIOD_MS) {
    gs.poss = 1 - gs.poss;
    broadcastState();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════
void tftCX(const char *s, int x0, int x1, int y, int sz, uint16_t fg,
           uint16_t bg) {
  tft.setTextSize(sz);
  int w = strlen(s) * sz * 6;
  int x = x0 + (x1 - x0 - w) / 2;
  if (x < x0)
    x = x0;
  tft.setTextColor(fg, bg);
  tft.setCursor(x, y);
  tft.print(s);
}
void tftCtr(const char *s, int y, int sz, uint16_t fg, uint16_t bg = C_BG) {
  tftCX(s, 0, DW, y, sz, fg, bg);
}
void tftRX(const char *s, int x, int y, int sz, uint16_t fg, uint16_t bg) {
  tft.setTextSize(sz);
  int w = strlen(s) * sz * 6;
  tft.setTextColor(fg, bg);
  tft.setCursor(x - w, y);
  tft.print(s);
}

// ─── Boot screen ──────────────────────────────────────────────────
void drawBootScreen() {
  tft.fillScreen(C_BG);

  tft.fillRect(0, 0, DW, 20, C_CHROME);
  tft.drawFastHLine(0, 20, DW, C_LINE);
  tftCX("THE BOX", 0, DW, 6, 1, C_MUTED, C_CHROME);

  int state = deviceState;

  // Step breadcrumb
  int bx = DW / 2 - 36, by = 28;
  uint16_t c1 = C_GREEN, c2 = C_GREEN, c3 = (state >= 1) ? C_GREEN : C_MUTED;
  tft.fillCircle(bx, by + 5, 4, c1);
  tft.fillCircle(bx + 36, by + 5, 4, c2);
  if (state >= 1)
    tft.fillCircle(bx + 72, by + 5, 4, c3);
  else
    tft.drawCircle(bx + 72, by + 5, 4, c3);
  tft.drawFastHLine(bx + 4, by + 5, 28, c2);
  tft.drawFastHLine(bx + 40, by + 5, 28, c3);
  tft.setTextSize(1);
  tftCX("WIFI", bx - 18, bx + 18, by + 14, 1, c1, C_BG);
  tftCX("REG", bx + 18, bx + 54, by + 14, 1, c2, C_BG);
  tftCX("PAIR", bx + 54, bx + 90, by + 14, 1, c3, C_BG);

  if (state == 0) {
    tft.setTextSize(1);
    // [UX 1] Show whether we're resuming a saved code or fresh
    if (codeIsResumed)
      tftCtr("RESUMING SESSION", 52, 1, C_GREEN);
    else
      tftCtr("PAIR CODE", 52, 1, C_MUTED);

    tft.setTextSize(8);
    tft.setTextColor(C_YELLOW, C_BG);
    int cw = 4 * 8 * 6;
    tft.setCursor((DW - cw) / 2, 64);
    tft.print(sessionCode);

    uint8_t phase = (uint8_t)((millis() / 6) & 0xFF);
    uint8_t g = (phase < 128) ? (phase * 2) : (255 - (phase - 128) * 2);
    uint16_t ringCol = tft.color565(0, g / 4, 0);
    tft.drawRoundRect((DW - cw) / 2 - 8, 58, cw + 16, 66, 6, ringCol);
    tft.drawRoundRect((DW - cw) / 2 - 10, 56, cw + 20, 70, 8,
                      tft.color565(0, g / 8, 0));

    tftCtr("enter on website to pair", 148, 1, C_MUTED);
    String ip = WiFi.localIP().toString();
    tft.setTextSize(1);
    tft.setTextColor(C_DIM, C_BG);
    int iw = ip.length() * 6;
    tft.setCursor((DW - iw) / 2, 164);
    tft.print(ip.c_str());

    // Bottom debug bar
    tft.fillRect(0, DH - 14, DW, 14, C_CHROME);
    tft.drawFastHLine(0, DH - 14, DW, C_LINE);
    char pb[48];
    snprintf(pb, sizeof(pb), "poll #%d  db:%s  HTTP:%d", pollCount, dbStatusRaw,
             lastHttpCode);
    tftCX(pb, 0, DW, DH - 10, 1, C_DIM, C_CHROME);

  } else {
    tft.setTextSize(4);
    tft.setTextColor(C_GREEN, C_BG);
    int pw = 6 * 4 * 6;
    tft.setCursor((DW - pw) / 2, 72);
    tft.print("PAIRED");
    tftCtr("website linked!", 126, 1, C_GREEN);
    tftCtr("launch game on website...", 146, 1, C_MUTED);
    tft.setTextSize(1);
    tft.setTextColor(C_DIM, C_BG);
    tft.setCursor((DW - 4 * 6) / 2, 170);
    tft.print(sessionCode);
    int phase = (millis() / 350) % 4;
    for (int i = 0; i < 4; i++)
      tft.fillCircle(DW / 2 - 27 + i * 18, 192, 4,
                     (i < phase) ? C_GREEN : C_DIM);
  }
}

// ─── Game screen zones ────────────────────────────────────────────
static bool pLocked2 = false;
void drawStatusBar(bool f = false) {
  bool locked = gs.isLocked;
  if (!f && locked == pLocked2)
    return;
  pLocked2 = locked;
  tft.fillRect(0, ZONE_STATUS_Y, DW, ZONE_STATUS_H, C_CHROME);
  tft.drawFastHLine(0, ZONE_STATUS_H - 1, DW, C_LINE);
  tft.fillCircle(8, 10, 3, C_GREEN);
  tft.setTextSize(1);
  tft.setTextColor(C_GREEN, C_CHROME);
  tft.setCursor(14, 6);
  tft.print("live");
  tftCX(sessionCode, 0, DW, 6, 1, C_DIM, C_CHROME);
  if (locked) {
    tftRX("WEB CTRL", DW - 4, 6, 1, C_AMBER, C_CHROME);
  } else {
    char qb[8];
    if (gs.period <= gcfg.totalPeriods) {
      if (gcfg.totalPeriods == 1)
        snprintf(qb, 8, "GAME");
      else if (gcfg.totalPeriods == 2)
        snprintf(qb, 8, "H%d", gs.period);
      else
        snprintf(qb, 8, "Q%d", gs.period);
    } else
      snprintf(qb, 8, "OT");
    uint16_t qcol = (gs.period > gcfg.totalPeriods) ? C_AMBER : C_MUTED;
    tftRX(qb, DW - 4, 6, 1, qcol, C_CHROME);
  }
}

static int pPoss = -1;
void drawTeamBar(bool f = false) {
  if (!f && gs.poss == pPoss)
    return;
  pPoss = gs.poss;
  tft.fillRect(0, ZONE_TEAM_Y, DW, ZONE_TEAM_H, C_BG);
  tft.drawFastHLine(0, ZONE_TEAM_Y + ZONE_TEAM_H - 1, DW, C_LINE);
  int ax = 12;
  if (gs.poss == 0) {
    tft.fillTriangle(ax, ZONE_TEAM_Y + 5, ax, ZONE_TEAM_Y + 18, ax + 9,
                     ZONE_TEAM_Y + 11, C_A);
    ax += 14;
  }
  char nA[12] = {0};
  strncpy(nA, teamAName, 11);
  tft.setTextSize(1);
  tft.setTextColor(C_A, C_BG);
  tft.setCursor(ax, ZONE_TEAM_Y + 8);
  tft.print(nA);
  char nB[12] = {0};
  strncpy(nB, teamBName, 11);
  int bw2 = strlen(nB) * 6, bx = DW - 12 - bw2;
  if (gs.poss == 1)
    bx -= 14;
  tft.setTextColor(C_B, C_BG);
  tft.setCursor(bx, ZONE_TEAM_Y + 8);
  tft.print(nB);
  if (gs.poss == 1) {
    int tx = bx + bw2 + 5;
    tft.fillTriangle(tx + 8, ZONE_TEAM_Y + 5, tx + 8, ZONE_TEAM_Y + 18, tx,
                     ZONE_TEAM_Y + 11, C_B);
  }
}

static unsigned long flashTA = 0, flashTB = 0;
static bool fA = false, fB = false;
void triggerFlash(int t) {
  if (t == 0) {
    fA = true;
    flashTA = millis();
  } else {
    fB = true;
    flashTB = millis();
  }
}
void tickFlash() {
  unsigned long now = millis();
  if (fA) {
    int el = now - flashTA;
    if (el < 250) {
      if (el < 150) {
        tft.drawRect(1, ZONE_SCORE_Y + 1, 158, ZONE_SCORE_H - 2, C_A);
        tft.drawRect(2, ZONE_SCORE_Y + 2, 156, ZONE_SCORE_H - 4, C_A);
      }
    } else {
      tft.drawRect(1, ZONE_SCORE_Y + 1, 158, ZONE_SCORE_H - 2, C_BG);
      tft.drawRect(2, ZONE_SCORE_Y + 2, 156, ZONE_SCORE_H - 4, C_BG);
      fA = false;
    }
  }
  if (fB) {
    int el = now - flashTB;
    if (el < 250) {
      if (el < 150) {
        tft.drawRect(162, ZONE_SCORE_Y + 1, 157, ZONE_SCORE_H - 2, C_B);
        tft.drawRect(163, ZONE_SCORE_Y + 2, 155, ZONE_SCORE_H - 4, C_B);
      }
    } else {
      tft.drawRect(162, ZONE_SCORE_Y + 1, 157, ZONE_SCORE_H - 2, C_BG);
      tft.drawRect(163, ZONE_SCORE_Y + 2, 155, ZONE_SCORE_H - 4, C_BG);
      fB = false;
    }
  }
}

static int pSA = -1, pSB = -1, pFA = -1, pFB = -1;
static bool pPaused = false, pPA = false, pLocked = false;

void drawScoreHalf(int team, bool f = false) {
  int x0 = team ? 161 : 0, w = team ? 159 : 160;
  int score = team ? gs.scoreB : gs.scoreA;
  int fouls = team ? gs.foulsB : gs.foulsA;
  uint16_t col = team ? C_B : C_A;
  uint16_t sc = gs.paused ? C_DIM : col;
  tft.fillRect(x0, ZONE_SCORE_Y, w, ZONE_SCORE_H, C_BG);
  char sb[5];
  sprintf(sb, "%d", score);
  int nw = strlen(sb) * 8 * 6, nx = x0 + (w - nw) / 2;
  if (nx < x0)
    nx = x0 + 2;
  tft.setTextSize(8);
  tft.setTextColor(sc, C_BG);
  tft.setCursor(nx, ZONE_SCORE_Y + 24);
  tft.print(sb);
  char fb[10];
  snprintf(fb, 10, "FOULS: %d", fouls);
  uint16_t fc = (fouls >= gcfg.foulBonus) ? C_RED : C_DIM;
  tft.setTextSize(1);
  tft.setTextColor(fc, C_BG);
  int fw2 = strlen(fb) * 6;
  tft.setCursor(x0 + (w - fw2) / 2, ZONE_SCORE_Y + ZONE_SCORE_H - 14);
  tft.print(fb);
  if (gs.isLocked) {
    tft.setTextSize(1);
    tft.setTextColor(C_AMBER, C_BG);
    int lw2 = 6 * 6;
    tft.setCursor(x0 + (w - lw2) / 2, ZONE_SCORE_Y + 6);
    tft.print("LOCKED");
  }
  if (gs.pendingActive && gs.pendingTeam == team) {
    const char *b = "TAP: +2";
    int bw3 = strlen(b) * 6 + 8;
    int bx2 = x0 + (w - bw3) / 2, by = ZONE_SCORE_Y + 10;
    tft.fillRoundRect(bx2, by, bw3, 13, 2, C_DIM);
    tft.setTextSize(1);
    tft.setTextColor(C_TEXT, C_DIM);
    tft.setCursor(bx2 + 4, by + 4);
    tft.print(b);
  }
}

void drawScoreArea(bool f = false) {
  bool locked = gs.isLocked;
  if (f || gs.scoreA != pSA || gs.foulsA != pFA || gs.paused != pPaused ||
      locked != pLocked)
    drawScoreHalf(0, f);
  if (f || gs.scoreB != pSB || gs.foulsB != pFB || gs.paused != pPaused ||
      locked != pLocked)
    drawScoreHalf(1, f);
  if (f)
    tft.drawFastVLine(160, ZONE_SCORE_Y, ZONE_SCORE_H, C_LINE);
  pSA = gs.scoreA;
  pSB = gs.scoreB;
  pFA = gs.foulsA;
  pFB = gs.foulsB;
  pPaused = gs.paused;
  pPA = gs.pendingActive;
  pLocked = locked;
}

static int pCS = -1, pSS = -1;
static bool pCR = false;
static int prevShotSec = -1;

void drawClockBar(bool f = false) {
  // [PERF 5] use frame-cached values
  int cs = frameClock, ss = frameShot;
  if (!f && cs == pCS && ss == pSS && gs.clockRunning == pCR)
    return;
  pCS = cs;
  pSS = ss;
  pCR = gs.clockRunning;
  tft.fillRect(0, ZONE_CLOCK_Y, DW, ZONE_CLOCK_H, C_CHROME);
  tft.drawFastHLine(0, ZONE_CLOCK_Y, DW, C_LINE);
  tft.drawFastHLine(0, ZONE_CLOCK_Y + ZONE_CLOCK_H - 1, DW, C_LINE);
  char cb[8];
  snprintf(cb, 8, "%d:%02d", cs / 60, cs % 60);
  uint16_t clkCol;
  if (!gs.clockRunning)
    clkCol = C_DIM;
  else if (cs <= 30)
    clkCol = C_RED;
  else if (cs <= 60)
    clkCol = C_AMBER;
  else
    clkCol = C_TEXT;
  tft.setTextSize(2);
  tft.setTextColor(clkCol, C_CHROME);
  int cw2 = strlen(cb) * 2 * 6;
  tft.setCursor((DW - cw2) / 2, ZONE_CLOCK_Y + 4);
  tft.print(cb);
  if (ss > 0 || gs.clockRunning) {
    char sc2[4];
    snprintf(sc2, 4, "%02d", ss);
    uint16_t sc3;
    if (!gs.clockRunning)
      sc3 = C_DIM;
    else if (ss <= 5)
      sc3 = C_RED;
    else if (ss <= 10)
      sc3 = C_AMBER;
    else
      sc3 = C_MUTED;
    if (gs.clockRunning && ss <= 5 && ss != prevShotSec) {
      prevShotSec = ss;
      tft.fillRect(4, ZONE_CLOCK_Y + 3, 22, 15, sc3);
      tft.setTextSize(1);
      tft.setTextColor(C_BG, sc3);
    } else {
      tft.setTextSize(1);
      tft.setTextColor(sc3, C_CHROME);
    }
    tft.setCursor(6, ZONE_CLOCK_Y + 7);
    tft.print(sc2);
  }
  char qb2[6];
  if (gs.period <= gcfg.totalPeriods) {
    if (gcfg.totalPeriods == 1)
      snprintf(qb2, 6, "GAME");
    else if (gcfg.totalPeriods == 2)
      snprintf(qb2, 6, "H %d", gs.period);
    else
      snprintf(qb2, 6, "Q %d", gs.period);
  } else
    snprintf(qb2, 6, "OT");
  uint16_t qc2 = (gs.period > gcfg.totalPeriods)
                     ? C_AMBER
                     : (gs.clockRunning ? C_MUTED : C_DIM);
  tft.setTextSize(1);
  tft.setTextColor(qc2, C_CHROME);
  int qw2 = strlen(qb2) * 6;
  tft.setCursor(DW - qw2 - 6, ZONE_CLOCK_Y + 7);
  tft.print(qb2);
}

static bool pFP = false, pSO = false, pHR = false;
void drawHintStrip(bool f = false) {
  if (!f && foulPopup == pFP && settingsOpen == pSO && gs.clockRunning == pHR)
    return;
  pFP = foulPopup;
  pSO = settingsOpen;
  pHR = gs.clockRunning;
  tft.fillRect(0, ZONE_HINT_Y, DW, ZONE_HINT_H, C_CHROME);
  tft.drawFastHLine(0, ZONE_HINT_Y, DW, C_LINE);
  if (gs.isLocked) {
    tftCX("WEBSITE HAS CONTROL", 0, DW, ZONE_HINT_Y + 7, 1, C_AMBER, C_CHROME);
    return;
  }
  if (foulPopup) {
    tftCX("A=HOME   C=AWAY   E=cancel", 0, DW, ZONE_HINT_Y + 7, 1, C_MUTED,
          C_CHROME);
    return;
  }
  if (settingsOpen) {
    tftCX("G hold = close", 0, DW, ZONE_HINT_Y + 7, 1, C_MUTED, C_CHROME);
    return;
  }
  struct {
    const char *key;
    const char *act;
    uint16_t col;
  } h[5] = {
      {"A/B", teamAName, C_A},
      {"I", gs.clockRunning ? "PAUSE" : "START", C_TEXT},
      {"C/D", teamBName, C_B},
      {"H", "foul", C_MUTED},
      {"E", "undo", C_MUTED},
  };
  int sp = DW / 5;
  for (int i = 0; i < 5; i++) {
    int cx = i * sp + sp / 2;
    tft.setTextSize(1);
    tft.setTextColor(h[i].col, C_CHROME);
    int kw = strlen(h[i].key) * 6;
    tft.setCursor(cx - kw / 2, ZONE_HINT_Y + 3);
    tft.print(h[i].key);
    char act[6] = {0};
    strncpy(act, h[i].act, 5);
    int aw = strlen(act) * 6;
    tft.setTextColor(C_MID, C_CHROME);
    tft.setCursor(cx - aw / 2, ZONE_HINT_Y + 13);
    tft.print(act);
  }
}

static bool pFPD = false;
void drawFoulPopup(bool f = false) {
  if (!f && foulPopup == pFPD)
    return;
  if (foulPopup && !pFPD) {
    int px = 50, py = 74, pw = 220, ph = 84;
    tft.fillRect(0, ZONE_SCORE_Y, DW, ZONE_SCORE_H, tft.color565(4, 4, 4));
    tft.fillRoundRect(px, py, pw, ph, 6, tft.color565(22, 22, 22));
    tft.drawRoundRect(px, py, pw, ph, 6, C_LINE);
    tftCX("FOUL — WHICH TEAM?", px, px + pw, py + 12, 1, C_MUTED,
          tft.color565(22, 22, 22));
    tft.fillRoundRect(px + 12, py + 28, 92, 28, 4, tft.color565(48, 0, 0));
    tft.drawRoundRect(px + 12, py + 28, 92, 28, 4, C_A);
    char lA[12];
    snprintf(lA, 12, "A · %.7s", teamAName);
    tftCX(lA, px + 12, px + 104, py + 40, 1, C_A, tft.color565(36, 8, 8));
    tft.fillRoundRect(px + 116, py + 28, 92, 28, 4, tft.color565(32, 28, 4));
    tft.drawRoundRect(px + 116, py + 28, 92, 28, 4, C_B);
    char lB[12];
    snprintf(lB, 12, "C · %.7s", teamBName);
    tftCX(lB, px + 116, px + 208, py + 40, 1, C_B, tft.color565(32, 28, 4));
    tftCX("E = cancel", px, px + pw, py + 68, 1, C_DIM,
          tft.color565(22, 22, 22));
    pFPD = true;
  } else if (!foulPopup && pFPD) {
    pFPD = false;
    drawScoreHalf(0, true);
    drawScoreHalf(1, true);
    tft.drawFastVLine(160, ZONE_SCORE_Y, ZONE_SCORE_H, C_LINE);
  }
}

static int pFill2 = 0;
void drawFillBar() {
  if (!btnJ.held) {
    if (pFill2 > 0) {
      tft.fillRect(0, ZONE_HINT_Y - 3, DW, 3, C_BG);
      pFill2 = 0;
    }
    return;
  }
  unsigned long hm = btnJ.heldMs();
  if (hm < 200)
    return;
  int pct = (int)((hm * 100) / HOLD_PERIOD_MS);
  if (pct > 100)
    pct = 100;
  if (pct == pFill2)
    return;
  pFill2 = pct;
  int fw = (DW * pct) / 100;
  tft.fillRect(0, ZONE_HINT_Y - 3, fw, 3, C_AMBER);
  tft.fillRect(fw, ZONE_HINT_Y - 3, DW - fw, 3, C_LINE);
}

// [FIX 3] Settings overlay — drawn flag is instance-scoped, resets on close
static bool settingsDrawn = false;
void drawSettingsOverlay() {
  if (!settingsOpen) {
    if (settingsDrawn) {
      settingsDrawn = false;
    } // reset for next open
    return;
  }
  if (settingsDrawn)
    return; // already drawn this open session
  settingsDrawn = true;

  uint16_t panelBg = tft.color565(18, 18, 18);
  tft.fillRoundRect(16, 26, DW - 32, DH - 52, 8, panelBg);
  tft.drawRoundRect(16, 26, DW - 32, DH - 52, 8, C_LINE);
  tft.drawRoundRect(17, 27, DW - 34, DH - 54, 7, C_DIM);
  tftCX("SETTINGS", 16, DW - 16, 36, 1, C_MUTED, panelBg);
  tft.drawFastHLine(24, 50, DW - 48, C_LINE);

  int y = 58;
  int lh = 14;
  uint16_t panelBg2 = panelBg;
  auto row = [&](const char *label, const char *val, uint16_t vc) {
    tft.setTextSize(1);
    tft.setTextColor(C_MUTED, panelBg2);
    tft.setCursor(26, y);
    tft.print(label);
    tft.setTextColor(vc, panelBg2);
    int vw2 = strlen(val) * 6;
    tft.setCursor(DW - 26 - vw2, y);
    tft.print(val);
    y += lh;
  };

  char tmp[32];
  row("Code:", sessionCode, C_YELLOW);
  row("Game:", activeGameId[0] ? activeGameId : "none", C_MUTED);
  snprintf(tmp, 32, "%s", WiFi.localIP().toString().c_str());
  row("IP:", tmp, C_MUTED);
  snprintf(tmp, 32, "%d", pollCount);
  row("Polls:", tmp, C_MUTED);
  snprintf(tmp, 32, "HTTP %d", lastHttpCode);
  row("Poll:", tmp, lastHttpCode == 200 ? C_GREEN : C_RED);
  snprintf(tmp, 32, "HTTP %d", lastBcastCode);
  row("Bcast:", tmp, lastBcastCode == 200 ? C_GREEN : C_RED);
  snprintf(tmp, 32, "%s", gs.isLocked ? "WEB" : "HARDWARE");
  row("Control:", tmp, gs.isLocked ? C_AMBER : C_GREEN);
  row("FW:",      "v8.0",                               C_DIM);
  row("ESP-NOW:", ESPNOW_ENABLED?(espNowReady?"ACTIVE":"FAILED"):"OFF", espNowReady?C_GREEN:(ESPNOW_ENABLED?C_RED:C_DIM));
  snprintf(tmp, 32, "%s", codeIsResumed ? "NVS" : "fresh");
  row("Code src:", tmp, C_DIM);

  tftCX("G hold or E = close", 16, DW - 16, DH - 40, 1, C_DIM, panelBg);
}

void drawGameScreen() {
  if (settingsWasOpen) {
    settingsWasOpen = false;
    settingsDrawn = false;
    gameInit = false;
  }

  if (!gameInit) {
    tft.fillScreen(C_BG);
    drawStatusBar(true);
    drawTeamBar(true);
    drawScoreArea(true);
    drawClockBar(true);
    drawHintStrip(true);
    gameInit = true;
    return;
  }

  if (settingsOpen) {
    drawSettingsOverlay();
    return;
  }

  drawStatusBar();
  drawTeamBar();
  drawScoreArea();
  drawClockBar();
  drawHintStrip();
  drawFoulPopup();
  drawFillBar();
  tickFlash();
}

// ═══════════════════════════════════════════════════════════════════
//  NET SPORTS SCREEN
// ═══════════════════════════════════════════════════════════════════
static bool netDirty = true;

static const char *netSportName() {
  switch (ns.subSport) {
  case 0:
    return "BADMINTON";
  case 1:
    return "VOLLEYBALL";
  default:
    return "TABLE TEN.";
  }
}

void checkNetSetWinner() {
  int pts = ns.ptsToWin;
  // Volleyball deciding set (when combined sets = max-1) goes to 15
  if (ns.subSport == 1 && ns.setsA + ns.setsB >= (ns.setsToWin * 2 - 2))
    pts = 15;
  bool aWin = (ns.scoreA >= pts && ns.scoreA - ns.scoreB >= 2);
  bool bWin = (ns.scoreB >= pts && ns.scoreB - ns.scoreA >= 2);
  if (!aWin && !bWin)
    return;
  if (aWin)
    ns.setsA++;
  else
    ns.setsB++;
  if (ns.setsA >= ns.setsToWin) {
    ns.matchOver = true;
    ns.winnerTeam = 0;
  } else if (ns.setsB >= ns.setsToWin) {
    ns.matchOver = true;
    ns.winnerTeam = 1;
  } else {
    ns.currentSet++;
    ns.scoreA = 0;
    ns.scoreB = 0;
  }
  netDirty = true;
}

void handleNetButtons() {
  if (ns.matchOver) {
    if (btnE.pressed) {
      btnE.consume();
      setScreen(SCR_MENU);
    }
    return;
  }
  if (btnA.pressed) {
    btnA.consume();
    ns.scoreA++;
    checkNetSetWinner();
    netDirty = true;
  }
  if (btnB.pressed) {
    btnB.consume();
    if (ns.scoreA > 0) {
      ns.scoreA--;
      netDirty = true;
    }
  }
  if (btnC.pressed) {
    btnC.consume();
    ns.scoreB++;
    checkNetSetWinner();
    netDirty = true;
  }
  if (btnD.pressed) {
    btnD.consume();
    if (ns.scoreB > 0) {
      ns.scoreB--;
      netDirty = true;
    }
  }
  if (btnJ.heldFor(HOLD_PERIOD_MS)) {
    if (ns.scoreA > ns.scoreB)
      ns.setsA++;
    else if (ns.scoreB > ns.scoreA)
      ns.setsB++;
    if (ns.setsA >= ns.setsToWin) {
      ns.matchOver = true;
      ns.winnerTeam = 0;
    } else if (ns.setsB >= ns.setsToWin) {
      ns.matchOver = true;
      ns.winnerTeam = 1;
    } else {
      ns.currentSet++;
      ns.scoreA = 0;
      ns.scoreB = 0;
    }
    netDirty = true;
  }
  if (btnE.pressed) {
    btnE.consume();
    setScreen(SCR_MENU);
  }
}

void drawNetScreen() {
  // Status bar
  tft.fillRect(0, ZONE_STATUS_Y, DW, ZONE_STATUS_H, C_CHROME);
  tft.drawFastHLine(0, ZONE_STATUS_H - 1, DW, C_LINE);
  tft.setTextSize(1);
  tft.setTextColor(C_MUTED, C_CHROME);
  tft.setCursor(8, 6);
  tft.print(netSportName());
  char setbuf[8];
  snprintf(setbuf, 8, "SET %d", ns.currentSet);
  tftRX(setbuf, DW - 4, 6, 1, C_DIM, C_CHROME);

  // Team bar with set-won circles
  tft.fillRect(0, ZONE_TEAM_Y, DW, ZONE_TEAM_H, C_BG);
  tft.drawFastHLine(0, ZONE_TEAM_Y + ZONE_TEAM_H - 1, DW, C_LINE);
  tft.setTextSize(1);
  tft.setTextColor(C_A, C_BG);
  tft.setCursor(8, ZONE_TEAM_Y + 8);
  tft.print(teamAName);
  int maxS = ns.setsToWin;
  int axBase = DW / 2 - maxS * 9 - 4;
  for (int i = 0; i < maxS; i++) {
    int cx = axBase + i * 9 + 4;
    if (i < ns.setsA)
      tft.fillCircle(cx, ZONE_TEAM_Y + 11, 4, C_A);
    else
      tft.drawCircle(cx, ZONE_TEAM_Y + 11, 4, C_DIM);
  }
  int bxBase = DW / 2 + 4;
  for (int i = 0; i < maxS; i++) {
    int cx = bxBase + i * 9 + 4;
    if (i < ns.setsB)
      tft.fillCircle(cx, ZONE_TEAM_Y + 11, 4, C_B);
    else
      tft.drawCircle(cx, ZONE_TEAM_Y + 11, 4, C_DIM);
  }
  char nB[12] = {0};
  strncpy(nB, teamBName, 11);
  tft.setTextColor(C_B, C_BG);
  tft.setCursor(DW - 8 - (int)strlen(nB) * 6, ZONE_TEAM_Y + 8);
  tft.print(nB);

  // Score area
  tft.fillRect(0, ZONE_SCORE_Y, 160, ZONE_SCORE_H, C_BG);
  tft.fillRect(161, ZONE_SCORE_Y, 159, ZONE_SCORE_H, C_BG);
  tft.drawFastVLine(160, ZONE_SCORE_Y, ZONE_SCORE_H, C_LINE);
  char sA[4], sB[4];
  snprintf(sA, 4, "%d", ns.scoreA);
  snprintf(sB, 4, "%d", ns.scoreB);
  int nwA = (int)strlen(sA) * 8 * 6, nxA = (160 - nwA) / 2;
  if (nxA < 2)
    nxA = 2;
  int nwB = (int)strlen(sB) * 8 * 6, nxB = 161 + (159 - nwB) / 2;
  if (nxB < 163)
    nxB = 163;
  tft.setTextSize(8);
  tft.setTextColor(C_A, C_BG);
  tft.setCursor(nxA, ZONE_SCORE_Y + 24);
  tft.print(sA);
  tft.setTextColor(C_B, C_BG);
  tft.setCursor(nxB, ZONE_SCORE_Y + 24);
  tft.print(sB);
  char ftbuf[16];
  snprintf(ftbuf, 16, "first to %d", ns.ptsToWin);
  tftCtr(ftbuf, ZONE_SCORE_Y + ZONE_SCORE_H - 14, 1, C_DIM);

  if (ns.matchOver) {
    const char *wn = (ns.winnerTeam == 0) ? teamAName : teamBName;
    char wb[24];
    snprintf(wb, 24, "%.10s WINS!", wn);
    tft.fillRect(0, ZONE_SCORE_Y + 58, DW, 32, C_BG);
    tftCtr(wb, ZONE_SCORE_Y + 64, 2, (ns.winnerTeam == 0) ? C_A : C_B);
  }

  // Hint strip
  tft.fillRect(0, ZONE_HINT_Y, DW, ZONE_HINT_H, C_CHROME);
  tft.drawFastHLine(0, ZONE_HINT_Y, DW, C_LINE);
  tft.setTextSize(1);
  tft.setTextColor(C_MID, C_CHROME);
  tft.setCursor(4, ZONE_HINT_Y + 7);
  tft.print("A=+A  B=-1  C=+B  D=-1  J>=end set  E=back");
}

void setScreen(int s) {
  currentScreen = s;
  gameInit = false;
  netDirty = true;
  tft.fillScreen(C_BG);
}

void tickDisplay() {
  // [PERF 5] Cache clock values once per frame
  frameClock = clkSecs();
  frameShot = shotSecs();

  if (currentScreen == SCR_BOOT) {
    static int lastState = -1;
    static unsigned long lastBoot = 0;
    if (deviceState != lastState || millis() - lastBoot > 300) {
      lastState = deviceState;
      lastBoot = millis();
      drawBootScreen();
    }
    return;
  }
  if (currentScreen == SCR_NET) {
    if (netDirty) {
      drawNetScreen();
      netDirty = false;
    }
    return;
  }
  drawGameScreen();
}

// ═══════════════════════════════════════════════════════════════════
//  LAN BROADCAST — soft-AP web server + SSE scoreboard
// ═══════════════════════════════════════════════════════════════════

static const char LAN_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>THE BOX</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080810;color:#ccc;font-family:monospace;min-height:100vh;
display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem}
h1{font-size:.7rem;color:#333;letter-spacing:.3em;margin-bottom:1.2rem}
#sp{font-size:.65rem;color:#294A;text-transform:uppercase;margin-bottom:.4rem}
.row{display:flex;justify-content:space-between;width:100%;max-width:440px}
.tn{font-size:.8rem;letter-spacing:.1em}
#ta{color:#c149ff}#tb{color:#ef20}
#scores{display:flex;align-items:center;justify-content:center;gap:.5rem;margin:.5rem 0}
.big{font-size:5rem;font-weight:700;min-width:110px;text-align:center;font-variant-numeric:tabular-nums}
#sa{color:#c149ff}#sb{color:#ef20}
#sep{font-size:3rem;color:#333;line-height:5rem}
#clk{font-size:2.4rem;text-align:center;font-variant-numeric:tabular-nums;margin:.2rem 0}
#shot{font-size:.75rem;color:#DBC0;text-align:center}
#per{font-size:.65rem;color:#4228;text-align:center;margin-top:.1rem}
#fls{display:flex;justify-content:space-between;width:100%;max-width:440px;
font-size:.6rem;color:#294A;margin:.2rem 0}
#pos{font-size:.65rem;color:#39E7;text-align:center;margin:.15rem 0}
#sets{display:flex;justify-content:space-between;width:100%;max-width:440px;
font-size:.65rem;color:#4228;margin:.2rem 0}
#ftn{font-size:.6rem;color:#294A;text-align:center}
#st{font-size:.55rem;color:#1863;margin-top:1rem;text-align:center}
.dim{color:#333!important}.run{color:#EF5C}.warn{color:#DBC0}.hot{color:#F184}
</style></head><body>
<h1>THE BOX</h1>
<div id=sp>connecting…</div>
<div class=row><span class=tn id=ta></span><span class=tn id=tb></span></div>
<div id=scores>
  <div class=big id=sa>–</div>
  <div id=sep>/</div>
  <div class=big id=sb>–</div>
</div>
<div id=bball>
  <div id=fls><span id=fa>FOULS –</span><span id=fb>FOULS –</span></div>
  <div id=clk>–:––</div>
  <div id=shot></div>
  <div id=per></div>
  <div id=pos></div>
</div>
<div id=net style=display:none>
  <div id=sets><span id=sta></span><span id=stb></span></div>
  <div id=ftn></div>
</div>
<div id=st>waiting for data</div>
<script>
var ev=new EventSource('/events');
ev.addEventListener('update',function(e){
  try{
    var d=JSON.parse(e.data),S=function(i){return document.getElementById(i);};
    S('st').textContent='● live';
    S('ta').textContent=d.tA; S('tb').textContent=d.tB;
    S('sa').textContent=d.sA; S('sb').textContent=d.sB;
    if(d.sport==='basketball'){
      S('sp').textContent='BASKETBALL';
      S('bball').style.display='block'; S('net').style.display='none';
      S('fa').textContent='FOULS '+d.fA; S('fb').textContent='FOULS '+d.fB;
      var t=d.clk,m=Math.floor(t/60),s=t%60;
      S('clk').textContent=m+':'+(s<10?'0':'')+s;
      S('clk').className=!d.running?'dim':t<=30?'hot':t<=60?'warn':'run';
      S('shot').textContent=d.shot>0?'SHOT '+d.shot:'';
      var p=d.period,tp=d.totalP;
      S('per').textContent=p<=tp?(tp===1?'GAME':tp===2?'H'+p:'Q'+p):'OT';
      S('pos').textContent=d.poss==='A'?'\u25c4 '+d.tA:d.tB+' \u25ba';
    }else{
      var sn=['BADMINTON','VOLLEYBALL','TABLE TENNIS'];
      S('sp').textContent=d.over?(d.winner===0?d.tA:d.tB)+' WINS!':(sn[d.subSport]||'NET')+' \u00b7 SET '+d.curSet;
      S('bball').style.display='none'; S('net').style.display='block';
      S('sta').textContent=d.tA+' \u25cf\u25cf\u25cf'.slice(0,d.setA*2);
      S('stb').textContent='\u25cf\u25cf\u25cf'.slice(0,d.setB*2)+' '+d.tB;
      S('ftn').textContent='first to '+d.ptsToWin;
    }
  }catch(ex){}
});
ev.onerror=function(){document.getElementById('st').textContent='reconnecting…';};
</script></body></html>
)rawliteral";

void pushSseUpdate() {
  if (!sseSource || !sseSource->count())
    return;
  char buf[400];
  if (gcfg.sport == 0) {
    // Basketball
    int cs = frameClock, ss = frameShot;
    snprintf(buf, sizeof(buf),
             "{\"sport\":\"basketball\","
             "\"sA\":%d,\"sB\":%d,"
             "\"fA\":%d,\"fB\":%d,"
             "\"clk\":%d,\"shot\":%d,"
             "\"period\":%d,\"running\":%s,"
             "\"poss\":\"%c\","
             "\"tA\":\"%.15s\",\"tB\":\"%.15s\","
             "\"totalP\":%d}",
             gs.scoreA, gs.scoreB, gs.foulsA, gs.foulsB, cs, ss, gs.period,
             gs.clockRunning ? "true" : "false", gs.poss ? 'B' : 'A', teamAName,
             teamBName, gcfg.totalPeriods);
  } else {
    // Net sports
    snprintf(buf, sizeof(buf),
             "{\"sport\":\"net\","
             "\"sA\":%d,\"sB\":%d,"
             "\"setA\":%d,\"setB\":%d,"
             "\"curSet\":%d,"
             "\"ptsToWin\":%d,\"setsToWin\":%d,"
             "\"subSport\":%d,"
             "\"tA\":\"%.15s\",\"tB\":\"%.15s\","
             "\"over\":%s,\"winner\":%d}",
             ns.scoreA, ns.scoreB, ns.setsA, ns.setsB, ns.currentSet,
             ns.ptsToWin, ns.setsToWin, ns.subSport, teamAName, teamBName,
             ns.matchOver ? "true" : "false", ns.winnerTeam);
  }
  sseSource->send(buf, "update", 0, 0);
}

void startLanServer() {
  char apName[24];
  snprintf(apName, sizeof(apName), "THEBOX_%s", sessionCode);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apName, "thebox123");
  delay(150);
  Serial.printf("[lan] AP: %s  IP: %s\n", apName,
                WiFi.softAPIP().toString().c_str());

  sseSource = new AsyncEventSource("/events");
  sseSource->onConnect([](AsyncEventSourceClient *c) {
    // Push current state to newly connected client
    if (c->lastId())
      Serial.printf("[sse] reconnect id=%u\n", c->lastId());
    c->send("connected", "hello", millis(), 3000);
  });
  lanServer.addHandler(sseSource);

  lanServer.on("/", HTTP_GET, [](AsyncWebServerRequest *req) {
    req->send_P(200, "text/html", LAN_HTML);
  });

  lanServer.begin();
  Serial.println("[lan] Server started on port 80");
}

// ═══════════════════════════════════════════════════════════════════
//  BROADCAST — fixed char buffer, no heap allocation
// ═══════════════════════════════════════════════════════════════════

// [PERF 3] snprintf into fixed buffer — no String, no heap alloc
void buildBroadcastJson(char *out, size_t outLen) {
  // Use frame-cached clock values so we don't recompute
  int cs = frameClock, ss = frameShot;
  snprintf(
      out, outLen,
      "{\"messages\":[{\"topic\":\"hw-%s\",\"event\":\"signal\",\"payload\":{"
      "\"action\":\"SCORE_STATE\","
      "\"deviceId\":\"%s\","
      "\"gameId\":\"%s\","
      "\"scoreA\":%d,\"scoreB\":%d,"
      "\"minutes\":%d,\"seconds\":%d,"
      "\"shotClock\":%d,"
      "\"period\":%d,"
      "\"gameRunning\":%s,"
      "\"paused\":%s,"
      "\"possession\":\"%c\","
      "\"foulsA\":%d,\"foulsB\":%d,"
      "\"timestamp\":%lu"
      "}}]}",
      activeGameId, sessionCode, activeGameId, gs.scoreA, gs.scoreB, cs / 60,
      cs % 60, ss, gs.period, gs.clockRunning ? "true" : "false",
      gs.paused ? "true" : "false", gs.poss ? 'B' : 'A', gs.foulsA, gs.foulsB,
      millis());
}

// [PERF 1] Push fixed-size struct onto queue — no new/delete
void broadcastState() {
  if (deviceMode == MODE_BROADCAST) {
    pushSseUpdate();
    return;
  }
  if (deviceMode != MODE_ONLINE)
    return; // offline: no network, return quietly
  if (activeGameId[0] == '\0')
    return;
  if (WiFi.status() != WL_CONNECTED)
    return;
  if (!broadcastQueue)
    return;

  BcastMsg msg;
  buildBroadcastJson(msg.buf, BCAST_BUF_SIZE);

  // If queue full, drop oldest and push newest (always send current state)
  if (xQueueSend(broadcastQueue, &msg, 0) != pdTRUE) {
    BcastMsg old;
    xQueueReceive(broadcastQueue, &old, 0);
    xQueueSend(broadcastQueue, &msg, 0);
  }
}

// ─── [PERF 2] Persistent HTTP connection ──────────────────────────
// Opens once, reuses for every broadcast, reconnects only on failure.
bool bcastEnsureConnected() {
  // If we have a live connection that was recently used, reuse it
  if (bcastClient && bcastHttp && bcastClient->connected() &&
      millis() - bcastLastUse < BCAST_CONN_TIMEOUT_MS) {
    return true;
  }
  // Tear down stale connection
  if (bcastHttp) {
    bcastHttp->end();
    delete bcastHttp;
    bcastHttp = nullptr;
  }
  if (bcastClient) {
    bcastClient->stop();
    delete bcastClient;
    bcastClient = nullptr;
  }

  if (WiFi.status() != WL_CONNECTED)
    return false;

  bcastClient = new WiFiClientSecure();
  bcastClient->setInsecure();
  bcastClient->setTimeout(5);

  // Pre-connect TCP+TLS to the host
  if (!bcastClient->connect(SUPABASE_HOST, 443)) {
    Serial.println("[bcast] TCP connect failed");
    delete bcastClient;
    bcastClient = nullptr;
    return false;
  }

  bcastHttp = new HTTPClient();
  String url = String(SUPABASE_URL) + "/realtime/v1/api/broadcast";
  bcastHttp->begin(*bcastClient, url);
  bcastHttp->addHeader("Content-Type", "application/json");
  bcastHttp->addHeader("apikey", SUPABASE_KEY);
  bcastHttp->addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  bcastHttp->addHeader("Connection", "keep-alive");

  Serial.println("[bcast] New persistent connection established");
  return true;
}

void broadcastTask(void *p) {
  for (;;) {
    BcastMsg msg;
    if (xQueueReceive(broadcastQueue, &msg, portMAX_DELAY) == pdTRUE) {
      if (WiFi.status() != WL_CONNECTED)
        continue;

      bool ok = bcastEnsureConnected();
      if (!ok)
        continue;

      int rc = bcastHttp->POST(msg.buf);
      bcastLastUse = millis();
      lastBcastCode = rc;

      if (rc <= 0 || rc >= 500) {
        // Connection failed or server error — force reconnect next time
        Serial.printf("[bcast] HTTP:%d — closing connection\n", rc);
        if (bcastHttp) {
          bcastHttp->end();
          delete bcastHttp;
          bcastHttp = nullptr;
        }
        if (bcastClient) {
          bcastClient->stop();
          delete bcastClient;
          bcastClient = nullptr;
        }
      } else {
        Serial.printf("[bcast] HTTP:%d\n", rc);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ACTIVATE GAME
// ═══════════════════════════════════════════════════════════════════
static volatile bool pendingActivation = false;
static char pendingTeamA[16] = {0};
static char pendingTeamB[16] = {0};
static char pendingGameId[16] = {0};

void activateGame(const char *ta, const char *tb, const char *gid) {
  strncpy(teamAName, ta, 15);
  teamAName[15] = '\0';
  strncpy(teamBName, tb, 15);
  teamBName[15] = '\0';
  strncpy(activeGameId, gid, 15);
  activeGameId[15] = '\0';
  gs = {};
  gs.paused = true;
  gs.clockValueAtStart = QUARTER_SECONDS;
  gs.shotValueAtStart = SHOT_CLOCK_FULL;
  gs.period = 1;
  undoTop = 0;
  pSA = -1;
  pSB = -1;
  pPoss = -1;
  pLocked = false;
  pLocked2 = false;
  gcfg.sport = 0;
  gcfg.bballFormat = 0;
  gcfg.totalPeriods = 4;
  gcfg.periodSeconds = QUARTER_SECONDS;
  gcfg.shotClockDefault = SHOT_CLOCK_FULL;
  gcfg.foulBonus = 5;
  gcfg.is3x3 = false;
  gcfg.shotClockOn = true;
  gcfg.periodMins = 10;
  setScreen(SCR_GAME);
  broadcastState();
  Serial.printf("[game] ACTIVATED — %s vs %s  game:%s\n", teamAName, teamBName,
                activeGameId);
}

// ═══════════════════════════════════════════════════════════════════
//  WIFI
// ═══════════════════════════════════════════════════════════════════
void setupWifi() {
  tft.fillScreen(C_BG);
  tftCtr("THE BOX", 28, 2, C_MUTED);
  tft.drawFastHLine(60, 52, DW - 120, C_LINE);
  tftCtr("connecting to wifi...", 70, 1, C_MUTED);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.begin(); // try saved credentials first

  unsigned long t0 = millis();
  int dot = 0;
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
    char dots[5] = {0};
    for (int i = 0; i < (dot % 4); i++)
      dots[i] = '.';
    tft.fillRect(0, 86, DW, 12, C_BG);
    tftCtr(dots, 86, 1, C_GREEN);
    dot++;
    delay(300);
  }

  if (WiFi.status() == WL_CONNECTED) {
    tft.fillRect(0, 86, DW, 12, C_BG);
    tftCtr("connected!", 86, 1, C_GREEN);
    delay(400);
    return;
  }

  // WiFiManager portal fallback
  char ap[32];
  snprintf(ap, sizeof(ap), "THEBOX_%s", sessionCode);
  tft.fillScreen(C_BG);
  tftCtr("WIFI SETUP", 46, 2, C_AMBER);
  tft.drawFastHLine(40, 74, DW - 80, C_LINE);
  tftCtr("connect phone to:", 88, 1, C_MUTED);
  tftCtr(ap, 106, 1, C_YELLOW);
  tftCtr("enter wifi password", 126, 1, C_MUTED);
  tftCtr("portal closes in 5 min", 150, 1, C_DIM);

  WiFiManager wm;
  wm.setConnectTimeout(15);
  wm.setConfigPortalTimeout(300);
  wm.setBreakAfterConfig(true);
  wm.autoConnect(ap);
  WiFi.begin();
  unsigned long t1 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t1 < 12000)
    delay(300);
  if (WiFi.status() == WL_CONNECTED)
    WiFi.setSleep(false);
}

// ═══════════════════════════════════════════════════════════════════
//  SUPABASE REGISTER
//  [FIX 2] When row exists: only PATCH local_ip.
//          Never touch status, host_id or active_game_id.
//          An active game survives a device reboot.
// ═══════════════════════════════════════════════════════════════════
bool supaRegister() {
  WiFiClientSecure cli;
  cli.setInsecure();
  HTTPClient http;
  http.setTimeout(10000);

  String checkUrl = String(SUPABASE_URL) +
                    "/rest/v1/hardware_terminals?id=eq." + sessionCode +
                    "&select=id,status";
  http.begin(cli, checkUrl);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
  http.addHeader("Accept", "application/json");
  int cc = http.GET();
  String cb = http.getString();
  http.end();
  Serial.printf("[reg] Check HTTP:%d  %s\n", cc, cb.c_str());

  bool exists = (cc == 200 && cb.length() > 4 && cb != "[]");

  if (exists) {
    // [FIX 2] Only update IP — never overwrite status or pairing fields
    String pu = String(SUPABASE_URL) + "/rest/v1/hardware_terminals?id=eq." +
                sessionCode;
    http.begin(cli, pu);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
    http.addHeader("Prefer", "return=minimal");
    char body[128];
    snprintf(body, sizeof(body), "{\"local_ip\":\"%s\"}",
             WiFi.localIP().toString().c_str());
    int pc = http.PATCH(body);
    http.end();
    Serial.printf("[reg] IP-only PATCH HTTP:%d\n", pc);
    return (pc >= 200 && pc < 300 || pc == 0);
  } else {
    // New device — insert with status=waiting
    String iu = String(SUPABASE_URL) + "/rest/v1/hardware_terminals";
    http.begin(cli, iu);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
    http.addHeader("Prefer", "return=minimal");
    char body[192];
    snprintf(body, sizeof(body),
             "{\"id\":\"%s\",\"status\":\"waiting\",\"local_ip\":\"%s\"}",
             sessionCode, WiFi.localIP().toString().c_str());
    int ic = http.POST((uint8_t *)body, strlen(body));
    String ib = http.getString();
    http.end();
    Serial.printf("[reg] INSERT HTTP:%d  %s\n", ic, ib.c_str());
    if (ic == 409)
      return true; // already exists (race) — fine
    return (ic >= 200 && ic < 300);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  POLL TASK
// ═══════════════════════════════════════════════════════════════════
void pollTask(void *p) {
  vTaskDelay(pdMS_TO_TICKS(2000));
  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClientSecure cli;
      cli.setInsecure();
      HTTPClient http;
      http.setTimeout(6000);
      String url =
          String(SUPABASE_URL) + "/rest/v1/hardware_terminals?id=eq." +
          sessionCode +
          "&select=status,active_game_id,team_a_name,team_b_name,control_mode";
      http.begin(cli, url);
      http.addHeader("apikey", SUPABASE_KEY);
      http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
      http.addHeader("Accept", "application/json");
      int code = http.GET();
      String body = http.getString();
      http.end();
      lastHttpCode = code;
      pollCount++;
      Serial.printf("[poll #%d] HTTP:%d  %s\n", pollCount, code, body.c_str());

      if (code == 200) {
        StaticJsonDocument<512> doc;
        if (!deserializeJson(doc, body) && doc.is<JsonArray>() &&
            doc.size() > 0) {
          JsonObject row = doc[0].as<JsonObject>();
          const char *st = row["status"] | "waiting";
          const char *gid = row["active_game_id"] | "";
          const char *ta = row["team_a_name"] | "HOME";
          const char *tb = row["team_b_name"] | "AWAY";
          const char *mod = row["control_mode"] | "hardware";
          strncpy(dbStatusRaw, st, sizeof(dbStatusRaw) - 1);
          gs.isLocked = (strcmp(mod, "web") == 0);

          if (strcmp(st, "active") == 0 && strlen(gid) > 0 &&
              strcmp(gid, "null") != 0) {
            if (deviceState != 2) {
              strncpy(pendingTeamA, ta, 15);
              strncpy(pendingTeamB, tb, 15);
              strncpy(pendingGameId, gid, 15);
              deviceState = 2;
              pendingActivation = true;
            } else {
              // Keep team names up-to-date if changed mid-game
              strncpy(teamAName, ta, 15);
              strncpy(teamBName, tb, 15);
            }
          } else if (strcmp(st, "paired") == 0) {
            if (deviceState != 1)
              deviceState = 1;
          } else {
            if (deviceState != 0) {
              deviceState = 0;
            }
          }
        }
      }
    }
    vTaskDelay(pdMS_TO_TICKS(2000));
  }
}

// ═══════════════════════════════════════════════════════════════════
//  HEARTBEAT TASK
//  [PERF 6] Interval increased 10s → 15s — halves background HTTP load.
// ═══════════════════════════════════════════════════════════════════
void heartbeatTask(void *p) {
  vTaskDelay(pdMS_TO_TICKS(10000));
  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClientSecure cli;
      cli.setInsecure();
      HTTPClient http;
      http.setTimeout(5000);
      String url = String(SUPABASE_URL) + "/rest/v1/hardware_terminals?id=eq." +
                   sessionCode;
      http.begin(cli, url);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("apikey", SUPABASE_KEY);
      http.addHeader("Authorization", "Bearer " + String(SUPABASE_KEY));
      char b[48];
      snprintf(b, sizeof(b), "{\"last_heartbeat\":%lu}", millis());
      http.PATCH(b);
      http.end();
    }
    vTaskDelay(pdMS_TO_TICKS(15000)); // [PERF 6] was 10s
  }
}

// ═══════════════════════════════════════════════════════════════════
//  WIFI MONITOR
// ═══════════════════════════════════════════════════════════════════
void wifiMonTask(void *p) {
  vTaskDelay(pdMS_TO_TICKS(30000));
  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(20000));
    if (WiFi.status() == WL_CONNECTED)
      continue;
    Serial.println("[wifi] Lost — reconnecting");
    WiFi.begin(); // reuses saved credentials
    int a = 0;
    while (WiFi.status() != WL_CONNECTED && a++ < 40)
      vTaskDelay(pdMS_TO_TICKS(500));
    if (WiFi.status() == WL_CONNECTED) {
      WiFi.setSleep(false);
      // Force broadcast connection reset so it reconnects on clean WiFi
      if (bcastClient) {
        bcastClient->stop();
        delete bcastClient;
        bcastClient = nullptr;
      }
      if (bcastHttp) {
        bcastHttp->end();
        delete bcastHttp;
        bcastHttp = nullptr;
      }
      Serial.println("[wifi] Reconnected");
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SESSION CODE — [FIX 1] Persists across reboots via NVS
// ═══════════════════════════════════════════════════════════════════
void initSessionCode() {
  Preferences prefs;
  prefs.begin("thebox", false);
  String stored = prefs.getString("code", "");
  if (stored.length() == 4) {
    stored.toCharArray(sessionCode, 5);
    codeIsResumed = true;
    Serial.printf("[boot] Reusing NVS code: %s\n", sessionCode);
  } else {
    uint32_t r = esp_random();
    for (int i = 0; i < 4; i++)
      sessionCode[i] = CHARSET[(r >> (i * 5)) & 0x1F];
    sessionCode[4] = '\0';
    prefs.putString("code", String(sessionCode));
    codeIsResumed = false;
    Serial.printf("[boot] New code: %s\n", sessionCode);
  }
  prefs.end();
}

// ═══════════════════════════════════════════════════════════════════
//  GENERIC MENU HELPERS
// ═══════════════════════════════════════════════════════════════════

int showHorizMenu(const char *title, const MenuItem *items, int count,
                  uint16_t accent) {
  int gap = 6;
  int cw = (DW - (count + 1) * gap) / count;
  int ch = 162, cy = 26;
  int idx = 0;
  bool changed = true;
  for (auto b : allButtons)
    b->consume();
  for (;;) {
    for (auto b : allButtons)
      b->update();
    if (btnA.pressed) {
      idx = (idx + 1) % count;
      if (idx >= count)
        idx = count - 1;
      changed = true;
      btnA.consume();
    }
    if (btnB.pressed) {
      idx = (idx - 1 + count) % count;
      changed = true;
      btnB.consume();
    }
    if (changed) {
      tft.fillScreen(C_BG);
      tft.fillRect(0, 0, DW, 22, C_CHROME);
      tft.drawFastHLine(0, 22, DW, C_LINE);
      tftCX(title, 0, DW, 6, 1, C_TEXT, C_CHROME);
      for (int i = 0; i < count; i++) {
        int cx = gap + i * (cw + gap);
        bool sel = (i == idx);
        uint16_t cardBg = sel ? tft.color565((((accent >> 11) & 0x1F) * 8) / 8,
                                             (((accent >> 5) & 0x3F) * 4) / 10,
                                             ((accent & 0x1F) * 8) / 8)
                              : (uint16_t)0x0000;
        uint16_t border = sel ? accent : C_LINE;
        uint16_t fg = sel ? 0xFFFF : C_MUTED;
        uint16_t sfg = sel ? accent : C_DIM;
        tft.fillRoundRect(cx, cy, cw, ch, 5, cardBg);
        tft.drawRoundRect(cx, cy, cw, ch, 5, border);
        if (sel) {
          tft.drawRoundRect(cx + 1, cy + 1, cw - 2, ch - 2, 5, border);
        }
        if (sel)
          tft.fillRect(cx + 5, cy, cw - 10, 4, accent);
        int lsz = 2;
        if ((int)(strlen(items[i].label) * 2 * 6) > cw - 10)
          lsz = 1;
        int labelH = lsz * 8;
        int labelY = cy + ch / 2 - labelH - 6;
        tftCX(items[i].label, cx + 2, cx + cw - 2, labelY, lsz, fg, cardBg);
        tftCX(items[i].sub, cx + 2, cx + cw - 2, labelY + labelH + 10, 1, sfg,
              cardBg);
        if (sel)
          tft.fillRect(cx + 8, cy + ch - 5, cw - 16, 3, accent);
      }
      tft.fillRect(0, DH - 20, DW, 20, C_CHROME);
      tft.drawFastHLine(0, DH - 20, DW, C_LINE);
      tft.setTextSize(1);
      tft.setTextColor(C_MID, C_CHROME);
      tft.setCursor(10, DH - 13);
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("A");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print("/");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("B");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" change   ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("I");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" select   ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("E");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" back");
      changed = false;
    }
    if (btnI.pressed) {
      btnI.consume();
      return idx;
    }
    if (btnE.pressed) {
      btnE.consume();
      return -1;
    }
    delay(2);
  }
}

int showVertList(const char *title, const char **items, int count,
                 uint16_t accent) {
  const int RH = 30, LY = 26, VIS = 6;
  int idx = 0;
  bool changed = true;
  for (auto b : allButtons)
    b->consume();
  for (;;) {
    for (auto b : allButtons)
      b->update();
    if (btnC.pressed) {
      idx = (idx + 1) % count;
      if (idx >= count)
        idx = count - 1;
      changed = true;
      btnC.consume();
    }
    if (btnD.pressed) {
      idx = (idx - 1 + count) % count;
      changed = true;
      btnD.consume();
    }
    if (changed) {
      tft.fillScreen(C_BG);
      tft.fillRect(0, 0, DW, 22, C_CHROME);
      tft.drawFastHLine(0, 22, DW, C_LINE);
      tftCX(title, 0, DW, 6, 1, C_TEXT, C_CHROME);
      int start = idx - (VIS / 2);
      if (start < 0)
        start = 0;
      if (start + VIS > count) {
        start = count - VIS;
        if (start < 0)
          start = 0;
      }
      for (int i = start; i < start + VIS && i < count; i++) {
        int ry = LY + (i - start) * RH;
        bool sel = (i == idx);
        uint16_t bg = sel ? C_DIM : C_BG;
        uint16_t fg = sel ? 0xFFFF : C_MUTED;
        tft.fillRect(0, ry, DW, RH, bg);
        if (sel) {
          tft.drawFastHLine(0, ry, DW, accent);
          tft.drawFastHLine(0, ry + RH - 1, DW, accent);
        }
        if (sel)
          tft.fillCircle(14, ry + RH / 2, 5, accent);
        else
          tft.drawCircle(14, ry + RH / 2, 5, C_LINE);
        int tsz = sel ? 2 : 1;
        tft.setTextSize(tsz);
        tft.setTextColor(fg, bg);
        tft.setCursor(28, ry + RH / 2 - tsz * 4);
        tft.print(items[i]);
      }
      if (count > VIS) {
        int dotY = DH - 26;
        for (int i = 0; i < count; i++) {
          int dx = DW / 2 - (count * 8) / 2 + i * 8;
          if (i == idx)
            tft.fillCircle(dx, dotY, 3, accent);
          else
            tft.drawCircle(dx, dotY, 3, C_LINE);
        }
      }
      tft.fillRect(0, DH - 20, DW, 20, C_CHROME);
      tft.drawFastHLine(0, DH - 20, DW, C_LINE);
      tft.setTextSize(1);
      tft.setTextColor(C_MID, C_CHROME);
      tft.setCursor(10, DH - 13);
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("C");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print("/");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("D");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" scroll   ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("I");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" select   ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("E");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" back");
      changed = false;
    }
    if (btnI.pressed) {
      btnI.consume();
      return idx;
    }
    if (btnE.pressed) {
      btnE.consume();
      return -1;
    }
    delay(2);
  }
}

bool showToggle(const char *title, const char *question, bool defaultVal) {
  bool val = defaultVal;
  bool changed = true;
  for (auto b : allButtons)
    b->consume();
  for (;;) {
    for (auto b : allButtons)
      b->update();
    if (btnA.pressed || btnB.pressed || btnC.pressed || btnD.pressed) {
      val = !val;
      changed = true;
      btnA.consume();
      btnB.consume();
      btnC.consume();
      btnD.consume();
    }
    if (changed) {
      tft.fillScreen(C_BG);
      tft.fillRect(0, 0, DW, 20, C_CHROME);
      tft.drawFastHLine(0, 20, DW, C_LINE);
      tftCX(title, 0, DW, 6, 1, C_MUTED, C_CHROME);
      tftCtr(question, 60, 1, C_TEXT);
      uint16_t yBg = val ? C_GREEN : C_BG, nBg = val ? C_BG : C_RED;
      uint16_t yFg = val ? 0x0000 : C_MUTED, nFg = val ? C_MUTED : 0xFFFF;
      tft.fillRoundRect(20, 90, 130, 60, 6, yBg);
      tft.drawRoundRect(20, 90, 130, 60, 6, C_GREEN);
      tftCX("YES", 20, 150, 106, 3, yFg, yBg);
      tft.fillRoundRect(170, 90, 130, 60, 6, nBg);
      tft.drawRoundRect(170, 90, 130, 60, 6, C_RED);
      tftCX("NO", 170, 300, 106, 3, nFg, nBg);
      tft.fillRect(0, 218, DW, 22, C_CHROME);
      tft.drawFastHLine(0, 218, DW, C_LINE);
      tft.setTextSize(1);
      tft.setTextColor(C_MID, C_CHROME);
      tft.setCursor(20, 226);
      tft.print("A/B/C/D = toggle    I = confirm");
      changed = false;
    }
    if (btnI.pressed) {
      btnI.consume();
      return val;
    }
    delay(2);
  }
}

// ─── Team name character picker ───────────────────────────────────
static const char NAME_CHARS[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ";
#define NAME_CHARS_LEN 37

static const char NE_CHARS[] = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
#define NE_CHARS_LEN 37

void enterTeamName(char *out, int maxLen, const char *defaultName,
                   uint16_t accent) {
  tft.fillScreen(C_BG);
  tft.fillRect(0, 0, DW, 22, C_CHROME);
  tft.drawFastHLine(0, 22, DW, C_LINE);
  tftCX("TEAM NAME", 0, DW, 6, 1, C_TEXT, C_CHROME);
  tft.fillRoundRect(20, 50, 280, 40, 5, C_CHROME);
  tft.drawRoundRect(20, 50, 280, 40, 5, C_LINE);
  tftCX(defaultName, 20, 300, 62, 2, C_YELLOW, C_CHROME);
  tft.fillRoundRect(20, 100, 130, 50, 5, C_DIM);
  tft.drawRoundRect(20, 100, 130, 50, 5, accent);
  tftCX("CUSTOM", 20, 150, 118, 2, 0xFFFF, C_DIM);
  tft.fillRoundRect(170, 100, 130, 50, 5, C_DIM);
  tft.drawRoundRect(170, 100, 130, 50, 5, C_LINE);
  tftCX("DEFAULT", 170, 300, 118, 2, C_MUTED, C_DIM);
  tftCX("I = custom   E = use default", 0, DW, 165, 1, C_DIM, C_BG);
  tft.fillRect(0, DH - 20, DW, 20, C_CHROME);
  tft.drawFastHLine(0, DH - 20, DW, C_LINE);
  for (auto b : allButtons)
    b->consume();
  for (;;) {
    for (auto b : allButtons)
      b->update();
    if (btnE.pressed) {
      btnE.consume();
      strncpy(out, defaultName, maxLen - 1);
      out[maxLen - 1] = '\0';
      return;
    }
    if (btnI.pressed) {
      btnI.consume();
      break;
    }
    delay(2);
  }

  int nameLen = 4;
  {
    bool lchanged = true;
    for (auto b : allButtons)
      b->consume();
    for (;;) {
      for (auto b : allButtons)
        b->update();
      if (btnC.pressed) {
        nameLen++;
        if (nameLen > 10)
          nameLen = 10;
        lchanged = true;
        btnC.consume();
      }
      if (btnD.pressed) {
        nameLen--;
        if (nameLen < 2)
          nameLen = 2;
        lchanged = true;
        btnD.consume();
      }
      if (lchanged) {
        tft.fillScreen(C_BG);
        tft.fillRect(0, 0, DW, 22, C_CHROME);
        tft.drawFastHLine(0, 22, DW, C_LINE);
        tftCX("NAME LENGTH", 0, DW, 6, 1, C_TEXT, C_CHROME);
        char nb[4];
        snprintf(nb, 4, "%d", nameLen);
        tft.setTextSize(8);
        tft.setTextColor(C_YELLOW, C_BG);
        int nw = strlen(nb) * 8 * 6;
        tft.setCursor((DW - nw) / 2, 70);
        tft.print(nb);
        tftCX("letters", 0, DW, 148, 1, C_MUTED, C_BG);
        tft.fillRect(0, DH - 20, DW, 20, C_CHROME);
        tft.drawFastHLine(0, DH - 20, DW, C_LINE);
        tft.setTextSize(1);
        tft.setCursor(10, DH - 13);
        tft.setTextColor(C_YELLOW, C_CHROME);
        tft.print("C/D");
        tft.setTextColor(C_MID, C_CHROME);
        tft.print(" adjust   ");
        tft.setTextColor(C_YELLOW, C_CHROME);
        tft.print("I");
        tft.setTextColor(C_MID, C_CHROME);
        tft.print(" confirm");
        lchanged = false;
      }
      if (btnI.pressed) {
        btnI.consume();
        break;
      }
      if (btnE.pressed) {
        btnE.consume();
        strncpy(out, defaultName, maxLen - 1);
        out[maxLen - 1] = '\0';
        return;
      }
      delay(2);
    }
  }

  char name[11];
  memset(name, 0, 11);
  int charState[10];
  memset(charState, 0, 10);
  int pos = 0;
  bool echanged = true;
  unsigned long lastScrollA = 0, lastScrollB = 0;
  const int BOX_W = 28, BOX_H = 36, BOX_GAP = 5;
  int totalBoxW = nameLen * (BOX_W + BOX_GAP) - BOX_GAP;
  int boxStartX = (DW - totalBoxW) / 2;
  int boxY = 70;
  for (auto b : allButtons)
    b->consume();
  for (;;) {
    for (auto b : allButtons)
      b->update();
    unsigned long now = millis();
    if (btnA.pressed) {
      charState[pos] = (charState[pos] + 1) % NE_CHARS_LEN;
      echanged = true;
      lastScrollA = now;
      btnA.consume();
    } else if (btnA.held && btnA.heldMs() > 400 && now - lastScrollA >= 80) {
      charState[pos] = (charState[pos] + 1) % NE_CHARS_LEN;
      echanged = true;
      lastScrollA = now;
    }
    if (btnB.pressed) {
      charState[pos] = (charState[pos] - 1 + NE_CHARS_LEN) % NE_CHARS_LEN;
      echanged = true;
      lastScrollB = now;
      btnB.consume();
    } else if (btnB.held && btnB.heldMs() > 400 && now - lastScrollB >= 80) {
      charState[pos] = (charState[pos] - 1 + NE_CHARS_LEN) % NE_CHARS_LEN;
      echanged = true;
      lastScrollB = now;
    }
    if (btnI.pressed) {
      btnI.consume();
      name[pos] = NE_CHARS[charState[pos]];
      pos++;
      if (pos >= nameLen) {
        break;
      }
      echanged = true;
    }
    if (btnH.pressed) {
      btnH.consume();
      if (pos > 0) {
        pos--;
        charState[pos] = 0;
        name[pos] = '\0';
      }
      echanged = true;
    }
    if (btnJ.pressed) {
      btnJ.consume();
      name[pos] = NE_CHARS[charState[pos]];
      pos++;
      break;
    }
    if (btnE.pressed) {
      btnE.consume();
      strncpy(out, defaultName, maxLen - 1);
      out[maxLen - 1] = '\0';
      return;
    }
    if (echanged) {
      tft.fillScreen(C_BG);
      tft.fillRect(0, 0, DW, 22, C_CHROME);
      tft.drawFastHLine(0, 22, DW, C_LINE);
      tftCX("TEAM NAME", 0, DW, 6, 1, C_TEXT, C_CHROME);
      for (int i = 0; i < nameLen; i++) {
        int bx = boxStartX + i * (BOX_W + BOX_GAP);
        bool active = (i == pos);
        bool filled = (i < pos);
        uint16_t boxBg = active ? C_DIM : (filled ? C_CHROME : C_BG);
        uint16_t boxBdr = active ? accent : (filled ? C_LINE : C_DIM);
        tft.fillRoundRect(bx, boxY, BOX_W, BOX_H, 3, boxBg);
        tft.drawRoundRect(bx, boxY, BOX_W, BOX_H, 3, boxBdr);
        if (active) {
          char cc[2] = {NE_CHARS[charState[i]], '\0'};
          tft.setTextSize(2);
          tft.setTextColor(accent, boxBg);
          int cw = 2 * 6;
          tft.setCursor(bx + (BOX_W - cw) / 2, boxY + 10);
          tft.print(cc);
        } else if (filled) {
          char lc[2] = {name[i], '\0'};
          if (name[i] == '\0')
            lc[0] = ' ';
          tft.setTextSize(2);
          tft.setTextColor(C_TEXT, boxBg);
          int cw = 2 * 6;
          tft.setCursor(bx + (BOX_W - cw) / 2, boxY + 10);
          tft.print(lc);
        }
      }
      if (pos < nameLen) {
        int prevI = (charState[pos] - 1 + NE_CHARS_LEN) % NE_CHARS_LEN;
        int nextI = (charState[pos] + 1) % NE_CHARS_LEN;
        char prev[2] = {NE_CHARS[prevI], '\0'};
        char curr[2] = {NE_CHARS[charState[pos]], '\0'};
        char next[2] = {NE_CHARS[nextI], '\0'};
        tft.setTextSize(2);
        tft.setTextColor(C_DIM, C_BG);
        tft.setCursor(DW / 2 - 48, 120);
        tft.print(prev);
        tft.setTextSize(4);
        tft.setTextColor(accent, C_BG);
        int cw = 4 * 6;
        tft.setCursor((DW - cw) / 2, 114);
        tft.print(curr);
        tft.setTextSize(2);
        tft.setTextColor(C_DIM, C_BG);
        tft.setCursor(DW / 2 + 28, 120);
        tft.print(next);
        tft.setTextSize(1);
        tft.setTextColor(C_DIM, C_BG);
        tftCX("A  /  B", 0, DW, 170, 1, C_DIM, C_BG);
      }
      char posbuf[12];
      snprintf(posbuf, 12, "letter %d/%d", pos + 1, nameLen);
      tftCX(posbuf, 0, DW, 188, 1, C_DIM, C_BG);
      tft.fillRect(0, DH - 20, DW, 20, C_CHROME);
      tft.drawFastHLine(0, DH - 20, DW, C_LINE);
      tft.setTextSize(1);
      tft.setCursor(4, DH - 13);
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("A/B");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" char  ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("I");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" place  ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("H");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" del  ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("J");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" done  ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("E");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" skip");
      echanged = false;
    }
    delay(2);
  }
  name[pos] = '\0';
  int l = strlen(name);
  while (l > 0 && name[l - 1] == ' ') {
    name[l - 1] = '\0';
    l--;
  }
  if (l == 0)
    strncpy(name, defaultName, 10);
  strncpy(out, name, maxLen - 1);
  out[maxLen - 1] = '\0';
}

// ═══════════════════════════════════════════════════════════════════
//  OFFLINE GAME CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

int showTimePicker() {
  static const int presets[] = {300, 480, 600, 720, 900, 1200};
  static const char *labels[] = {"5", "8", "10", "12", "15", "20"};
  const int nPresets = 6;
  int idx = 2; // default 10 min
  int customMins = 10;
  bool changed = true;
  for (auto b : allButtons)
    b->consume();
  for (;;) {
    for (auto b : allButtons)
      b->update();
    if (btnA.pressed) {
      idx = (idx + 1) % (nPresets + 1);
      changed = true;
      btnA.consume();
    }
    if (btnB.pressed) {
      idx = (idx - 1 + nPresets + 1) % (nPresets + 1);
      changed = true;
      btnB.consume();
    }
    if (idx == nPresets) {
      if (btnC.pressed) {
        customMins++;
        if (customMins > 40)
          customMins = 40;
        changed = true;
        btnC.consume();
      }
      if (btnD.pressed) {
        customMins--;
        if (customMins < 1)
          customMins = 1;
        changed = true;
        btnD.consume();
      }
    }
    if (changed) {
      tft.fillScreen(C_BG);
      tft.fillRect(0, 0, DW, 22, C_CHROME);
      tft.drawFastHLine(0, 22, DW, C_LINE);
      tftCX("PERIOD TIME", 0, DW, 6, 1, C_TEXT, C_CHROME);
      int displayMins = (idx == nPresets) ? customMins : presets[idx] / 60;
      tft.fillRect(60, 30, 200, 70, C_CHROME);
      tft.drawRoundRect(60, 30, 200, 70, 6, C_LINE);
      char bigbuf[12];
      snprintf(bigbuf, 12, "%d", displayMins);
      tft.setTextSize(6);
      tft.setTextColor(C_YELLOW, C_CHROME);
      int bw = strlen(bigbuf) * 6 * 6;
      tft.setCursor(160 - bw / 2, 38);
      tft.print(bigbuf);
      tft.setTextSize(1);
      tft.setTextColor(C_MUTED, C_CHROME);
      tftCX("minutes", 60, 260, 88, 1, C_MUTED, C_CHROME);
      int pillW = 38, pillH = 28, pillGap = 4;
      int totalW = (nPresets + 1) * (pillW + pillGap) - pillGap;
      int startX = (DW - totalW) / 2;
      int pillY = 112;
      for (int i = 0; i <= nPresets; i++) {
        int px = startX + i * (pillW + pillGap);
        bool sel = (i == idx);
        tft.fillRoundRect(px, pillY, pillW, pillH, 5, sel ? C_AMBER : C_DIM);
        tft.drawRoundRect(px, pillY, pillW, pillH, 5, sel ? C_AMBER : C_LINE);
        tft.setTextSize(1);
        tft.setTextColor(sel ? 0x0000 : C_MUTED, sel ? C_AMBER : C_DIM);
        const char *lbl = (i == nPresets) ? "??" : labels[i];
        int lw = strlen(lbl) * 6;
        tft.setCursor(px + (pillW - lw) / 2, pillY + 10);
        tft.print(lbl);
      }
      if (idx == nPresets)
        tftCX("C/D to adjust", 0, DW, 150, 1, C_DIM, C_BG);
      tft.fillRect(0, DH - 20, DW, 20, C_CHROME);
      tft.drawFastHLine(0, DH - 20, DW, C_LINE);
      tft.setTextSize(1);
      tft.setTextColor(C_MID, C_CHROME);
      tft.setCursor(10, DH - 13);
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("A/B");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" choose   ");
      tft.setTextColor(C_YELLOW, C_CHROME);
      tft.print("I");
      tft.setTextColor(C_MID, C_CHROME);
      tft.print(" confirm");
      if (idx == nPresets) {
        tft.setTextColor(C_DIM, C_CHROME);
        tft.print("   C/D adj");
      }
      changed = false;
    }
    if (btnI.pressed) {
      btnI.consume();
      return (idx == nPresets) ? customMins * 60 : presets[idx];
    }
    if (btnE.pressed) {
      btnE.consume();
      return 600;
    }
    delay(2);
  }
}

void runBballConfig() {
  gcfg.sport = 0;
  static const MenuItem fmtItems[] = {{"5v5", "Full team"},
                                      {"3x3", "FIBA 3x3"}};
  int fmt = showHorizMenu("BASKETBALL", fmtItems, 2, C_AMBER);
  if (fmt < 0)
    return;
  if (fmt == 1) {
    gcfg.bballFormat = 2;
    gcfg.totalPeriods = 1;
    gcfg.periodSeconds = 600;
    gcfg.periodMins = 10;
    gcfg.shotClockDefault = 12;
    gcfg.foulBonus = 7;
    gcfg.is3x3 = true;
    gcfg.shotClockOn = true;
    return;
  }
  gcfg.is3x3 = false;
  gcfg.foulBonus = 5;
  gcfg.shotClockDefault = 24;
  gcfg.shotClockOn = true;
  static const MenuItem periodItems[] = {{"4 QTR", "10 min each"},
                                         {"2 HALF", "20 min each"}};
  int pf = showHorizMenu("5v5 FORMAT", periodItems, 2, C_AMBER);
  if (pf < 0)
    return;
  gcfg.bballFormat = (pf == 0) ? 0 : 1;
  gcfg.totalPeriods = (pf == 0) ? 4 : 2;
  int secs = showTimePicker();
  gcfg.periodSeconds = secs;
  gcfg.periodMins = secs / 60;
}

void runNetConfig() {
  static const MenuItem sportItems[] = {{"BADMINTON", "21 pts"},
                                        {"VOLLEYBALL", "25 pts"},
                                        {"T.TENNIS", "11 pts"}};
  int sp = showHorizMenu("NET SPORTS", sportItems, 3, C_BLUE);
  if (sp < 0)
    return;
  ns.subSport = sp;
  gcfg.sport = 1;

  static const char *ptsOpts[] = {"11", "15", "21", "25", "30"};
  static const int ptsVals[] = {11, 15, 21, 25, 30};
  // Default pts: volleyball=25(idx3), table tennis=11(idx0), badminton=21(idx2)
  int defPts = (sp == 1) ? 3 : (sp == 2) ? 0 : 2;
  int pi = showVertList("POINTS TO WIN", ptsOpts, 5, C_BLUE);
  if (pi < 0)
    pi = defPts;
  ns.ptsToWin = ptsVals[pi];

  static const char *setOpts[] = {"Best of 1", "Best of 3", "Best of 5",
                                  "Best of 7"};
  static const int setVals[] = {1, 3, 5, 7};
  int si = showVertList("NUMBER OF SETS", setOpts, 4, C_BLUE);
  if (si < 0)
    si = 1;
  ns.setsToWin = (setVals[si] + 1) / 2;
}

void startOfflineGame() {
  if (gcfg.sport == 1) {
    // Net sports
    ns.scoreA = 0;
    ns.scoreB = 0;
    ns.setsA = 0;
    ns.setsB = 0;
    ns.currentSet = 1;
    ns.matchOver = false;
    ns.winnerTeam = -1;
    if (deviceMode == MODE_BROADCAST) {
      tft.fillScreen(C_BG);
      tft.fillRect(0, 0, DW, 20, C_CHROME);
      tft.drawFastHLine(0, 20, DW, C_LINE);
      tftCX("BROADCAST MODE", 0, DW, 6, 1, C_MUTED, C_CHROME);
      tftCtr("LAN SCOREBOARD READY", 40, 1, C_AMBER);
      char apbuf[24];
      snprintf(apbuf, sizeof(apbuf), "THEBOX_%s", sessionCode);
      char ip[20];
      snprintf(ip, sizeof(ip), "%s", WiFi.softAPIP().toString().c_str());
      tft.drawFastHLine(40, 62, DW - 80, C_LINE);
      tftCtr("WiFi:", 74, 1, C_MUTED);
      tftCtr(apbuf, 86, 1, C_YELLOW);
      tftCtr("Pass: thebox123", 100, 1, C_DIM);
      tftCtr("IP:", 116, 1, C_MUTED);
      tftCtr(ip, 128, 1, C_GREEN);
      tft.drawFastHLine(40, 144, DW - 80, C_LINE);
      tftCtr("I = start game", 154, 1, C_MID);
      for (auto b : allButtons)
        b->consume();
      for (;;) {
        for (auto b : allButtons)
          b->update();
        if (btnI.pressed) {
          btnI.consume();
          break;
        }
        delay(2);
      }
    }
    netDirty = true;
    setScreen(SCR_NET);
    return;
  }
  // Basketball
  gs = {};
  gs.paused = true;
  gs.clockValueAtStart = gcfg.periodSeconds;
  gs.shotValueAtStart = gcfg.shotClockDefault;
  gs.period = 1;
  undoTop = 0;
  pSA = -1;
  pSB = -1;
  pPoss = -1;
  pLocked = false;
  pLocked2 = false;
  if (deviceMode == MODE_BROADCAST) {
    tft.fillScreen(C_BG);
    tft.fillRect(0, 0, DW, 20, C_CHROME);
    tft.drawFastHLine(0, 20, DW, C_LINE);
    tftCX("BROADCAST MODE", 0, DW, 6, 1, C_MUTED, C_CHROME);
    tftCtr("LAN SCOREBOARD READY", 40, 1, C_AMBER);
    char apbuf[24];
    snprintf(apbuf, sizeof(apbuf), "THEBOX_%s", sessionCode);
    char ip[20];
    snprintf(ip, sizeof(ip), "%s", WiFi.softAPIP().toString().c_str());
    tft.drawFastHLine(40, 62, DW - 80, C_LINE);
    tftCtr("WiFi:", 74, 1, C_MUTED);
    tftCtr(apbuf, 86, 1, C_YELLOW);
    tftCtr("Pass: thebox123", 100, 1, C_DIM);
    tftCtr("IP:", 116, 1, C_MUTED);
    tftCtr(ip, 128, 1, C_GREEN);
    tft.drawFastHLine(40, 144, DW - 80, C_LINE);
    tftCtr("I = start game", 154, 1, C_MID);
    for (auto b : allButtons)
      b->consume();
    for (;;) {
      for (auto b : allButtons)
        b->update();
      if (btnI.pressed) {
        btnI.consume();
        break;
      }
      delay(2);
    }
  }
  setScreen(SCR_GAME);
}

void runOfflineMenu() {
  static const MenuItem modeItems[] = {{"QUICK", "Basketball 10m"},
                                       {"BROADCAST", "LAN stream"},
                                       {"CUSTOM", "Configure"}};
  int mode = showHorizMenu("OFFLINE", modeItems, 3, C_GREEN);
  if (mode < 0)
    mode = 0; // back defaults to QUICK

  if (mode == 0) { // QUICK basketball
    applyQuickBasketball();
    startOfflineGame();
    return;
  }
  if (mode == 1) {
    deviceMode = MODE_BROADCAST;
    startLanServer();
  }

  // Pick sport
  static const MenuItem sportItems[] = {{"BASKETBALL", "Score + clock"},
                                        {"NET SPORTS", "Rally scoring"}};
  int sport = showHorizMenu("SELECT SPORT", sportItems, 2, C_GREEN);
  if (sport < 0) {
    runOfflineMenu();
    return;
  } // back -> top of offline menu

  if (sport == 0) {
    runBballConfig();
    enterTeamName(teamAName, 16, "HOME", C_A);
    enterTeamName(teamBName, 16, "AWAY", C_B);
  } else {
    runNetConfig();
    enterTeamName(teamAName, 16, "HOME", C_A);
    enterTeamName(teamBName, 16, "AWAY", C_B);
  }
  startOfflineGame();
}

// ═══════════════════════════════════════════════════════════════════
//  QUICK START PRESETS
// ═══════════════════════════════════════════════════════════════════
void applyQuickBasketball() {
  gcfg.sport = 0;
  gcfg.bballFormat = 0;
  gcfg.periodMins = 10;
  gcfg.shotClockOn = true;
  gcfg.totalPeriods = 4;
  gcfg.periodSeconds = 600;
  gcfg.shotClockDefault = 24;
  gcfg.foulBonus = 5;
  gcfg.is3x3 = false;
  strncpy(teamAName, "HOME", 15);
  strncpy(teamBName, "AWAY", 15);
  gs = {};
  gs.paused = true;
  gs.clockValueAtStart = gcfg.periodSeconds;
  gs.shotValueAtStart = gcfg.shotClockDefault;
  gs.period = 1;
  undoTop = 0;
  pSA = -1;
  pSB = -1;
  pPoss = -1;
  pLocked = false;
  pLocked2 = false;
}

// ═══════════════════════════════════════════════════════════════════
//  MODE MENU
// ═══════════════════════════════════════════════════════════════════
void showModeMenu() {
  tft.fillScreen(C_BG);
  tft.fillRect(0, 0, DW, 20, C_CHROME);
  tft.drawFastHLine(0, 20, DW, C_LINE);
  tftCX("THE BOX", 0, DW, 6, 1, C_MUTED, C_CHROME);

  // Two cards
  auto drawCard = [](int x, int w, const char *label, const char *sub,
                     bool selected) {
    uint16_t bg = selected ? 0x18C3 : 0x0000;
    uint16_t border = selected ? 0x07E0 : 0x18C3;
    uint16_t fg = selected ? 0xFFFF : 0x4228;
    tft.fillRoundRect(x, 28, w, 160, 4, bg);
    tft.drawRoundRect(x, 28, w, 160, 4, border);
    if (selected)
      tft.drawRoundRect(x + 1, 29, w - 2, 158, 4, border);
    tftCX(label, x, x + w, 88, 2, fg, bg);
    tftCX(sub, x, x + w, 110, 1, selected ? border : 0x294A, bg);
    if (selected)
      tft.fillRect(x + 10, 28 + 154, w - 20, 3, border);
  };

  int idx = 0;
  bool changed = true;
  for (auto b : allButtons)
    b->consume();

  for (;;) {
    for (auto b : allButtons)
      b->update();
    if (btnA.pressed || btnB.pressed) {
      idx = 1 - idx;
      changed = true;
      btnA.consume();
      btnB.consume();
    }
    if (changed) {
      drawCard(6, 148, "ONLINE", "Supabase linked", idx == 0);
      drawCard(166, 148, "OFFLINE", "Standalone", idx == 1);
      tft.fillRect(0, 218, DW, 22, C_CHROME);
      tft.drawFastHLine(0, 218, DW, 0x18C3);
      tft.setTextSize(1);
      tft.setTextColor(0x39E7, C_CHROME);
      tft.setCursor(20, 226);
      tft.print("B/A = switch    I = select");
      changed = false;
    }
    if (btnI.pressed) {
      btnI.consume();
      deviceMode = (idx == 0) ? MODE_ONLINE : MODE_OFFLINE;
      return;
    }
    delay(2);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n[boot] THE BOX v8.0");

  WiFi.mode(WIFI_OFF);

  tft.init();
  tft.setRotation(3);
  tft.fillScreen(C_BG);

  ledcAttach(TFT_BL, 5000, 8);
  ledcWrite(TFT_BL, 220);

  for (auto b : allButtons)
    b->begin();

  // [FIX 1] Load persistent session code from NVS
  initSessionCode();

  // [PERF 1] Create broadcast queue with fixed-size struct entries
  broadcastQueue = xQueueCreate(8, sizeof(BcastMsg));

  showModeMenu();

  if (deviceMode == MODE_ONLINE) {
    setupWifi();
    tft.fillScreen(C_BG);
    tftCtr("THE BOX", 38, 2, C_MUTED);
    tft.drawFastHLine(60, 66, DW - 120, C_LINE);
    tftCtr("registering...", 82, 1, C_AMBER);
    tftCtr(sessionCode, 100, 1, C_YELLOW);
    initEspNow();
    bool ok = supaRegister();
    if (!ok) {
      tft.fillScreen(C_BG);
      tftCtr("REGISTER FAILED", 76, 1, C_RED);
      delay(2000);
    }
    Serial.printf("[boot] Code:%s IP:%s\n", sessionCode,
                  WiFi.localIP().toString().c_str());
    xTaskCreatePinnedToCore(pollTask, "poll", 8192, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(heartbeatTask, "hb", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(wifiMonTask, "wifim", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(broadcastTask, "bcast", 8192, NULL, 2, NULL, 0);
  }
  if (deviceMode == MODE_OFFLINE || deviceMode == MODE_BROADCAST) {
    runOfflineMenu();
  }
  // OFFLINE/BROADCAST: all routing handled by runOfflineMenu()
}

// ═══════════════════════════════════════════════════════════════════
//  LOOP — Core 1. Buttons + display only. Never touches network.
// ═══════════════════════════════════════════════════════════════════
void loop() {
  // Activation from pollTask crosses into loop() via volatile flag + staging
  // vars
  if (pendingActivation) {
    pendingActivation = false;
    activateGame(pendingTeamA, pendingTeamB, pendingGameId);
  }

  updateAllButtons();

  if (currentScreen == SCR_GAME) {
    handleButtons();
    tickPending();
    tickExpiry();
  }
  if (currentScreen == SCR_NET)
    handleNetButtons();

  tickDisplay();
  delay(2);
}