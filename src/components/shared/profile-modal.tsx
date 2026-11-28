"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, UserRound } from "lucide-react";

import {
  ProfileFormValues,
  profileFormSchema,
} from "@/lib/validations/profile";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
  TEAM_MODAL_CONTROL,
} from "@/features/team/components/modal-buttons";
import {
  DIALOG_FOOTER_BAND,
  DialogIconHeader,
} from "@/features/team/components/dialog-icon-header";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  prepareProfileAvatarUploadAction,
  updateProfileAction,
} from "@/features/users/actions/user-actions";
import { uploadAvatar } from "@/features/portal/avatar-upload";
import { avatarError } from "@/features/portal/portal";
import { toast } from "sonner";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  tenantId: string;
  role: string;
  initialValues?: Partial<ProfileFormValues> & { initials?: string };
}

export function ProfileModal({
  open,
  onOpenChange,
  companyName,
  role,
  tenantId,
  initialValues,
}: ProfileModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialValues?.avatarUrl || null,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: initialValues?.fullName || "",
      email: initialValues?.email || "",
      avatarUrl: initialValues?.avatarUrl || "",
    },
  });

  // Backing out (Cancel, Esc, outside click) drops the picked photo and any
  // unsaved edits, so they are not saved by the next, unrelated save.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedFile(null);
      setPreviewUrl(initialValues?.avatarUrl || null);
      form.reset({
        fullName: initialValues?.fullName || "",
        email: initialValues?.email || "",
        avatarUrl: initialValues?.avatarUrl || "",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    onOpenChange(next);
  };

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const problem = avatarError(file);
      if (problem) {
        toast.error("Couldn't use that photo", { description: problem });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl((previous) => {
        if (previous?.startsWith("blob:")) {
          URL.revokeObjectURL(previous);
        }
        return URL.createObjectURL(file);
      });
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    setIsSubmitting(true);

    try {
      let avatarPath: string | null = null;

      // The photo goes straight to Storage with a single-use token; only its
      // path is sent to the action (Server Action bodies are capped at 1 MB).
      if (selectedFile) {
        const prepared = await prepareProfileAvatarUploadAction(tenantId, {
          size: selectedFile.size,
          type: selectedFile.type,
        });

        if (!prepared.success) {
          toast.error("Couldn't upload your photo", {
            description: prepared.message,
          });
          return;
        }

        await uploadAvatar(prepared.data, selectedFile);
        avatarPath = prepared.data.path;
      }

      const result = await updateProfileAction(tenantId, data, avatarPath);

      if (result.success) {
        // Saved: keep the new photo as the starting point, then close.
        setSelectedFile(null);
        onOpenChange(false);
      } else if (result.errors) {
        Object.entries(result.errors).forEach(([key, messages]) => {
          form.setError(key as keyof ProfileFormValues, {
            message: messages?.[0],
          });
        });
      } else {
        toast.error("Couldn't save your profile", {
          description: result.message,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save your profile", {
        description:
          err instanceof Error && err.message
            ? err.message
            : "We couldn't save your profile. Try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* The platform console's popup: icon header, roomy body, banded footer. */}
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto sm:max-w-115 ${TEAM_DIALOG_CONTENT}`}
      >
        <DialogIconHeader
          icon={UserRound}
          title="Profile settings"
          description={
            <>
              {role} · {companyName}
            </>
          }
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-slate-50/60 p-3 sm:gap-4 dark:bg-muted/20">
              <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border">
                  {previewUrl && (
                    <AvatarImage
                      src={previewUrl}
                      alt="Avatar"
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-slate-200 text-slate-700 text-base sm:text-lg font-bold">
                    {initialValues?.initials || ""}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-5 w-5 text-primary-foreground " />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold"
                >
                  Change picture
                </Button>
                <p className="text-[11px] text-slate-500 mt-1">
                  JPG, PNG or GIF. 5MB max.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/gif, image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">
                    Full name
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={isSubmitting}
                      className={`rounded-lg text-sm ${TEAM_MODAL_CONTROL}`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      disabled
                      className={`rounded-lg text-sm ${TEAM_MODAL_CONTROL}`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel className="text-sm font-semibold">
                Company name
              </FormLabel>

              <FormControl>
                <Input
                  value={companyName}
                  disabled
                  className={`rounded-lg bg-slate-100 text-sm text-slate-500 ${TEAM_MODAL_CONTROL}`}
                />
              </FormControl>

              <p className="text-xs text-slate-500 mt-1">
                Contact support to update your company name.
              </p>
            </FormItem>
            <DialogFooter
              className={`${TEAM_DIALOG_FOOTER} ${DIALOG_FOOTER_BAND}`}
            >
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleOpenChange(false)}
                className={TEAM_MODAL_BUTTON}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={`${TEAM_MODAL_BUTTON} ${TEAM_MODAL_BUTTON_PRIMARY}`}
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
