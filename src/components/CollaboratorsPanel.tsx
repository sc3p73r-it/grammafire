import React, { useState } from "react";
import { Users, UserPlus, Trash2, Mail, ShieldAlert } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

interface CollaboratorsPanelProps {
  documentId: string;
  collaborators: string[];
  ownerEmail: string;
  currentUserEmail: string | null;
  currentUserTier: "free" | "pro";
  onTriggerUpgrade: () => void;
}

export default function CollaboratorsPanel({
  documentId,
  collaborators,
  ownerEmail,
  currentUserEmail,
  currentUserTier,
  onTriggerUpgrade,
}: CollaboratorsPanelProps) {
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUserTier !== "pro") {
      onTriggerUpgrade();
      return;
    }

    const emailToInvite = newEmail.trim().toLowerCase();
    if (!emailToInvite) return;

    if (emailToInvite === ownerEmail.toLowerCase()) {
      setErrorMsg("You are already the owner of this document.");
      return;
    }

    if (collaborators.includes(emailToInvite)) {
      setErrorMsg("User is already a collaborator.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const docRef = doc(db, "documents", documentId);
    try {
      await updateDoc(docRef, {
        collaborators: arrayUnion(emailToInvite),
        updatedAt: new Date()
      });
      setNewEmail("");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `documents/${documentId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCollaborator = async (email: string) => {
    if (currentUserTier !== "pro") {
      onTriggerUpgrade();
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const docRef = doc(db, "documents", documentId);
    try {
      await updateDoc(docRef, {
        collaborators: arrayRemove(email),
        updatedAt: new Date()
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `documents/${documentId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-50 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <Users size={14} className="text-slate-500" />
          Collaboration Room
        </h3>
        {currentUserTier !== "pro" && (
          <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-sm">
            PRO ONLY
          </span>
        )}
      </div>

      {currentUserTier !== "pro" ? (
        <div className="p-3 bg-amber-50 rounded-lg flex gap-2 items-start text-xs text-amber-900 border border-amber-100/30">
          <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Join the collaborative room</p>
            <p className="text-[11px] leading-relaxed text-amber-800/80">
              Grammar checks are better together! Upgrade to Pro to invite other writers, edit concurrently, and review suggestions in real-time.
            </p>
            <button
              onClick={onTriggerUpgrade}
              className="text-[10px] font-bold text-amber-900 underline mt-1 block hover:text-amber-950 cursor-pointer"
            >
              Learn more & Upgrade
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active Collaborators */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Authorized Members</h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {/* Owner Item */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100/50 text-xs">
                <span className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  {ownerEmail}
                </span>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  Owner
                </span>
              </div>

              {/* Collaborators */}
              {collaborators.length === 0 ? (
                <p className="text-xs text-center text-gray-400 py-3">No other writers invited yet.</p>
              ) : (
                collaborators.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs hover:bg-gray-100/50 transition-colors"
                  >
                    <span className="text-gray-700 truncate flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {email}
                    </span>
                    {(currentUserEmail === ownerEmail) && (
                      <button
                        onClick={() => handleRemoveCollaborator(email)}
                        disabled={loading}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-sm cursor-pointer disabled:opacity-40"
                        title="Revoke access"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invitation Form */}
          <form onSubmit={handleAddCollaborator} className="space-y-2 pt-2 border-t border-gray-50">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Invite Writer</h4>
            {errorMsg && (
              <p className="text-[11px] text-red-500 bg-red-50 rounded-sm p-1 px-2 font-medium">{errorMsg}</p>
            )}
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full text-xs border border-gray-200 rounded-lg pl-8 pr-2 py-2 text-gray-800 focus:outline-none focus:border-slate-800"
                />
                <Mail className="absolute left-2.5 top-2.5 text-gray-400" size={12} />
              </div>
              <button
                type="submit"
                disabled={loading || !newEmail.trim()}
                className="bg-slate-900 text-white rounded-lg p-2 hover:bg-slate-800 cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                title="Send Invite"
              >
                <UserPlus size={14} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
