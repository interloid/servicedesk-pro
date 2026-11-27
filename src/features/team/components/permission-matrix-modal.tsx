"use client";

import { UserShield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_MODAL_BUTTON,
} from "@/features/team/components/modal-buttons";
import {
  DIALOG_FOOTER_BAND,
  DialogIconHeader,
} from "@/features/team/components/dialog-icon-header";
import { DASHBOARD_BUTTON } from "@/components/shared/dashboard-ui";
import {
  TEAM_PERMISSION_AREAS,
  TEAM_PERMISSION_AREA_LABELS,
  TEAM_PERMISSION_MATRIX,
  TEAM_ROLE_SUMMARIES,
  TEAM_ROLE_VALUES,
} from "@/features/team/types/team";

/**
 * Values are plain text. Glyphs beside "Full" and "None" only ever decorated
 * two of the six values, so a column read as a ragged mix of icon-then-word
 * and word-alone; colour carries the same meaning without the ragged edge.
 */
function PermissionValue({ value }: { value: string }) {
  const tone =
    value === "None"
      ? "text-slate-400"
      : value === "Full"
        ? "bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-600/15 ring-inset dark:bg-emerald-950/60 dark:text-emerald-300"
        : "bg-slate-100 font-medium text-slate-700 ring-1 ring-slate-500/15 ring-inset dark:bg-muted dark:text-slate-300";

  if (value === "None") {
    return <span className={tone}>{value}</span>;
  }

  return (
    <span
      className={`inline-flex h-6 items-center rounded-md px-2 text-xs whitespace-nowrap ${tone}`}
    >
      {value}
    </span>
  );
}

export function PermissionMatrixModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`${DASHBOARD_BUTTON} gap-2 bg-card text-sm hover:bg-slate-50 dark:hover:bg-muted`}
        >
          <UserShield className="size-4" aria-hidden />
          View permissions
        </Button>
      </DialogTrigger>

      <DialogContent
        className={`max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl ${TEAM_DIALOG_CONTENT}`}
      >
        <DialogIconHeader
          icon={UserShield}
          title="Permission matrix"
          description="What each role can see and change inside the workspace."
        />

        <div className="overflow-hidden rounded-xl border border-border shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 w-[34%] bg-slate-50/80 px-4 text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)] dark:bg-muted/40">
                  Role
                </TableHead>
                {TEAM_PERMISSION_AREAS.map((area) => (
                  <TableHead
                    key={area}
                    className="h-10 w-[16.5%] bg-slate-50/80 px-4 text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase shadow-[inset_0_-1px_0_var(--border)] dark:bg-muted/40"
                  >
                    {TEAM_PERMISSION_AREA_LABELS[area]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {TEAM_ROLE_VALUES.map((role) => {
                const row = TEAM_PERMISSION_MATRIX[role];
                return (
                  <TableRow
                    key={role}
                    className="border-border transition-colors hover:bg-slate-50/60 dark:hover:bg-muted/30"
                  >
                    <TableCell className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold whitespace-nowrap text-foreground">
                          {role}
                        </span>
                        <span className="text-xs whitespace-normal text-slate-500">
                          {TEAM_ROLE_SUMMARIES[role]}
                        </span>
                      </div>
                    </TableCell>
                    {TEAM_PERMISSION_AREAS.map((area) => (
                      <TableCell
                        key={area}
                        className="px-4 py-3 align-middle text-sm"
                      >
                        <PermissionValue value={row[area]} />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className={`${TEAM_DIALOG_FOOTER} ${DIALOG_FOOTER_BAND}`}>
          <DialogClose asChild>
            <Button variant="outline" size="sm" className={TEAM_MODAL_BUTTON}>
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
