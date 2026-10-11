import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { settingsSchema, type SettingsInput } from '@svi/shared';
import { api } from '../../api/client';
import { qk, useSettings } from '../../api/hooks';
import { Button, Card, CardHeader, ConfirmDialog, ErrorBlock, Field, Input, LoadingBlock, Textarea } from '../../components/ui';
import { applyServerErrors, nullsToEmpty, toastError } from '../../lib/forms';

export function SchoolTab() {
  const qc = useQueryClient();
  const settings = useSettings();
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema) });
  const err = form.formState.errors;

  useEffect(() => {
    if (settings.data) {
      const { hasLogo: _h, hasWebLogo: _w, ...rest } = settings.data;
      form.reset(nullsToEmpty(rest) as SettingsInput);
    }
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: (v: z.output<typeof settingsSchema>) => api('/settings', { method: 'PUT', body: v }),
    onSuccess: async () => {
      toast.success('School details saved');
      await qc.invalidateQueries({ queryKey: qk.settings });
      await qc.invalidateQueries({ queryKey: qk.branding }); // login page, sidebar, tab icon
    },
    onError: (e) => applyServerErrors(e, form.setError),
  });

  if (settings.isPending) return <LoadingBlock />;
  if (settings.isError) return <ErrorBlock error={settings.error} />;
  const r = form.register;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="School details" description="Shown on the website and printed on grade sheets and ledgers." />
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
      <div className="space-y-6">
        <LogoCard
          kind="web"
          title="Website logo (colour)"
          description="Shown on the login page, sidebar, dashboard and browser tab. PNG, JPEG or WebP, up to 2 MB."
          present={settings.data.hasWebLogo}
          accept="image/png,image/jpeg,image/webp"
          emptyText={settings.data.hasLogo ? 'Not uploaded – the website uses the grade sheet logo for now' : 'Not uploaded'}
        />
        <LogoCard
          kind="print"
          title="Grade sheet logo (black & white)"
          description="Printed on grade sheets and mark ledgers. PNG or JPEG, up to 2 MB."
          present={settings.data.hasLogo}
          accept="image/png,image/jpeg"
          emptyText="Not uploaded – grade sheets print without a logo"
        />
      </div>
    </div>
  );
}

function LogoCard({
  kind,
  title,
  description,
  present,
  accept,
  emptyText,
}: {
  kind: 'web' | 'print';
  title: string;
  description: string;
  present: boolean;
  accept: string;
  emptyText: string;
}) {
  const qc = useQueryClient();
  const [version, setVersion] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = async () => {
    setVersion((v) => v + 1);
    await qc.invalidateQueries({ queryKey: qk.settings });
    await qc.invalidateQueries({ queryKey: qk.branding }); // login page, sidebar, dashboard, tab icon
  };
  const upload = useMutation({
    mutationFn: (file: File) => api(`/settings/logo`, { method: 'POST', rawBody: file, contentType: file.type, query: { kind } }),
    onSuccess: async () => {
      toast.success(`${title} updated`);
      await refresh();
    },
    onError: toastError,
  });
  const remove = useMutation({
    mutationFn: () => api(`/settings/logo`, { method: 'DELETE', query: { kind } }),
    onSuccess: async () => {
      toast.success(`${title} removed`);
      setConfirmRemove(false);
      await refresh();
    },
    onError: toastError,
  });

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-4 p-5">
        <div
          className={`flex h-40 items-center justify-center rounded-md ring-1 ring-slate-200 ${kind === 'web' ? 'bg-gradient-to-br from-brand-900 to-brand-700' : 'bg-slate-50'}`}
        >
          {present ? (
            <img
              src={`/api/v1/settings/logo?kind=${kind}&v=${version}`}
              alt={title}
              className={kind === 'web' ? 'size-32 rounded-full bg-white object-contain p-1.5 shadow' : 'max-h-36 object-contain'}
            />
          ) : (
            <span className={`px-4 text-center text-sm ${kind === 'web' ? 'text-brand-100' : 'text-slate-400'}`}>{emptyText}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label>
            <span className="sr-only">Upload {title}</span>
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                if (f.size > 2_000_000) return toast.error('Logo must be smaller than 2 MB');
                upload.mutate(f);
              }}
            />
            <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
              <ImageUp className="size-4" /> {upload.isPending ? 'Uploading…' : present ? 'Replace' : 'Upload'}
            </span>
          </label>
          {present && (
            <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        danger
        title={`Remove ${title.toLowerCase()}?`}
        message={kind === 'web' ? 'The website will use the grade sheet logo instead.' : 'Grade sheets and ledgers will print without a logo.'}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmRemove(false)}
      />
    </Card>
  );
}
