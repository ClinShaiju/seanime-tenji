// Smoothed one-way latency (half the WS round-trip) to the server, in milliseconds.
//
// Tenji has no built-in ping loop, so useWsLatencyProbe (watch-room.ts) sends a {type:"ping"}
// with a timestamp the server echoes in its pong; RTT = now - timestamp. The watch-room sync reads
// this to lead positions by the network lag: a position travels controller -> server -> follower,
// so a follower trails the controller's true playhead by (controller uplink + follower downlink).
// Each client compensates only the leg it can measure — the controller adds its own half-RTT to
// the position it emits, the follower adds its own half-RTT on apply. EMA-smoothed so measurement
// jitter doesn't become position jitter.

let halfRttMs = 0

export function recordRtt(rttMs: number): void {
    if (!isFinite(rttMs) || rttMs < 0 || rttMs > 5000) return
    const half = rttMs / 2
    halfRttMs = halfRttMs === 0 ? half : halfRttMs * 0.8 + half * 0.2
}

// getHalfRttSeconds returns the smoothed one-way latency in SECONDS (player currentTime is seconds).
export function getHalfRttSeconds(): number {
    return halfRttMs / 1000
}
