import { lazy, Suspense, useState } from 'react';
import type { Burial, CreateBurialInput, GraveSpace, HeadstoneLookups } from '../../types';
import { confirmDiscardChanges } from '../../hooks/useDraftState';
import { Notice } from '../ui/Feedback';

const BurialRecord = lazy(() => import('./BurialRecord').then(module => ({ default: module.BurialRecord })));

export function CreateBurialForm({ grave, lookups, onCreate, onClose }: {
  grave: GraveSpace; lookups: HeadstoneLookups; onCreate: (input: CreateBurialInput) => Promise<Burial>; onClose: () => void;
}) {
  const [ownerId, setOwnerId] = useState('');
  const [operationId] = useState(() => crypto.randomUUID());
  const [version] = useState(grave.version ?? '');
  const [busy, setBusy] = useState(false);
  const [owners] = useState(() => grave.owners.filter(owner => grave.currentOwnerIds.includes(owner.id)));
  const owner = owners.find(entry => entry.id === ownerId);
  const seed: Burial = { id: 'new-burial', person: { id: 'new-person', firstName: owner?.firstName ?? '', lastName: owner?.lastName ?? '' },
    veteran: false, intermentType: 'unknown', recordStatusCode: 'interred' };
  return <section className="admin-section" aria-label="Add burial">
    <h4>Add burial</h4>
    <Notice>Recording a burial keeps the existing deed holders and ownership history. Record a deed transfer separately only when one actually occurs.</Notice>
    <label>Person to record
      <select disabled={busy} value={ownerId} onChange={event => { if (confirmDiscardChanges()) setOwnerId(event.target.value); }}>
        <option value="">Enter a new person</option>
        {owners.map(entry => <option key={entry.id} value={entry.id}>Deed holder: {entry.displayName}</option>)}
      </select>
    </label>
    {owner && <p>Review the deed holder's name and enter their burial details. This creates a burial record without changing their ownership record.</p>}
    {owner && !owner.firstName && !owner.lastName && <Notice>This deed holder has an unstructured name. Enter the individual person's name below; a joint or organization name must not be treated as one person.</Notice>}
    {grave.burials.length > 0 && <p>Already recorded here: {grave.burials.map(b => b.person.displayName || [b.person.firstName, b.person.lastName].filter(Boolean).join(' ')).join('; ')}. Edit an existing pre-need record when that is the same person.</p>}
    <Suspense fallback={<p role="status">Loading burial form…</p>}>
      <BurialRecord key={ownerId || 'new-person'} burial={seed} creating canUpdate lookups={lookups} onCancelCreate={() => { if (confirmDiscardChanges()) onClose(); }}
        onSave={async (_id, form) => {
          setBusy(true);
          try {
            const saved = await onCreate({ ...form, reason: 'Record burial in existing gravesite', expectedVersion: version, operationId,
              sourceOwnerId: owner?.id, sourceOwnerVersion: owner?.version });
            onClose(); return saved;
          } finally { setBusy(false); }
        }} />
    </Suspense>
  </section>;
}
