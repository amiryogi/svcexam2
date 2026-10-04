import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { settingsSchema, type SettingsInput } from '@svi/shared';
import { api } from '../../api/client';
import { qk, useSettings } from '../../api/hooks';
import { Button, Card, CardHeader, ErrorBlock, Field, Input, LoadingBlock, Textarea } from '../../components/ui';
import { applyServerErrors, nullsToEmpty, toastError } from '../../lib/forms';

export function SchoolTab() {
  const qc = useQueryClient();
  const settings = useSettings();
  const [logoVersion, setLogoVersion] = useState(0);
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema) });
  const err = form.formState.errors;

  useEffect(() => {
    if (settings.data) {
      const { hasLogo: _h, ...rest } = settings.data;
      form.reset(nullsToEmpty(rest) as SettingsInput);
    }
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: (v: z.output<typeof settingsSchema>) => api('/settings', { method: 'PUT', body: v }),
    onSuccess: async () => {
      toast.success('School details saved');
      await qc.invalidateQueries({ queryKey: qk.settings });
    },
    onError: (e) => applyServerErrors(e, form.setError),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => api('/settings/logo', { method: 'POST', rawBody: file, contentType: file.type }),
    onSuccess: async () => {
      toast.success('Logo updated');
      setLogoVersion((v) => v + 1);
      await qc.invalidateQueries({ queryKey: qk.settings });
    },
    onError: toastError,
  });

  if (settings.isPending) return <LoadingBlock />;
  if (settings.isError) return <ErrorBlock error={settings.error} />;
  const r = form.register;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="School details" description="Printed on grade sheets and ledgers." />
        <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <Field label="School name" required className="sm:col-span-2" error={err.name?.message}><Input {...r('name')} /></Field>
          <Field label="Address" className="sm:col-span-2" error={err.address?.message}><Input {...r('address')} /></Field>
          <Field label="Phone" error={err.phone?.message}><Input {...r('phone')} /></Field>
          <Field label="Email" error={err.email?.message}><Input {...r('email')} /></Field>
          <Field label="Website" error={err.website?.message}><Input {...r('website')} /></Field>
          <Field label="NEB school code" error={err.nebSchoolCode?.message}><Input {...r('nebSchoolCode')} /></Field>
          <Field label="Prepared by (name)" error={err.preparedByName?.message}><Input {...r('preparedByName')} /></Field>
          <Field label="Checked by (name)" error={err.checkedByName?.message}><Input {...r('checkedByName')} /></Field>
          <Field label="Head of school (name)" error={err.principalName?.message}><Input {...r('principalName')} /></Field>
          <Field label="Head of school title" required error={err.principalTitle?.message} hint="e.g. Principal, Campus Chief"><Input {...r('principalTitle')} /></Field>
          <Field label="Grade sheet footnote" className="sm:col-span-2" error={err.gradesheetNote?.message} hint="Leave empty to use the standard NEB legend">
            <Textarea rows={4} {...r('gradesheetNote')} />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={save.isPending}>Save details</Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Logo" description="PNG or JPEG, up to 1 MB." />
        <div className="space-y-4 p-5">
          <div className="flex h-40 items-center justify-center rounded-md bg-slate-50 ring-1 ring-slate-200">
            {settings.data.hasLogo ? (
              <img src={`/api/v1/settings/logo?v=${logoVersion}`} alt="School logo" className="max-h-36 object-contain" />
            ) : (
              <span className="text-sm text-slate-400">No logo uploaded</span>
            )}
          </div>
          <label className="block">
            <span className="sr-only">Upload logo</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                if (f.size > 1_000_000) return toast.error('Logo must be smaller than 1 MB');
                uploadLogo.mutate(f);
              }}
            />
            <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
              <ImageUp className="size-4" /> {uploadLogo.isPending ? 'Uploading…' : 'Upload logo'}
            </span>
          </label>
        </div>
      </Card>
    </div>
  );
}
