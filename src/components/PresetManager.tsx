import { useState } from "react";
import type { Preset } from "../types";
import { createPresetId, loadPresets, savePresets } from "../lib/presets";
import { formatDuration } from "../lib/time";

interface PresetManagerProps {
  onLoad: (durationMs: number) => void;
}

type FormState = {
  /** Preset being edited, or null when adding a new one. */
  editingId: string | null;
  name: string;
  hours: string;
  minutes: string;
  seconds: string;
};

/**
 * Preset list with add / edit / delete and a shared inline form.
 * Owns its own persisted state; the parent only receives load requests.
 */
export function PresetManager({ onLoad }: PresetManagerProps) {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const persist = (next: Preset[]) => {
    setPresets(next);
    savePresets(next);
  };

  const openAddForm = () => {
    setError("");
    setConfirmDeleteId(null);
    setForm({ editingId: null, name: "", hours: "0", minutes: "25", seconds: "0" });
  };

  const openEditForm = (preset: Preset) => {
    setError("");
    setConfirmDeleteId(null);
    setForm({
      editingId: preset.id,
      name: preset.label,
      hours: String(Math.floor(preset.seconds / 3600)),
      minutes: String(Math.floor((preset.seconds % 3600) / 60)),
      seconds: String(preset.seconds % 60),
    });
  };

  const closeForm = () => {
    setForm(null);
    setError("");
  };

  const handleSave = () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setError("Please enter a preset name.");
      return;
    }
    const hours = Number(form.hours);
    const minutes = Number(form.minutes);
    const seconds = Number(form.seconds);
    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      !Number.isInteger(seconds) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      setError("Hours must be 0-23, minutes 0-59, and seconds 0-59.");
      return;
    }
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0) {
      setError("Duration must be greater than zero.");
      return;
    }

    if (form.editingId === null) {
      persist([
        ...presets,
        { id: createPresetId(), label: name, seconds: totalSeconds },
      ]);
    } else {
      persist(
        presets.map((p) =>
          p.id === form.editingId
            ? { ...p, label: name, seconds: totalSeconds }
            : p,
        ),
      );
    }
    closeForm();
  };

  const handleDelete = (id: string) => {
    persist(presets.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <section className="glass-card presets-card">
      <div className="presets-header">
        <span className="presets-title">Presets</span>
        <button
          type="button"
          className="presets-add"
          onClick={openAddForm}
          disabled={form !== null}
        >
          + Add
        </button>
      </div>

      {form !== null && (
        <form
          className="preset-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <input
            className="preset-input"
            type="text"
            placeholder="Preset name"
            value={form.name}
            maxLength={40}
            autoFocus
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="preset-form-row">
            <label className="preset-field">
              <span>Hours</span>
              <input
                type="number"
                min={0}
                max={23}
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
              />
            </label>
            <label className="preset-field">
              <span>Minutes</span>
              <input
                type="number"
                min={0}
                max={59}
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: e.target.value })}
              />
            </label>
            <label className="preset-field">
              <span>Seconds</span>
              <input
                type="number"
                min={0}
                max={59}
                value={form.seconds}
                onChange={(e) => setForm({ ...form, seconds: e.target.value })}
              />
            </label>
          </div>
          {error && <div className="preset-error">{error}</div>}
          <div className="preset-form-actions">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={closeForm}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-small">
              Save
            </button>
          </div>
        </form>
      )}

      {presets.length === 0 && form === null && (
        <div className="presets-empty">
          No presets yet - add one to get started.
        </div>
      )}

      <ul className="preset-list">
        {presets.map((preset) => (
          <li key={preset.id} className="preset-row">
            <button
              type="button"
              className="preset-load"
              onClick={() => onLoad(preset.seconds * 1000)}
              title={`Load ${preset.label}`}
            >
              <span className="preset-name">{preset.label}</span>
              <span className="preset-duration">
                {formatDuration(preset.seconds * 1000)}
              </span>
            </button>
            <span className="preset-actions">
              {confirmDeleteId === preset.id ? (
                <>
                  <span className="preset-confirm">Delete?</span>
                  <button
                    type="button"
                    className="preset-action danger"
                    onClick={() => handleDelete(preset.id)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="preset-action"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="preset-action"
                    onClick={() => openEditForm(preset)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="preset-action"
                    onClick={() => setConfirmDeleteId(preset.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
