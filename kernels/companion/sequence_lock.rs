//! The sequence lock every snapshot is published under. A reader may look at a
//! region between any two kernel stores, so each write is bracketed: an odd
//! `sequence` first, then the header and payload, then the next even value. A
//! reader that sees an odd value, or a value that changed during its read,
//! discards the frame instead of decoding a half-written one.

use core::ptr::{addr_of_mut, write_volatile};

use crate::abi::SnapshotHeader;

/// Writes one snapshot under the sequence lock and returns the even sequence
/// it published. The caller keeps that value in its own state rather than
/// reading it back, so a host write to the region cannot move the count.
///
/// SAFETY: `header` is the start of a region `companion_init` accepted through
/// `valid_region` for this snapshot type; memory never shrinks, so it is still
/// in bounds. `write` stores only inside the same region.
pub(crate) unsafe fn write(
    header: *mut SnapshotHeader,
    last: u32,
    magic: u32,
    abi_and_size: u32,
    write: impl FnOnce(),
) -> u32 {
    let next = last.wrapping_add(2) & !1;
    unsafe {
        write_volatile(addr_of_mut!((*header).sequence), next.wrapping_sub(1));
        write_volatile(addr_of_mut!((*header).magic), magic);
        write_volatile(addr_of_mut!((*header).abi_and_size), abi_and_size);
    }
    write();
    unsafe { write_volatile(addr_of_mut!((*header).sequence), next) };
    next
}
