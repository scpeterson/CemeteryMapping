import releaseNotes from "../data/releaseNotes.json";
import { Modal } from "./ui/Modal";

export default function WhatsNewPanel({ version, onClose }: { version: string; onClose: () => void }) {
  const changes = (releaseNotes as Record<string, string[]>)[version];
  return <Modal className="whats-new-panel" label="What's new" onClose={onClose}>
    <button type="button" onClick={onClose}>Close</button>
    <h2>What's new in v{version}</h2>
    {Array.isArray(changes) ? <ul>{changes.map((change) => <li key={change}>{change}</li>)}</ul>
      : <p>No notes for this version.</p>}
  </Modal>;
}
