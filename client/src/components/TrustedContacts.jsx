import { useEffect, useState, useCallback } from "react";

/**
 * Onboarding piece for FRD §7: "At least one Trusted Contact must be
 * configured before Shield or Guardian Mode can function." Lets the
 * Primary User add/remove the people who get notified on SOS.
 */
export default function TrustedContacts({ apiBaseUrl, userId, onContactsChange }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts/${userId}`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setContacts(data.contacts || []);
      onContactsChange?.(data.contacts?.length || 0);
    } catch (err) {
      console.error("Failed to load trusted contacts:", err);
      setError("Couldn't load contacts — is the server running?");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, userId, onContactsChange]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const addContact = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, phone, relationship }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setName("");
      setPhone("");
      setRelationship("");
      await loadContacts();
    } catch (err) {
      console.error("Failed to add trusted contact:", err);
      setError("Couldn't add that contact — double-check the phone number and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeContact = async (id) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setContacts((prev) => {
        const next = prev.filter((c) => c.id !== id);
        onContactsChange?.(next.length);
        return next;
      });
    } catch (err) {
      console.error("Failed to remove trusted contact:", err);
      setError("Couldn't remove that contact — try again.");
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--mist)", marginBottom: 14 }}>
        These people get notified (location + status) the moment Shield fires. At least one is required.
      </p>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--mist-dim)" }}>Loading…</p>
      ) : contacts.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--mist-dim)" }}>No trusted contacts yet — add one below.</p>
      ) : (
        <div style={{ marginBottom: 6 }}>
          {contacts.map((c) => (
            <div className="contact-row" key={c.id}>
              <span>
                <div className="name">{c.name}</div>
                <div className="meta">
                  {c.phone}
                  {c.relationship ? ` · ${c.relationship}` : ""}
                </div>
              </span>
              <button className="btn-quiet" onClick={() => removeContact(c.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addContact} className="form-stack">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          type="tel"
          placeholder="Phone (with country code, e.g. 9198xxxxxxx)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Relationship (optional — e.g. sister, friend)"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Adding…" : "Add Trusted Contact"}
        </button>
      </form>
    </div>
  );
}