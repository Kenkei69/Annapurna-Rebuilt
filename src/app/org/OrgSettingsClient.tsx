"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Shield,
  ChevronRight,
  Save,
  Trash2,
  Crown,
  UserCog,
  AlertCircle,
  CheckCircle2,
  Palette,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastBanner, ToastMessage } from "@/components/ui/ToastBanner";

interface Member {
  id: string;
  orgRole: string;
  createdAt: string | Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface OrgSettingsClientProps {
  org: {
    id: string;
    name: string;
    slug: string;
    type: string;
    createdAt: string | Date;
    partnerProfile?: {
      facilityName: string | null;
      facilityType: string;
      onboardingComplete: boolean;
      isActive: boolean;
      verificationStatus: string;
    } | null;
  };
  members: Member[];
  currentUserId: string;
  currentOrgRole: string;
}

const ORG_ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  DISPATCHER: "Dispatcher",
  DRIVER: "Driver",
  MEMBER: "Member",
};

const ORG_ROLE_ICONS: Record<string, React.ReactNode> = {
  OWNER: <Crown size={12} className="text-amber-500" />,
  DISPATCHER: <Shield size={12} className="text-blue-500" />,
  DRIVER: <UserCog size={12} className="text-emerald-500" />,
  MEMBER: <Users size={12} className="text-slate-400" />,
};

export function OrgSettingsClient({
  org,
  members,
  currentUserId,
  currentOrgRole,
}: OrgSettingsClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [tab, setTab] = useState<"profile" | "members" | "appearance">("profile");

  // Appearance State
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("annapurna_theme") as any) || "light";
    }
    return "light";
  });
  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("annapurna_contrast") === "high";
    }
    return false;
  });
  const [density, setDensity] = useState<"comfortable" | "compact">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("annapurna_density") as any) || "comfortable";
    }
    return "comfortable";
  });

  const handleApplyAppearance = (
    newTheme: "light" | "dark" | "system",
    newContrast: boolean,
    newDensity: "comfortable" | "compact"
  ) => {
    setThemeMode(newTheme);
    setHighContrast(newContrast);
    setDensity(newDensity);

    if (typeof window !== "undefined") {
      localStorage.setItem("annapurna_theme", newTheme);
      localStorage.setItem("annapurna_contrast", newContrast ? "high" : "normal");
      localStorage.setItem("annapurna_density", newDensity);

      const root = document.documentElement;
      if (newTheme === "dark") {
        root.classList.add("dark");
      } else if (newTheme === "light") {
        root.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", prefersDark);
      }

      if (newContrast) {
        root.classList.add("high-contrast");
      } else {
        root.classList.remove("high-contrast");
      }
    }
    setToast({ type: "success", message: "Appearance preferences saved successfully." });
  };

  // Organization name edit
  const [orgName, setOrgName] = useState(org.name);
  const [savingName, setSavingName] = useState(false);

  // Member role editing
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>("");
  const [updatingMember, setUpdatingMember] = useState(false);

  const isOwner = currentOrgRole === "OWNER";

  const handleSaveOrgName = async () => {
    if (!orgName.trim() || orgName.trim() === org.name) return;
    try {
      setSavingName(true);
      const res = await fetch("/api/org/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update organization name");
      setToast({ type: "success", message: "Organization name updated successfully." });
      router.refresh();
    } catch (err: unknown) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update" });
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string) => {
    try {
      setUpdatingMember(true);
      const res = await fetch("/api/org/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, orgRole: editingRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      setEditingMember(null);
      setToast({ type: "success", message: "Member role updated." });
      router.refresh();
    } catch (err: unknown) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update" });
    } finally {
      setUpdatingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this organization?`)) return;
    try {
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      setToast({ type: "success", message: `${memberName} removed from organization.` });
      router.refresh();
    } catch (err: unknown) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to remove" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Page header */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <span>Dashboard</span>
          <ChevronRight size={12} />
          <span className="text-slate-900 font-medium">Organization Settings</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Organization Settings</h1>
        <p className="text-sm text-slate-500 mt-1">{org.name} · {org.type === "FLEET" ? "Fleet Operator" : "Rescue Partner"}</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {(["profile", "members", "appearance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "profile"
              ? "Organization Profile"
              : t === "members"
              ? "Members & Roles"
              : "Appearance & Accessibility"}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === "profile" && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-slate-400" />
              Organization Profile
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <dt className="text-xs text-slate-500 font-medium mb-0.5">Organization ID</dt>
                <dd className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded">{org.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 font-medium mb-0.5">URL Slug</dt>
                <dd className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded">{org.slug}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 font-medium mb-0.5">Organization Type</dt>
                <dd><StatusBadge status={org.type} /></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 font-medium mb-0.5">Created</dt>
                <dd className="text-slate-700">{new Date(org.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>

            {/* Editable name */}
            <div className="border-t border-slate-100 pt-4">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Organization Name
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={!isOwner}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                  maxLength={100}
                />
                {isOwner && (
                  <button
                    onClick={handleSaveOrgName}
                    disabled={savingName || orgName.trim() === org.name || !orgName.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors"
                  >
                    <Save size={13} />
                    {savingName ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
              {!isOwner && (
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} />
                  Only organization owners can rename the organization.
                </p>
              )}
            </div>
          </div>

          {/* Partner profile status */}
          {org.partnerProfile && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield size={16} className="text-slate-400" />
                Partner Profile Status
              </h2>
              <div className="flex items-start gap-3">
                {org.partnerProfile.onboardingComplete && org.partnerProfile.isActive ? (
                  <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {org.partnerProfile.isActive ? "Active — Eligible to bid on rescue opportunities" : "Inactive — Complete onboarding to participate"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verification: {org.partnerProfile.verificationStatus.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Profile information is self-reported and has not been independently verified.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === "members" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Members</h2>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{members.length}</span>
            </div>
            {!isOwner && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <AlertCircle size={11} />
                Read-only — contact an owner to change roles
              </p>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-slate-500">Member</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">Organization Role</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">Platform Role</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">Joined</th>
                {isOwner && <th className="px-3 py-2.5 text-xs font-medium text-slate-500 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{m.user.name}</div>
                    <div className="text-xs text-slate-500">{m.user.email}</div>
                    {m.user.id === currentUserId && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">You</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {isOwner && editingMember === m.id ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value)}
                          className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          {["OWNER", "DISPATCHER", "DRIVER", "MEMBER"].map((r) => (
                            <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleUpdateMemberRole(m.id)}
                          disabled={updatingMember}
                          className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMember(null)}
                          className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {ORG_ROLE_ICONS[m.orgRole]}
                        <span className="text-xs text-slate-700">{ORG_ROLE_LABELS[m.orgRole] || m.orgRole}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={m.user.role} />
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                  {isOwner && (
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {m.user.id !== currentUserId && (
                          <>
                            <button
                              onClick={() => {
                                setEditingMember(m.id);
                                setEditingRole(m.orgRole);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                              title="Change role"
                            >
                              <UserCog size={14} />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(m.id, m.user.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                              title="Remove member"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {members.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No members found.</div>
          )}

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              To add members, they must register with the platform and contact an organization owner.
              Driver invitation workflows require a configured email integration.
            </p>
          </div>
        </div>
      )}

      {/* Appearance & Accessibility tab */}
      {tab === "appearance" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Palette size={18} className="text-emerald-600" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Color Theme &amp; Contrast</h2>
                <p className="text-xs text-slate-500">
                  Customizable display modes complying with WCAG 2.1 AA accessibility guidelines
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Display Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "light", label: "Light Theme", desc: "Neutral light surfaces & slate sidebar", icon: <Sun size={16} /> },
                    { id: "dark", label: "Dark Mode", desc: "Dark background for low-light environments", icon: <Moon size={16} /> },
                    { id: "system", label: "System Sync", desc: "Matches operating system settings", icon: <Monitor size={16} /> },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleApplyAppearance(m.id as any, highContrast, density)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        themeMode === m.id
                          ? "border-emerald-600 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-500/20"
                          : "border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm flex items-center gap-2">
                          {m.icon}
                          <span>{m.label}</span>
                        </span>
                        {themeMode === m.id && <CheckCircle2 size={16} className="text-emerald-600" />}
                      </div>
                      <p className="text-xs text-slate-500">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Accessibility Contrast
                  </label>
                  <button
                    type="button"
                    onClick={() => handleApplyAppearance(themeMode, !highContrast, density)}
                    className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      highContrast
                        ? "border-emerald-600 bg-emerald-50/40 text-emerald-950"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Enhanced Contrast</span>
                      {highContrast && <CheckCircle2 size={16} className="text-emerald-600" />}
                    </div>
                    <p className="text-xs text-slate-500">
                      Strengthens typography contrast and sharpens operational border delineations for control room readability.
                    </p>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Console Density
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "comfortable", label: "Comfortable", desc: "Default spacing" },
                      { id: "compact", label: "High Density", desc: "Information-dense" },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleApplyAppearance(themeMode, highContrast, d.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          density === d.id
                            ? "border-emerald-600 bg-emerald-50/40 text-emerald-950"
                            : "border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <span className="font-semibold text-xs block mb-0.5">{d.label}</span>
                        <span className="text-[11px] text-slate-500">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
