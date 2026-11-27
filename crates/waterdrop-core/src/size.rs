/// Approximates the deflate size of a payload without external dependencies.
///
/// It combines an LZ77 match estimate with a Shannon entropy estimate and takes
/// the smaller of the two. The result is used for reporting and budgets only;
/// it is intentionally deterministic across platforms.
pub fn compressed_estimate(bytes: &[u8]) -> usize {
    if bytes.is_empty() {
        return 0;
    }
    let entropy = entropy_estimate(bytes);
    let lz = lz_estimate(bytes);
    let overhead = (bytes.len() / 256).max(8);
    entropy.min(lz).saturating_add(overhead).min(bytes.len())
}

fn entropy_estimate(bytes: &[u8]) -> usize {
    let mut counts = [0usize; 256];
    for byte in bytes {
        counts[*byte as usize] += 1;
    }
    let len = bytes.len() as f64;
    let mut bits = 0.0f64;
    for count in counts {
        if count == 0 {
            continue;
        }
        let p = count as f64 / len;
        bits -= p * p.log2();
    }
    ((bits * len) / 8.0).ceil() as usize
}

fn lz_estimate(bytes: &[u8]) -> usize {
    if bytes.len() < 8 {
        return bytes.len();
    }
    const WINDOW: usize = 32 * 1024;
    const MIN_MATCH: usize = 4;
    const MAX_MATCH: usize = 258;

    let mut table = vec![usize::MAX; 1 << 16];
    let mut cost = 0usize;
    let mut index = 0usize;
    while index < bytes.len() {
        let mut matched = 0usize;
        if index + MIN_MATCH <= bytes.len() {
            let key = hash4(bytes, index);
            let candidate = table[key];
            table[key] = index;
            if candidate != usize::MAX && index - candidate <= WINDOW {
                let limit = MAX_MATCH.min(bytes.len() - index);
                while matched < limit && bytes[candidate + matched] == bytes[index + matched] {
                    matched += 1;
                }
                if matched >= MIN_MATCH {
                    // A length/distance pair costs roughly three bytes; literals cost one.
                    cost += 3;
                    for offset in 1..matched {
                        if index + offset + MIN_MATCH <= bytes.len() {
                            table[hash4(bytes, index + offset)] = index + offset;
                        }
                    }
                    index += matched;
                    continue;
                }
            }
        }
        cost += 1;
        index += 1;
    }
    cost
}

fn hash4(bytes: &[u8], index: usize) -> usize {
    let chunk = u32::from_le_bytes([
        bytes[index],
        bytes[index + 1],
        bytes[index + 2],
        bytes[index + 3],
    ]);
    (chunk.wrapping_mul(0x9e37_79b1) >> 16) as usize & 0xffff
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_and_tiny_payloads() {
        assert_eq!(compressed_estimate(b""), 0);
        assert!(compressed_estimate(b"a") >= 1);
    }

    #[test]
    fn repetitive_text_compresses_more_than_noise() {
        let repetitive = "const value = 1;\n".repeat(500);
        let noise: Vec<u8> = (0..10_000).map(|i| (i * 73 % 251) as u8).collect();
        let a = compressed_estimate(repetitive.as_bytes());
        let b = compressed_estimate(&noise);
        assert!(a < repetitive.len() / 3, "repetitive estimate: {a}");
        assert!(b > a, "noise {b} should be larger than text {a}");
    }

    #[test]
    fn estimate_never_exceeds_input() {
        for payload in [
            b"hello".as_slice(),
            b"<html></html>".as_slice(),
            &[0u8; 1024],
        ] {
            assert!(compressed_estimate(payload) <= payload.len());
        }
    }
}
