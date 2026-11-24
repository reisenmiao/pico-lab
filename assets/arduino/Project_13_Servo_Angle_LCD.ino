#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

Servo servo;
LiquidCrystal_I2C lcd(0x27, 16, 2);
const int leftUs = 750, rightUs = 2250;  // Chapter 07 sweep endpoints

void showAngle(int degrees) {
  servo.writeMicroseconds(map(degrees, 0, 150, leftUs, rightUs));
  lcd.setCursor(0, 1);
  lcd.print(degrees);
  lcd.write(byte(223));  // Degree symbol on the kit's LCD1602
  lcd.print("  ");       // Erase leftover digits when the angle gets smaller
  delay(25);
}

void setup() {
  Wire.setSDA(0);
  Wire.setSCL(1);
  lcd.init();
  lcd.backlight();
  lcd.print("Servo target");
  servo.attach(16, leftUs, rightUs);
  showAngle(0);
  delay(500);
}

void loop() {
  for (int angle = 1; angle <= 150; angle++) showAngle(angle);
  for (int angle = 149; angle >= 0; angle--) showAngle(angle);
}
