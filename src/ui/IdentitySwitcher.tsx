import type { FormEvent } from "react";
import { useState } from "react";

import type { DemoIdentity, DemoRole } from "../state/IdentityContext";
import { useIdentity } from "../state/IdentityContext";

export function IdentitySwitcher() {
  const { identity, setIdentity } = useIdentity();
  const [draft, setDraft] = useState<DemoIdentity>(identity);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIdentity(draft);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3">
      <div>
        <p className="text-sm font-semibold text-amber-950">Local-demo identity headers</p>
        <p className="mt-1 text-xs leading-5 text-amber-900">
          These trusted headers are for local development only and are not production authentication.
        </p>
      </div>
      <label className="field-label">
        User ID
        <input
          className="field-input"
          value={draft.userId}
          onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
          placeholder="UUID"
        />
      </label>
      <label className="field-label">
        Role
        <select
          className="field-input"
          value={draft.role}
          onChange={(event) => setDraft({ ...draft, role: event.target.value as DemoRole })}
        >
          <option value="">No role</option>
          <option value="facility_manager">Facility manager</option>
          <option value="technician">Technician</option>
          <option value="reporter">Reporter</option>
        </select>
      </label>
      <label className="field-label">
        Building ID
        <input
          className="field-input"
          value={draft.buildingId}
          onChange={(event) => setDraft({ ...draft, buildingId: event.target.value })}
          placeholder="Required for manager views"
        />
      </label>
      <button className="primary-button w-full" type="submit">
        Apply identity
      </button>
    </form>
  );
}
