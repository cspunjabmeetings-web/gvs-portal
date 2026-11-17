// spec: 6.3 A01 (password, ghalti/rok ka paigham), F07-AC1, AC2, F08-AC10 (44px+ button, 360px)
import { useState } from 'preact/hooks';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError('Password likhein.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      if (res.ok && data.ok) {
        setPassword('');
        location.reload();
        return;
      }
      setError(data.error?.message ?? 'Login nahin ho saka.');
    } catch {
      setError('Server se rabta nahin ho saka. Dobara koshish karein.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate class="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <label for="admin-password" class="text-sm font-medium">
        Password
      </label>
      <div class="flex gap-2">
        <input
          id="admin-password"
          type={show ? 'text' : 'password'}
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          autocomplete="current-password"
          maxLength={200}
          aria-invalid={!!error}
          aria-describedby={error ? 'admin-login-err' : undefined}
          class="min-h-[44px] w-full rounded-lg border border-border bg-surface px-3"
        />
        <button type="button" onClick={() => setShow(!show)} class="min-h-[44px] shrink-0 rounded-lg border border-border px-3 text-sm" aria-pressed={show}>
          {show ? 'Chhupayen' : 'Dikhayen'}
        </button>
      </div>
      {error && (
        <p id="admin-login-err" class="rounded-lg bg-wrong-bg p-3 text-sm font-medium text-wrong" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} class="min-h-[48px] rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-70">
        {busy ? 'Jaanch rahe hain…' : 'Login'}
      </button>
    </form>
  );
}
