#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <LittleFS.h>
#include <pico/time.h>
#include <algorithm>

// B1-B4 and the SG90 use the same wiring as the four-button PIN lock.
const int keys[] = {2, 3, 4, 5};  // Unit, increase, decrease, start
const int testUnlockPin = 6;      // B5: GP6 (physical pin 9) to GND when pressed
const int unlockedUs = 750;       // 0 degrees
const int lockedUs = 1650;        // 90 degrees
Servo latch;
LiquidCrystal_I2C lcd(0x27, 16, 2);

enum Mode { SET_TIME, CONFIRM, LOCKED, STORAGE_ERROR };
Mode mode = SET_TIME;
const int maxMinutes = 365 * 24 * 60;
const int steps[] = {1, 60, 1440};
int minutes = 1, unit = 0;
uint64_t deadlineMs, nextSaveMs;
uint32_t lastShown = UINT32_MAX;
uint64_t addErrorUntil;
int highlightedKey = 0;
uint64_t highlightUntil;

// A 64 KiB LittleFS partition is selected by the course compiler.
// Only format a completely blank partition on first use.
extern uint8_t _FS_start, _FS_end;
bool openStorage() {
  LittleFS.setConfig(LittleFSConfig(false));
  if (LittleFS.begin()) return true;
  if (&_FS_start == &_FS_end) return false;
  for (uintptr_t p = (uintptr_t)&_FS_start; p < (uintptr_t)&_FS_end; ++p) {
    if (*(const uint8_t*)p != 0xff) return false;
  }
  return LittleFS.format() && LittleFS.begin();
}

struct Record { uint32_t seconds, inverse; };
const char* recordPath = "/phone-timer";

bool restoreSeconds(uint32_t &seconds) {
  if (!LittleFS.exists(recordPath)) return true;
  File f = LittleFS.open(recordPath, "r");
  Record r;
  if (!f || f.size() != sizeof(r) || f.read((uint8_t*)&r, sizeof(r)) != sizeof(r)) return false;
  if (r.inverse != ~r.seconds || r.seconds > maxMinutes * 60U) return false;
  seconds = r.seconds;
  return true;
}

bool saveSeconds(uint32_t seconds) {
  Record r = {seconds, ~seconds};
  const char* temp = "/phone-timer.tmp";
  File f = LittleFS.open(temp, "w");
  if (!f || f.write((const uint8_t*)&r, sizeof(r)) != sizeof(r)) return false;
  f.close();
  return LittleFS.rename(temp, recordPath);
}

// Emit one event per press. Only + and - repeat when held in setup.
int readKey(uint64_t now) {
  static int raw = 0, stable = 0;
  static bool armed = false;
  static uint64_t changed = 0, repeatAt = 0;
  int mask = 0;
  for (int i = 0; i < 4; ++i) {
    if (digitalRead(keys[i]) == LOW) mask |= 1 << i;
  }
  if (mask != raw) { raw = mask; changed = now; }
  if (now - changed < 30) return 0;
  if (raw == 0) { armed = true; stable = 0; return 0; }
  if (raw != stable) {
    stable = raw;
    bool accept = armed;
    armed = false;
    repeatAt = 0;
    if (!accept) return 0;
    for (int i = 0; i < 4; ++i) {
      if (raw == (1 << i)) {
        if (mode == SET_TIME && (i == 1 || i == 2)) repeatAt = now + 500;
        return i + 1;
      }
    }
  }
  if (repeatAt && now >= repeatAt && mode == SET_TIME) {
    repeatAt = now + 125;
    return stable == 2 ? 2 : 3;
  }
  return 0;
}

// Keep every character in its own LCD cell. Only write cells that changed.
void writeRow(int row, const char* text) {
  static char shown[2][16] = {};
  lcd.noCursor();
  for (int col = 0; col < 16; ++col) {
    char ch = *text ? *text++ : ' ';
    if (shown[row][col] != ch) {
      lcd.setCursor(col, row);
      lcd.write((uint8_t)ch);
      shown[row][col] = ch;
    }
  }
}

void markUnit() {
  const int columns[] = {9, 6, 2};  // Minutes, hours, days
  lcd.setCursor(columns[unit], 1);
  lcd.cursor();
}

void showStatus(bool locked) {
  // The right seven cells always label B1-B4: gear, plus, minus, lock.
  char line[] = "Unlocked \x01 + - \x02";
  if (locked) memcpy(line, "Locked  ", 8);
  if (highlightedKey) {
    int col = highlightedKey == 5 ? 15 : 9 + 2 * (highlightedKey - 1);
    line[col] = 2 + highlightedKey;
  }
  writeRow(0, line);
}

void updateHighlight(int key, uint64_t now) {
  if (key) highlightUntil = now + 200;
  else if (now < highlightUntil) return;
  if (key == highlightedKey) return;
  highlightedKey = key;
  showStatus(mode == LOCKED);
  if (mode == SET_TIME || (mode == LOCKED && now >= addErrorUntil)) markUnit();
}

void showTime(uint32_t seconds) {
  char line[17];
  snprintf(line, sizeof(line), "%3lud %02lu:%02lu:%02lu", (unsigned long)(seconds / 86400),
           (unsigned long)(seconds / 3600 % 24), (unsigned long)(seconds / 60 % 60), (unsigned long)(seconds % 60));
  writeRow(1, line);
  markUnit();
}

void showSetup() {
  mode = SET_TIME;
  showStatus(false);
  showTime(minutes * 60U);
}

void storageError() {
  mode = STORAGE_ERROR;
  showStatus(false);
  writeRow(1, "Storage error");
}

void finishCountdown() {
  latch.writeMicroseconds(unlockedUs);
  if (saveSeconds(0)) showSetup();
  else storageError();
}

void startCountdown(uint32_t seconds, uint64_t now) {
  mode = LOCKED;
  unit = 0;  // Start with one-minute extensions.
  deadlineMs = now + seconds * 1000ULL;
  nextSaveMs = now + 300000;
  latch.writeMicroseconds(lockedUs);
  addErrorUntil = 0;
  showStatus(true);
  showTime(seconds);
  lastShown = seconds;
}

void extendCountdown(uint64_t now) {
  const uint64_t limit = now + maxMinutes * 60000ULL;
  const uint64_t extended = std::min<uint64_t>(deadlineMs + steps[unit] * 60000ULL, limit);
  if (extended <= deadlineMs || (limit - deadlineMs) < 1000) return;
  uint32_t seconds = (extended - now + 999) / 1000;
  if (!saveSeconds(seconds)) {
    writeRow(1, "Add failed");
    addErrorUntil = now + 2000;
    lastShown = UINT32_MAX;
    return;
  }
  deadlineMs = extended;
  nextSaveMs = now + 300000;
  addErrorUntil = 0;
}

void setup() {
  for (int pin : keys) pinMode(pin, INPUT_PULLUP);
  pinMode(testUnlockPin, INPUT_PULLUP);
  Wire.setSDA(0); Wire.setSCL(1);
  lcd.init(); lcd.backlight();
  uint8_t gear[8] = {0b00100, 0b10101, 0b01110, 0b11011, 0b01110, 0b10101, 0b00100, 0};
  uint8_t lockIcon[8] = {0b01110, 0b01010, 0b01010, 0b11111, 0b10001, 0b10001, 0b11111, 0};
  lcd.createChar(1, gear);
  lcd.createChar(2, lockIcon);
  uint8_t plus[8] = {0, 4, 4, 31, 4, 4, 0, 0};
  uint8_t minus[8] = {0, 0, 0, 31, 0, 0, 0, 0};
  uint8_t openLock[8] = {14, 10, 8, 31, 17, 17, 31, 0};
  const uint8_t* icons[] = {gear, plus, minus, lockIcon, openLock};
  for (int i = 0; i < 5; ++i) {
    uint8_t inverse[8];
    for (int row = 0; row < 8; ++row) inverse[row] = icons[i][row] ^ 0x1f;
    lcd.createChar(3 + i, inverse);
  }
  uint32_t seconds = 0;
  bool ready = openStorage() && restoreSeconds(seconds);
  bool testUnlock = digitalRead(testUnlockPin) == LOW;
  latch.attach(16, 750, 2250, ready && seconds && !testUnlock ? lockedUs : unlockedUs);
  if (!ready) storageError();
  else if (seconds && testUnlock) finishCountdown();
  else if (seconds) startCountdown(seconds, time_us_64() / 1000);
  else showSetup();
}

void loop() {
  uint64_t now = time_us_64() / 1000;
  int key = readKey(now);
  // B5 takes priority, even if another key is held. Holding it inhibits locking.
  bool testPressed = digitalRead(testUnlockPin) == LOW;
  static bool testHeld = false;
  updateHighlight(testPressed ? (testHeld ? 0 : 5) : key, now);
  testHeld = testPressed;
  if (testPressed) {
    if (mode == LOCKED) finishCountdown();
    else if (mode == CONFIRM) showSetup();
    return;
  }
  if (mode == SET_TIME) {
    if (!key) return;
    if (key == 4) {
      mode = CONFIRM;
      deadlineMs = now + 5000;
      lastShown = UINT32_MAX;
      lcd.noCursor();
    } else {
      if (key == 1) unit = (unit + 1) % 3;
      if (key == 2) minutes = min(maxMinutes, minutes + steps[unit]);
      if (key == 3) minutes = max(1, minutes - steps[unit]);
      showSetup();
    }
    return;
  }
  if (mode == STORAGE_ERROR) return;
  uint32_t left = now >= deadlineMs ? 0 : (deadlineMs - now + 999) / 1000;
  if (mode == CONFIRM) {
    if (key) { showSetup(); return; }
    if (!left) {
      if (saveSeconds(minutes * 60U)) startCountdown(minutes * 60U, time_us_64() / 1000);
      else storageError();
    } else if (left != lastShown) {
      char line[17];
      snprintf(line, sizeof(line), "Locks in %u s", (unsigned)left);
      writeRow(1, line);
      lastShown = left;
    }
    return;
  }
  if (!left) {
    finishCountdown();
    return;
  }
  if (key == 1) {
    unit = (unit + 1) % 3;
    if (now >= addErrorUntil) markUnit();
  } else if (key == 2) {
    extendCountdown(now);
    left = (deadlineMs - now + 999) / 1000;
  }
  if (now >= nextSaveMs) {
    bool saved = saveSeconds(left);
    nextSaveMs = now + (saved ? 300000 : 30000);
  }
  if (left != lastShown && now >= addErrorUntil) {
    showTime(left);
    lastShown = left;
  }
}
