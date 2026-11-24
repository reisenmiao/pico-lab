#include <Servo.h>

Servo servo;
// Starting pulse widths for the two ends of the 150-degree sweep.
// Adjust these to match the measured travel of your servo.
const int leftUs = 750;
const int rightUs = 2250;

void moveTo(int degrees) {
  servo.writeMicroseconds(map(degrees, 0, 150, leftUs, rightUs));
  delay(20);
}

void setup() {
  Serial.begin(115200);
  servo.attach(16, leftUs, rightUs);  // Orange signal wire on GP16 (physical pin 21).
  moveTo(0);
  delay(500);
}

void loop() {
  Serial.println("Sweep right");
  for (int degrees = 1; degrees <= 150; degrees++) {
    moveTo(degrees);
  }

  Serial.println("Sweep left");
  for (int degrees = 149; degrees >= 0; degrees--) {
    moveTo(degrees);
  }
}
