# THE BOX — Pico W Firmware

MicroPython firmware for the Raspberry Pi Pico W button controller.

## Flashing

1. Hold BOOTSEL on the Pico, plug into USB — it mounts as a USB drive
2. Drag `rp2-pico-w-latest.uf2` onto the drive (from [micropython.org](https://micropython.org/download/RPI_PICO_W/))
3. Pico reboots with MicroPython
4. Use [Thonny IDE](https://thonny.org/) or `mpremote` to copy `main.py`:
   ```bash
   pip install mpremote
   mpremote connect /dev/ttyACM0 fs cp main.py :main.py
   ```
5. Power-cycle the Pico — it auto-runs `main.py` on boot

## Wiring

### UART to Raspberry Pi 4
```
Pico W GP0  (UART TX) ──────────→ Pi GPIO 15 (UART0 RX)
Pico W GND            ──────────→ Pi GND
```
> The Pi's `/dev/serial0` maps to GPIO 14 (TX) / GPIO 15 (RX).
> You only need TX from Pico → RX on Pi (one-directional).

### Push Buttons (active LOW — use internal pull-up)
```
Each button: one leg → GPIO pin, other leg → GND
```

| Button | GPIO | UART Message     | Action                     |
|--------|------|------------------|----------------------------|
| BTN 1  | GP2  | `SCORE_A1`       | Team A +1 (free throw)     |
| BTN 2  | GP3  | `SCORE_A2`       | Team A +2 (field goal)     |
| BTN 3  | GP4  | `SCORE_A3`       | Team A +3 (three-pointer)  |
| BTN 4  | GP5  | `SCORE_B1`       | Team B +1 (free throw)     |
| BTN 5  | GP6  | `SCORE_B2`       | Team B +2 (field goal)     |
| BTN 6  | GP7  | `SCORE_B3`       | Team B +3 (three-pointer)  |
| BTN 7  | GP8  | `CLOCK_TOGGLE`   | Start / stop game clock    |
| BTN 8  | GP9  | `SHOT_CLOCK_24`  | Reset shot clock to 24s    |
| BTN 9  | GP10 | `UNDO`           | Undo last action           |

### Toggle Switch
```
Toggle: one leg → GP11, other leg → GND
Fires SETTINGS on every state change (toggles touch lock/unlock)
```

### LED
```
Built-in Pico W LED (no wiring needed)
Flashes 55ms on every button press as tactile feedback
3 quick flashes on boot
```

## Pico W Pinout Reference (relevant pins)

```
         ┌─────────────┐
    GP0  │ TX ──→ Pi   │  GP1  (UART RX, unused)
    GP2  │ BTN 1  A+1  │  GP3  BTN 2  A+2
    GP4  │ BTN 3  A+3  │  GP5  BTN 4  B+1
    GP6  │ BTN 5  B+2  │  GP7  BTN 6  B+3
    GP8  │ BTN 7  CLK  │  GP9  BTN 8  SHOT
    GP10 │ BTN 9  UNDO │  GP11 TOGGLE
         └─────────────┘
```

## Serial Protocol

All messages are plain ASCII strings terminated with `\n` at 115200 baud.
The Pi daemon reads them via `serialport` and routes to the game state engine.

Boot message: `PICO_READY\n`
Button messages: `SCORE_A1\n`, `CLOCK_TOGGLE\n`, etc.

## Troubleshooting

- **No messages received on Pi**: Check GP0 → Pi GPIO15 connection and GND
- **Enable UART on Pi**: run `sudo raspi-config` → Interface Options → Serial Port → disable login shell, enable hardware UART
- **Verify UART on Pi**: `cat /dev/serial0` while pressing Pico buttons should print the messages
- **Bounce/double-trigger**: increase `BUTTON_DEBOUNCE_MS` in `main.py` (currently 80ms)
