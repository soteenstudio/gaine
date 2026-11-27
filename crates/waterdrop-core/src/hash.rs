/// FNV-1a, 64 bit. Fast, dependency free and stable across platforms.
pub fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

pub fn content_hash(bytes: &[u8]) -> String {
    format!("{:016x}", fnv1a64(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_vectors() {
        assert_eq!(fnv1a64(b""), 0xcbf2_9ce4_8422_2325);
        assert_eq!(fnv1a64(b"a"), 0xaf63_dc4c_8601_ec8c);
        assert_eq!(content_hash(b"a"), "af63dc4c8601ec8c");
        assert_eq!(content_hash(b"a").len(), 16);
    }

    #[test]
    fn is_sensitive_to_every_byte() {
        assert_ne!(content_hash(b"app.js"), content_hash(b"app.jz"));
    }
}
