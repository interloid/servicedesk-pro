import { z } from "zod";

import { TEAM_ROLE_VALUES } from "@/features/team/types/team";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Please enter an email address.")
  .max(254, "That email is too long.")
  .email("Please enter a valid email address.");

const memberId = z.uuid("Pick a member.");

const role = z.enum(TEAM_ROLE_VALUES);

// The catalogue role picked. When set, the server takes the tier from it and
// ignores `role`.
const roleId = z.uuid("Pick a role.").optional();

const memberRoleInput = z.object({
  memberId,
  role,
  roleId,
});

const memberStatusInput = z.object({
  memberId,
  status: z.enum(["Active", "Disabled"]),
});

const inviteMemberInput = z.object({
  email,
  role,
  roleId,
});

const resendInviteInput = z.object({
  memberId,
});

const removeMemberInput = z.object({
  memberId,
});

const transferOwnershipInput = z.object({
  memberId,
});

export const inviteMemberSchema = inviteMemberInput;
export const resendInviteSchema = resendInviteInput;
export const changeMemberRoleSchema = memberRoleInput;
export const changeMemberStatusSchema = memberStatusInput;
export const removeMemberSchema = removeMemberInput;
export const transferOwnershipSchema = transferOwnershipInput;

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
export type ResendInviteValues = z.infer<typeof resendInviteSchema>;
export type ChangeMemberRoleValues = z.infer<typeof changeMemberRoleSchema>;
export type ChangeMemberStatusValues = z.infer<typeof changeMemberStatusSchema>;
export type RemoveMemberValues = z.infer<typeof removeMemberSchema>;
export type TransferOwnershipValues = z.infer<typeof transferOwnershipSchema>;
