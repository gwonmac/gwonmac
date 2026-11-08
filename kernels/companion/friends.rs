//! Publishes the current admitted friend roster only while Travel observation
//! is active in a supported region. Lifecycle invalidation clears the owned
//! snapshot synchronously; no native identity or pointer is published.

use core::ptr::{addr_of_mut, write_volatile};
use crate::abi::{
    FriendRecord, FriendSnapshot, Layout, FRIEND_ABI_AND_SIZE, FRIEND_MAGIC, FRIEND_SLOTS, PLAY_REGION_PVE,
};
use crate::friend_records::{read_records, DecodedFriends};
use crate::sequence_lock;
use crate::{resolve_game, friend_session, GameState};

static mut SNAPSHOT_PTR: u32 = 0;
static mut ROOT: u32 = 0;
static mut SEQUENCE: u32 = 0;
static mut PUBLISHED: bool = false;

/// SAFETY: initialize receives a validated, exclusively host-owned region.
/// Subsequent calls run on the non-reentrant game callback thread.
pub(crate) unsafe fn initialize(pointer: u32, root: u32) {
    unsafe {
        SNAPSHOT_PTR = pointer;
        ROOT = root;
        SEQUENCE = 0;
        PUBLISHED = false;
        friend_session::initialize();
        publish(0, None);
    }
}

unsafe fn publish(generation: u32, records: Option<&DecodedFriends>) {
    let snapshot = unsafe { SNAPSHOT_PTR as *mut FriendSnapshot };
    // SAFETY: initialize proved the full region; Wasm memory cannot shrink.
    unsafe {
        SEQUENCE = sequence_lock::write(addr_of_mut!((*snapshot).header), SEQUENCE, FRIEND_MAGIC, FRIEND_ABI_AND_SIZE, || {
            write_volatile(addr_of_mut!((*snapshot).ready), u32::from(records.is_some()));
            write_volatile(addr_of_mut!((*snapshot).generation), generation);
            write_volatile(addr_of_mut!((*snapshot).count), records.map_or(0, |value| value.count));
            let output = addr_of_mut!((*snapshot).records).cast::<FriendRecord>();
            // Clear all slots on withdrawal, including the names no longer in use.
            let empty: FriendRecord = core::mem::MaybeUninit::zeroed().assume_init();
            for index in 0..FRIEND_SLOTS {
                write_volatile(output.add(index), records.map_or(empty, |value| *value.records.get_unchecked(index)));
            }
        });
        PUBLISHED = records.is_some();
    }
}

pub(crate) unsafe fn withdraw() {
    if unsafe { PUBLISHED } {
        unsafe { publish(0, None) };
    }
}

pub(crate) unsafe fn lifecycle(event: u32, request: u32, connection: u32, success: u32) {
    unsafe {
        match event {
            1 => friend_session::invalidate(),
            2 => friend_session::request_sent(request, connection),
            3 => friend_session::completion_started(request, connection, success == 1),
            4 => friend_session::completion_queued(),
            5 => friend_session::completion_finished(),
            6 => friend_session::completion_processed(),
            _ => return,
        }
        if friend_session::accepted_generation() == 0 {
            withdraw();
        }
    }
}

pub(crate) unsafe fn tick(layout: Layout) {
    let generation = unsafe { friend_session::accepted_generation() };
    // This lightweight region proof must precede every roster read. PvP maps
    // other than Guild Halls, and loading, do not reach the roster.
    if generation == 0 || !matches!(unsafe { resolve_game(layout) },
        GameState::Ready { play_region: PLAY_REGION_PVE, .. })
    {
        unsafe { withdraw() };
        return;
    }
    match unsafe { read_records(ROOT, generation) } {
        Some(records) => unsafe { publish(generation, Some(&records)) },
        None => unsafe { withdraw() },
    }
}
