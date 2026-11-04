import type { DigestRow } from '../digest/types.js';

function marked(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function value(value: string | null): string {
  return value ?? '—';
}

export function Digest({ night, rows }: { night: string; rows: DigestRow[] }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first at</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr class={marked(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{value(row.owner)}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{value(row.lastError)}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
