import hashlib

GRID = 5
CELL = 20
PADDING = 4
SIZE = GRID * CELL + 2 * PADDING

PALETTE = [
    "#8b5cf6",
    "#7c3aed",
    "#6d28d9",
    "#3b82f6",
    "#2563eb",
    "#10b981",
    "#059669",
    "#f59e0b",
    "#d97706",
    "#ef4444",
    "#dc2626",
    "#ec4899",
    "#db2777",
    "#8b5cf6",
    "#6366f1",
    "#14b8a6",
]


def generate_identicon(username: str) -> str:
    digest = hashlib.sha256(username.encode()).digest()
    bg = digest[0] % 2  # alternate background
    color = PALETTE[digest[1] % len(PALETTE)]
    fill = {
        0: "#1c1c26",
        1: "#2a2a3a",
    }[bg]
    stroke = {0: "#8b5cf6", 1: "#4b5563"}[bg]

    pixels: list[tuple[int, int]] = []
    for row in range(GRID):
        for col in range(GRID // 2 + 1):
            byte_idx = 2 + (row * (GRID // 2 + 1) + col) // 8
            bit_idx = (row * (GRID // 2 + 1) + col) % 8
            if (digest[byte_idx % len(digest)] >> bit_idx) & 1:
                pixels.append((row, col))
                if col < GRID // 2:
                    pixels.append((row, GRID - 1 - col))

    rects = [
        f'<rect x="{PADDING + c * CELL}" y="{PADDING + r * CELL}"'
        f' width="{CELL}" height="{CELL}" rx="3" fill="{color}"/>'
        for r, c in pixels
    ]

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg"'
        f' viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">'
        f'<rect width="{SIZE}" height="{SIZE}" rx="8" fill="{fill}"'
        f' stroke="{stroke}" stroke-width="1"/>'
        f"{''.join(rects)}"
        f"</svg>"
    )
