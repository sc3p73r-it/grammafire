import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Users,
  CheckCircle,
  FileCode,
  Languages,
  Plus,
  Compass,
  FileText,
  AlertCircle,
  LogOut,
  FolderOpen,
  ChevronRight,
  ShieldAlert,
  Save,
  Loader2,
  Trash,
  HelpCircle,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { SubscriptionTier, CodeLanguage, GrammaDoc, GrammarIssue, Revision } from "./types";
import ImportExport from "./components/ImportExport";
import SubscriptionModal from "./components/SubscriptionModal";
import CollaboratorsPanel from "./components/CollaboratorsPanel";
import RevisionHistory from "./components/RevisionHistory";

export default function App() {
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ email: string; displayName: string; tier: SubscriptionTier } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showDemoLogin, setShowDemoLogin] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoDisplayName, setDemoDisplayName] = useState("");

  // Documents state
  const [documents, setDocuments] = useState<GrammaDoc[]>([]);
  const [activeDoc, setActiveDoc] = useState<GrammaDoc | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  
  // Local active text inputs
  const [editorText, setEditorText] = useState("");
  const [docTitle, setDocTitle] = useState("Untitled Draft");
  const [docLanguage, setDocLanguage] = useState<CodeLanguage>("en");
  
  // Synchronization debouncer state
  const [isSyncing, setIsSyncing] = useState(false);

  // Grammar engine states
  const [checkingGrammar, setCheckingGrammar] = useState(false);
  const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[]>([]);
  const [correctedText, setCorrectedText] = useState("");
  const [checkError, setCheckError] = useState<string | null>(null);

  // Revisions state
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);

  // UI Panels / Modals
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "help">("workspace");

  // Local state reference to solve cursor jumps or stale closures during snapshot updates
  const isEditingLocal = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Authenticate & Synchronize User Profiles
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Load or create Firestore database profile
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as any);
          } else {
            // New register! Create default profile
            const newProfile = {
              email: firebaseUser.email || "writer@grammafire.local",
              displayName: firebaseUser.displayName || "GrammaFire Writer",
              tier: "free" as SubscriptionTier,
              createdAt: new Date(),
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (e) {
          console.warn("Could not load user profile from firestore rules. Providing local secure fallback.", e);
          setUserProfile({
            email: firebaseUser.email || "writer@grammafire.local",
            displayName: firebaseUser.displayName || "GrammaFire Writer",
            tier: "free"
          });
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setActiveDoc(null);
        setDocuments([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // One click Google login popup
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.warn("Popup blocked or auth failure inside iframe. Directing user to use Sandbox local simulation credentials block:", err);
      setShowDemoLogin(true);
    }
  };

  // Secure local demo auth sign-in for iframe runtime compatibility
  const handleSandboxLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEmail || !demoDisplayName) return;

    setAuthLoading(true);
    try {
      // Sign-in with simulated credentials if actual providers are locked under 3rd party cookie restrictions
      // In this system, we can easily emulate a user profile by saving to the auth store
      // But creating a deterministic credentials mock will be more robust for iframe previewers
      setUser({
        uid: "sandbox_" + Math.random().toString(36).substring(2, 9),
        email: demoEmail,
        displayName: demoDisplayName,
        emailVerified: true
      });
      setUserProfile({
        email: demoEmail,
        displayName: demoDisplayName,
        tier: "free",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // Local cleanout fallback if sandbox account
      setUser(null);
      setUserProfile(null);
    }
  };

  const handleFetchUserProfile = async () => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as any);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // 2. Fetch Owned Documents + Shared Collaboration Documents
  useEffect(() => {
    if (!user) return;

    setDocsLoading(true);
    const docsCol = collection(db, "documents");
    
    // We listen to documents owned by the user, or where they are added as collaborator
    const userEmail = user.email || "writer@grammafire.local";
    const q = query(
      docsCol,
      where("ownerId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: GrammaDoc[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as GrammaDoc);
      });

      // Also let's query documents where they are collaborators
      try {
        const collabQuery = query(docsCol, where("collaborators", "array-contains", userEmail));
        const collabSnap = await getDocs(collabQuery);
        collabSnap.forEach((doc) => {
          if (!list.some(item => item.id === doc.id)) {
            list.push({ id: doc.id, ...doc.data() } as GrammaDoc);
          }
        });
      } catch (e) {
        console.warn("Collaborator query restricted or incomplete:", e);
      }

      setDocuments(list);
      setDocsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "documents");
    });

    return () => unsubscribe();
  }, [user]);

  // Create a new Document
  const handleCreateDocument = async () => {
    if (!user) return;
    
    // Tier check: Free tier limit length check for documents count
    if (userProfile?.tier === "free" && documents.length >= 3) {
      setShowBillingModal(true);
      return;
    }

    const docId = "doc_" + Math.random().toString(36).substring(2, 11);
    const newDocObj = {
      title: "New Drafting Session",
      content: "Type English or Myanmar text here ...",
      ownerId: user.uid,
      ownerEmail: user.email || "writer@grammafire.local",
      language: "en" as CodeLanguage,
      collaborators: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await setDoc(doc(db, "documents", docId), newDocObj);
      // Select the newly created document
      setActiveDoc({ id: docId, ...newDocObj });
      setEditorText(newDocObj.content);
      setDocTitle(newDocObj.title);
      setDocLanguage(newDocObj.language);
      setGrammarIssues([]);
      setCorrectedText("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `documents/${docId}`);
    }
  };

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document session?")) return;

    try {
      await deleteDoc(doc(db, "documents", docId));
      if (activeDoc?.id === docId) {
        setActiveDoc(null);
        setEditorText("");
        setDocTitle("");
        setGrammarIssues([]);
        setCorrectedText("");
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `documents/${docId}`);
    }
  };

  // Select active document and load properties
  const handleSelectDocument = (docItem: GrammaDoc) => {
    setActiveDoc(docItem);
    setEditorText(docItem.content);
    setDocTitle(docItem.title);
    setDocLanguage(docItem.language);
    setGrammarIssues([]);
    setCorrectedText("");
    setActiveRevisionId(null);
  };

  // 3. Real-time active document Sync Listening (Collaboration state changes)
  useEffect(() => {
    if (!activeDoc?.id) return;

    const docRef = doc(db, "documents", activeDoc.id);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedData = snapshot.data() as GrammaDoc;
        
        // Only override local editorText if local is NOT actively editing (prevents annoying cursor jumps)
        if (!isEditingLocal.current) {
          setEditorText(updatedData.content);
          setDocTitle(updatedData.title);
          setDocLanguage(updatedData.language);
        }
        
        // Dynamically keep activeDoc state details synchronized
        setActiveDoc({ id: snapshot.id, ...updatedData });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `documents/${activeDoc.id}`);
    });

    return () => unsubscribe();
  }, [activeDoc?.id]);

  // 4. Listen to Historic revisions of the active document
  useEffect(() => {
    if (!activeDoc?.id) {
      setRevisions([]);
      return;
    }

    const revsCol = collection(db, "documents", activeDoc.id, "revisions");
    const q = query(revsCol, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Revision[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Revision);
      });
      setRevisions(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `documents/${activeDoc.id}/revisions`);
    });

    return () => unsubscribe();
  }, [activeDoc?.id]);

  // Propagate text changes back to Firestore with a lightweight 800ms debounce
  const triggerDebouncedSync = useCallback((newText: string, updatedTitle: string, updatedLang: CodeLanguage) => {
    if (!activeDoc?.id) return;
    setIsSyncing(true);

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      const docRef = doc(db, "documents", activeDoc.id);
      try {
        await updateDoc(docRef, {
          content: newText,
          title: updatedTitle,
          language: updatedLang,
          updatedAt: new Date(),
        });
      } catch (err) {
        console.warn("Failed to synchronize cursor state with rule restrictions:", err);
      } finally {
        setIsSyncing(false);
        isEditingLocal.current = false;
      }
    }, 800);
  }, [activeDoc?.id]);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    isEditingLocal.current = true;
    setEditorText(text);
    triggerDebouncedSync(text, docTitle, docLanguage);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const codeTitle = e.target.value;
    isEditingLocal.current = true;
    setDocTitle(codeTitle);
    triggerDebouncedSync(editorText, codeTitle, docLanguage);
  };

  const handleLanguageChange = (lang: CodeLanguage) => {
    if (lang === "my" && userProfile?.tier !== "pro") {
      setShowBillingModal(true);
      return;
    }
    setDocLanguage(lang);
    triggerDebouncedSync(editorText, docTitle, lang);
  };

  // Extract from uploaded txt/docx
  const handleTextImported = (importedText: string, importedTitle: string) => {
    isEditingLocal.current = true;
    setEditorText(importedText);
    setDocTitle(importedTitle);
    triggerDebouncedSync(importedText, importedTitle, docLanguage);
  };

  // 5. Connect to Server-Side AI Gramma-Check Endpoint
  const handleCheckGrammar = async () => {
    if (!editorText.trim()) return;

    // Character length constraints per Tier
    const cap = userProfile?.tier === "pro" ? 15000 : 1200;
    if (editorText.length > cap) {
      setShowBillingModal(true);
      setCheckError(`Free tier limits spelling checks to 1,200 characters. Your text is ${editorText.length} characters long. Upgrade to Pro for unlimited billing limits (15,000 chars)!`);
      return;
    }

    setCheckingGrammar(true);
    setCheckError(null);
    setGrammarIssues([]);
    setCorrectedText("");

    try {
      const res = await fetch("/api/grammar/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editorText,
          language: docLanguage,
          tier: userProfile?.tier || "free",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Grammar evaluation failed.");
      }

      setCorrectedText(data.correctedText || "");
      setGrammarIssues(data.issues || []);

      // Auto save this verified correction into Firebase revision history subcollection sync
      if (activeDoc?.id && user) {
        const revRef = collection(db, "documents", activeDoc.id, "revisions");
        const revId = "rev_" + Math.random().toString(36).substring(2, 11);
        await setDoc(doc(revRef, revId), {
          documentId: activeDoc.id,
          content: data.correctedText || editorText,
          originalContent: editorText,
          corrections: data.issues || [],
          createdAt: new Date(),
          authorId: user.uid,
        });
      }
    } catch (err: any) {
      console.error(err);
      setCheckError(err.message || "An error occurred connecting to language models.");
    } finally {
      setCheckingGrammar(false);
    }
  };

  const applySingleCorrection = (issue: GrammarIssue) => {
    // Basic substring replace or offset calculation
    // Offsets might drift slightly on sequential writes, so string-replace is safer for single-clicking
    const updated = editorText.replace(issue.original, issue.replacement);
    setEditorText(updated);
    
    // Remove issues from checked list
    setGrammarIssues(prev => prev.filter(i => i.original !== issue.original));
    triggerDebouncedSync(updated, docTitle, docLanguage);
  };

  const applyAllCorrections = () => {
    if (!correctedText) return;
    setEditorText(correctedText);
    setGrammarIssues([]);
    triggerDebouncedSync(correctedText, docTitle, docLanguage);
  };

  // Restore past historic revision draft
  const handleRestoreRevision = (rev: Revision) => {
    setActiveRevisionId(rev.id);
    setEditorText(rev.content);
    setGrammarIssues(rev.corrections);
    triggerDebouncedSync(rev.content, docTitle, docLanguage);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col antialiased">
      {/* Dynamic Billing Paywall sliding modal */}
      {showBillingModal && user && (
        <SubscriptionModal
          uid={user.uid}
          currentTier={userProfile?.tier || "free"}
          onUpgradeSuccess={async () => {
            await handleFetchUserProfile();
            setShowBillingModal(false);
          }}
          onClose={() => setShowBillingModal(false)}
        />
      )}

      {/* Primary Header Utility Nav */}
      <nav id="navbar" className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-slate-900 border-2 border-slate-900 text-amber-400 rounded-xl flex items-center justify-center font-black text-xl shadow-xs">
            GF
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">GrammaFire</h1>
            <p className="text-[10px] text-gray-400 font-medium">Bilingual Grammar & Speller</p>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            {/* Tier Badge */}
            <button
              onClick={() => setShowBillingModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                userProfile?.tier === "pro"
                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              <Sparkles size={12} className={userProfile?.tier === "pro" ? "text-amber-600 animate-spin-pulse" : "text-gray-400"} />
              {userProfile?.tier === "pro" ? "Linguistic Pro Active" : "Get GrammaFire Pro"}
            </button>

            {/* User Profile Info */}
            <div className="flex items-center gap-2 border-l border-gray-100 pl-3">
              <div className="hidden md:block text-right">
                <p className="text-xs font-bold text-gray-800 leading-none">{userProfile?.displayName || user.displayName}</p>
                <p className="text-[10px] text-gray-400 truncate max-w-[140px] mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-red-500 rounded-lg hover:text-red-600 transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-400 font-medium">Bilingual Editorial Space</span>
        )}
      </nav>

      {/* Main Framework body */}
      {!user ? (
        /* Unauthenticated Auth Splash Lobby Layout */
        <main className="flex-1 flex flex-col items-center justify-center p-6 bg-linear-to-b from-white to-slate-50">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-gray-100 p-8 rounded-2xl max-w-md w-full shadow-lg text-center space-y-6"
          >
            <div className="w-16 h-16 bg-slate-900 text-amber-400 rounded-2xl flex items-center justify-center font-black text-3xl mx-auto shadow-md">
              GF
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Sign in to GrammaFire</h2>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Review, correct and sync English & Myanmar documents in a collaborative real-time environment.
              </p>
            </div>

            {showDemoLogin ? (
              /* Local sandboxed credentials login helper */
              <form onSubmit={handleSandboxLogin} className="space-y-3 text-left">
                <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-900 border border-amber-100 border-dashed">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <ShieldAlert size={14} /> Sandbox One-click sign-in
                  </p>
                  We provided this alternative access method in case Google OAuth popup blocking prevents authentication within the workspace iframe. Choose any moniker to play!
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Pseudonym / Name</label>
                  <input
                    type="text"
                    required
                    value={demoDisplayName}
                    onChange={(e) => setDemoDisplayName(e.target.value)}
                    placeholder="e.g. Writer Pro Mg Mg"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">User Email</label>
                  <input
                    type="email"
                    required
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    placeholder="mgmg@gmail.com"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDemoLogin(false)}
                    className="w-1/3 py-2.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                  >
                    Go Back
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Launch Session
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2.5 py-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 bg-white hover:bg-gray-50/50 shadow-xs cursor-pointer active:scale-[0.99] transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.67 0 3.17.58 4.35 1.71l3.25-3.25C17.63 1.63 15 .75 12 .75 7.42.75 3.52 3.38 1.62 7.21l3.86 3c.91-2.73 3.47-4.17 6.52-4.17z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.46-1.1 2.69-2.33 3.52l3.62 2.81c2.12-1.96 3.76-4.84 3.76-8.46z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.48 14.5c-.24-.71-.38-1.47-.38-2.5s.14-1.79.38-2.5l-3.86-3C.62 8.35 0 10.11 0 12s.62 3.65 1.62 5.5l3.86-3z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.25c3.24 0 5.97-1.07 7.96-2.91l-3.62-2.81c-.99.66-2.27 1.06-4.34 1.06-3.05 0-5.61-1.44-6.52-4.17l-3.86 3c1.9 3.83 5.8 6.46 10.38 6.46z"
                    />
                  </svg>
                  Sign in with Google Account
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                  <span className="relative text-[9px] font-bold tracking-wider text-gray-400 bg-white px-2 uppercase">OR</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDemoLogin(true)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-all"
                >
                  Launch Sandbox Demo Session
                </button>
              </div>
            )}

            <div className="text-[10px] text-gray-400 leading-relaxed pt-2">
              By using GrammaFire, you agree to secure rule constraints. Standard user credentials are sandbox-compatible for prompt editing compatibility.
            </div>
          </motion.div>
        </main>
      ) : (
        /* Authenticated Interactive Grammar Workspace dashboard */
        <main className="flex-1 flex overflow-hidden">
          {/* LEFT RAIL - Document Manager sessions history */}
          <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
            <div className="p-4 border-b border-gray-50 space-y-3">
              <button
                onClick={handleCreateDocument}
                disabled={docsLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-2.5 px-3 text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                New Document
              </button>
              
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Checked Drafts ({documents.length})
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {docsLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-xs text-gray-400 font-medium">
                  <Loader2 className="animate-spin text-slate-500" size={14} />
                  <span>Loading cloud storage...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-1 text-gray-400">
                  <FolderOpen size={16} className="mx-auto text-gray-300" />
                  <p className="text-xs font-semibold">No Documents</p>
                  <p className="text-[10px]">Create or upload a .txt to start checking.</p>
                </div>
              ) : (
                documents.map((docItem) => {
                  const isSelected = activeDoc?.id === docItem.id;
                  const isShared = docItem.ownerId !== user.uid;

                  return (
                    <div
                      key={docItem.id}
                      onClick={() => handleSelectDocument(docItem)}
                      className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-all ${
                        isSelected
                          ? "bg-slate-900 text-white font-semibold"
                          : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                        <FileText size={14} className={isSelected ? "text-amber-400" : "text-gray-400"} />
                        <div className="truncate text-left">
                          <p className="truncate font-medium">{docItem.title || "Untitled draft"}</p>
                          <span className="text-[9px] opacity-60 font-mono tracking-tight block">
                            {docItem.language === "en" ? "English" : "မြန်မာ"} • {isShared ? "Collab" : "Mine"}
                          </span>
                        </div>
                      </div>
                      
                      {/* Delete Session trigger for owner */}
                      {!isShared && (
                        <button
                          onClick={(e) => handleDeleteDocument(docItem.id, e)}
                          className={`opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white p-1 rounded-sm cursor-pointer transition-all ${
                            isSelected ? "text-slate-300 hover:bg-red-600" : "text-gray-400"
                          }`}
                          title="Delete document"
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick stats / Account footer info */}
            <div className="p-3 bg-slate-50 border-t border-gray-100 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between font-medium">
                <span>Account Tier:</span>
                <span className="capitalize font-bold text-slate-900">{userProfile?.tier || "Free"}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Usage logs:</span>
                <span>{documents.length} / {userProfile?.tier === "pro" ? "Unlimited" : "3 drafts"}</span>
              </div>
            </div>
          </aside>

          {/* MIDDLE AREA - Bilingual Document Editor */}
          <section className="flex-1 flex flex-col bg-white overflow-hidden">
            {activeDoc ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Active Document Top Controls */}
                <div className="px-6 py-3 border-b border-gray-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={docTitle}
                      onChange={handleTitleChange}
                      className="text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-slate-800 focus:outline-none py-1 truncate flex-1"
                      placeholder="Give this draft a title"
                    />
                    
                    {isSyncing && (
                      <span className="text-[10px] font-mono text-gray-400 shrink-0 flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" />
                        autosaving...
                      </span>
                    )}
                  </div>

                  {/* Language Selector */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase mr-1.5 flex items-center gap-1">
                      <Languages size={12} /> Language:
                    </span>
                    <button
                      onClick={() => handleLanguageChange("en")}
                      className={`px-3 py-1 rounded text-xs px-2.5 font-semibold transition-all cursor-pointer ${
                        docLanguage === "en"
                          ? "bg-slate-900 text-white"
                          : "bg-white hover:bg-gray-100 text-slate-700 border border-gray-200"
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => handleLanguageChange("my")}
                      className={`px-3 py-1 rounded text-xs px-2.5 font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                        docLanguage === "my"
                          ? "bg-slate-900 text-white"
                          : "bg-white hover:bg-gray-100 text-slate-700 border border-gray-200"
                      }`}
                    >
                      မြန်မာ (Myanmar)
                      {userProfile?.tier !== "pro" && (
                        <span className="text-[8px] bg-amber-400 text-slate-950 font-bold px-1 rounded-full uppercase scale-[0.9]">PRO</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Main Split Window Workspace */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  
                  {/* TEXT EDITOR BOX CONTAINER */}
                  <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4 border-r border-gray-100">
                    <div className="flex-1 flex flex-col relative min-h-[250px] md:min-h-0 bg-slate-50/30 rounded-xl p-3 border border-gray-100">
                      
                      {/* Editor body text field */}
                      <textarea
                        value={editorText}
                        onChange={handleEditorChange}
                        placeholder={docLanguage === "my" ? "မြန်မာစာသားကို ဤနေရာတွင် ရိုက်ထည့်ပါ သို့မဟုတ် စစ်ဆေးရန် တင်သွင်းပါ ..." : "Start proofreading by typing or paste your English text here ..."}
                        className="w-full flex-1 text-sm leading-relaxed text-slate-800 bg-transparent resize-none border-none focus:outline-none font-sans"
                      />

                      {/* Interactive issue highlight count marker */}
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 pointer-events-none">
                        <span className="text-[11px] font-mono font-medium text-gray-400 bg-white border border-gray-100 px-2 py-0.5 rounded shadow-2xs">
                          {editorText.length} chars
                        </span>
                        {grammarIssues.length > 0 && (
                          <span className="text-[11px] font-mono font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded shadow-2xs animate-pulse">
                            ● {grammarIssues.length} corrections available
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom AI Grammar Engine Commands */}
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-gray-300" />
                        <span>
                          {userProfile?.tier === "pro" 
                            ? "Uncapped premium processing up to 15,000 characters per analysis." 
                            : "Standard free plan covers up to 1,200 character checks per cycle."}
                        </span>
                      </div>

                      <button
                        onClick={handleCheckGrammar}
                        disabled={checkingGrammar || !editorText.trim()}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-3 px-6 text-xs font-bold tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed uppercase"
                      >
                        {checkingGrammar ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Analyzing language ...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} className="text-amber-400" />
                            Run Grammar Checker
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* LATERAL GRAMMAR LOGS & PROOF LIST INSIDE EDITOR */}
                  <div className="w-full md:w-80 bg-slate-50/30 overflow-y-auto p-4 flex flex-col space-y-4 shrink-0 border-t md:border-t-0 border-gray-100">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 shrink-0">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">AI Corrections Room</h3>
                      {grammarIssues.length > 0 && (
                        <button
                          onClick={applyAllCorrections}
                          className="text-[10px] font-extrabold text-indigo-700 hover:text-indigo-850 underline cursor-pointer"
                        >
                          Apply All Changes
                        </button>
                      )}
                    </div>

                    {checkError && (
                      <div className="bg-red-50 text-red-700 rounded-lg p-3 text-xs border border-red-100 space-y-1">
                        <p className="font-bold flex items-center gap-1"><AlertCircle size={12} /> Process Terminated</p>
                        <p className="text-[11px] leading-relaxed font-medium">{checkError}</p>
                      </div>
                    )}

                    {checkingGrammar && (
                      <div className="py-20 text-center space-y-3">
                        <Loader2 className="animate-spin text-slate-400 mx-auto" size={24} />
                        <p className="text-xs font-semibold text-gray-500">Grammar model executing analysis ...</p>
                        <p className="text-[10px] text-gray-400 max-w-[200px] mx-auto">Evaluating lexicon syntax, particles, and bilingual structural spelling parameters.</p>
                      </div>
                    )}

                    {!checkingGrammar && grammarIssues.length === 0 && !checkError && (
                      <div className="py-16 text-center space-y-2 text-gray-400">
                        <CheckCircle size={32} className="mx-auto text-emerald-400" />
                        <p className="text-xs font-bold text-gray-700">All Pristine!</p>
                        <p className="text-[10px] max-w-[210px] mx-auto">Click check to review writing mechanics and grammar. Discrepancies will appear in real-time right here.</p>
                      </div>
                    )}

                    {/* Correction suggestion items */}
                    {!checkingGrammar && grammarIssues.length > 0 && (
                      <div className="space-y-3.5 pr-1">
                        {grammarIssues.map((issue, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-gray-100 rounded-xl p-3.5 space-y-2.5 shadow-2xs hover:border-slate-300 transition-all duration-150 animate-in fade-in"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="bg-red-50 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded decoration-dashed">
                                Delete: "{issue.original}"
                              </span>
                              <ChevronRight size={14} className="text-gray-300 mt-1" />
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                                Use: "{issue.replacement}"
                              </span>
                            </div>

                            <p className="text-[11px] text-gray-600 leading-relaxed font-medium font-sans">
                              {issue.explanation}
                            </p>
                            
                            {issue.explanation_my && (
                              <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100 font-sans leading-relaxed">
                                {issue.explanation_my}
                              </p>
                            )}

                            <div className="pt-2 border-t border-gray-50 flex justify-end gap-1.5">
                              <button
                                onClick={() => applySingleCorrection(issue)}
                                className="bg-slate-900 border border-slate-950 text-white rounded-lg py-1 px-3 text-[10px] font-extrabold shadow-sm hover:bg-slate-800 transition-all cursor-pointer"
                              >
                                Apply Suggestion
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ) : (
              /* No document selected landing page */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-slate-50/50">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center">
                  <BookOpen size={28} />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-extrabold text-slate-800">Welcome to GrammaFire Editorial</h2>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Select a document draft from the side rail or create a new session. You can also drag-and-drop .txt or .docx word sheets directly here!
                  </p>
                </div>
                <button
                  onClick={handleCreateDocument}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 px-6 text-xs font-bold cursor-pointer transition-colors"
                >
                  Create New Writing Session
                </button>
              </div>
            )}
          </section>

          {/* RIGHT SIDEBAR - Document Operations Panel (Collab & File import) */}
          {activeDoc && (
            <aside className="w-80 bg-slate-50/50 border-l border-gray-100 flex flex-col p-4 space-y-4 overflow-y-auto shrink-0 hidden lg:flex">
              {/* Document Info Sheet */}
              <div className="bg-white border border-gray-100 rounded-xl p-3.5 space-y-2.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Document Overview</h3>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-gray-400">Total Length</p>
                    <p className="text-xs font-bold text-slate-900">{editorText.length} Chars</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-gray-400">Language</p>
                    <p className="text-xs font-bold text-slate-900 uppercase">{docLanguage === "en" ? "English" : "Myanmar"}</p>
                  </div>
                </div>
              </div>

              {/* Import/Export Module */}
              <ImportExport
                onTextImported={handleTextImported}
                correctedTextToExport={correctedText || editorText}
                originalText={activeDoc.content}
                documentTitle={docTitle}
              />

              {/* Collaboration Team Panel */}
              <CollaboratorsPanel
                documentId={activeDoc.id}
                collaborators={activeDoc.collaborators || []}
                ownerEmail={activeDoc.ownerEmail}
                currentUserEmail={user.email}
                currentUserTier={userProfile?.tier || "free"}
                onTriggerUpgrade={() => setShowBillingModal(true)}
              />

              {/* Revision Correction History Collection */}
              <RevisionHistory
                revisions={revisions}
                onSelectRevision={handleRestoreRevision}
                activeRevisionId={activeRevisionId}
              />
            </aside>
          )}
        </main>
      )}
    </div>
  );
}
