import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Alert, Button, Modal } from '../../components/ui';
import { toastError } from '../../lib/forms';

interface ImportReport {
  dryRun: boolean;
  total: number;
  created: number;
  errors: { row: number; message: string }[];
}

const TEMPLATE =
  'admissionNo,firstName,middleName,lastName,gender,dobBs,dobAd,nebRegistrationNo,guardianName,guardianPhone,phone,address\n' +
  'SVI-0101,Sita,,Sharma,FEMALE,2066-02-15,,,Ram Sharma,9800000000,,Balaju\n';

export function StudentImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCsv(null);
    setReport(null);
    setFileName('');
    onClose();
  };

  const run = async (dryRun: boolean) => {
    if (!csv) return;
    setBusy(true);
    try {
      const r = await api<ImportReport>('/students/import', { method: 'POST', rawBody: csv, contentType: 'text/csv', query: { dryRun } });
      setReport(r);
      if (!dryRun && r.created > 0) {
        toast.success(`Imported ${r.created} students`);
        await qc.invalidateQueries({ queryKey: ['students'] });
        close();
      }
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import students from CSV"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant="secondary" disabled={!csv} loading={busy} onClick={() => run(true)}>Check file</Button>
          <Button disabled={!report || report.errors.length > 0 || !report.dryRun} loading={busy} onClick={() => run(false)}>
            Import {report?.total ?? ''} students
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Use a CSV file with a header row. Dates are <code>YYYY-MM-DD</code>; give either B.S. or A.D. date of birth.{' '}
          <button className="font-medium text-brand-700 underline" onClick={downloadTemplate}>Download template</button>
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-800"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            setReport(null);
            if (!f) return;
            if (f.size > 2_000_000) return toast.error('File is larger than 2 MB');
            setFileName(f.name);
            setCsv(await f.text());
          }}
        />
        {fileName && <p className="text-slate-500">Selected: {fileName}</p>}
        {report && report.errors.length === 0 && (
          <Alert tone="green">All {report.total} rows are valid. Click Import to save them.</Alert>
        )}
        {report && report.errors.length > 0 && (
          <Alert tone="red">
            <p className="font-medium">{report.errors.length} problem(s) found. Nothing was imported.</p>
            <ul className="mt-2 max-h-56 list-disc space-y-0.5 overflow-y-auto pl-5">
              {report.errors.map((e, i) => (
                <li key={i}>{e.row ? `Row ${e.row}: ` : ''}{e.message}</li>
              ))}
            </ul>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
