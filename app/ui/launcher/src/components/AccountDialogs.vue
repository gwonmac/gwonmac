<script setup lang="ts">
/**
 * The account dialogs: Add account, and Edit account with its name, appearance and Archive.
 * Each dialog owns its draft and shows its own failure inside itself: the launch bar behind an
 * open dialog is inert (BaseModal), so an error there would reach no one. Without a native
 * bridge (browser preview) an edit changes only the shown accounts.
 */
import { computed, ref, watch } from "vue";
import { Archive, X } from "lucide-vue-next";
import { DEFAULT_PROFILE_COLOR, DEFAULT_PROFILE_ICON, type LauncherNativeApi, type LauncherProfileIcon, type LauncherSnapshot } from "@shared/launcher-contracts";
import { parseProfileName, profileNameKey, type ProfileId } from "@shared/multiple-accounts";
import BaseModal from "./BaseModal.vue";
import ProfileAppearanceFields from "./ProfileAppearanceFields.vue";

type Profile = LauncherSnapshot["profiles"][number];
const props = defineProps<{ profiles: readonly Profile[]; native: LauncherNativeApi | undefined }>();
const emit = defineEmits<{
  /** Browser preview only: the accounts with an edit applied. */
  preview: [profiles: Profile[]];
}>();
/** Add account is open. */
const adding = defineModel<boolean>("adding", { required: true });
/** The account that Edit account is open for. */
const editing = defineModel<ProfileId | null>("editing", { required: true });

const newName = ref("");
const newIcon = ref<LauncherProfileIcon>(DEFAULT_PROFILE_ICON);
const newColor = ref<string>(DEFAULT_PROFILE_COLOR);
const addError = ref("");
watch(adding, (open) => { if (open) addError.value = ""; });

async function createProfile() {
  const name = newName.value.trim();
  if (!name) return;
  addError.value = "";
  try {
    await props.native?.profiles.create({ name, appearance: { icon: newIcon.value, color: newColor.value } });
  } catch {
    addError.value = "The account could not be added. Try another name or try again.";
    return;
  }
  newName.value = "";
  newIcon.value = DEFAULT_PROFILE_ICON;
  newColor.value = DEFAULT_PROFILE_COLOR;
  adding.value = false;
}

const editName = ref("");
const editIcon = ref<LauncherProfileIcon>(DEFAULT_PROFILE_ICON);
const editColor = ref<string>(DEFAULT_PROFILE_COLOR);
const editError = ref("");
const archiveError = ref("");
const saving = ref(false);
const edited = computed(() => props.profiles.find((profile) => profile.id === editing.value) ?? null);
/** The first visible account stays, and an account with an open game window cannot be archived. */
const canArchive = computed(() => {
  const profile = edited.value;
  return profile !== null
    && profile.id !== props.profiles.find((each) => !each.archived)?.id
    && (profile.state === "ready" || profile.state === "failed");
});
watch(editing, () => {
  const profile = edited.value;
  if (!profile) return;
  editName.value = profile.name;
  editIcon.value = profile.appearance.icon;
  editColor.value = profile.appearance.color;
  editError.value = "";
  archiveError.value = "";
}, { immediate: true });

async function saveEdit() {
  const id = editing.value;
  if (!id || saving.value) return;
  editError.value = "";
  let name: string;
  try {
    name = parseProfileName(editName.value);
    if (props.profiles.some(profile => profile.id !== id && profileNameKey(profile.name) === profileNameKey(name))) {
      editError.value = "Another account already uses this name.";
      return;
    }
  } catch {
    editError.value = "Enter a name of 1–48 characters without control characters.";
    return;
  }
  saving.value = true;
  try {
    if (props.native) await props.native.profiles.update({ id, name, icon: editIcon.value, color: editColor.value });
    else emit("preview", props.profiles.map(profile => profile.id === id
      ? { ...profile, name, appearance: { icon: editIcon.value, color: editColor.value } }
      : profile));
    editing.value = null;
  } catch {
    editError.value = "The account could not be fully saved. Some changes may already be saved. Try again.";
  } finally {
    saving.value = false;
  }
}

async function archive() {
  const profile = edited.value;
  if (!profile || !canArchive.value) return;
  archiveError.value = "";
  try {
    await props.native?.profiles.archive(profile.id);
    editing.value = null;
  } catch {
    archiveError.value = "The account could not be archived.";
  }
}
</script>

<template>
  <BaseModal v-if="adding" labelledby="add-account-title" @close="adding = false">
    <form @submit.prevent="createProfile"><div class="modal-head"><h2 id="add-account-title">Add account</h2><button type="button" class="icon-button" aria-label="Close" @click="adding = false"><X /></button></div><p>This opens another separate Guild Wars window. Sign-in stays inside the game.</p><label>Name<input v-model="newName" autofocus maxlength="48" placeholder="Second account" :aria-invalid="!!addError" :aria-describedby="addError ? 'account-add-error' : undefined" /></label><p v-if="addError" id="account-add-error" class="dialog-error" role="alert">{{ addError }}</p><details><summary>Appearance</summary><ProfileAppearanceFields v-model:icon="newIcon" v-model:color="newColor" /></details><div class="form-actions"><button type="button" class="secondary" @click="adding = false">Cancel</button><button class="primary" :disabled="!newName.trim()">Add account</button></div></form>
  </BaseModal>

  <BaseModal v-if="editing" labelledby="appearance-title" :dismissible="!saving" @close="editing = null">
    <form @submit.prevent="saveEdit"><fieldset class="account-edit-fields" :disabled="saving"><div class="modal-head"><h2 id="appearance-title">Edit account</h2><button type="button" class="icon-button" aria-label="Close" :disabled="saving" @click="editing = null"><X /></button></div><p>Choose a name and appearance you can recognize at a glance.</p><label>Name<input v-model="editName" maxlength="48" required :disabled="saving" :aria-invalid="!!editError" :aria-describedby="editError ? 'account-edit-error' : undefined" /></label><p v-if="editError" id="account-edit-error" class="dialog-error" role="alert">{{ editError }}</p><ProfileAppearanceFields v-model:icon="editIcon" v-model:color="editColor" /><div v-if="canArchive" class="archive-account-row"><span><strong>Archive account</strong><small>Hide this account without deleting its data.</small></span><button type="button" class="secondary" :aria-describedby="archiveError ? 'account-archive-error' : undefined" @click="archive"><Archive />Archive</button></div><p v-if="archiveError" id="account-archive-error" class="dialog-error" role="alert">{{ archiveError }}</p><div class="form-actions"><button type="button" class="secondary" :disabled="saving" @click="editing = null">Cancel</button><button class="primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save changes' }}</button></div></fieldset></form>
  </BaseModal>
</template>
