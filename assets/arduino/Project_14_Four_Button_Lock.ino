#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <string.h>

const int buttonPins[] = {2, 3, 4, 5};  // Buttons 1, 2, 3, 4
const char pinCode[] = "1234";
const int unlockAngle = 0;
const int lockAngle = 90;
const int leftUs = 750, rightUs = 2250;  // Same 150-degree scale as Project 13
Servo latch;
LiquidCrystal_I2C lcd(0x27, 16, 2);
bool locked = false;
char entry[sizeof(pinCode)] = {};
unsigned int entered = 0;

void setLatch(bool lock) {
  locked = lock;
  int degrees = locked ? lockAngle : unlockAngle;
  latch.writeMicroseconds(map(degrees, 0, 150, leftUs, rightUs));
  lcd.clear();
  lcd.print(locked ? "Locked   " : "Unlocked ");
  lcd.print(degrees);
  lcd.write(byte(223));
  lcd.setCursor(0, 1);
  lcd.print("PIN: ");
}

int buttonsDown() {
  int mask = 0;
  for (int i = 0; i < 4; i++) {
    if (digitalRead(buttonPins[i]) == LOW) mask |= 1 << i;
  }
  return mask;
}

// Accept one button per press and wait for a stable release before repeating.
int readDigit() {
  int down = buttonsDown();
  if (down == 0) return 0;
  delay(25);
  if (buttonsDown() != down) return 0;
  do {
    while (buttonsDown() != 0) delay(5);
    delay(25);
  } while (buttonsDown() != 0);
  for (int i = 0; i < 4; i++) {
    if (down == (1 << i)) return i + 1;
  }
  return 0;
}

void setup() {
  for (int pin : buttonPins) pinMode(pin, INPUT_PULLUP);
  latch.attach(16, leftUs, rightUs);
  Wire.setSDA(0);
  Wire.setSCL(1);
  lcd.init();
  lcd.backlight();
  setLatch(false);
}

void loop() {
  int digit = readDigit();
  if (!digit) return;
  entry[entered++] = '0' + digit;
  lcd.print('*');
  if (entered < sizeof(pinCode) - 1) return;
  if (strcmp(entry, pinCode) == 0) {
    setLatch(!locked);
  } else {
    lcd.setCursor(0, 1);
    lcd.print("Try again       ");
    delay(700);
    lcd.setCursor(0, 1);
    lcd.print("PIN:            ");
    lcd.setCursor(5, 1);
  }
  entered = 0;
}
