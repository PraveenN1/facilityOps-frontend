import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createComplaint } from "../api/client";
import { useIdentity } from "../state/IdentityContext";
import { ErrorState } from "../ui/AsyncState";

function newIdempotencyKey() {
  return crypto.randomUUID();
}

export function ComplaintCreatePage() {
  const navigate = useNavigate();
  const { headers, identity } = useIdentity();
  const [buildingId, setBuildingId] = useState(identity.buildingId);
  const [description, setDescription] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const canSubmit = useMemo(() => buildingId.trim() && description.trim(), [buildingId, description]);

  const mutation = useMutation({
    mutationFn: () =>
      createComplaint(
        headers,
        {
          building_id: buildingId.trim(),
          description: description.trim(),
        },
        idempotencyKey,
      ),
    onSuccess: (response) => {
      setIdempotencyKey(newIdempotencyKey());
      navigate(`/incidents/${response.incident_id}`);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <section className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Submit complaint</h2>
        <p className="mt-1 text-sm text-slate-500">
          Creates a complaint and primary incident, then queues AI triage through the backend outbox.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <label className="field-label">
          Building ID
          <input
            required
            className="field-input"
            value={buildingId}
            onChange={(event) => setBuildingId(event.target.value)}
            placeholder="UUID"
          />
        </label>
        <label className="field-label">
          Complaint description
          <textarea
            required
            className="field-input min-h-36"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Example: Water leakage near an electrical panel"
          />
        </label>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Stable idempotency key for this retryable submission:
          <span className="ml-1 font-mono text-slate-900">{idempotencyKey}</span>
        </div>
        {mutation.isError ? <ErrorState title="Complaint was not submitted" detail={mutation.error.message} /> : null}
        <button className="primary-button" disabled={!canSubmit || mutation.isPending} type="submit">
          {mutation.isPending ? "Submitting..." : "Submit complaint"}
        </button>
      </form>
    </section>
  );
}
