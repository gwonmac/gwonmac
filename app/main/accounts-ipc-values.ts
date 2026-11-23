/**
 * Pure validation for the account-profile IPC surface.
 * The Electron boundary owns argument counts; this module owns account values.
 */
import type { HubAccountRequest } from '../shared/accounts-contracts.js';
import {
  MULTI_PROFILE_MAX_COUNT,
  parseProfileId,
  type ProfileId,
} from "../shared/multiple-accounts.js";
import { ValidationError } from "../shared/errors.js";

export function parseProfileIds(value: unknown): readonly ProfileId[] {
  const maximumWorkspaceProfiles = MULTI_PROFILE_MAX_COUNT + 1;
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.length > maximumWorkspaceProfiles
  ) {
    throw new ValidationError(
      `select between 1 and ${maximumWorkspaceProfiles} account profiles`,
    );
  }
  const ids = value.map(parseProfileId);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError("account profile selection contains duplicates");
  }
  return ids;
}

export function parseHubAccountRequest(value: unknown): HubAccountRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Invalid account request');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== 'id' && key !== 'mode') || (input.mode !== 'open' && input.mode !== 'replace')) throw new ValidationError('Invalid account action');
  return { id: parseProfileId(input.id), mode: input.mode };
}
