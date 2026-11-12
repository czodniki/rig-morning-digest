import type { NightDigest } from '../digest/types.js';

export function DigestPage({ night, digest }: { night: string; digest: NightDigest }) {
  if (digest.rows.length === 0) {
    return (
      <>
        <h1>digest · {night}</h1>
        {digest.malformedLines > 0 && (
          <p class="warn">{digest.malformedLines} malformed {digest.malformedLines === 1 ? 'line' : 'lines'} counted.</p>
        )}
        <p class="mute">nothing ran</p>
      </>
    );
  }

  return (
    <>
      <h1>digest · {night}</h1>
      {digest.malformedLines > 0 && (
        <p class="warn">{digest.malformedLines} malformed {digest.malformedLines === 1 ? 'line' : 'lines'} counted.</p>
      )}
      <table>
        <thead>
          <tr>
            <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last status</th>
            <th>last error</th><th>first time</th><th>last time</th>
          </tr>
        </thead>
        <tbody>
          {digest.rows.map((row) => (
            <tr>
              <td>{row.job}</td>
              <td>{row.owner ?? '—'}</td>
              <td>{row.runs}</td>
              <td>{row.retries >= 3 ? <strong class="warn">{row.retries}</strong> : row.retries}</td>
              <td>{row.lastStatus === 'fail' ? <strong class="warn">fail</strong> : row.lastStatus}</td>
              <td>{row.lastError ?? '—'}</td>
              <td>{row.firstAt}</td>
              <td>{row.lastAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
