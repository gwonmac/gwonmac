<script setup lang="ts">
/**
 * Owns the account icon and colour pickers that the Add account and Edit account
 * forms share: every icon and preset colour from the launcher contract, plus a
 * custom colour.
 */
import { LAUNCHER_PROFILE_COLORS, LAUNCHER_PROFILE_ICONS, type LauncherProfileIcon } from "@shared/launcher-contracts";
import { PROFILE_ICONS } from "../profile-icons";
import ColorControl from "./ColorControl.vue";

const icon = defineModel<LauncherProfileIcon>("icon", { required: true });
const color = defineModel<string>("color", { required: true });
</script>

<template>
  <fieldset class="icon-options"><legend>Icon</legend><button v-for="each in LAUNCHER_PROFILE_ICONS" :key="each" type="button" :aria-label="each" :aria-pressed="icon === each" :class="{ selected: icon === each }" @click="icon = each"><component :is="PROFILE_ICONS[each]" /></button></fieldset>
  <fieldset class="color-options"><legend>Color</legend><button v-for="each in LAUNCHER_PROFILE_COLORS" :key="each" type="button" :aria-label="`Use ${each}`" :aria-pressed="color === each" :class="{ selected: color === each }" :style="{ background: each }" @click="color = each" /><ColorControl label="Custom account color" :value="color" @change="color = $event" /></fieldset>
</template>
