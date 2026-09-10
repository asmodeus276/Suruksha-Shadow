import { useEffect, useState, useCallback } from "react";
import { TrashIcon, CheckIcon } from "./icons";

const DEMO_CONTACTS_TEMPLATE = [
  {
    id: "demo-contact-1",
    name: "Ananya Sharma",
    phone: "919876543210",
    relationship: "Sister",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-contact-2",
    name: "Rohan Verma",
    phone: "919812345678",
    relationship: "Emergency Contact",
    created_at: new Date().toISOString(),
  },
];

function getStoredContacts() {
  try {
    const raw = localStorage.getItem("suraksha_trusted_contacts");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  // In development/demo, provide default demo contacts if localStorage is empty
  // In production, real users start with empty list for safety.
  if (import.meta.env.DEV) {
    return DEMO_CONTACTS_TEMPLATE;
  }
  return [];
}

function persistContacts(list) {
  try {
    localStorage.setItem("suraksha_trusted_contacts", JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/**
 * TrustedContacts management component.
 * Features dual-layer persistence with TRANSPARENT connection state:
 * - Shows cloud sync vs local cache state explicitly (no silent masking).
 * - Real users in production start empty for safety.
 * - 1-tap Demo Seeds button available for rapid hackathon testing.
 */
export default function TrustedContacts({ apiBaseUrl, userId, onContactsChange, onContactsLoaded }) {
  const [contacts, setContacts] = useState(getStoredContacts);
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState("checking"); // 'synced' | 'local_only' | 'checking'
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync initial contacts with parent
  useEffect(() => {
    const initial = getStoredContacts();
    setContacts(initial);
    onContactsChange?.(initial.length);
    onContactsLoaded?.(initial);
  }, [onContactsChange, onContactsLoaded]);

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.contacts)) {
          setDbStatus("synced");
          // If server has contacts, update state & local cache
          if (data.contacts.length > 0) {
            setContacts(data.contacts);
            persistContacts(data.contacts);
            onContactsChange?.(data.contacts.length);
            onContactsLoaded?.(data.contacts);
            return;
          }
        }
      } else {
        setDbStatus("local_only");
      }
    } catch {
      setDbStatus("local_only");
    }

    // Fallback to localStorage
    const local = getStoredContacts();
    setContacts(local);
    onContactsChange?.(local.length);
    onContactsLoaded?.(local);
  }, [apiBaseUrl, userId, onContactsChange, onContactsLoaded]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const addContact = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSubmitting(true);
    setError(null);

    const newContact = {
      id: "contact-" + Date.now(),
      name: name.trim(),
      phone: phone.trim().replace(/[\s-]/g, ""),
      relationship: relationship.trim() || "Emergency Contact",
      created_at: new Date().toISOString(),
    };

    const updated = [...contacts, newContact];
    setContacts(updated);
    persistContacts(updated);
    onContactsChange?.(updated.length);
    onContactsLoaded?.(updated);

    setName("");
    setPhone("");
    setRelationship("");

    // Attempt server sync
    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: newContact.name, phone: newContact.phone, relationship: newContact.relationship }),
      });
      if (res.ok) {
        setDbStatus("synced");
      } else {
        setDbStatus("local_only");
      }
    } catch {
      setDbStatus("local_only");
    } finally {
      setSubmitting(false);
    }
  };

  const removeContact = async (id) => {
    const next = contacts.filter((c) => c.id !== id);
    setContacts(next);
    persistContacts(next);
    onContactsChange?.(next.length);
    onContactsLoaded?.(next);

    try {
      const res = await fetch(`${apiBaseUrl}/api/contacts/${id}`, { method: "DELETE" });
      if (res.ok) setDbStatus("synced");
    } catch {
      setDbStatus("local_only");
    }
  };

  const loadDemoContacts = () => {
    setContacts(DEMO_CONTACTS_TEMPLATE);
    persistContacts(DEMO_CONTACTS_TEMPLATE);
    onContactsChange?.(DEMO_CONTACTS_TEMPLATE.length);
    onContactsLoaded?.(DEMO_CONTACTS_TEMPLATE);
  };

  const clearAllContacts = () => {
    setContacts([]);
    persistContacts([]);
    onContactsChange?.(0);
    onContactsLoaded?.([]);
  };

  return (
    <div>
      {/* Backend / Cloud Database Status Indicator */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          Emergency contacts notified immediately when Shield fires.
        </p>
        <span
          className="tag"
          style={{
            fontSize: 11,
            padding: "3px 8px",
            background: dbStatus === "synced" ? "rgba(78, 201, 148, 0.15)" : "rgba(235, 174, 66, 0.15)",
            color: dbStatus === "synced" ? "var(--mint)" : "var(--amber)",
            border: dbStatus === "synced" ? "1px solid rgba(78, 201, 148, 0.3)" : "1px solid rgba(235, 174, 66, 0.3)",
          }}
          title={dbStatus === "synced" ? "Connected to Cloud Database" : "Using local offline storage (Supabase key not configured or unreachable)"}
        >
          {dbStatus === "synced" ? "● Cloud DB Synced" : "🟡 Local Cache Mode"}
        </span>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <div className="stack-2 mb-2">
          <div className="skeleton" style={{ width: "70%" }} />
          <div className="skeleton" style={{ width: "45%" }} />
        </div>
      ) : contacts.length === 0 ? (
        <div className="card mb-3 text-center" style={{ padding: "16px", background: "rgba(0,0,0,0.15)" }}>
          <p className="text-sm text-dim mb-2">No trusted contacts configured yet.</p>
          <button
            type="button"
            className="btn-quiet"
            onClick={loadDemoContacts}
            style={{ fontSize: 12, padding: "6px 12px", margin: "0 auto" }}
          >
            ✨ Load Demo Contacts (2 Contacts)
          </button>
        </div>
      ) : (
        <div className="mb-3">
          {contacts.map((c) => (
            <div className="contact-row" key={c.id}>
              <span>
                <div className="name">{c.name}</div>
                <div className="meta">
                  {c.phone}
                  {c.relationship ? ` · ${c.relationship}` : ""}
                </div>
              </span>
              <button className="icon-btn" onClick={() => removeContact(c.id)} aria-label={`Remove ${c.name}`}>
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn-quiet"
              onClick={loadDemoContacts}
              style={{ fontSize: 11, padding: "4px 8px" }}
            >
              Reset Demo Contacts
            </button>
            <button
              type="button"
              className="btn-quiet"
              onClick={clearAllContacts}
              style={{ fontSize: 11, padding: "4px 8px", color: "var(--dim)" }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      <form onSubmit={addContact} className="form-stack mt-3">
        <input type="text" placeholder="Contact Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          type="tel"
          placeholder="Phone (with country code, e.g. 9198xxxxxxx)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Relationship (e.g. sister, parent, friend)"
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