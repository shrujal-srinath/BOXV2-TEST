# pico-firmware/main.py — THE BOX Button Controller
# Raspberry Pi Pico W firmware (MicroPython)
# ═══════════════════════════════════════════════════════════════
# Reads 9 push buttons + 1 toggle switch.
# Sends UART messages over GP0 at 115200 baud → Raspberry Pi 4.
#
# PHYSICAL WIRING
# ───────────────
# Pico GP0 (UART TX) → Pi GPIO 15 (UART RX, /dev/serial0)
# Pico GND           → Pi GND
# All buttons: one terminal to GPIO pin, other to GND
#              (internal pull-up — active LOW when pressed)
# Toggle switch: one terminal to GP11, other to GND
#
# BUTTON LAYOUT
# ─────────────
#  HOME (Team A)               AWAY (Team B)
#  [+1 FT]  [+2 FG]  [+3 3PT] [+1 FT]  [+2 FG]  [+3 3PT]
#  GP2      GP3      GP4      GP5      GP6      GP7
#
#  [CLOCK]  [SHOT24] [UNDO]
#  GP8      GP9      GP10
#
#  [TOGGLE SWITCH] — GP11 (toggle: lock / unlock touchscreen)
# ═══════════════════════════════════════════════════════════════

import machine
import utime

# ── UART — sends to Pi 4 /dev/serial0 ────────────────────────
uart = machine.UART(0, baudrate=115200, tx=machine.Pin(0), rx=machine.Pin(1))

# ── Onboard LED (feedback flash on button press) ──────────────
led = machine.Pin("LED", machine.Pin.OUT)

# ── Debounce timing ───────────────────────────────────────────
BUTTON_DEBOUNCE_MS = 80   # push buttons: 80ms (fast taps welcome)
TOGGLE_DEBOUNCE_MS = 150  # toggle switch: slightly longer

# ── Button definitions ────────────────────────────────────────
# (GPIO pin, UART message)
BUTTONS = [
    (machine.Pin(2,  machine.Pin.IN, machine.Pin.PULL_UP), "SCORE_A1"),
    (machine.Pin(3,  machine.Pin.IN, machine.Pin.PULL_UP), "SCORE_A2"),
    (machine.Pin(4,  machine.Pin.IN, machine.Pin.PULL_UP), "SCORE_A3"),
    (machine.Pin(5,  machine.Pin.IN, machine.Pin.PULL_UP), "SCORE_B1"),
    (machine.Pin(6,  machine.Pin.IN, machine.Pin.PULL_UP), "SCORE_B2"),
    (machine.Pin(7,  machine.Pin.IN, machine.Pin.PULL_UP), "SCORE_B3"),
    (machine.Pin(8,  machine.Pin.IN, machine.Pin.PULL_UP), "CLOCK_TOGGLE"),
    (machine.Pin(9,  machine.Pin.IN, machine.Pin.PULL_UP), "SHOT_CLOCK_24"),
    (machine.Pin(10, machine.Pin.IN, machine.Pin.PULL_UP), "UNDO"),
]

TOGGLE = machine.Pin(11, machine.Pin.IN, machine.Pin.PULL_UP)

# ── State ────────────────────────────────────────────────────
btn_last_ms   = [0] * len(BUTTONS)   # per-button debounce timestamp
toggle_state  = TOGGLE.value()        # 1 = not toggled (pull-up), 0 = toggled
toggle_last_ms = 0


def send(msg: str) -> None:
    """Write a newline-terminated UART message and flash LED."""
    uart.write((msg + "\n").encode("utf-8"))
    led.on()
    utime.sleep_ms(55)
    led.off()


def boot_sequence() -> None:
    """3 fast LED flashes + PICO_READY handshake on startup."""
    for _ in range(3):
        led.on();  utime.sleep_ms(70)
        led.off(); utime.sleep_ms(70)
    utime.sleep_ms(200)
    uart.write(b"PICO_READY\n")
    print("THE BOX — Pico W ready")


# ── Main loop ─────────────────────────────────────────────────
boot_sequence()

while True:
    now = utime.ticks_ms()

    # Push buttons (active LOW)
    for i, (pin, msg) in enumerate(BUTTONS):
        if pin.value() == 0:
            if utime.ticks_diff(now, btn_last_ms[i]) >= BUTTON_DEBOUNCE_MS:
                btn_last_ms[i] = now
                send(msg)
                print(msg)

    # Toggle switch — fire SETTINGS on every state change
    cur = TOGGLE.value()
    if cur != toggle_state:
        if utime.ticks_diff(now, toggle_last_ms) >= TOGGLE_DEBOUNCE_MS:
            toggle_state = cur
            toggle_last_ms = now
            send("SETTINGS")
            print("SETTINGS (toggle →", "UNLOCK)" if cur == 0 else "LOCK)")

    utime.sleep_ms(10)  # 100 Hz poll — fast enough for confident button taps
