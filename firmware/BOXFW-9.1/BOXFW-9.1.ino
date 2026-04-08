/*
 * ================================================================
 * THE BOX — Handheld ESP32 Controller
 * Firmware BOXFW-9.2 — LAN-Priority + Grid Keyboard Edition
 * BMSCE Sports Tech Division
 * ================================================================
 *
 * CHANGES FROM 9.1:
 *
 * [N1]  LOCAL ONLY mode: toggle in settings popup (J button).
 *       When ON, signals skip Supabase and go LAN-only via WebSocket.
 *       Useful when controller and laptop are on same WiFi.
 *
 * [N2]  wsConnectedClients: tracks active WS clients.
 *       Status bar shows green dot (LAN active) or yellow dot (cloud only).
 *       m_drawStatusBar gains 4th param: bool lanDot.
 *
 * [N3]  Settings popup redesigned: shows LOCAL ONLY toggle row,
 *       LAN STATUS indicator, and BOXFW-9.2 info.
 *       A/B = toggle LOCAL ONLY. I/H/J = close.
 *
 * [N4]  Letter-grid keyboard replaces per-char slot scroll.
 *       8 cols x 5 rows grid (A-Z, 0-9, SPC, BSP, OK).
 *       A/B = move right/left. F/G = move up/down.
 *       I = select char. H = backspace (or back on empty).
 *       J = confirm name immediately.
 *       Only 2 cells repainted per cursor move — instant feel.
 *
 * [N5]  drawBB: shot clock area gets pulsing red border when sc<=5
 *       and clock is running. Period indicator uses filled dots.
 *       Status bar passes lanDot flag.
 *
 * NETWORKING: Local-only flag added; no other WS/Supabase changes.
 * GAME LOGIC: Zero changes from 9.1.
 * ================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <WebSocketsServer.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/queue.h>
#include <Preferences.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <sys/time.h>

// ─── Supabase Config ─────────────────────────────────────────────
const char* SUPABASE_HOST     = "eoowagimooxsqcrrihbw.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvb3dhZ2ltb294c3FjcnJpaGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDIwOTAsImV4cCI6MjA4Njk3ODA5MH0.goB7TMo3Sv3RQhez4kjvGLzikBz37XB3OZV-cRmUXn0";
const char* FW_VERSION        = "9.2.0";

// ─── TFT ─────────────────────────────────────────────────────────
#define TFT_CS   17
#define TFT_DC   22
#define TFT_RST  16
#define TFT_BL    2
#define TFT_MOSI 23
#define TFT_SCK  18
Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCK, TFT_RST);
#define DW 320
#define DH 240

// ─── Colour palette — MODERN v9.2 ────────────────────────────────
#define M_BG          0x0000
#define M_SURFACE     0x18C3
#define M_SURFACE_HI  0x2945
#define M_BORDER      0x2965
#define M_TEXT        0xFFFF
#define M_DIM         0x9CF3
#define M_MUTED       0x630C
#define M_BBALL       0xFB40
#define M_NET         0x05FD
#define M_ONLINE      0x4B5F
#define M_PI          0xB4BE
#define M_OFFLINE     0x7BCF
#define M_DANGER      0xF041
#define M_SUCCESS     0x0647
#define M_WARN        0xFD00
#define M_GOLD        0xFEE0
#define M_SCORE_A     0xFB40
#define M_SCORE_B     0x05FD

// ─── Pins ─────────────────────────────────────────────────────────
#define BTN_A   19
#define BTN_B   4
#define BTN_C   13
#define BTN_D   26
#define BTN_E   15
#define BTN_F   32
#define BTN_G   27
#define BTN_H   33
#define BTN_I   14
#define BTN_J   25
#define BUZZER   5

// ─── Mode / Sport IDs ─────────────────────────────────────────────
#define MODE_NONE       0
#define MODE_ONLINE     1
#define MODE_PI_CONNECT 2
#define MODE_OFFLINE    3
#define MODE_PI_CODE    4
#define SPORT_BASKETBALL 0
#define SPORT_NET        1
#define SCR_SPORT_SELECT  0
#define SCR_SETTINGS      1
#define SCR_TEAM_NAMES    2
#define SCR_GAME          3

// ─── ESP-NOW ──────────────────────────────────────────────────────
#define PKT_HELLO 0x00
#define PKT_ACK   0x01
#define PKT_CMD   0x02
#define PKT_SYNC  0x03
#define ESPNOW_CHANNEL        1
#define ESPNOW_RSSI_THRESHOLD (-65)
uint8_t broadcastMac[] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};
QueueHandle_t espNowRxQueue = NULL;
static volatile bool     ackPending   = false;
static volatile int8_t   ackRssi      = 0;
static uint8_t           ackSrcMac[6] = {0};
struct __attribute__((packed)) ESPNowPacket {
  uint8_t  type, action;
  int16_t  scoreA, scoreB, mainMin, mainSec, shotClock;
  uint8_t  period, paused;
  uint8_t  senderMac[6];
};

// ─── Action codes ─────────────────────────────────────────────────
#define ACT_NONE           0
#define ACT_SCORE_A_PLUS   1
#define ACT_SCORE_A_MINUS  2
#define ACT_SCORE_B_PLUS   3
#define ACT_SCORE_B_MINUS  4
#define ACT_CLOCK_TOGGLE   5
#define ACT_PERIOD_NEXT    6
#define ACT_SC_24          7
#define ACT_SC_14          8
#define ACT_UNDO           9
#define ACT_POSSESSION    10
#define ACT_NET_SET_WIN_A 11
#define ACT_NET_SET_WIN_B 12

static const char* signalNames[] = {
  "", "ADD_SCORE_A", "SUB_SCORE_A", "ADD_SCORE_B", "SUB_SCORE_B",
  "TOGGLE_CLOCK", "NEXT_PERIOD", "RESET_SHOT_CLOCK_24", "RESET_SHOT_CLOCK_14",
  "UNDO", "TOGGLE_POSSESSION", "NET_SET_WIN_A", "NET_SET_WIN_B",
};

// ─── Shared game state ────────────────────────────────────────────
SemaphoreHandle_t stateMutex;
Preferences prefs;
struct GameStateData {
  int  scoreA, scoreB, shotClock, mainMin, mainSec;
  bool paused;
  int  period;
  bool isLocked;
  int  setsA, setsB, currentSet;
} liveState;

struct SportConfig {
  int  sport, ptsToWin, setsToWin, quarters, quarterMin, shotClockDur;
  char teamAName[12], teamBName[12];
} cfg;

struct BballSettings { int quarters, quarterMin, shotClockDur; bool back; };
struct NetSettings   { int ptsToWin, setsToWin; bool back; };

struct SignalOutbox {
  uint8_t action;
  int scoreA,scoreB,mainMin,mainSec,shotClock,period;
  bool paused,poss;
  char gameId[12];
};

// ─── Forward declarations ─────────────────────────────────────────
void bootModeFromSelect();
void bootOnlineMode();
void bootOfflineMode();
void bootPiConnectMode();
void bootPiCodeMode();
bool runLocalSetupFlow();
void processNetWins();
void loopPiCodeMode();
void drawGameScreen();
int  checkSetWin();
void drawNetMatchWon(const char* winner, bool isTeamA);
void pushClockTick(const String& gameId);

// ─── Modern hint bar struct ────────────────────────────────────────
struct MHint { const char* label; uint16_t color; };

// ─── ESP-NOW runtime globals ──────────────────────────────────────
uint8_t receiverMac[6]    = {0};
bool    receiverPeerAdded = false;
bool    piPaired          = false;

// ─── Online screen draw-once flags ────────────────────────────────
static bool _waitingDrawn = false;
static bool _pairedDrawn  = false;

// ─── Runtime globals ─────────────────────────────────────────────
int    currentMode   = MODE_NONE;
int    currentScreen = SCR_SPORT_SELECT;
String deviceId      = "";
String activeGameId  = "";
int    deviceState   = 0;
bool   possession    = false;
bool   espNowReady   = false;
TaskHandle_t NetworkTask = NULL;
TaskHandle_t WSTask      = NULL;
char   piTvCode[5]   = "AAAA";
unsigned long tUI    = 0;
unsigned long tSec   = 0;

// [N1] Local-Only mode — skip Supabase when ON
static bool localOnlyMode = false;

// [N2] WS client counter — drives LAN dot in status bar
static volatile int wsConnectedClients = 0;

// Prev-state trackers
static int  prev_sA=-1,prev_sB=-1,prev_sc=-1,prev_mm=-1,prev_ms=-1,prev_per=-1;
static bool prev_pau=true,prev_poss=false,prev_lck=false;
static int  prev_stA=-1,prev_stB=-1,prev_curSet=-1;
static bool prev_inDeuce=false;
static bool prev_clkZero=false;
static bool prev_lanDot=false;

void resetPrevState(){
  prev_sA=-1;prev_sB=-1;prev_sc=-1;prev_mm=-1;prev_ms=-1;prev_per=-1;
  prev_pau=true;prev_poss=false;prev_lck=false;
  prev_stA=-1;prev_stB=-1;prev_curSet=-1;prev_inDeuce=false;
  prev_clkZero=false;prev_lanDot=false;
}

// ─── Dual-channel transport globals ──────────────────────────────
QueueHandle_t signalQueue = NULL;
QueueHandle_t wsQueue     = NULL;
#define SIGNAL_QUEUE_SIZE 16
WebSocketsServer wsServer(81);
static WiFiClientSecure* supaClient    = nullptr;
static HTTPClient* supaHttp      = nullptr;
static bool              supaConnected = false;
static unsigned long     lastSupaUse   = 0;
#define SUPA_KEEPALIVE_MS        25000
#define WIFI_RECONNECT_INTERVAL_MS 5000


// ═══════════════════════════════════════════════════════════════════
//  BUZZER
// ═══════════════════════════════════════════════════════════════════
struct Buzzer {
  bool active=false,inGap=false;
  unsigned long endTime=0;
  int beepsLeft=0;
  void beep(int ms){digitalWrite(BUZZER,HIGH);active=true;inGap=false;endTime=millis()+ms;beepsLeft=0;}
  void pattern(int n){beepsLeft=n-1;digitalWrite(BUZZER,HIGH);active=true;inGap=false;endTime=millis()+80;}
  void update(){
    if(!active)return;
    if(millis()<endTime)return;
    if(!inGap&&beepsLeft>0){digitalWrite(BUZZER,LOW);inGap=true;endTime=millis()+80;beepsLeft--;}
    else if(inGap){digitalWrite(BUZZER,HIGH);inGap=false;endTime=millis()+80;}
    else{digitalWrite(BUZZER,LOW);active=false;}
  }
} buz;

// ═══════════════════════════════════════════════════════════════════
//  BUTTON CLASS
// ═══════════════════════════════════════════════════════════════════
class Button {
public:
  uint8_t pin;
  bool state=false,pressed=false,released=false;
  unsigned long lastDebounce=0,pressTime=0,lastReading=false;
  Button(uint8_t p):pin(p){}
  void begin(){pinMode(pin,INPUT_PULLUP);}
  void update(){
    bool r=(digitalRead(pin)==LOW);
    if(r!=lastReading)lastDebounce=millis();
    if((millis()-lastDebounce)>25&&r!=state){
      state=r;
      if(state){pressed=true;pressTime=millis();}
      else{released=true;}
    }
    lastReading=r;
  }
  void consume(){pressed=false;released=false;}
  bool heldFor(unsigned long ms){return state&&(millis()-pressTime>=ms);}
  void reset(){state=false;pressed=false;released=false;pressTime=millis();lastReading=false;}
};

Button btnA(BTN_A),btnB(BTN_B),btnC(BTN_C),btnD(BTN_D),
       btnE(BTN_E),btnF(BTN_F),btnG(BTN_G),btnH(BTN_H),
       btnI(BTN_I),btnJ(BTN_J);
Button* allBtns[]={&btnA,&btnB,&btnC,&btnD,&btnE,&btnF,&btnG,&btnH,&btnI,&btnJ};
void resetAllButtons(){for(Button* b:allBtns)b->reset();}

// ═══════════════════════════════════════════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════════════════════════════════════════
void saveAtomicState(){prefs.putBytes("game_data",&liveState,sizeof(GameStateData));}

void applyAction(uint8_t action){
  switch(action){
    case ACT_SCORE_A_PLUS:  liveState.scoreA++;liveState.shotClock=cfg.shotClockDur;break;
    case ACT_SCORE_A_MINUS: if(liveState.scoreA>0)liveState.scoreA--;break;
    case ACT_SCORE_B_PLUS:  liveState.scoreB++;liveState.shotClock=cfg.shotClockDur;break;
    case ACT_SCORE_B_MINUS: if(liveState.scoreB>0)liveState.scoreB--;break;
    case ACT_CLOCK_TOGGLE:
      liveState.paused=!liveState.paused;
      if(!liveState.paused)tSec=millis();
      pushClockTick(activeGameId);
      break;
    case ACT_PERIOD_NEXT:
      liveState.period++;if(liveState.period>cfg.quarters)liveState.period=1;
      liveState.mainMin=cfg.quarterMin;liveState.mainSec=0;
      liveState.shotClock=cfg.shotClockDur;liveState.paused=true;
      pushClockTick(activeGameId);
      break;
    case ACT_SC_24: liveState.shotClock=24;pushClockTick(activeGameId);break;
    case ACT_SC_14: liveState.shotClock=14;pushClockTick(activeGameId);break;
    case ACT_POSSESSION: possession=!possession;break;
    case ACT_NET_SET_WIN_A:case ACT_NET_SET_WIN_B:
      if(action==ACT_NET_SET_WIN_A)liveState.scoreA++;else liveState.scoreB++;break;
    case ACT_UNDO:break;
  }
}

void pushClockTick(const String& gameId){
  if(wsQueue==NULL||gameId=="")return;
  SignalOutbox msg;msg.action=254;
  msg.scoreA=0;msg.scoreB=0;msg.poss=false;
  strncpy(msg.gameId,gameId.c_str(),11);msg.gameId[11]='\0';
  if(xSemaphoreTake(stateMutex,pdMS_TO_TICKS(2))){
    msg.mainMin=liveState.mainMin;msg.mainSec=liveState.mainSec;
    msg.shotClock=liveState.shotClock;msg.period=liveState.period;
    msg.paused=liveState.paused;
    xSemaphoreGive(stateMutex);
  }
  pushQueue(wsQueue,msg);
}

void tickLocalClock(){
  static int _prevSc = -1;
  if(liveState.paused)return;
  if(millis()-tSec<1000)return;
  tSec=millis();
  if(liveState.mainMin>0||liveState.mainSec>0){
    if(liveState.mainSec>0)liveState.mainSec--;
    else{liveState.mainMin--;liveState.mainSec=59;}
  }
  int gameClockTotalSeconds = liveState.mainMin * 60 + liveState.mainSec;
  if(gameClockTotalSeconds < liveState.shotClock && liveState.shotClock > 0){
    liveState.shotClock = 0;
  } else if((liveState.mainMin>0||liveState.mainSec>=liveState.shotClock)&&liveState.shotClock>0){
    liveState.shotClock--;
  }
  // Shot clock zero: one-shot buzz when it first hits 0
  if(cfg.shotClockDur>0 && liveState.shotClock==0 && _prevSc>0 && !liveState.paused){
    buz.beep(350);
  }
  _prevSc = liveState.shotClock;
}

// Flash border
static uint16_t flashColor=0;
static unsigned long flashUntil=0;
void triggerFlash(uint16_t color){flashColor=color;flashUntil=millis()+100;}
void drawFlashBorder(){
  if(millis()>flashUntil)return;
  // Screen-edge outline — never overlaps content (clock, scores, etc.)
  tft.drawRect(0,0,DW,DH,flashColor);
  tft.drawRect(1,1,DW-2,DH-2,flashColor);
}
void clearFlashBorder(){
  if(flashUntil>0&&millis()>flashUntil+40){
    tft.drawRect(0,0,DW,DH,M_BG);
    tft.drawRect(1,1,DW-2,DH-2,M_BG);
    flashUntil=0;
  }
}

// ─── Button action reader ─────────────────────────────────────────
static bool _eLongFired=false;
static bool _jLongFired=false;
static bool _jConsumedAsLong=false;

// ─── [N3] Settings popup — LOCAL ONLY toggle + LAN status ─────────
void showSettingsPopup(){
  bool needDraw = true;
  for(Button* b:allBtns){b->update();b->consume();}
  while(true){
    if(needDraw){
      const int PX=20,PY=44,PW=280,PH=152;
      tft.fillRoundRect(PX,PY,PW,PH,8,M_SURFACE);
      tft.drawRoundRect(PX,PY,PW,PH,8,M_PI);
      tft.drawRoundRect(PX+1,PY+1,PW-2,PH-2,7,M_PI);

      // Title
      tft.setTextSize(1);tft.setTextColor(M_PI,M_SURFACE);
      tft.setCursor(PX+10,PY+10);tft.print("SETTINGS");
      tft.drawFastHLine(PX+8,PY+22,PW-16,M_BORDER);
      tft.setTextColor(M_MUTED,M_SURFACE);tft.setCursor(PX+PW-60,PY+10);tft.print("BOXFW-9.2");

      // LOCAL ONLY row
      tft.setTextSize(1);tft.setTextColor(M_DIM,M_SURFACE);
      tft.setCursor(PX+12,PY+36);tft.print("LOCAL ONLY");
      tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);
      tft.setCursor(PX+12,PY+48);tft.print("Skip Supabase, LAN only");
      uint16_t toggleBg = localOnlyMode ? M_SUCCESS : M_SURFACE_HI;
      uint16_t toggleBr = localOnlyMode ? M_SUCCESS : M_BORDER;
      tft.fillRoundRect(PX+PW-74,PY+32,62,22,4,toggleBg);
      tft.drawRoundRect(PX+PW-74,PY+32,62,22,4,toggleBr);
      tft.setTextSize(2);tft.setTextColor(localOnlyMode?M_BG:M_MUTED,toggleBg);
      tft.setCursor(PX+PW-62,PY+36);tft.print(localOnlyMode?" ON":"OFF");
      tft.drawFastHLine(PX+8,PY+66,PW-16,M_BORDER);

      // LAN STATUS row
      tft.setTextSize(1);tft.setTextColor(M_DIM,M_SURFACE);
      tft.setCursor(PX+12,PY+76);tft.print("LAN STATUS");
      bool lanActive=(wsConnectedClients>0);
      uint16_t lanCol=lanActive?M_SUCCESS:M_WARN;
      tft.fillCircle(PX+PW-44,PY+82,5,lanCol);
      tft.setTextColor(lanCol,M_SURFACE);
      tft.setCursor(PX+PW-36,PY+78);tft.print(lanActive?"ACTIVE":"CLOUD");
      tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);
      tft.setCursor(PX+12,PY+92);tft.print(lanActive?"Website connected via WiFi":"Routing via Supabase");
      tft.drawFastHLine(PX+8,PY+106,PW-16,M_BORDER);

      // Local-only indicator badge on status bar if active
      if(localOnlyMode){
        tft.fillRoundRect(PX+12,PY+116,60,16,3,M_SUCCESS);
        tft.setTextSize(1);tft.setTextColor(M_BG,M_SUCCESS);
        tft.setCursor(PX+16,PY+120);tft.print("LAN ONLY");
      } else {
        tft.fillRoundRect(PX+12,PY+116,60,16,3,M_SURFACE_HI);
        tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE_HI);
        tft.setCursor(PX+14,PY+120);tft.print("LAN+CLOUD");
      }

      // Hint
      tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);
      tft.setCursor(PX+10,PY+PH-18);tft.print("A/B = TOGGLE LOCAL    I/H/J = CLOSE");
      needDraw=false;
    }
    for(Button* b:allBtns)b->update();
    if(btnA.pressed||btnB.pressed){
      btnA.consume();btnB.consume();
      localOnlyMode=!localOnlyMode;
      needDraw=true;
      continue;
    }
    if(btnI.pressed){btnI.consume();break;}
    if(btnH.pressed){btnH.consume();break;}
    if(btnJ.pressed){btnJ.consume();break;}
    delay(5);
  }
  resetPrevState();
  _waitingDrawn=false;_pairedDrawn=false;
}

bool checkJSettings(){
  if(btnJ.state&&btnJ.heldFor(600)&&!_jLongFired){
    _jLongFired=true;_jConsumedAsLong=true;
  }
  if(btnJ.released){
    btnJ.consume();
    bool wasLong=_jConsumedAsLong;
    _jLongFired=false;_jConsumedAsLong=false;
    if(!wasLong){
      showSettingsPopup();
      return true;
    }
  }
  return false;
}

uint8_t readButtonAction(){
  if(btnE.released){
    bool wasLong=_eLongFired;
    btnE.consume();_eLongFired=false;
    if(!wasLong){triggerFlash(M_WARN);return ACT_SC_24;}
    return ACT_NONE;
  }
  if(btnE.state&&btnE.heldFor(600)&&!_eLongFired){
    _eLongFired=true;triggerFlash(M_WARN);return ACT_SC_14;
  }

  if(cfg.sport==SPORT_NET){
    if(btnA.pressed){btnA.consume();triggerFlash(M_BBALL);return ACT_SCORE_A_PLUS;}
    if(btnB.pressed){btnB.consume();triggerFlash(M_BBALL);return ACT_SCORE_A_MINUS;}
    if(btnC.pressed){btnC.consume();triggerFlash(M_NET);return ACT_SCORE_B_PLUS;}
    if(btnD.pressed){btnD.consume();triggerFlash(M_NET);return ACT_SCORE_B_MINUS;}
    if(btnF.pressed){btnF.consume();triggerFlash(M_SUCCESS);return ACT_PERIOD_NEXT;}
    if(btnH.pressed){btnH.consume();triggerFlash(M_WARN);return ACT_UNDO;}
    if(btnE.pressed){btnE.consume();triggerFlash(M_BBALL);return ACT_NET_SET_WIN_A;}
    if(btnJ.state&&btnJ.heldFor(600)&&!_jLongFired){
      _jLongFired=true;triggerFlash(M_NET);return ACT_NET_SET_WIN_B;}
    return ACT_NONE;
  }

  if(btnA.pressed){btnA.consume();triggerFlash(M_BBALL);return ACT_SCORE_A_PLUS;}
  if(btnB.pressed){btnB.consume();triggerFlash(M_BBALL);return ACT_SCORE_A_MINUS;}
  if(btnC.pressed){btnC.consume();triggerFlash(M_NET);return ACT_SCORE_B_PLUS;}
  if(btnD.pressed){btnD.consume();triggerFlash(M_NET);return ACT_SCORE_B_MINUS;}
  if(btnG.pressed){btnG.consume();triggerFlash(M_SUCCESS);return ACT_CLOCK_TOGGLE;}
  if(btnF.pressed){btnF.consume();triggerFlash(M_SUCCESS);return ACT_PERIOD_NEXT;}
  if(btnH.pressed){btnH.consume();triggerFlash(M_WARN);return ACT_UNDO;}
  if(btnI.pressed){btnI.consume();triggerFlash(M_GOLD);return ACT_POSSESSION;}
  return ACT_NONE;
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION A: CORE HELPERS
// ═══════════════════════════════════════════════════════════════════

void tftCtr(const char* s,int y,int sz=2,uint16_t color=M_TEXT,uint16_t bg=M_BG){
  int w=(int)strlen(s)*sz*6,x=(DW-w)/2;
  tft.setTextSize(sz);tft.setTextColor(color,bg);
  tft.setCursor(x<0?0:x,y);tft.print(s);
}
void tftCtrIn(const char* s,int x0,int x1,int y,int sz,uint16_t color,uint16_t bg){
  int w=(int)strlen(s)*sz*6,x=x0+((x1-x0)-w)/2;
  tft.setTextSize(sz);tft.setTextColor(color,bg);
  tft.setCursor(x<x0?x0:x,y);tft.print(s);
}

void drawCheckmark(int cx,int cy,uint16_t color){
  for(int t=-3;t<=3;t++){
    tft.drawLine(cx-22,cy+2+t,cx-5,cy+20+t,color);
    tft.drawLine(cx-5,cy+20+t,cx+24,cy-8+t,color);
  }
}

// ─── Status card (for boot/connection screens) ────────────────────
static bool     _scDrawn  = false;
static uint16_t _scAccent = 0;

void _resetStatusCard(){ _scDrawn=false; }

void drawStatusCard(const char* title,const char* sub1,const char* sub2,
                    uint16_t accent,int anim=0){
  if(!_scDrawn||_scAccent!=accent){
    tft.fillScreen(M_BG);
    tft.fillRoundRect(18,70,DW-36,100,10,M_SURFACE);
    tft.drawRoundRect(18,70,DW-36,100,10,accent);
    int tw=(int)strlen(title)*12;
    tft.setTextSize(2);tft.setTextColor(M_TEXT,M_SURFACE);
    tft.setCursor((DW-tw)/2,106);tft.print(title);
    if(sub1&&strlen(sub1)>0){
      int sw=(int)strlen(sub1)*6;
      tft.setTextSize(1);tft.setTextColor(M_DIM,M_SURFACE);
      tft.setCursor((DW-sw)/2,126);tft.print(sub1);
    }
    if(sub2&&strlen(sub2)>0){
      int sw=(int)strlen(sub2)*6;
      tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);
      tft.setCursor((DW-sw)/2,138);tft.print(sub2);
    }
    _scDrawn=true;_scAccent=accent;
  }
  tft.fillRect(DW/2-24,82,48,20,M_SURFACE);
  if(anim>=0){
    for(int i=0;i<3;i++){
      int dx=DW/2-16+i*16;
      tft.fillCircle(dx,92,4,i==anim?accent:M_BORDER);
    }
  } else {
    drawCheckmark(DW/2-12,80,accent);
  }
}
int statusAnim(){return(int)(millis()/400)%3;}

// ─── [N2] Status bar — with LAN dot ──────────────────────────────
void m_drawStatusBar(int mode,bool connected=false,int signal=0,bool lanDot=false){
  const uint16_t mc[]={M_MUTED,M_ONLINE,M_PI,M_OFFLINE};
  const char* ml[]={"","ONLINE","PI LINK","OFFLINE"};
  tft.fillRect(0,0,DW,18,M_SURFACE);
  tft.drawFastHLine(0,18,DW,M_BORDER);
  tft.setTextSize(1);
  if(mode>0){tft.setTextColor(mc[mode],M_SURFACE);tft.setCursor(8,6);tft.print(ml[mode]);}

  // LAN / CLOUD dot (left of wifi bars)
  if(connected){
    uint16_t dotCol = lanDot ? M_SUCCESS : M_WARN;
    tft.fillCircle(DW-62,9,3,dotCol);
  }

  // LOCAL ONLY badge (tiny)
  if(localOnlyMode){
    tft.setTextColor(M_SUCCESS,M_SURFACE);
    tft.setCursor(DW-120,6);tft.print("LAN");
  }

  tft.setTextColor(M_MUTED,M_SURFACE);tft.setCursor(DW-24,6);tft.print("FW9");
  if(connected){
    int bars=signal>0?signal:4;
    for(int i=0;i<4;i++){
      int bh=3+i*3,bx=DW-52+i*6,by=18-2-bh;
      tft.fillRect(bx,by,4,bh,i<bars?M_SUCCESS:M_MUTED);
    }
  }
}

// ─── Hint bar (bottom 22px) ───────────────────────────────────────
void m_drawHintBar(MHint* hints,int count){
  tft.fillRect(0,DH-22,DW,22,M_SURFACE);
  tft.drawFastHLine(0,DH-22,DW,M_BORDER);
  int spacing=DW/count;
  for(int i=0;i<count;i++){
    int x=i*spacing+spacing/2;
    int w=(int)strlen(hints[i].label)*7;
    tft.setTextSize(1);tft.setTextColor(hints[i].color?hints[i].color:M_MUTED,M_SURFACE);
    tft.setCursor(x-w/2,DH-15);tft.print(hints[i].label);
  }
}

// ─── Setting row (for BB/Net settings) ───────────────────────────
void _drawSettingRowModern(int y,const char* label,const char* value,
                           bool selected,uint16_t accent){
  uint16_t bg=selected?M_SURFACE_HI:M_SURFACE;
  uint16_t br=selected?accent:M_BORDER;
  tft.fillRoundRect(6,y,308,36,4,bg);
  tft.drawRoundRect(6,y,308,36,4,br);
  tft.setTextSize(1);tft.setTextColor(selected?M_TEXT:M_DIM,bg);
  tft.setCursor(14,y+14);tft.print(label);
  if(selected){
    tft.setTextColor(accent,bg);tft.setCursor(180,y+14);tft.print("<");
    int vw=(int)strlen(value)*12;
    tft.setTextSize(2);tft.setTextColor(accent,bg);tft.setCursor(200,y+10);tft.print(value);
    tft.setTextSize(1);tft.setTextColor(accent,bg);tft.setCursor(200+vw+4,y+14);tft.print(">");
  } else {
    int vw=(int)strlen(value)*12;
    tft.setTextSize(2);tft.setTextColor(M_DIM,bg);tft.setCursor(200,y+10);tft.print(value);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION C: SPLASH
// ═══════════════════════════════════════════════════════════════════
void showSplash(){
  tft.fillScreen(M_BG);
  tft.setTextSize(2);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(139,68);tft.print("THE");
  tft.setTextSize(7);tft.setTextColor(M_TEXT,M_BG);tft.setCursor(88,88);tft.print("BOX");
  tft.fillRect(136,158,48,3,M_BBALL);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(78,172);tft.print("BMSCE SPORTS TECH");
  tft.setCursor(116,186);tft.print("BOXFW-9.2");
  int barY=214,barX=60,barW=200;
  tft.fillRect(barX,barY,barW,2,M_SURFACE);
  for(int i=0;i<=barW;i+=4){
    tft.fillRect(barX,barY,i,2,M_BBALL);delay(5);
    for(Button* b:allBtns)b->update();
    if(btnI.pressed){btnI.consume();tft.fillRect(barX,barY,barW,2,M_BBALL);break;}
  }
  tft.fillRect(barX,barY,barW,2,M_BBALL);delay(200);
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION D: MODE SELECT
// ═══════════════════════════════════════════════════════════════════

static const int MC_W=96,MC_H=154,MC_GAP=6,MC_X0=6,MC_Y0=42;
struct MCData { const char* label; const char* desc; uint16_t color; };
static MCData _mc[3]={
  {"ONLINE","WiFi + Web",M_ONLINE},
  {"PI LINK","Local / Code",M_PI},
  {"OFFLINE","Standalone",M_OFFLINE}
};
void _drawOneModeCard(int i,bool sel){
  int cx=MC_X0+i*(MC_W+MC_GAP);
  uint16_t bg=sel?M_SURFACE_HI:M_SURFACE;
  tft.fillRoundRect(cx,MC_Y0,MC_W,MC_H,6,bg);
  tft.drawRoundRect(cx,MC_Y0,MC_W,MC_H,6,sel?_mc[i].color:M_BORDER);
  if(sel)tft.drawRoundRect(cx+1,MC_Y0+1,MC_W-2,MC_H-2,5,_mc[i].color);
  int icx=cx+MC_W/2,icy=MC_Y0+44;
  tft.fillCircle(icx,icy,18,sel?_mc[i].color:M_SURFACE_HI);
  tft.drawCircle(icx,icy,18,sel?_mc[i].color:M_BORDER);
  int lw=(int)strlen(_mc[i].label)*6;
  tft.setTextSize(1);tft.setTextColor(sel?M_TEXT:M_DIM,bg);
  tft.setCursor(cx+(MC_W-lw)/2,MC_Y0+74);tft.print(_mc[i].label);
  int dw=(int)strlen(_mc[i].desc)*6;
  tft.setTextColor(sel?_mc[i].color:M_MUTED,bg);
  tft.setCursor(cx+(MC_W-dw)/2,MC_Y0+90);tft.print(_mc[i].desc);
  if(sel)tft.fillCircle(icx,MC_Y0+MC_H-14,4,_mc[i].color);
}

void _modeSelectFull(int sel){
  tft.fillScreen(M_BG);
  m_drawStatusBar(0);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(8,26);tft.print("SELECT");
  tft.setTextSize(2);tft.setTextColor(M_TEXT,M_BG);tft.setCursor(52,22);tft.print("Mode");
  for(int i=0;i<3;i++)_drawOneModeCard(i,i==sel);
  MHint h[]={{"A/B NAV",M_MUTED},{"I SELECT",M_TEXT},{"",0}};
  m_drawHintBar(h,3);
}

void _modeSelectUpdate(int oldS,int newS){
  _drawOneModeCard(oldS,false);
  _drawOneModeCard(newS,true);
}

// ── PI sub-select ────────────────────────────────────────────────
static const int PI_W=148,PI_H=154,PI_GAP=8,PI_X0=6,PI_Y0=42;
static const char* _piL[]={"DIRECT LINK","WIFI CODE"};
static const char* _piD[]={"Range-based local","Enter cast code"};

void _drawOnePiCard(int i,bool sel){
  int cx=PI_X0+i*(PI_W+PI_GAP);
  uint16_t bg=sel?M_SURFACE_HI:M_SURFACE;
  tft.fillRoundRect(cx,PI_Y0,PI_W,PI_H,6,bg);
  tft.drawRoundRect(cx,PI_Y0,PI_W,PI_H,6,sel?M_PI:M_BORDER);
  if(sel)tft.drawRoundRect(cx+1,PI_Y0+1,PI_W-2,PI_H-2,5,M_PI);
  int lw=(int)strlen(_piL[i])*12;
  tft.setTextSize(2);tft.setTextColor(sel?M_TEXT:M_DIM,bg);
  tft.setCursor(cx+(PI_W-lw)/2,PI_Y0+50);tft.print(_piL[i]);
  int dw=(int)strlen(_piD[i])*6;
  tft.setTextSize(1);tft.setTextColor(sel?M_PI:M_MUTED,bg);
  tft.setCursor(cx+(PI_W-dw)/2,PI_Y0+78);tft.print(_piD[i]);
  if(sel){int icx=cx+PI_W/2;tft.fillCircle(icx,PI_Y0+PI_H-14,4,M_PI);}
}

void _piSelectFull(int sel){
  tft.fillScreen(M_BG);
  m_drawStatusBar(2);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(8,26);tft.print("PI DIRECT");
  tft.setTextSize(2);tft.setTextColor(M_TEXT,M_BG);tft.setCursor(72,22);tft.print("Link Type");
  for(int i=0;i<2;i++)_drawOnePiCard(i,i==sel);
  MHint h[]={{"H BACK",M_MUTED},{"A/B NAV",M_MUTED},{"I SELECT",M_PI}};
  m_drawHintBar(h,3);
}

int _showPiSubSelect(){
  int modes[]={MODE_PI_CONNECT,MODE_PI_CODE};
  const int N=2;int idx=0;
  _piSelectFull(idx);
  for(Button* b:allBtns){b->update();b->consume();}
  while(true){
    for(Button* b:allBtns)b->update();
    if(btnA.pressed){btnA.consume();int p=idx;idx=(idx+1)%N;if(idx!=p){_drawOnePiCard(p,false);_drawOnePiCard(idx,true);}}
    if(btnB.pressed){btnB.consume();int p=idx;idx=(idx-1+N)%N;if(idx!=p){_drawOnePiCard(p,false);_drawOnePiCard(idx,true);}}
    if(btnI.pressed){btnI.consume();return modes[idx];}
    if(btnH.pressed){btnH.consume();return -1;}
    delay(1);
  }
}

int showModeSelect(){
  const int PSEUDO_PI=-2;
  int modes[]={MODE_ONLINE,PSEUDO_PI,MODE_OFFLINE};
  const int N=3;
  int lastMode=prefs.getInt("last_mode",MODE_ONLINE);
  int idx=0;
  if(lastMode==MODE_PI_CONNECT||lastMode==MODE_PI_CODE)idx=1;
  else if(lastMode==MODE_OFFLINE)idx=2;
  for(Button* b:allBtns){b->update();b->consume();}
  _modeSelectFull(idx);
  while(true){
    for(Button* b:allBtns)b->update();
    if(btnA.pressed){btnA.consume();int p=idx;idx=(idx+1)%N;if(idx!=p)_modeSelectUpdate(p,idx);}
    if(btnB.pressed){btnB.consume();int p=idx;idx=(idx-1+N)%N;if(idx!=p)_modeSelectUpdate(p,idx);}
    if(btnI.pressed){
      btnI.consume();
      int sel=modes[idx];
      if(sel==PSEUDO_PI){
        int piResult=_showPiSubSelect();
        if(piResult==-1){_modeSelectFull(idx);for(Button* b:allBtns){b->update();b->consume();}continue;}
        prefs.putInt("last_mode",piResult);return piResult;
      }
      prefs.putInt("last_mode",sel);return sel;
    }
    delay(1);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION E: SPORT SELECT
// ═══════════════════════════════════════════════════════════════════

struct SCData { const char* label; const char* desc; uint16_t color; const char* tags[3]; };
static SCData _sc[2]={
  {"BASKETBALL","Quarters / Shot clock",M_BBALL,{"Shot Clock","Quarters","Possession"}},
  {"NET SPORT","Sets / Rally scoring",M_NET,{"Sets & Pts","Deuce","Match Win"}}
};
void _drawOneSportCard(int i,bool sel){
  int cx=PI_X0+i*(PI_W+PI_GAP);
  uint16_t bg=sel?M_SURFACE_HI:M_SURFACE;
  tft.fillRoundRect(cx,PI_Y0,PI_W,PI_H,6,bg);
  tft.drawRoundRect(cx,PI_Y0,PI_W,PI_H,6,sel?_sc[i].color:M_BORDER);
  if(sel)tft.drawRoundRect(cx+1,PI_Y0+1,PI_W-2,PI_H-2,5,_sc[i].color);
  int lw=(int)strlen(_sc[i].label)*12;
  tft.setTextSize(2);tft.setTextColor(sel?_sc[i].color:M_DIM,bg);
  tft.setCursor(cx+(PI_W-lw)/2,PI_Y0+40);tft.print(_sc[i].label);
  for(int t=0;t<3;t++){
    int tw=(int)strlen(_sc[i].tags[t])*6+8;
    int tx=cx+(PI_W-tw)/2,ty=PI_Y0+72+t*22;
    tft.fillRoundRect(tx,ty,tw,14,3,sel?_sc[i].color:M_SURFACE_HI);
    tft.setTextSize(1);tft.setTextColor(sel?M_BG:M_MUTED,sel?_sc[i].color:M_SURFACE_HI);
    tft.setCursor(tx+4,ty+4);tft.print(_sc[i].tags[t]);
  }
  if(sel){int icx=cx+PI_W/2;tft.fillCircle(icx,PI_Y0+PI_H-14,4,_sc[i].color);}
}

// ─── Setup progress header (replaces status bar on setup screens) ─
void _drawSetupProgress(int step, int total){
  tft.fillRect(0,0,DW,18,M_SURFACE);
  tft.drawFastHLine(0,18,DW,M_BORDER);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);
  char buf[16];snprintf(buf,16,"STEP %d OF %d",step,total);
  tft.setCursor(6,6);tft.print(buf);
  int dotX=DW-10-(total*10);
  for(int i=0;i<total;i++){
    tft.fillCircle(dotX+i*10,9,3,i<step?M_BBALL:M_SURFACE_HI);
  }
}

void _sportSelectFull(int sel){
  tft.fillScreen(M_BG);
  _drawSetupProgress(1,3);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(8,26);tft.print("CHOOSE");
  tft.setTextSize(2);tft.setTextColor(M_TEXT,M_BG);tft.setCursor(52,22);tft.print("Sport");
  for(int i=0;i<2;i++)_drawOneSportCard(i,i==sel);
  MHint h[]={{"H BACK",M_MUTED},{"A/B NAV",M_MUTED},{"I SELECT",_sc[sel].color},{"HOLD I: QUICK",M_DIM}};
  m_drawHintBar(h,4);
}

int showSportSelect(){
  const int N=2;
  int lastSport=prefs.getInt("last_sport",SPORT_BASKETBALL);
  int idx=(lastSport==SPORT_NET)?1:0;
  for(Button* b:allBtns){b->update();b->consume();}
  _sportSelectFull(idx);
  while(true){
    for(Button* b:allBtns)b->update();
    if(btnA.pressed){
      btnA.consume();int p=idx;idx=(idx+1)%N;
      if(idx!=p){
        _drawOneSportCard(p,false);_drawOneSportCard(idx,true);
        MHint h[]={{"H BACK",M_MUTED},{"A/B NAV",M_MUTED},{"I SELECT",_sc[idx].color},{"HOLD I: QUICK",M_DIM}};
        m_drawHintBar(h,4);
      }
    }
    if(btnB.pressed){
      btnB.consume();int p=idx;idx=(idx-1+N)%N;
      if(idx!=p){
        _drawOneSportCard(p,false);_drawOneSportCard(idx,true);
        MHint h[]={{"H BACK",M_MUTED},{"A/B NAV",M_MUTED},{"I SELECT",_sc[idx].color},{"HOLD I: QUICK",M_DIM}};
        m_drawHintBar(h,4);
      }
    }
    if(btnH.pressed){btnH.consume();return -1;}

    // Quick Game: hold I alone 1.5s (simpler one-button trigger)
    if(btnI.state && btnI.heldFor(1500)){
      btnI.consume();
      return 99; // Quick Game sentinel
    }
    // Show fill bar when I is held > 400ms
    if(btnI.state && btnI.heldFor(400)){
      unsigned long held=min((unsigned long)(millis()-btnI.pressTime),1500UL);
      int barW=(int)(held*(DW-40)/1500);
      tft.fillRect(20,DH-40,DW-40,12,M_SURFACE_HI);
      tft.fillRect(20,DH-40,barW,12,_sc[idx].color);
      tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE_HI);
      tft.setCursor(24,DH-36);tft.print("HOLD: QUICK START");
    }
    // Short press I = normal select (btnI.pressed fires on release of short press)
    if(btnI.pressed){
      btnI.consume();
      int sport=(idx==0)?SPORT_BASKETBALL:SPORT_NET;
      prefs.putInt("last_sport",sport);return sport;
    }
    delay(1);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION F: GAME SETTINGS
// ═══════════════════════════════════════════════════════════════════

void _drawBBSettingsFull(int cursor,BballSettings& s){
  tft.fillScreen(M_BG);
  _drawSetupProgress(2,3);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(8,26);tft.print("CONFIGURE");
  tft.setTextSize(2);tft.setTextColor(M_BBALL,M_BG);tft.setCursor(78,22);tft.print("Basketball");
  const char* labs[]={"PERIODS","MIN / PERIOD","SHOT CLOCK"};
  char vals[3][14];
  snprintf(vals[0],14,s.quarters==4?"4 QTR":"2 HALF");
  snprintf(vals[1],14,"%d MIN",s.quarterMin);
  if(s.shotClockDur==0)strcpy(vals[2],"OFF");else snprintf(vals[2],14,"%d SEC",s.shotClockDur);
  for(int i=0;i<3;i++)_drawSettingRowModern(46+i*46,labs[i],vals[i],(i==cursor),M_BBALL);
  MHint h[]={{"H BACK",M_MUTED},{"A/B ROW",M_MUTED},{"C/D VALUE",M_BBALL},{"I CONFIRM",M_BBALL}};
  m_drawHintBar(h,4);
}

void _drawBBSettingsUpdate(int oldCur,int newCur,BballSettings& s){
  const char* labs[]={"PERIODS","MIN / PERIOD","SHOT CLOCK"};
  char vals[3][14];
  snprintf(vals[0],14,s.quarters==4?"4 QTR":"2 HALF");
  snprintf(vals[1],14,"%d MIN",s.quarterMin);
  if(s.shotClockDur==0)strcpy(vals[2],"OFF");else snprintf(vals[2],14,"%d SEC",s.shotClockDur);
  if(oldCur!=newCur){
    _drawSettingRowModern(46+oldCur*46,labs[oldCur],vals[oldCur],false,M_BBALL);
    _drawSettingRowModern(46+newCur*46,labs[newCur],vals[newCur],true,M_BBALL);
  } else {
    _drawSettingRowModern(46+newCur*46,labs[newCur],vals[newCur],true,M_BBALL);
  }
}

BballSettings showBballSettings(){
  BballSettings s;s.quarters=4;s.quarterMin=10;s.shotClockDur=24;s.back=false;
  int cursor=0;const int N=3;
  static const int qMin[]={7,8,9,10,12,15,20};const int QML=7;
  _drawBBSettingsFull(cursor,s);
  for(Button* b:allBtns){b->update();b->consume();}
  while(true){
    for(Button* b:allBtns)b->update();
    if(btnA.pressed){btnA.consume();int p=cursor;cursor=(cursor+1)%N;_drawBBSettingsUpdate(p,cursor,s);}
    if(btnB.pressed){btnB.consume();int p=cursor;cursor=(cursor-1+N)%N;_drawBBSettingsUpdate(p,cursor,s);}
    if(btnC.pressed||btnD.pressed){
      bool fwd=(btnC.pressed);if(btnC.pressed)btnC.consume();else btnD.consume();
      if(cursor==0)s.quarters=(s.quarters==4?2:4);
      else if(cursor==1){for(int i=0;i<QML;i++)if(qMin[i]==s.quarterMin){s.quarterMin=qMin[(i+(fwd?1:QML-1))%QML];break;}}
      else{int v[]={24,14,0};const int VL=3;for(int i=0;i<VL;i++)if(v[i]==s.shotClockDur){s.shotClockDur=v[(i+(fwd?1:VL-1))%VL];break;}}
      _drawBBSettingsUpdate(cursor,cursor,s);
    }
    if(btnI.pressed){btnI.consume();s.back=false;return s;}
    if(btnH.pressed){btnH.consume();s.back=true;return s;}
    delay(1);
  }
}

void _drawNetSettingsFull(int cursor,NetSettings& s){
  tft.fillScreen(M_BG);
  _drawSetupProgress(2,3);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(8,26);tft.print("CONFIGURE");
  tft.setTextSize(2);tft.setTextColor(M_NET,M_BG);tft.setCursor(78,22);tft.print("Net Sport");
  const char* labs[]={"POINTS TO WIN","SETS TO WIN"};
  char vals[2][14];
  snprintf(vals[0],14,"%d PTS",s.ptsToWin);
  snprintf(vals[1],14,s.setsToWin==1?"1 SET":"%d SETS",s.setsToWin);
  for(int i=0;i<2;i++)_drawSettingRowModern(60+i*60,labs[i],vals[i],(i==cursor),M_NET);
  MHint h[]={{"H BACK",M_MUTED},{"A/B ROW",M_MUTED},{"C/D VALUE",M_NET},{"I CONFIRM",M_NET}};
  m_drawHintBar(h,4);
}

void _drawNetSettingsUpdate(int oldCur,int newCur,NetSettings& s){
  const char* labs[]={"POINTS TO WIN","SETS TO WIN"};
  char vals[2][14];
  snprintf(vals[0],14,"%d PTS",s.ptsToWin);
  snprintf(vals[1],14,s.setsToWin==1?"1 SET":"%d SETS",s.setsToWin);
  if(oldCur!=newCur){
    _drawSettingRowModern(60+oldCur*60,labs[oldCur],vals[oldCur],false,M_NET);
    _drawSettingRowModern(60+newCur*60,labs[newCur],vals[newCur],true,M_NET);
  } else {
    _drawSettingRowModern(60+newCur*60,labs[newCur],vals[newCur],true,M_NET);
  }
}

NetSettings showNetSettings(){
  NetSettings s;s.ptsToWin=21;s.setsToWin=2;s.back=false;
  int cursor=0;const int N=2;
  static const int ptsOpts[]={11,15,21,25,30};const int PO=5;
  static const int setsOpts[]={1,2,3,5};const int SO=4;
  _drawNetSettingsFull(cursor,s);
  for(Button* b:allBtns){b->update();b->consume();}
  while(true){
    for(Button* b:allBtns)b->update();
    if(btnA.pressed){btnA.consume();int p=cursor;cursor=(cursor+1)%N;_drawNetSettingsUpdate(p,cursor,s);}
    if(btnB.pressed){btnB.consume();int p=cursor;cursor=(cursor-1+N)%N;_drawNetSettingsUpdate(p,cursor,s);}
    if(btnC.pressed||btnD.pressed){
      bool fwd=(btnC.pressed);if(btnC.pressed)btnC.consume();else btnD.consume();
      if(cursor==0){for(int i=0;i<PO;i++)if(ptsOpts[i]==s.ptsToWin){s.ptsToWin=ptsOpts[(i+(fwd?1:PO-1))%PO];break;}}
      else{for(int i=0;i<SO;i++)if(setsOpts[i]==s.setsToWin){s.setsToWin=setsOpts[(i+(fwd?1:SO-1))%SO];break;}}
      _drawNetSettingsUpdate(cursor,cursor,s);
    }
    if(btnI.pressed){btnI.consume();s.back=false;return s;}
    if(btnH.pressed){btnH.consume();s.back=true;return s;}
    delay(1);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION G: TEAM NAME ENTRY  [N4 — Letter Grid]
// ═══════════════════════════════════════════════════════════════════

// Grid: 8 columns x 5 rows
// Row 0: A B C D E F G H
// Row 1: I J K L M N O P
// Row 2: Q R S T U V W X
// Row 3: Y Z 0 1 2 3 4 5
// Row 4: 6 7 8 9 [SPC] [BSP] [OK] [ . ]
// '\b'=backspace  '\r'=confirm/OK  '\0'=padding
static const char _gridChars[40] = {
  'A','B','C','D','E','F','G','H',
  'I','J','K','L','M','N','O','P',
  'Q','R','S','T','U','V','W','X',
  'Y','Z','0','1','2','3','4','5',
  '6','7','8','9',' ','\b','\r','\0'
};

#define GRID_COLS 8
#define GRID_ROWS 5
#define GRID_CELL_W 40
#define GRID_CELL_H 29
#define GRID_X0 0
#define GRID_Y0 52

static char  _gridSpecialLabel(char ch){
  // returns display char for special cells
  return ch;
}

void _drawGridNamePreview(const char* title, const char* name, int nameLen, uint16_t accent){
  // Strip y=18..52 (34px)
  tft.fillRect(0,18,DW,34,M_BG);
  tft.setTextSize(1);tft.setTextColor(accent,M_BG);
  tft.setCursor(6,22);tft.print(title);

  // Name slots: 8 slots of 34px each, starting at x=DW/2-136
  int slotW=34,slotGap=2,totalW=8*(slotW+slotGap);
  int startX=(DW-totalW)/2;
  bool cursorBlink=((millis()/400)%2==0);
  for(int i=0;i<8;i++){
    int sx=startX+i*(slotW+slotGap);
    bool filled=(i<nameLen);
    bool isCursor=(i==nameLen&&nameLen<8);
    uint16_t bg=filled?M_SURFACE_HI:M_SURFACE;
    uint16_t br=filled?accent:(isCursor&&cursorBlink)?accent:M_BORDER;
    tft.fillRect(sx,24,slotW,22,bg);
    tft.drawRect(sx,24,slotW,22,br);
    if(isCursor&&cursorBlink){tft.drawRect(sx+1,25,slotW-2,20,accent);}
    if(filled){
      char ch[2]={name[i],'\0'};
      tft.setTextSize(2);tft.setTextColor(accent,bg);
      tft.setCursor(sx+(slotW-12)/2,28);tft.print(ch);
    } else if(!isCursor){
      tft.setTextSize(1);tft.setTextColor(M_MUTED,bg);
      tft.setCursor(sx+(slotW-6)/2,31);tft.print("_");
    }
  }
}

void _drawGridCell(int row, int col, char ch, bool selected, uint16_t accent){
  int cx = GRID_X0 + col * GRID_CELL_W;
  int cy = GRID_Y0 + row * GRID_CELL_H;
  uint16_t bg  = selected ? accent     : M_SURFACE;
  uint16_t tc  = selected ? M_BG       : M_DIM;
  uint16_t br  = selected ? accent     : M_BORDER;

  tft.fillRect(cx, cy, GRID_CELL_W, GRID_CELL_H, bg);
  tft.drawRect(cx, cy, GRID_CELL_W, GRID_CELL_H, br);

  if(ch == '\0') return; // empty padding cell

  char label[4];
  if(ch == '\b') strcpy(label,"BSP");
  else if(ch == '\r') strcpy(label," OK");
  else if(ch == ' ') strcpy(label,"SPC");
  else { label[0]=ch; label[1]='\0'; }

  int lw = (ch=='\b'||ch=='\r'||ch==' ') ? strlen(label)*6 : 12;
  int tx = cx + (GRID_CELL_W - lw) / 2;
  int ty = cy + (GRID_CELL_H - 8) / 2;

  if(ch=='\b'||ch=='\r'||ch==' '){
    tft.setTextSize(1);tft.setTextColor(selected?M_BG:M_MUTED,bg);
    tft.setCursor(tx,ty);tft.print(label);
  } else {
    tft.setTextSize(2);tft.setTextColor(tc,bg);
    tft.setCursor(tx,ty-2);tft.print(label);
  }
}

// Returns true if user pressed BACK with empty name
bool editSingleName(const char* title, char* out, const char* def, uint16_t accent){
  char name[9]={0};
  strncpy(name,def,8);
  // Trim trailing spaces
  for(int i=7;i>=0;i--){if(name[i]==' '||name[i]=='\0')name[i]='\0';else break;}
  int nameLen = strlen(name);
  int gridRow=0, gridCol=0;
  int prevRow=-1, prevCol=-1;
  bool needFullRedraw=true;

  for(Button* b:allBtns){b->update();b->consume();}

  while(true){
    if(needFullRedraw){
      tft.fillScreen(M_BG);
      _drawSetupProgress(3,3);
      _drawGridNamePreview(title, name, nameLen, accent);
      tft.drawFastHLine(0,50,DW,M_BORDER);
      for(int r=0;r<GRID_ROWS;r++)
        for(int c=0;c<GRID_COLS;c++)
          _drawGridCell(r,c,_gridChars[r*GRID_COLS+c],(r==gridRow&&c==gridCol),accent);
      // Fill any unused area below grid
      int gridBottom = GRID_Y0 + GRID_ROWS * GRID_CELL_H;
      if(gridBottom < DH-22) tft.fillRect(0, gridBottom, DW, DH-22-gridBottom, M_BG);
      MHint hints[]={{"NAVIGATE",accent},{"I SELECT",accent},{"H BACK/DEL",M_MUTED}};
      m_drawHintBar(hints,3);
      needFullRedraw=false;
      prevRow=gridRow;prevCol=gridCol;
    } else if(prevRow!=gridRow||prevCol!=gridCol){
      _drawGridCell(prevRow,prevCol,_gridChars[prevRow*GRID_COLS+prevCol],false,accent);
      _drawGridCell(gridRow,gridCol,_gridChars[gridRow*GRID_COLS+gridCol],true,accent);
      prevRow=gridRow;prevCol=gridCol;
    }

    for(Button* b:allBtns)b->update();

    // Navigation: A=right, B=left, G=down, F=up
    if(btnA.pressed){
      btnA.consume();
      int next=(gridCol+1)%GRID_COLS;
      // Skip padding cell (last cell row 4)
      if(gridRow==4&&next==7)next=0;
      gridCol=next;
    }
    if(btnB.pressed){
      btnB.consume();
      int prev=(gridCol-1+GRID_COLS)%GRID_COLS;
      if(gridRow==4&&prev==7)prev=6;
      gridCol=prev;
    }
    // C/D for up/down (consistent with rest of offline flow; G/F removed)
    if(btnC.pressed){btnC.consume();gridRow=(gridRow+1)%GRID_ROWS;}
    if(btnD.pressed){btnD.consume();gridRow=(gridRow>0)?gridRow-1:0;}

    // Long-press auto-advance with row-wrap (fires at 12.5 chars/sec after 300ms hold)
    {static unsigned long _arLast=0;
    const unsigned long AR_DELAY=300,AR_RATE=80;
    if(btnA.state&&btnA.heldFor(AR_DELAY)&&millis()-_arLast>=AR_RATE){
      _arLast=millis();
      int next=gridCol+1;
      if(next>=GRID_COLS){next=0;gridRow=(gridRow+1)%GRID_ROWS;}
      if(gridRow==4&&next==7)next=0;
      gridCol=next;
    }
    if(btnB.state&&btnB.heldFor(AR_DELAY)&&millis()-_arLast>=AR_RATE){
      _arLast=millis();
      int prev=gridCol-1;
      if(prev<0){prev=GRID_COLS-1;gridRow=(gridRow>0)?gridRow-1:GRID_ROWS-1;}
      if(gridRow==4&&prev==7)prev=6;
      gridCol=prev;
    }
    if(btnC.state&&btnC.heldFor(AR_DELAY)&&millis()-_arLast>=AR_RATE){
      _arLast=millis();gridRow=(gridRow+1)%GRID_ROWS;
    }
    if(btnD.state&&btnD.heldFor(AR_DELAY)&&millis()-_arLast>=AR_RATE){
      _arLast=millis();gridRow=(gridRow>0)?gridRow-1:0;
    }}

    // H = backspace or back if empty
    if(btnH.pressed){
      btnH.consume();
      if(nameLen>0){
        name[--nameLen]='\0';
        _drawGridNamePreview(title,name,nameLen,accent);
      } else {
        return true; // back
      }
    }

    // J = confirm immediately
    if(btnJ.pressed){
      btnJ.consume();
      goto done;
    }

    // I = select
    if(btnI.pressed){
      btnI.consume();
      char ch=_gridChars[gridRow*GRID_COLS+gridCol];
      if(ch=='\r'){goto done;}
      if(ch=='\b'){
        if(nameLen>0){name[--nameLen]='\0';_drawGridNamePreview(title,name,nameLen,accent);}
      } else if(ch!='\0'&&nameLen<8){
        name[nameLen++]=ch;name[nameLen]='\0';
        _drawGridNamePreview(title,name,nameLen,accent);
      }
    }
    delay(1);
  }
done:
  strncpy(out,name,8);out[8]='\0';
  if(strlen(out)==0)strncpy(out,def,8);
  return false;
}

bool showTeamNames(){
  if(editSingleName("TEAM A NAME",cfg.teamAName,"HOME",M_BBALL))return true;
  if(editSingleName("TEAM B NAME",cfg.teamBName,"AWAY",M_NET))return true;
  return false;
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION H: SETUP FLOW
// ═══════════════════════════════════════════════════════════════════
bool runLocalSetupFlow(){
  int step=0;
  while(step>=0&&step<=2){
    if(step==0){
      int s=showSportSelect();
      if(s==-1)return false;
      if(s==99){
        // Quick Game: load last-used settings from NVS
        cfg.sport=prefs.getInt("qs_sport",SPORT_BASKETBALL);
        cfg.quarters=prefs.getInt("qs_quarters",4);
        cfg.quarterMin=prefs.getInt("qs_qmin",10);
        cfg.shotClockDur=prefs.getInt("qs_sc",24);
        cfg.ptsToWin=prefs.getInt("qs_pts",21);
        cfg.setsToWin=prefs.getInt("qs_sets",2);
        String ta=prefs.getString("qs_ta","HOME");
        String tb=prefs.getString("qs_tb","AWAY");
        strncpy(cfg.teamAName,ta.c_str(),11);
        strncpy(cfg.teamBName,tb.c_str(),11);
        step=3;continue; // skip to game init
      }
      cfg.sport=s;step=1;
    } else if(step==1){
      if(cfg.sport==SPORT_BASKETBALL){
        BballSettings s=showBballSettings();if(s.back){step=0;continue;}
        cfg.quarters=s.quarters;cfg.quarterMin=s.quarterMin;cfg.shotClockDur=s.shotClockDur;
      } else {
        NetSettings s=showNetSettings();if(s.back){step=0;continue;}
        cfg.ptsToWin=s.ptsToWin;cfg.setsToWin=s.setsToWin;cfg.quarters=0;cfg.shotClockDur=0;
      }
      step=2;
    } else if(step==2){if(showTeamNames()){step=1;continue;}step=3;}
  }
  if(step<0)return false;
  // Save settings for Quick Game next time
  prefs.putInt("qs_sport",cfg.sport);
  prefs.putInt("qs_quarters",cfg.quarters);
  prefs.putInt("qs_qmin",cfg.quarterMin);
  prefs.putInt("qs_sc",cfg.shotClockDur);
  prefs.putInt("qs_pts",cfg.ptsToWin);
  prefs.putInt("qs_sets",cfg.setsToWin);
  prefs.putString("qs_ta",cfg.teamAName);
  prefs.putString("qs_tb",cfg.teamBName);
  if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
    liveState.scoreA=0;liveState.scoreB=0;liveState.shotClock=cfg.shotClockDur;
    liveState.mainMin=cfg.quarterMin;liveState.mainSec=0;liveState.paused=true;
    liveState.period=1;liveState.isLocked=false;
    liveState.setsA=0;liveState.setsB=0;liveState.currentSet=1;
    saveAtomicState();xSemaphoreGive(stateMutex);
  }
  possession=false;tSec=millis();currentScreen=SCR_GAME;resetPrevState();
  return true;
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION I: BASKETBALL HUD  [N5 — LAN dot, shot clock urgency, dot period]
// ═══════════════════════════════════════════════════════════════════
void drawBB(){
  int sA,sB,sc,mm,ms,per;bool pau,lck,poss;char tA[12],tB[12];
  if(!xSemaphoreTake(stateMutex,pdMS_TO_TICKS(5)))return;
  sA=liveState.scoreA;sB=liveState.scoreB;sc=liveState.shotClock;
  mm=liveState.mainMin;ms=liveState.mainSec;per=liveState.period;
  pau=liveState.paused;lck=liveState.isLocked;poss=possession;
  strncpy(tA,cfg.teamAName,11);strncpy(tB,cfg.teamBName,11);
  xSemaphoreGive(stateMutex);
  bool lanDot=(wsConnectedClients>0);
  bool fullRedraw=(prev_sA==-1);
  bool lastMinute=(mm==0&&ms>0&&ms<=59&&!pau);
  bool clkZero=(mm==0&&ms==0);
  static bool flashSA=false,flashSB=false;
  if(sA!=prev_sA&&prev_sA>=0)flashSA=true;
  if(sB!=prev_sB&&prev_sB>=0)flashSB=true;
  if(clkZero&&!prev_clkZero&&!pau){buz.pattern(3);prev_clkZero=true;}
  if(!clkZero)prev_clkZero=false;

  // Status bar — redraw if lock, lanDot or full
  if(fullRedraw||lck!=prev_lck||lanDot!=prev_lanDot){
    int modeInt=(currentMode==MODE_ONLINE||currentMode==MODE_PI_CODE)?1:
                (currentMode==MODE_PI_CONNECT)?2:3;
    bool conn=(currentMode==MODE_ONLINE||currentMode==MODE_PI_CODE||currentMode==MODE_PI_CONNECT);
    m_drawStatusBar(modeInt,conn,3,lanDot);
    if(lck){tft.setTextSize(1);tft.setTextColor(M_WARN,M_SURFACE);tft.setCursor(DW-70,6);tft.print("WEB CTRL");}
    prev_lanDot=lanDot;
  }

  // Top info bar (y=18..64)
  if(fullRedraw){
    tft.fillRect(0,18,DW,46,M_SURFACE);
    tft.drawFastHLine(0,64,DW,M_BORDER);
  }

  // Shot clock (left 54px) + urgency border [N5]
  if(fullRedraw||sc!=prev_sc||pau!=prev_pau){
    tft.fillRect(0,18,54,46,M_SURFACE);
    if(cfg.shotClockDur>0){
      char scBuf[4];sprintf(scBuf,"%02d",sc);
      uint16_t scCol=pau?M_DIM:(sc<=5)?M_DANGER:(sc<=10)?M_WARN:M_TEXT;
      int scSize=(!pau&&sc<=5&&sc>0)?4:3;
      int scY=(scSize==4)?22:26;
      tft.setTextSize(scSize);tft.setTextColor(scCol,M_SURFACE);tft.setCursor(4,scY);tft.print(scBuf);
      tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);tft.setCursor(6,50);tft.print("SHOT");
      // Pulsing red border when urgent
      if(!pau&&sc<=5&&sc>0){
        uint16_t urgCol=((millis()/250)%2)?M_DANGER:M_SURFACE;
        tft.drawRect(0,18,54,46,urgCol);
        tft.drawRect(1,19,52,44,urgCol);
      }
    }
  }

  // Game clock (center)
  if(fullRedraw||mm!=prev_mm||ms!=prev_ms||pau!=prev_pau){
    tft.fillRect(54,18,212,46,M_SURFACE);
    char clkBuf[8];snprintf(clkBuf,8,"%d:%02d",mm,ms);
    int clkLen=strlen(clkBuf),clkX=54+(212-clkLen*18)/2;
    uint16_t clkCol=pau?M_DIM:lastMinute?M_WARN:M_TEXT;
    if(pau){tft.fillRect(140,24,6,18,M_WARN);tft.fillRect(150,24,6,18,M_WARN);}
    tft.setTextSize(3);tft.setTextColor(clkCol,M_SURFACE);tft.setCursor(clkX,26);tft.print(clkBuf);
  }

  // Period — dot indicator + label [N5]
  if(fullRedraw||per!=prev_per){
    tft.fillRect(266,18,54,46,M_SURFACE);
    // Dot row
    int dotY=26,dotX0=270;
    int maxQ=(cfg.quarters>0)?cfg.quarters:4;
    int dotSpacing=(maxQ<=4)?10:7;
    for(int p=1;p<=maxQ;p++){
      int dx=dotX0+(p-1)*dotSpacing;
      if(dx>316)break;
      tft.fillCircle(dx,dotY,4,p<=per?M_BBALL:M_SURFACE_HI);
    }
    // Label
    tft.setTextSize(1);tft.setTextColor(M_BBALL,M_SURFACE);tft.setCursor(271,36);
    char pBuf[5];snprintf(pBuf,5,"%s %d",cfg.quarters==4?"Q":"H",per);
    tft.print(pBuf);
  }

  // Team names bar (y=64..86)
  if(fullRedraw||poss!=prev_poss){
    tft.fillRect(0,64,DW,22,M_SURFACE);
    tft.drawFastHLine(0,86,DW,M_BORDER);
    tftCtrIn(tA,0,159,68,1,poss?M_DIM:M_TEXT,M_SURFACE);
    if(!poss){tft.setTextSize(1);tft.setTextColor(M_GOLD,M_SURFACE);tft.setCursor(148,72);tft.print("*");}
    tft.drawFastVLine(159,64,22,M_BORDER);
    tftCtrIn(tB,161,320,68,1,poss?M_TEXT:M_DIM,M_SURFACE);
    if(poss){tft.setTextSize(1);tft.setTextColor(M_GOLD,M_SURFACE);tft.setCursor(163,72);tft.print("*");}
  }

  // Score A (flash accent BG on change)
  if(fullRedraw||sA!=prev_sA||poss!=prev_poss||flashSA){
    uint16_t bgA=flashSA?M_BBALL:M_BG;
    uint16_t tcA=flashSA?M_BG:(!poss?M_TEXT:M_DIM);
    tft.fillRect(0,87,158,106,bgA);
    char sAstr[5];sprintf(sAstr,"%d",sA);
    int len=strlen(sAstr),sx=(158-len*48)/2;if(sx<2)sx=2;
    tft.setTextSize(8);tft.setTextColor(tcA,bgA);tft.setCursor(sx,94);tft.print(sAstr);
    flashSA=false;
  }

  // Score B (flash accent BG on change)
  if(fullRedraw||sB!=prev_sB||poss!=prev_poss||flashSB){
    uint16_t bgB=flashSB?M_NET:M_BG;
    uint16_t tcB=flashSB?M_BG:(poss?M_TEXT:M_DIM);
    tft.fillRect(161,87,158,106,bgB);
    char sBstr[5];sprintf(sBstr,"%d",sB);
    int len=strlen(sBstr),sx=161+(158-len*48)/2;if(sx<163)sx=163;
    tft.setTextSize(8);tft.setTextColor(tcB,bgB);tft.setCursor(sx,94);tft.print(sBstr);
    flashSB=false;
  }
  // Vertical score divider — redraw after flash (flash fillRect can overwrite it)
  if(fullRedraw||flashSA||flashSB)tft.drawFastVLine(159,87,106,M_BORDER);

  // Flash border
  drawFlashBorder();clearFlashBorder();

  // Hint bar
  if(fullRedraw||pau!=prev_pau){
    MHint hints[]={{tA,M_BBALL},{pau?"PLAY":"PAUSE",M_WARN},{tB,M_BBALL},{"UNDO",M_DIM}};
    m_drawHintBar(hints,4);
  }

  prev_sA=sA;prev_sB=sB;prev_sc=sc;prev_mm=mm;prev_ms=ms;
  prev_per=per;prev_pau=pau;prev_poss=poss;prev_lck=lck;
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION J: NET SPORT HUD
// ═══════════════════════════════════════════════════════════════════
int checkSetWin(){
  int sA=liveState.scoreA,sB=liveState.scoreB,pts=cfg.ptsToWin;
  if(sA>=pts&&sA-sB>=2)return 1;
  if(sB>=pts&&sB-sA>=2)return 2;
  return 0;
}

void drawNet(){
  int sA,sB,stA,stB,curSet;char tA[12],tB[12];bool inDeuce;
  if(!xSemaphoreTake(stateMutex,pdMS_TO_TICKS(5)))return;
  sA=liveState.scoreA;sB=liveState.scoreB;
  stA=liveState.setsA;stB=liveState.setsB;curSet=liveState.currentSet;
  strncpy(tA,cfg.teamAName,11);strncpy(tB,cfg.teamBName,11);
  inDeuce=(sA>=cfg.ptsToWin-1&&sB>=cfg.ptsToWin-1&&abs(sA-sB)<2);
  xSemaphoreGive(stateMutex);
  bool lanDot=(wsConnectedClients>0);
  bool fullRedraw=(prev_sA==-1);

  if(fullRedraw||lanDot!=prev_lanDot){
    m_drawStatusBar(0,false,0,lanDot);
    prev_lanDot=lanDot;
  }

  if(fullRedraw||stA!=prev_stA||stB!=prev_stB){
    tft.fillRect(0,18,DW,32,M_SURFACE);
    tft.drawFastHLine(0,50,DW,M_BORDER);
    tft.drawFastVLine(159,18,32,M_BORDER);
    tftCtrIn(tA,0,159,26,2,M_TEXT,M_SURFACE);
    tftCtrIn(tB,161,320,26,2,M_TEXT,M_SURFACE);
    char ssA[4],ssB[4];snprintf(ssA,4,"%d",stA);snprintf(ssB,4,"%d",stB);
    tft.setTextSize(1);tft.setTextColor(M_NET,M_SURFACE);tft.setCursor(136,22);tft.print("SETS");
    tft.setTextSize(2);tft.setTextColor(M_TEXT,M_SURFACE);
    tft.setCursor(134,32);tft.print(ssA);tft.setCursor(152,32);tft.print("-");tft.setCursor(164,32);tft.print(ssB);
  }

  if(fullRedraw||inDeuce!=prev_inDeuce||curSet!=prev_curSet||stA!=prev_stA||stB!=prev_stB){
    tft.fillRect(0,51,DW,24,M_BG);
    if(inDeuce){
      uint16_t dc=((millis()/400)%2)?M_DANGER:M_WARN;
      tft.fillRect(0,51,DW,24,dc);tftCtr("D E U C E",55,2,M_BG,dc);
    } else {
      char setLbl[10];snprintf(setLbl,10,"SET %d",curSet);tftCtr(setLbl,57,1,M_NET);
      int maxSets=cfg.setsToWin;
      for(int i=0;i<maxSets;i++){int cx=120+i*14;
        if(i<stA)tft.fillCircle(cx,71,5,M_BBALL);
        else{tft.drawCircle(cx,71,5,M_BORDER);tft.fillCircle(cx,71,4,M_BG);}
      }
      for(int i=0;i<maxSets;i++){int cx=200+i*14;
        if(i<stB)tft.fillCircle(cx,71,5,M_NET);
        else{tft.drawCircle(cx,71,5,M_BORDER);tft.fillCircle(cx,71,4,M_BG);}
      }
    }
  }
  tft.drawFastHLine(0,75,DW,M_BORDER);

  if(fullRedraw||sA!=prev_sA){
    tft.fillRect(0,76,158,100,M_BG);
    char sAstr[5];sprintf(sAstr,"%d",sA);
    int len=strlen(sAstr),sx=(158-len*48)/2;if(sx<2)sx=2;
    tft.setTextSize(8);tft.setTextColor(sA>sB?M_TEXT:M_DIM,M_BG);tft.setCursor(sx,84);tft.print(sAstr);
  }
  if(fullRedraw||sB!=prev_sB){
    tft.fillRect(161,76,158,100,M_BG);
    char sBstr[5];sprintf(sBstr,"%d",sB);
    int len=strlen(sBstr),sx=161+(158-len*48)/2;if(sx<163)sx=163;
    tft.setTextSize(8);tft.setTextColor(sB>sA?M_TEXT:M_DIM,M_BG);tft.setCursor(sx,84);tft.print(sBstr);
  }
  if(fullRedraw)tft.drawFastVLine(159,76,100,M_BORDER);

  if(fullRedraw||sA!=prev_sA||sB!=prev_sB){
    tft.fillRect(140,125,40,30,M_BG);
    if(sA>sB)tft.fillTriangle(155,126,143,138,155,150,M_BBALL);
    else if(sB>sA)tft.fillTriangle(165,126,177,138,165,150,M_NET);
  }

  if(fullRedraw||inDeuce!=prev_inDeuce){
    tft.fillRect(0,176,DW,17,M_SURFACE);
    tft.drawFastHLine(0,176,DW,M_BORDER);
    char ptStr[24];snprintf(ptStr,24,"PLAYING TO %d",cfg.ptsToWin);
    tftCtr(ptStr,180,1,M_MUTED,M_SURFACE);
    if(inDeuce){tft.setTextSize(1);tft.setTextColor(M_DANGER,M_SURFACE);tft.setCursor(210,180);tft.print("WIN BY 2");}
  }

  if(fullRedraw||sA!=prev_sA||sB!=prev_sB){
    tft.fillRect(0,194,DW,24,M_BG);
    bool gpA=(stA==cfg.setsToWin-1)&&(sA>=cfg.ptsToWin-1)&&(sA>sB);
    bool gpB=(stB==cfg.setsToWin-1)&&(sB>=cfg.ptsToWin-1)&&(sB>sA);
    if(gpA||gpB){uint16_t gc=((millis()/500)%2)?(gpA?M_BBALL:M_NET):M_MUTED;tftCtr("MATCH POINT",197,1,gc);}
  }

  if(fullRedraw){
    MHint hints[]={{tA,M_BBALL},{tB,M_NET},{"SET A",M_BBALL},{"SET B",M_NET}};
    m_drawHintBar(hints,4);
  }

  prev_sA=sA;prev_sB=sB;prev_stA=stA;prev_stB=stB;prev_curSet=curSet;prev_inDeuce=inDeuce;
}

void drawNetMatchWon(const char* winner,bool isTeamA){
  uint16_t wCol=isTeamA?M_BBALL:M_NET;
  tft.fillScreen(M_BG);
  tft.fillRect(0,0,DW,4,wCol);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor((DW-72)/2,14);tft.print("MATCH WINNER");
  tft.drawFastHLine(60,26,200,wCol);
  char wn[9]={0};strncpy(wn,winner,8);
  int nw=strlen(wn)*30,nx=(DW-nw)/2;if(nx<4)nx=4;
  tft.setTextSize(5);tft.setTextColor(wCol,M_BG);tft.setCursor(nx,70);tft.print(wn);
  for(int i=0;i<7;i++){int dx=40+i*36;tft.fillCircle(dx,148,4,i%2==0?wCol:M_MUTED);}
  tft.drawFastHLine(30,160,260,M_BORDER);
  tftCtr("PRESS I TO RESTART",174,1,M_MUTED);
}

void drawGameScreen(){
  static int lastSport=-1;
  if(lastSport!=cfg.sport){resetPrevState();lastSport=cfg.sport;}
  if(cfg.sport==SPORT_NET)drawNet();else drawBB();
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION K: ONLINE MODE SCREENS
// ═══════════════════════════════════════════════════════════════════

void drawWaiting(){
  if(!_waitingDrawn){
    tft.fillScreen(M_BG);
    m_drawStatusBar(1,WiFi.status()==WL_CONNECTED,3,wsConnectedClients>0);
    tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);tft.setCursor(20,28);tft.print("PAIR CODE");
    for(int i=0;i<4;i++){
      int sx=20+i*58;
      tft.fillRoundRect(sx,40,50,56,6,M_SURFACE_HI);
      tft.drawRoundRect(sx,40,50,56,6,M_ONLINE);
      char ch[2]={deviceId[i],'\0'};
      tft.setTextSize(4);tft.setTextColor(M_ONLINE,M_SURFACE_HI);
      tft.setCursor(sx+13,50);tft.print(ch);
    }
    tft.drawFastVLine(DW/2+8,26,100,M_BORDER);
    tft.setTextSize(1);tft.setTextColor(M_DIM,M_BG);
    tft.setCursor(DW/2+16,32);tft.print("Open the website");
    tft.setCursor(DW/2+16,44);tft.print("and enter this code");
    tft.setCursor(DW/2+16,62);tft.print("to connect your");
    tft.setCursor(DW/2+16,74);tft.print("controller.");
    if(WiFi.status()==WL_CONNECTED){
      String ipStr=WiFi.localIP().toString();
      tft.setTextColor(M_ONLINE,M_BG);tft.setCursor(DW/2+16,92);tft.print(ipStr.c_str());tft.print(":81");
    }
    tftCtr("HOLD I 3.5S TO RETURN",220,1,M_MUTED);
    _waitingDrawn=true;
  }
  uint16_t bc=((millis()/700)%2)?M_ONLINE:M_PI;
  for(int i=0;i<4;i++){int sx=20+i*58;tft.drawRoundRect(sx,40,50,56,6,bc);}
  // WiFi bars
  tft.fillRect(DW-34,200,28,20,M_BG);
  int rssi=WiFi.RSSI(),bars=0;
  if(WiFi.status()==WL_CONNECTED){if(rssi>-50)bars=4;else if(rssi>-60)bars=3;else if(rssi>-70)bars=2;else bars=1;}
  for(int i=0;i<4;i++){int bh=4+i*4,bx=DW-30+i*6,by=204+16-bh;tft.fillRect(bx,by,4,bh,i<bars?M_SUCCESS:M_MUTED);}
  // LAN dot
  tft.fillCircle(DW-40,210,3,wsConnectedClients>0?M_SUCCESS:M_WARN);
}

void drawPaired(){
  if(_pairedDrawn)return;
  tft.fillScreen(M_BG);
  m_drawStatusBar(1,true,4,wsConnectedClients>0);
  tft.fillCircle(DW/2,100,32,M_SURFACE_HI);
  tft.drawCircle(DW/2,100,32,M_SUCCESS);tft.drawCircle(DW/2,100,31,M_SUCCESS);
  drawCheckmark(DW/2,92,M_SUCCESS);
  tft.setTextSize(3);tft.setTextColor(M_SUCCESS,M_BG);
  tft.setCursor((DW-72)/2,142);tft.print("PAIRED");
  tft.setTextSize(1);tft.setTextColor(M_DIM,M_BG);
  tftCtr("Controller connected to website",162,1,M_DIM);
  tft.fillRoundRect(80,176,160,22,4,M_SURFACE);
  tft.drawRoundRect(80,176,160,22,4,M_BORDER);
  tftCtr("Waiting for game start...",180,1,M_MUTED,M_SURFACE);
  _pairedDrawn=true;
}

void configModeCallback(WiFiManager* wm){
  _resetStatusCard();
  drawStatusCard("WIFI SETUP","CONNECT TO: THE_BOX_SETUP","ON YOUR PHONE",M_WARN,-1);
}


// ═══════════════════════════════════════════════════════════════════
//  DISPLAY — SECTION L: TV CODE ENTRY
// ═══════════════════════════════════════════════════════════════════

static const char _tcCharset[]="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
static const int  _tcCLEN=36;
static int        _tcCursor=0;
void _drawTvSlots(){
  for(int i=0;i<4;i++){
    int sx=32+i*64;bool active=(_tcCursor==i);
    if(active){tft.fillRoundRect(sx,26,60,26,5,M_PI);}
    else{tft.fillRoundRect(sx,26,60,26,5,M_SURFACE);tft.drawRoundRect(sx,26,60,26,5,M_BORDER);}
    char ch[2]={piTvCode[i],'\0'};
    tft.setTextSize(3);tft.setTextColor(active?M_BG:M_TEXT,active?M_PI:M_SURFACE);
    tft.setCursor(sx+21,29);tft.print(ch);
  }
  tft.drawFastHLine(32+_tcCursor*64,54,60,M_PI);
}

void _drawTvBigChar(){
  tft.fillRect(0,60,DW,96,M_BG);
  tft.fillTriangle(DW/2,60,DW/2-12,74,DW/2+12,74,M_PI);
  char bigCh[2]={piTvCode[_tcCursor],'\0'};
  tft.setTextSize(8);tft.setTextColor(M_PI,M_BG);
  tft.setCursor((DW-48)/2,76);tft.print(bigCh);
  tft.fillTriangle(DW/2-12,152,DW/2+12,152,DW/2,164,M_PI);
  char pos[5];snprintf(pos,5,"%d / 4",_tcCursor+1);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);
  tft.fillRect(DW-36,222,36,8,M_SURFACE);tft.setCursor(DW-34,222);tft.print(pos);
}

void drawTvCodeScreen(bool fullRedraw){
  if(fullRedraw){
    tft.fillScreen(M_BG);
    tft.fillRect(0,0,DW,20,M_SURFACE);tft.drawFastHLine(0,20,DW,M_PI);
    tftCtr("CAST LINK CODE",3,1,M_PI,M_SURFACE);
    tft.fillRect(0,172,DW,68,M_SURFACE);tft.drawFastHLine(0,172,DW,M_BORDER);
    tftCtr("A/B LETTER   G/I NEXT SLOT   H BACK",180,1,M_DIM,M_SURFACE);
    tftCtr("I ON LAST SLOT = CONFIRM",194,1,M_MUTED,M_SURFACE);
  }
  _drawTvSlots();_drawTvBigChar();
}

bool showTvCodeEntry(){
  _tcCursor=0;
  for(int i=0;i<4;i++)piTvCode[i]='A';piTvCode[4]='\0';
  int charIdx[4]={0,0,0,0};
  drawTvCodeScreen(true);
  for(Button* b:allBtns){b->update();b->consume();}
  unsigned long arLastA=0,arLastB=0;
  while(true){
    for(Button* b:allBtns)b->update();
    bool doA=btnA.pressed;if(btnA.pressed){btnA.consume();arLastA=millis();}
    if(!doA&&btnA.state&&btnA.heldFor(250)&&millis()-arLastA>=40){doA=true;arLastA=millis();}
    bool doB=btnB.pressed;if(btnB.pressed){btnB.consume();arLastB=millis();}
    if(!doB&&btnB.state&&btnB.heldFor(250)&&millis()-arLastB>=40){doB=true;arLastB=millis();}
    if(doA){charIdx[_tcCursor]=(charIdx[_tcCursor]+1)%_tcCLEN;piTvCode[_tcCursor]=_tcCharset[charIdx[_tcCursor]];_drawTvSlots();_drawTvBigChar();}
    if(doB){charIdx[_tcCursor]=(charIdx[_tcCursor]-1+_tcCLEN)%_tcCLEN;piTvCode[_tcCursor]=_tcCharset[charIdx[_tcCursor]];_drawTvSlots();_drawTvBigChar();}
    if(btnG.pressed){btnG.consume();if(_tcCursor<3){_tcCursor++;drawTvCodeScreen(false);}}
    if(btnI.pressed){
      btnI.consume();
      if(_tcCursor<3){_tcCursor++;drawTvCodeScreen(false);}
      else{piTvCode[4]='\0';return false;}
    }
    if(btnH.pressed){btnH.consume();return true;}
    delay(3);
  }
}


// ═══════════════════════════════════════════════════════════════════
//  NETWORKING — Supabase persistent connection & NTP
// ═══════════════════════════════════════════════════════════════════
void supaDisconnect(){
  if(supaHttp){supaHttp->end();delete supaHttp;supaHttp=nullptr;}
  if(supaClient){supaClient->stop();delete supaClient;supaClient=nullptr;}
  supaConnected=false;
}

String getTimestampStr() {
  struct timeval tv;
  gettimeofday(&tv, NULL);
  if (tv.tv_sec > 1600000000) {
    char buf[32];
    snprintf(buf, 32, "%lld", (long long)tv.tv_sec * 1000 + (tv.tv_usec / 1000));
    return String(buf);
  } else {
    return String(millis());
  }
}

bool supaConnect(){
  supaDisconnect();
  supaClient=new WiFiClientSecure();supaClient->setInsecure();supaClient->setTimeout(3);
  supaHttp=new HTTPClient();supaHttp->setReuse(true);supaHttp->setTimeout(4000);
  String url=String("https://")+SUPABASE_HOST+"/realtime/v1/api/broadcast";
  bool ok=supaHttp->begin(*supaClient,url);
  if(ok){
    supaHttp->addHeader("Content-Type","application/json");
    supaHttp->addHeader("apikey",SUPABASE_ANON_KEY);
    supaHttp->addHeader("Authorization",String("Bearer ")+SUPABASE_ANON_KEY);
    supaHttp->addHeader("Connection","keep-alive");
    supaConnected=true;lastSupaUse=millis();
  } else supaDisconnect();
  return ok;
}
bool supaEnsureConnected(){
  if(!supaConnected||!supaClient||!supaHttp)return supaConnect();
  if(millis()-lastSupaUse>SUPA_KEEPALIVE_MS)return supaConnect();
  return true;
}
bool supaPost(const String& body){
  if(!supaEnsureConnected())return false;
  int code=supaHttp->POST(body);lastSupaUse=millis();
  if(code<0){supaDisconnect();return false;}
  supaHttp->getString();return(code==200||code==202);
}

bool registerDevice_Online(){
  WiFiClientSecure cli;cli.setInsecure();cli.setTimeout(10000);
  HTTPClient http;http.setTimeout(15000);
  String url=String("https://")+SUPABASE_HOST+"/rest/v1/rpc/register_esp32_device";
  if(!http.begin(cli,url))return false;
  http.addHeader("Content-Type","application/json");
  http.addHeader("apikey",SUPABASE_ANON_KEY);
  http.addHeader("Authorization",String("Bearer ")+SUPABASE_ANON_KEY);
  String body="{\"p_id\":\""+deviceId+"\",\"p_firmware_version\":\""+FW_VERSION+"\",\"p_local_ip\":\""+WiFi.localIP().toString()+"\"}";
  int code=http.POST(body);bool ok=false;
  if(code==200){DynamicJsonDocument doc(256);if(!deserializeJson(doc,http.getString()))ok=doc["registered"]|false;}
  http.end();return ok;
}

void sendHeartbeat_Online(){
  WiFiClientSecure cli;cli.setInsecure();cli.setTimeout(3);HTTPClient http;http.setTimeout(4000);
  http.begin(cli,String("https://")+SUPABASE_HOST+"/rest/v1/rpc/send_esp32_heartbeat");
  http.addHeader("Content-Type","application/json");
  http.addHeader("apikey",SUPABASE_ANON_KEY);
  http.addHeader("Authorization",String("Bearer ")+SUPABASE_ANON_KEY);
  http.POST("{\"p_id\":\""+deviceId+"\",\"p_firmware_version\":\""+FW_VERSION+"\",\"p_local_ip\":\""+WiFi.localIP().toString()+"\"}");
  http.end();
}

void pollDeviceState_Online(){
  WiFiClientSecure cli;cli.setInsecure();cli.setTimeout(3);HTTPClient http;http.setTimeout(4000);
  String url=String("https://")+SUPABASE_HOST+"/rest/v1/hardware_terminals?id=eq."+deviceId+
    "&select=status,active_game_id,control_mode,team_a_name,team_b_name";
  http.begin(cli,url);
  http.addHeader("apikey",SUPABASE_ANON_KEY);
  http.addHeader("Authorization",String("Bearer ")+SUPABASE_ANON_KEY);
  http.addHeader("Accept","application/json");
  int httpCode=http.GET();
  if(httpCode==200){
    DynamicJsonDocument doc(1024);
    if(!deserializeJson(doc,http.getString())){
      JsonObject row=(doc.is<JsonArray>()&&doc.size()>0)?doc[0].as<JsonObject>():doc.as<JsonObject>();
      if(!row.isNull()){
        String dbStatus=row["status"]|"waiting";
        String dbGameId=String((const char*)(row["active_game_id"]|""));
        String dbMode=row["control_mode"]|"hardware";
        if(dbGameId=="null")dbGameId="";
        if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
          strncpy(cfg.teamAName,row["team_a_name"]|"HOME",11);
          strncpy(cfg.teamBName,row["team_b_name"]|"AWAY",11);
          liveState.isLocked=(dbMode=="web");
          if(dbStatus=="active"&&dbGameId!=""){
            if(activeGameId!=dbGameId){
              activeGameId=dbGameId;
              liveState.scoreA=0;liveState.scoreB=0;liveState.shotClock=24;
              liveState.mainMin=10;liveState.mainSec=0;liveState.paused=true;
              liveState.period=1;liveState.isLocked=false;
              liveState.setsA=0;liveState.setsB=0;liveState.currentSet=1;
              resetPrevState();
            }
            deviceState=2;
          } else if(dbStatus=="paired")deviceState=1;
          else{deviceState=0;activeGameId="";}
          xSemaphoreGive(stateMutex);
        }
      }
    }
  }
  http.end();
}

void sendSignal_Online(uint8_t action,const String& gameId){
  if(action==ACT_NONE||gameId=="")return;
  String body="{\"messages\":[{\"topic\":\"hw-"+gameId+"\",\"event\":\"signal\",\"payload\":{\"action\":\""+signalNames[action]+"\",\"deviceId\":\""+deviceId+"\",\"gameId\":\""+gameId+"\",\"timestamp\":"+getTimestampStr()+"}}]}";
  supaPost(body);
}

void broadcastAbsoluteState_Online(const SignalOutbox& msg){
  String gid=String(msg.gameId);if(gid=="")return;
  String body="{\"messages\":[{\"topic\":\"hw-"+gid+"\",\"event\":\"signal\",\"payload\":{\"action\":\"SCORE_STATE\",\"deviceId\":\""+deviceId+"\",\"gameId\":\""+gid+"\",\"scoreA\":"+String(msg.scoreA)+",\"scoreB\":"+String(msg.scoreB)+",\"minutes\":"+String(msg.mainMin)+",\"seconds\":"+String(msg.mainSec)+",\"shotClock\":"+String(msg.shotClock)+",\"period\":"+String(msg.period)+",\"gameRunning\":"+String(!msg.paused?"true":"false")+",\"possession\":\""+String(msg.poss?"B":"A")+"\",\"timestamp\":"+getTimestampStr()+"}}]}";
  supaPost(body);
}

String wsSignalJson(uint8_t action,const String& gameId){
  return "{\"event\":\"signal\",\"payload\":{\"action\":\""+String(signalNames[action])+"\",\"deviceId\":\""+deviceId+"\",\"gameId\":\""+gameId+"\",\"timestamp\":"+getTimestampStr()+"}}";
}
String wsStateJson(const SignalOutbox& msg){
  return "{\"event\":\"signal\",\"payload\":{\"action\":\"SCORE_STATE\",\"deviceId\":\""+deviceId+"\",\"gameId\":\""+String(msg.gameId)+"\",\"scoreA\":"+String(msg.scoreA)+",\"scoreB\":"+String(msg.scoreB)+",\"minutes\":"+String(msg.mainMin)+",\"seconds\":"+String(msg.mainSec)+",\"shotClock\":"+String(msg.shotClock)+",\"period\":"+String(msg.period)+",\"gameRunning\":"+String(!msg.paused?"true":"false")+",\"possession\":\""+String(msg.poss?"B":"A")+"\",\"timestamp\":"+getTimestampStr()+"}}";
}

SignalOutbox makeStateSnapshot(const String& gameId,uint8_t action=255){
  SignalOutbox msg;msg.action=action;
  msg.scoreA=0;msg.scoreB=0;msg.paused=true;
  msg.mainMin=0;msg.mainSec=0;msg.shotClock=0;msg.period=1;msg.poss=false;
  strncpy(msg.gameId,gameId.c_str(),11);msg.gameId[11]='\0';
  if(xSemaphoreTake(stateMutex,pdMS_TO_TICKS(5))){
    msg.scoreA=liveState.scoreA;msg.scoreB=liveState.scoreB;
    msg.mainMin=liveState.mainMin;msg.mainSec=liveState.mainSec;
    msg.shotClock=liveState.shotClock;msg.period=liveState.period;
    msg.paused=liveState.paused;msg.poss=possession;
    xSemaphoreGive(stateMutex);
  }
  return msg;
}
void pushQueue(QueueHandle_t q,const SignalOutbox& msg){
  if(!q)return;
  if(xQueueSend(q,&msg,0)!=pdTRUE){SignalOutbox d;xQueueReceive(q,&d,0);xQueueSend(q,&msg,0);}
}

// [N1] Local-Only aware signal queue — skips Supabase when localOnlyMode=true
void queueSignal_Online(uint8_t action,const String& gameId){
  if(action==ACT_NONE||gameId=="")return;
  SignalOutbox msg;msg.action=action;msg.scoreA=0;msg.scoreB=0;msg.paused=true;
  msg.mainMin=0;msg.mainSec=0;msg.shotClock=0;msg.period=1;msg.poss=false;
  strncpy(msg.gameId,gameId.c_str(),11);msg.gameId[11]='\0';
  pushQueue(wsQueue,msg);
  if(!localOnlyMode)pushQueue(signalQueue,msg);
}

// [N1] Local-Only aware full state sync
void queueFullStateSync(const String& gameId){
  if(gameId=="")return;
  SignalOutbox msg=makeStateSnapshot(gameId,255);
  pushQueue(wsQueue,msg);
  if(!localOnlyMode)pushQueue(signalQueue,msg);
}

void onWsEvent(uint8_t num,WStype_t type,uint8_t* payload,size_t length){
  if(type==WStype_CONNECTED){
    wsConnectedClients++;
    String gameId=activeGameId;
    if(gameId!=""){SignalOutbox snap=makeStateSnapshot(gameId,255);String js=wsStateJson(snap);wsServer.sendTXT(num,js);}
  } else if(type==WStype_DISCONNECTED){
    if(wsConnectedClients>0)wsConnectedClients--;
    // LAN dropped — push full state to Supabase so website recovers via cloud
    if(wsConnectedClients==0&&activeGameId!=""&&!localOnlyMode){
      queueFullStateSync(activeGameId);
    }
  }
}

String wsClockJson(const SignalOutbox& msg){
  return "{\"event\":\"clock\",\"payload\":{\"action\":\"CLOCK_TICK\""
    ",\"deviceId\":\""+deviceId+"\""
    ",\"gameId\":\""+String(msg.gameId)+"\""
    ",\"minutes\":"+String(msg.mainMin)+
    ",\"seconds\":"+String(msg.mainSec)+
    ",\"shotClock\":"+String(msg.shotClock)+
    ",\"gameRunning\":"+String(!msg.paused?"true":"false")+
    ",\"period\":"+String(msg.period)+
    ",\"timestamp\":"+getTimestampStr()+"}}";
}

void wsTaskCode(void* parameter){
  wsServer.begin();wsServer.onEvent(onWsEvent);
  for(;;){wsServer.loop();vTaskDelay(pdMS_TO_TICKS(1));}
}

void networkTaskCode_Online(void* parameter){
  vTaskDelay(pdMS_TO_TICKS(2000));
  if(WiFi.status()==WL_CONNECTED)supaConnect();
  unsigned long lastHeartbeat=0,lastPoll=0,lastWifiCheck=0,lastAbsState=0;
  bool wifiWasDown=false;
  for(;;){
    unsigned long now=millis();
    if(now-lastWifiCheck>1000){
      lastWifiCheck=now;
      if(WiFi.status()!=WL_CONNECTED){
        if(!wifiWasDown){supaDisconnect();wifiWasDown=true;}
        WiFi.reconnect();vTaskDelay(pdMS_TO_TICKS(WIFI_RECONNECT_INTERVAL_MS));continue;
      } else if(wifiWasDown){wifiWasDown=false;supaConnect();}
    }
    if(WiFi.status()!=WL_CONNECTED){vTaskDelay(pdMS_TO_TICKS(50));continue;}

    // Drain WS queue — instant LAN path
    SignalOutbox wsMsg;
    while(xQueueReceive(wsQueue,&wsMsg,0)==pdTRUE){
      String json;
      if(wsMsg.action==254)     json=wsClockJson(wsMsg);
      else if(wsMsg.action==255)json=wsStateJson(wsMsg);
      else                      json=wsSignalJson(wsMsg.action,String(wsMsg.gameId));
      wsServer.broadcastTXT(json);
    }

    // Drain Supabase queue — cloud path (skipped entirely when localOnlyMode)
    if(!localOnlyMode){
      SignalOutbox netMsg;
      if(xQueueReceive(signalQueue,&netMsg,pdMS_TO_TICKS(5))==pdTRUE){
        if(netMsg.action==255)broadcastAbsoluteState_Online(netMsg);
        else if(netMsg.action!=254)sendSignal_Online(netMsg.action,String(netMsg.gameId));
        while(xQueueReceive(signalQueue,&netMsg,0)==pdTRUE){
          if(netMsg.action==255)broadcastAbsoluteState_Online(netMsg);
          else if(netMsg.action!=254)sendSignal_Online(netMsg.action,String(netMsg.gameId));
        }
        lastAbsState=now;
      }
      if(now-lastAbsState>5000&&activeGameId!=""){
        queueFullStateSync(activeGameId);
        lastAbsState=now;
      }
    }
    if(now-lastPoll>2000){pollDeviceState_Online();lastPoll=now;}
    if(now-lastHeartbeat>8000){sendHeartbeat_Online();lastHeartbeat=now;}
  }
}

// ─── Online connect progress screen ──────────────────────────────
void _drawConnectStep(int active,const char* detail=""){
  tft.fillScreen(M_BG);
  tft.fillRect(0,0,DW,22,M_SURFACE);
  tft.drawFastHLine(0,22,DW,M_ONLINE);
  tft.setTextSize(1);tft.setTextColor(M_ONLINE,M_SURFACE);
  tft.setCursor(8,8);tft.print("ONLINE MODE");
  tft.setTextColor(M_MUTED,M_SURFACE);tft.setCursor(DW-24,8);tft.print("FW9");

  const char* labels[]={"WIFI","REGISTER","READY"};
  int pillW=84,pillH=28,pillGap=8,startX=(DW-3*pillW-2*pillGap)/2;
  for(int i=0;i<3;i++){
    int px=startX+i*(pillW+pillGap);
    bool done=(i<active),curr=(i==active);
    uint16_t bg=done?M_SUCCESS:curr?M_ONLINE:M_SURFACE;
    uint16_t br=done?M_SUCCESS:curr?M_ONLINE:M_BORDER;
    if(!done&&!curr){bg=M_SURFACE;}
    tft.fillRoundRect(px,36,pillW,pillH,6,bg);
    tft.drawRoundRect(px,36,pillW,pillH,6,br);
    tft.fillCircle(px+14,36+14,8,done?M_BG:curr?M_BG:M_BORDER);
    if(done){tft.setTextSize(1);tft.setTextColor(M_SUCCESS,M_BG);tft.setCursor(px+10,36+10);tft.print("OK");}
    else{tft.setTextSize(1);tft.setTextColor(curr?M_ONLINE:M_MUTED,M_BG);tft.setCursor(px+11,36+10);char n[2];n[0]='1'+i;n[1]=0;tft.print(n);}
    int lw=(int)strlen(labels[i])*6;
    tft.setTextSize(1);tft.setTextColor(done?M_BG:curr?M_BG:M_MUTED,bg);
    tft.setCursor(px+(pillW-lw)/2,36+18);tft.print(labels[i]);
  }

  if(active<2){
    // Single centered animated line — cleaner than old 2-line block
    tft.fillRect(0,68,DW,50,M_BG);
    const char* stepMsg=(active==0)?"Connecting to WiFi":"Registering device";
    int frame=(int)(millis()/350)%4;
    char animBuf[28];snprintf(animBuf,28,"%s%.*s",stepMsg,frame,"...");
    int lw=(int)strlen(animBuf)*6;
    tft.setTextSize(1);tft.setTextColor(M_ONLINE,M_BG);
    tft.setCursor((DW-lw)/2,78);tft.print(animBuf);
    if(strlen(detail)>0){
      int dw2=(int)strlen(detail)*6;
      tft.setTextSize(1);tft.setTextColor(M_DIM,M_BG);
      tft.setCursor((DW-dw2)/2,96);tft.print(detail);
    }
  }

  if(active==2){
    // Pair code display — layout ensures no overlap
    // "PAIR CODE" label at y=68
    tftCtr("PAIR CODE",68,1,M_MUTED);
    // Large code at y=78 — size 7 = 56px tall, ends at y=134
    int cw=(int)deviceId.length()*42;
    tft.setTextSize(7);tft.setTextColor(M_ONLINE,M_BG);
    tft.setCursor((DW-cw)/2,78);tft.print(deviceId.c_str());
    // WiFi IP below code (y=148, clear of code)
    if(WiFi.status()==WL_CONNECTED){
      String ipDisp=WiFi.localIP().toString()+":81";
      int iw=(int)ipDisp.length()*6;
      tft.setTextSize(1);tft.setTextColor(M_MUTED,M_BG);
      tft.setCursor((DW-iw)/2,148);tft.print(ipDisp.c_str());
    }
    tftCtr("enter on website to pair",170,1,M_DIM);
    tftCtr("PRESS I TO CONTINUE",192,1,M_MUTED);
  }

  tft.fillRect(0,DH-22,DW,22,M_SURFACE);
  tft.drawFastHLine(0,DH-22,DW,M_BORDER);
  tft.setTextSize(1);tft.setTextColor(M_MUTED,M_SURFACE);
  tft.setCursor(8,DH-14);tft.print("HOLD I 3.5S = BACK TO MENU");
}

void bootOnlineMode(){
  cfg.sport=SPORT_BASKETBALL;cfg.quarters=4;cfg.quarterMin=10;cfg.shotClockDur=24;
  strncpy(cfg.teamAName,"HOME",11);strncpy(cfg.teamBName,"AWAY",11);

  _drawConnectStep(0);
  WiFi.mode(WIFI_STA);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  {static const char _sc[]="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";char code[5];uint32_t rnd=esp_random();
   for(int i=0;i<4;i++)code[i]=_sc[(rnd>>(i*5))&0x1F];code[4]='\0';deviceId=String(code);}

  // Part A: try saved credentials first (avoids config portal restart)
  WiFi.begin();
  {unsigned long t0=millis();
  while(WiFi.status()!=WL_CONNECTED&&millis()-t0<8000){delay(100);}}

  bool connected=(WiFi.status()==WL_CONNECTED);

  // Part B: if saved creds failed, open portal with setBreakAfterConfig(true)
  if(!connected){
    WiFiManager wm;wm.setConnectTimeout(15);wm.setConfigPortalTimeout(180);
    wm.setAPCallback(configModeCallback);wm.setSaveConnectTimeout(10);
    wm.setBreakAfterConfig(true); // prevents ESP.restart() after portal save
    wm.autoConnect("THE_BOX_SETUP");
    // Portal returns false after save — attempt direct connect
    WiFi.begin();
    {unsigned long t0=millis();
    while(WiFi.status()!=WL_CONNECTED&&millis()-t0<10000){delay(100);}}
    connected=(WiFi.status()==WL_CONNECTED);
  }

  if(!connected){
    tft.fillScreen(M_BG);
    tft.fillRect(0,0,DW,22,M_SURFACE);tft.drawFastHLine(0,22,DW,M_DANGER);
    tft.setTextSize(1);tft.setTextColor(M_DANGER,M_SURFACE);tft.setCursor(8,8);tft.print("WIFI FAILED");
    tft.setTextSize(2);tft.setTextColor(M_DIM,M_BG);tftCtr("Could not connect to WiFi",80,2,M_DIM);
    tftCtr("I = RETRY",140,1,M_ONLINE);tftCtr("H = BACK TO MENU",158,1,M_MUTED);
    unsigned long w=millis();
    while(millis()-w<8000){for(Button* b:allBtns)b->update();if(btnI.pressed){btnI.consume();break;}if(btnH.pressed){btnH.consume();break;}delay(10);}
    resetAllButtons();currentMode=showModeSelect();bootModeFromSelect();return;
  }

  String ipStr=WiFi.localIP().toString();
  _drawConnectStep(1,ipStr.c_str());
  if(!registerDevice_Online()){
    tft.fillScreen(M_BG);
    tft.fillRect(0,0,DW,22,M_SURFACE);tft.drawFastHLine(0,22,DW,M_DANGER);
    tft.setTextSize(1);tft.setTextColor(M_DANGER,M_SURFACE);tft.setCursor(8,8);tft.print("REGISTER FAILED");
    tft.setTextSize(1);tft.setTextColor(M_DIM,M_BG);tftCtr("Could not reach server",80,1,M_DIM);
    tftCtr("I = RETRY  |  H = MENU",100,1,M_MUTED);
    unsigned long w=millis();
    while(millis()-w<8000){for(Button* b:allBtns)b->update();if(btnI.pressed){btnI.consume();break;}if(btnH.pressed){btnH.consume();break;}delay(10);}
    resetAllButtons();currentMode=showModeSelect();bootModeFromSelect();return;
  }

  if(signalQueue==NULL)signalQueue=xQueueCreate(SIGNAL_QUEUE_SIZE,sizeof(SignalOutbox));
  if(wsQueue==NULL)wsQueue=xQueueCreate(SIGNAL_QUEUE_SIZE,sizeof(SignalOutbox));
  if(NetworkTask!=NULL){vTaskDelete(NetworkTask);NetworkTask=NULL;delay(50);}
  xTaskCreatePinnedToCore(networkTaskCode_Online,"NetTask",16384,NULL,1,&NetworkTask,0);
  if(WSTask!=NULL){vTaskDelete(WSTask);WSTask=NULL;delay(50);}
  xTaskCreatePinnedToCore(wsTaskCode,"WSTask",8192,NULL,2,&WSTask,1);
  if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
    liveState.scoreA=0;liveState.scoreB=0;liveState.shotClock=24;
    liveState.mainMin=10;liveState.mainSec=0;liveState.paused=true;
    liveState.period=1;liveState.isLocked=false;
    liveState.setsA=0;liveState.setsB=0;liveState.currentSet=1;
    xSemaphoreGive(stateMutex);
  }

  _drawConnectStep(2); // IP shown inside step 2 layout — no arg needed
  {unsigned long w=millis();
  for(Button* b:allBtns){b->update();b->consume();}
  while(millis()-w<3000){for(Button* b:allBtns)b->update();if(btnI.pressed){btnI.consume();break;}delay(10);}}
  _waitingDrawn=false;_pairedDrawn=false;
  activeGameId="";deviceState=0;tUI=0;tSec=millis();resetPrevState();resetAllButtons();
}

void loopOnlineMode(){
  if(checkJSettings()){_waitingDrawn=false;_pairedDrawn=false;return;}
  int localState=0;String localGameId="";bool localLocked=false;
  if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
    localState=deviceState;localGameId=activeGameId;localLocked=liveState.isLocked;
    xSemaphoreGive(stateMutex);
  }
  static int prevState=-1;
  if(localState!=prevState){
    prevState=localState;tUI=0;resetPrevState();
    _waitingDrawn=false;_pairedDrawn=false;
  }
  if(localState==0){if(millis()-tUI>=500){drawWaiting();tUI=millis();}return;}
  if(localState==1){if(millis()-tUI>=800){drawPaired();tUI=millis();}return;}
  uint8_t action=ACT_NONE;
  if(!localLocked)action=readButtonAction();
  bool dirty=(action!=ACT_NONE&&action!=ACT_UNDO);
  if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
    if(action!=ACT_NONE)applyAction(action);
    tickLocalClock();if(dirty)saveAtomicState();
    xSemaphoreGive(stateMutex);
  }
  if(action!=ACT_NONE){
    queueSignal_Online(action,localGameId);
    SignalOutbox snap=makeStateSnapshot(localGameId,255);
    pushQueue(wsQueue,snap);
  }
  if(millis()-tUI>=150){drawBB();tUI=millis();}
}

void bootPiConnectMode(){
  if(!runLocalSetupFlow()){currentMode=showModeSelect();bootModeFromSelect();return;}
  while(true){
    _resetStatusCard();
    drawStatusCard("INITIALIZING","setting up direct link","",M_PI,statusAnim());
    if(espNowRxQueue==NULL)espNowRxQueue=xQueueCreate(5,sizeof(ESPNowPacket));
    WiFi.mode(WIFI_STA);WiFi.disconnect();
    esp_wifi_set_promiscuous(true);esp_wifi_set_channel(ESPNOW_CHANNEL,WIFI_SECOND_CHAN_NONE);esp_wifi_set_promiscuous(false);
    if(esp_now_init()!=ESP_OK){
      _resetStatusCard();drawStatusCard("ERROR","esp-now init failed","",M_DANGER,-1);delay(3000);
      currentMode=showModeSelect();bootModeFromSelect();return;
    }
    esp_now_register_recv_cb(onEspNowReceive);
    esp_now_peer_info_t pi;memset(&pi,0,sizeof(pi));memcpy(pi.peer_addr,broadcastMac,6);
    pi.channel=ESPNOW_CHANNEL;pi.encrypt=false;
    if(!esp_now_is_peer_exist(broadcastMac))esp_now_add_peer(&pi);
    espNowReady=true;piPaired=false;receiverPeerAdded=false;ackPending=false;
    unsigned long searchStart=millis(),lastHello=0;
    bool found=false;
    while(!found&&millis()-searchStart<8000){
      if(ackPending){
        ackPending=false;
        if(ackRssi>=ESPNOW_RSSI_THRESHOLD){
          memcpy(receiverMac,(void*)ackSrcMac,6);esp_now_del_peer(broadcastMac);
          esp_now_peer_info_t peer;memset(&peer,0,sizeof(peer));memcpy(peer.peer_addr,receiverMac,6);
          peer.channel=ESPNOW_CHANNEL;peer.encrypt=false;
          if(esp_now_add_peer(&peer)==ESP_OK){receiverPeerAdded=true;piPaired=true;found=true;}
        } else {
          _resetStatusCard();drawStatusCard("WEAK SIGNAL","move closer to pi box","",M_WARN,-1);delay(800);_resetStatusCard();
        }
      }
      if(millis()-lastHello>=300){
        sendHello();lastHello=millis();
        drawStatusCard("SEARCHING","looking for pi box","press I to cancel",M_PI,statusAnim());
      }
      for(Button* b:allBtns)b->update();
      if(btnI.pressed){btnI.consume();esp_now_deinit();espNowReady=false;
      currentMode=showModeSelect();bootModeFromSelect();return;}
      delay(20);
    }
    if(piPaired){_resetStatusCard();drawStatusCard("CONNECTED","pi box linked","",M_PI,-1);delay(800);break;}
    _resetStatusCard();
    drawStatusCard("NOT FOUND","pi not detected","I=RETRY  H=BACK",M_DANGER,-1);
    bool retry=false;
    unsigned long w=millis();
    while(millis()-w<5000){
      for(Button* b:allBtns)b->update();
      if(btnI.pressed){btnI.consume();retry=true;break;}
      if(btnH.pressed){btnH.consume();break;}
      delay(10);
    }
    esp_now_deinit();espNowReady=false;
    if(!retry){currentMode=showModeSelect();bootModeFromSelect();return;}
  }
}

void loopPiConnectMode(){
  if(checkJSettings()){resetPrevState();tUI=0;return;}
  ESPNowPacket rxPkt;
  while(xQueueReceive(espNowRxQueue,&rxPkt,0)==pdTRUE){
    if(rxPkt.type==PKT_SYNC&&xSemaphoreTake(stateMutex,portMAX_DELAY)){
      liveState.scoreA=rxPkt.scoreA;liveState.scoreB=rxPkt.scoreB;
      liveState.mainMin=rxPkt.mainMin;liveState.mainSec=rxPkt.mainSec;
      liveState.shotClock=rxPkt.shotClock;liveState.period=rxPkt.period;
      liveState.paused=(rxPkt.paused==1);saveAtomicState();xSemaphoreGive(stateMutex);
    }
  }
  if(!piPaired){
    if(millis()-tUI>=1000){tUI=millis();
      drawStatusCard("LOST LINK","reconnecting..","",M_WARN,statusAnim());sendHello();}
    return;
  }
  uint8_t action=readButtonAction();
  if(action!=ACT_NONE)sendEspNowCmd(action);
  if(cfg.sport==SPORT_NET&&(action==ACT_NET_SET_WIN_A||action==ACT_NET_SET_WIN_B))processNetWins();
  if(millis()-tUI>=150){drawGameScreen();tUI=millis();}
}

String lookupTvCode(const char* code){
  WiFiClientSecure cli;cli.setInsecure();HTTPClient http;
  http.begin(cli,String("https://")+SUPABASE_HOST+"/rest/v1/tv_displays?tv_code=eq."+String(code)+"&select=game_code,status,last_seen");
  http.addHeader("apikey",SUPABASE_ANON_KEY);
  http.addHeader("Authorization",String("Bearer ")+SUPABASE_ANON_KEY);
  http.addHeader("Accept","application/json");
  String result="";
  if(http.GET()==200){
    DynamicJsonDocument doc(512);
    if(!deserializeJson(doc,http.getString())&&doc.is<JsonArray>()&&doc.size()>0){
      JsonObject row=doc[0].as<JsonObject>();String st=row["status"]|"";String gc=row["game_code"]|"";
      if(st=="casting"&&gc!=""&&gc!="null")result=gc;
    }
  }
  http.end();return result;
}

void bootPiCodeMode(){
  _resetStatusCard();
  drawStatusCard("CONNECTING","joining wifi...","",M_PI,statusAnim());
  WiFi.mode(WIFI_STA);
  {uint8_t mac[6];WiFi.macAddress(mac);char buf[5];sprintf(buf,"%02X%02X",mac[4],mac[5]);deviceId=String(buf);}

  // Part A: try saved credentials first
  WiFi.begin();
  {unsigned long t0=millis();
  while(WiFi.status()!=WL_CONNECTED&&millis()-t0<8000){delay(100);}}

  bool piConnected=(WiFi.status()==WL_CONNECTED);

  // Part B: portal with setBreakAfterConfig(true) if needed
  if(!piConnected){
    WiFiManager wm;wm.setConnectTimeout(15);wm.setConfigPortalTimeout(180);
    wm.setAPCallback(configModeCallback);wm.setBreakAfterConfig(true);
    wm.autoConnect("THE_BOX_SETUP");
    WiFi.begin();
    {unsigned long t0=millis();
    while(WiFi.status()!=WL_CONNECTED&&millis()-t0<10000){delay(100);}}
    piConnected=(WiFi.status()==WL_CONNECTED);
  }

  if(!piConnected){
    _resetStatusCard();
    drawStatusCard("WIFI FAILED","press I to retry","",M_DANGER,-1);
    unsigned long w=millis();while(millis()-w<5000){for(Button* b:allBtns)b->update();if(btnI.pressed){btnI.consume();break;}delay(10);}
    currentMode=showModeSelect();bootModeFromSelect();return;
  }
  _resetStatusCard();drawStatusCard("REGISTERING","please wait","",M_PI,statusAnim());
  registerDevice_Online();
  while(true){
    if(showTvCodeEntry()){currentMode=showModeSelect();bootModeFromSelect();return;}
    _resetStatusCard();
    drawStatusCard("LOOKING UP",piTvCode,"please wait",M_PI,statusAnim());
    String gameCode=lookupTvCode(piTvCode);
    if(gameCode==""){
      _resetStatusCard();
      drawStatusCard("NOT FOUND","no active cast","try again",M_DANGER,-1);
      delay(2000);continue;
    }
    activeGameId=gameCode;deviceState=2;
    char gcShort[8];int gl=gameCode.length();strncpy(gcShort,gameCode.c_str()+(gl>6?gl-6:0),7);
    _resetStatusCard();drawStatusCard("LINKED",piTvCode,gcShort,M_SUCCESS,-1);
    delay(1500);break;
  }
  if(!runLocalSetupFlow()){currentMode=showModeSelect();bootModeFromSelect();return;}
  if(signalQueue==NULL)signalQueue=xQueueCreate(SIGNAL_QUEUE_SIZE,sizeof(SignalOutbox));
  if(NetworkTask!=NULL){vTaskDelete(NetworkTask);NetworkTask=NULL;}
  xTaskCreatePinnedToCore(networkTaskCode_Online,"PiCodeNet",16384,NULL,1,&NetworkTask,0);
  tSec=millis();tUI=0;resetPrevState();resetAllButtons();
}

void loopPiCodeMode(){
  if(checkJSettings()){resetPrevState();tUI=0;return;}
  String localGameId=activeGameId;
  uint8_t action=readButtonAction();
  bool dirty=(action!=ACT_NONE&&action!=ACT_UNDO);
  if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
    if(action!=ACT_NONE)applyAction(action);
    if(cfg.sport==SPORT_BASKETBALL)tickLocalClock();
    if(dirty)saveAtomicState();xSemaphoreGive(stateMutex);
  }
  if(action!=ACT_NONE){
    queueSignal_Online(action,localGameId);
    SignalOutbox snap=makeStateSnapshot(localGameId,255);
    pushQueue(wsQueue,snap);
  }
  if(cfg.sport==SPORT_NET&&(action==ACT_NET_SET_WIN_A||action==ACT_NET_SET_WIN_B))processNetWins();
  if(millis()-tUI>=150){drawGameScreen();tUI=millis();}
}

void bootOfflineMode(){if(!runLocalSetupFlow()){currentMode=showModeSelect();bootModeFromSelect();}}

void loopOfflineMode(){
  if(checkJSettings()){resetPrevState();tUI=0;return;}
  uint8_t action=readButtonAction();
  bool dirty=(action!=ACT_NONE&&action!=ACT_UNDO);
  if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
    if(action!=ACT_NONE)applyAction(action);
    if(cfg.sport==SPORT_BASKETBALL)tickLocalClock();
    if(dirty)saveAtomicState();xSemaphoreGive(stateMutex);
  }
  if(cfg.sport==SPORT_NET&&(action==ACT_NET_SET_WIN_A||action==ACT_NET_SET_WIN_B))processNetWins();
  if(millis()-tUI>=150){drawGameScreen();tUI=millis();}
}

void processNetWins(){
  int winner=0;
  if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
    winner=checkSetWin();
    if(winner==1){liveState.setsA++;liveState.scoreA=0;liveState.scoreB=0;liveState.currentSet++;saveAtomicState();}
    else if(winner==2){liveState.setsB++;liveState.scoreA=0;liveState.scoreB=0;liveState.currentSet++;saveAtomicState();}
    xSemaphoreGive(stateMutex);
  }
  if(winner==0)return;
  int stA=0,stB=0;
  if(xSemaphoreTake(stateMutex,pdMS_TO_TICKS(5))){stA=liveState.setsA;stB=liveState.setsB;xSemaphoreGive(stateMutex);}
  buz.pattern(3);
  if(stA>=cfg.setsToWin||stB>=cfg.setsToWin){
    const char* winName=(stA>stB)?cfg.teamAName:cfg.teamBName;
    bool isA=(stA>stB);
    buz.pattern(3);delay(300);buz.pattern(3);
    while(true){
      drawNetMatchWon(winName,isA);
      for(Button* b:allBtns)b->update();buz.update();
      if(btnI.pressed){btnI.consume();
        if(xSemaphoreTake(stateMutex,portMAX_DELAY)){
          liveState.scoreA=0;liveState.scoreB=0;liveState.setsA=0;liveState.setsB=0;liveState.currentSet=1;
          saveAtomicState();xSemaphoreGive(stateMutex);}
        resetPrevState();break;}
      delay(10);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MODE ROUTING + RETURN
// ═══════════════════════════════════════════════════════════════════
void bootModeFromSelect(){
  if(currentMode==MODE_ONLINE)bootOnlineMode();
  else if(currentMode==MODE_PI_CONNECT)bootPiConnectMode();
  else if(currentMode==MODE_PI_CODE)bootPiCodeMode();
  else bootOfflineMode();
}

bool checkModeSelectReturn(){
  if(!btnI.heldFor(1000))return false;
  unsigned long holdStart=btnI.pressTime;
  const unsigned long HOLD_MS=3500;
  unsigned long held=millis()-holdStart;
  if(held<HOLD_MS){
    int barW=80,barX=DW-barW-4,barY=DH-10;
    int filled=(int)((held*barW)/HOLD_MS);
    tft.fillRect(barX,barY,filled,4,M_ONLINE);
    tft.fillRect(barX+filled,barY,barW-filled,4,M_SURFACE);
    return false;
  }
  if(currentMode==MODE_ONLINE||currentMode==MODE_PI_CODE){
    if(NetworkTask!=NULL){vTaskDelete(NetworkTask);NetworkTask=NULL;}
    if(WSTask!=NULL){vTaskDelete(WSTask);WSTask=NULL;}
    supaDisconnect();
    if(signalQueue!=NULL){vQueueDelete(signalQueue);signalQueue=NULL;}
    if(wsQueue!=NULL){vQueueDelete(wsQueue);wsQueue=NULL;}
    wsConnectedClients=0;
    WiFi.disconnect();
  } else if(currentMode==MODE_PI_CONNECT){
    esp_now_deinit();espNowReady=false;
    if(espNowRxQueue!=NULL){vQueueDelete(espNowRxQueue);espNowRxQueue=NULL;}
  }
  delay(200);resetAllButtons();resetPrevState();_resetStatusCard();
  _waitingDrawn=false;_pairedDrawn=false;
  currentMode=showModeSelect();bootModeFromSelect();return true;
}

// ═══════════════════════════════════════════════════════════════════
//  SETUP + LOOP
// ═══════════════════════════════════════════════════════════════════
void setup(){
  Serial.begin(115200);
  stateMutex=xSemaphoreCreateMutex();
  pinMode(BUZZER,OUTPUT);digitalWrite(BUZZER,LOW);
  SPI.begin(TFT_SCK,-1,TFT_MOSI);
  tft.init(240,320);tft.setRotation(1);tft.fillScreen(0);
  ledcAttach(TFT_BL,5000,8);ledcWrite(TFT_BL,220);
  prefs.begin("box_state",false);
  if(prefs.getBytesLength("game_data")==sizeof(GameStateData))
    prefs.getBytes("game_data",&liveState,sizeof(GameStateData));
  else{
    liveState.scoreA=0;liveState.scoreB=0;liveState.shotClock=24;
    liveState.mainMin=10;liveState.mainSec=0;liveState.paused=true;
    liveState.period=1;liveState.isLocked=false;
    liveState.setsA=0;liveState.setsB=0;liveState.currentSet=1;
  }
  cfg.sport=SPORT_BASKETBALL;cfg.ptsToWin=21;cfg.setsToWin=2;
  cfg.quarters=4;cfg.quarterMin=10;cfg.shotClockDur=24;
  strncpy(cfg.teamAName,"HOME",11);strncpy(cfg.teamBName,"AWAY",11);
  for(Button* b:allBtns)b->begin();
  uint64_t chipId=ESP.getEfuseMac();
  char buf[5];sprintf(buf,"%04X",(uint16_t)(chipId>>32));
  deviceId=String(buf);
  showSplash();
  currentMode=showModeSelect();
  bootModeFromSelect();
}

void onEspNowReceive(const esp_now_recv_info_t* info,const uint8_t* data,int len){
  if(len!=sizeof(ESPNowPacket))return;
  ESPNowPacket pkt;memcpy(&pkt,data,sizeof(pkt));
  if(pkt.type==PKT_ACK&&!receiverPeerAdded){memcpy((void*)ackSrcMac,info->src_addr,6);ackRssi=info->rx_ctrl->rssi;ackPending=true;return;}
  if(pkt.type==PKT_SYNC&&espNowRxQueue!=NULL){BaseType_t w=pdFALSE;xQueueSendFromISR(espNowRxQueue,&pkt,&w);portYIELD_FROM_ISR(w);}
}
void sendEspNowCmd(uint8_t a){if(!espNowReady||a==ACT_NONE)return;ESPNowPacket p;memset(&p,0,sizeof(p));p.type=PKT_CMD;p.action=a;uint8_t m[6];WiFi.macAddress(m);memcpy(p.senderMac,m,6);esp_now_send(receiverPeerAdded?receiverMac:broadcastMac,(uint8_t*)&p,sizeof(p));}
void sendHello(){ESPNowPacket h;memset(&h,0,sizeof(h));h.type=PKT_HELLO;uint8_t m[6];WiFi.macAddress(m);memcpy(h.senderMac,m,6);esp_now_send(broadcastMac,(uint8_t*)&h,sizeof(h));}

void loop(){
  for(Button* b:allBtns)b->update();
  buz.update();
  if(checkModeSelectReturn())return;
  switch(currentMode){
    case MODE_ONLINE:     loopOnlineMode();    break;
    case MODE_PI_CONNECT: loopPiConnectMode(); break;
    case MODE_PI_CODE:    loopPiCodeMode();    break;
    case MODE_OFFLINE:    loopOfflineMode();   break;
  }
}
