# Whispers

Whispers is an optional, session-only companion to the original Guild Wars
chat. Original chat remains authoritative and fully usable. The companion
observes incoming and outgoing whisper log events and submits one explicit
reply through the certified native chat sender. It does not simulate typing,
replace chat handlers, block messages, or maintain a second delivery history.

## Use and presentation

Enable **Whispers** in launcher Tools settings (off by default). The panel is
available in PvE while Tools is enabled. `pnpm --filter @gwonmac/tools-ui dev` with `?whispers` opens
the same Vue surface with local scenario controls; those controls never send
game messages.

The default **Command-D** shortcut opens the floating Whispers surface. Existing
custom bindings and cleared shortcuts are preserved. Person search, the shortcut
and the unread launcher use the same mounted Vue conversation component.
Opening it from Hub suspends the Hub page. Returning to Hub resumes that page.
The session and transcript have one owner; there is no separate quick composer.

In Hub, the people picker uses the shared list keys. Enter opens the named primary;
Right opens the person page. Root Actions reuses that person's named actions.
Game actions require explicit selection when no whisper action is available.
Unavailable chat keeps a disabled result with its waiting reason.

The Whispers surface retains its saved geometry. Its single **Hide Whispers**
control preserves conversations and drafts. Its resize grip stays outside normal
Tab navigation. Chat options retain mute, sound and guarded conversation closing.

## Party invite

`enhancement_send_party_invite` shares the whisper mailbox, policy gate and
game-thread drain. Its enqueue accepts only `/invite ` followed by one to twenty
name units without a control character, quote, comma, surrogate, or leading or
trailing space. The whisper enqueue still accepts only whisper lines. One chat
command is pending at a time. The drained mailbox is the only receipt; Guild
Wars reports acceptance or refusal in original chat.

`party-invite.ts` allows an invite only in a PvE outpost with the chat mailbox
enabled. A friend in another map cannot receive it, so the row says where the
friend is before Enter. The caller decides whether it points to Travel and
invite: `hub-people.ts` adds the pointer only where it shows that row and the
row can start, so a hidden Travel palette, an unavailable Travel, an
explorable area or a PvP outpost gets no pointer. Travel and invite
refuses a known PvP outpost up front. It captures the character, starts the
existing friend Travel, and invites once after a ready PvE outpost of the
friend's map stays ready for two seconds. The first outpost after login can
publish no character key yet; the first known key is adopted, and only two
different known keys count as a character change. Once a key is known, only an
arrival with that key counts, so a relogged character never sends the invite; a
moment of unavailable game state during an ordinary zone change does not
withdraw it. While no key is known yet, a return to character selection counts
as a character change. A character
change, a refused trip, a non-PvE arrival or 60 seconds without arrival withdraws the
invite; a non-PvE arrival withdraws it at once. Disposing Tools withdraws a
pending arrival. The friend feed has no district, so an arrival in another
district can fail in Guild Wars.

While Travel and invite waits, Home names the pending friend and destination.
The player can cancel the pending invite. Cancellation prevents the later invite,
including after the arrival timer settles. It does not undo an accepted Travel.

`invite ` with an empty name lists the online friends, those invitable from
here first. No name was typed, so none is preselected and Enter alone sends
nothing; a row the player chooses invites by character name.
In the `invite` scope only an exact name invites: the exact typed name or an
exact known person comes first, and the footer names the target, such as
**Invite Mo Kai**. A prefix or "Seen in chat" match opens the person page.
Every Guild Wars character name has at least two words, so a typed single word
never invites: it stays after known people and reads "Type the full character
name".
Receipts claim only the sent command: "Sent /invite Mo Kai. Guild Wars answers
in chat." A refusal names the command it stopped, "/invite Mo Kai was not
sent. Guild Wars chat is not ready.", so it still reads right when it arrives
after Hub moved on or closed.

## Reuse and evidence

GWCA `ChatMgr` submits a UTF-16 line beginning with a quote, followed by
recipient, comma and message, with agent id zero. Current gwonmac Resign already
certifies the native sender and game-thread command queue. Reuse that proven
boundary without widening the argument-free Resign command.

GWToolbox++ `ChatSettings` identifies outgoing whispers in the global channel
by encoded template `0x76e`; incoming-only channel observation is insufficient.
External native-client facts are research leads, not WebAssembly authority.
The current outgoing producer supplies a numeric argument before recipient and
message. The parser consumes that bounded u32 prefix before reading either
string. Certification binds this producer, its template mapping and the native
encoder; integration tests cover echo confirmation and clearing the draft.

## Presentation and limits

Incoming bubbles align left; replies align right. Both use bright text and follow the selected Tools
UI theme and wrap long text. The header names the person; each message retains
an accessible author label. Back opens the people list. Its search is a
combobox over a listbox of the listed people (or the suggestions while typing):
Up and Down move the selected option and Enter opens it. Feed updates keep the
selected person by canonical name. Returning to the picker clears that selection.
The listbox owns person options; headings and cleanup buttons stay outside it.
Sound and cleanup are
in the options menu. A local Background slider reduces only this messenger's
broad panel and transcript paint to 15% of the selected global panel opacity;
text and controls stay legible. The options menu uses an opaque theme surface,
independent of both background opacity settings. The multiplier is
session-only and does not replace the saved appearance preference. There are no invented delivery or
read receipts. Original game links remain available in original chat.

The native sender accepts at most 137 UTF-16 units for the whole encoded line,
including recipient and separators. The composer displays the resulting body
limit (up to 120 units) and refuses excess text without truncation.

The view holds at most 32 open conversations and 200 messages per conversation.
Overflow is disclosed in the panel. Close read conversations keeps unread chats,
drafts and pending submissions. The picker shows online, away and do-not-disturb
friends with explicit presence; offline friends are hidden. The continue list
excludes conversations without messages, drafts, or pending submissions. Opening
a person without chatting does not remove them from available friends. An existing
conversation shows a friend's offline state when known. Friends use the latest
observed snapshot for this session; pausing the observer does not add friends
to recent people.
Temporary loading or PvP hides the surface and disables sending. Leaving the
game, changing character, or turning the feature off clears its session data.

## Verification boundary

A narrow live two-account check establishes current-game semantics; automated
fixtures cannot claim it. Do not send a live test message to an unspecified
person.
