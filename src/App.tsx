/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  Shield, 
  Lock, 
  Key, 
  FileText, 
  CreditCard, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit2, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2, 
  Search,
  ChevronRight,
  Menu,
  X,
  Globe,
  Briefcase,
  Layers,
  Building2,
  BookOpen,
  IdCard,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db, googleProvider } from './lib/firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function checkPasswordStrength(password: string): { isWeak: boolean; message: string } {
  if (password.length < 8) return { isWeak: true, message: "Password is too short (min 8 chars)" };
  if (!/[A-Z]/.test(password)) return { isWeak: true, message: "Add an uppercase letter" };
  if (!/[a-z]/.test(password)) return { isWeak: true, message: "Add a lowercase letter" };
  if (!/[0-9]/.test(password)) return { isWeak: true, message: "Add a number" };
  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) return { isWeak: true, message: "Add a special character" };
  return { isWeak: false, message: "Strong password" };
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    const { getDoc, doc } = await import('firebase/firestore');
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
      secondary: 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 shadow-sm',
      danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn('rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md', className)} {...props}>
    {children}
  </div>
);

class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Something went wrong. Please try again later.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) displayMessage = `Error: ${parsed.error}`;
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <div className="mb-4 rounded-full bg-red-100 p-3 text-red-600">
            <AlertTriangle size={32} />
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Oops! An error occurred</h1>
          <p className="mb-6 text-gray-600 max-w-md">{displayMessage}</p>
          <Button onClick={() => window.location.reload()}>
            Refresh Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Main App ---

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'passwords' | 'gov' | 'personal' | 'bank'>('passwords');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data States
  const [passwords, setPasswords] = useState<any[]>([]);
  const [govDocs, setGovDocs] = useState<any[]>([]);
  const [personalDocs, setPersonalDocs] = useState<any[]>([]);
  const [bankDetails, setBankDetails] = useState<any[]>([]);

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Listeners
  useEffect(() => {
    if (!user) return;

    const qPasswords = query(collection(db, `users/${user.uid}/passwords`));
    const unsubPasswords = onSnapshot(qPasswords, (snapshot) => {
      setPasswords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/passwords`));

    const qGov = query(collection(db, `users/${user.uid}/governmentDocs`));
    const unsubGov = onSnapshot(qGov, (snapshot) => {
      setGovDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/governmentDocs`));

    const qPersonal = query(collection(db, `users/${user.uid}/personalDocs`));
    const unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
      setPersonalDocs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/personalDocs`));

    const qBank = query(collection(db, `users/${user.uid}/bankDetails`));
    const unsubBank = onSnapshot(qBank, (snapshot) => {
      setBankDetails(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/bankDetails`));

    return () => {
      unsubPasswords();
      unsubGov();
      unsubPersonal();
      unsubBank();
    };
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl"
        >
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Shield size={32} />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
              Save Your Things
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Your secure vault for everything that matters.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleEmailAuth}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                />
              </div>
            </div>

            {authError && (
              <p className="text-sm text-red-500 text-center">{authError}</p>
            )}

            <Button type="submit" className="w-full py-3 text-base">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleGoogleLogin}
            className="w-full py-3 text-base"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="mr-2 h-4 w-4" />
            Google
          </Button>

          <p className="text-center text-sm text-gray-600">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth >= 1024) && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 lg:static lg:block",
              !isSidebarOpen && "hidden lg:block"
            )}
          >
            <div className="flex h-full flex-col">
              <div className="flex h-16 items-center px-6 border-b border-gray-100">
                <Shield className="text-indigo-600 mr-2" size={24} />
                <span className="text-xl font-bold text-gray-900">Vault</span>
              </div>
              <nav className="flex-1 space-y-1 px-3 py-4">
                <SidebarItem
                  icon={<Key size={20} />}
                  label="Passwords"
                  active={activeTab === 'passwords'}
                  onClick={() => { setActiveTab('passwords'); setIsSidebarOpen(false); }}
                />
                <SidebarItem
                  icon={<Building2 size={20} />}
                  label="Government"
                  active={activeTab === 'gov'}
                  onClick={() => { setActiveTab('gov'); setIsSidebarOpen(false); }}
                />
                <SidebarItem
                  icon={<UserIcon size={20} />}
                  label="Personal"
                  active={activeTab === 'personal'}
                  onClick={() => { setActiveTab('personal'); setIsSidebarOpen(false); }}
                />
                <SidebarItem
                  icon={<CreditCard size={20} />}
                  label="Bank & Cards"
                  active={activeTab === 'bank'}
                  onClick={() => { setActiveTab('bank'); setIsSidebarOpen(false); }}
                />
              </nav>
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center p-2 rounded-lg bg-gray-50 mb-4">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="User" className="h-8 w-8 rounded-full" />
                  <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.displayName || user.email}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700">
                  <LogOut size={18} className="mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-600">
            <Menu size={24} />
          </button>
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search your things..."
                className="pl-10 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-y-0">
            <AddButton activeTab={activeTab} userId={user.uid} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'passwords' && <PasswordSection data={passwords} searchQuery={searchQuery} userId={user.uid} />}
              {activeTab === 'gov' && <GovSection data={govDocs} searchQuery={searchQuery} userId={user.uid} />}
              {activeTab === 'personal' && <PersonalSection data={personalDocs} searchQuery={searchQuery} userId={user.uid} />}
              {activeTab === 'bank' && <BankSection data={bankDetails} searchQuery={searchQuery} userId={user.uid} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
        active 
          ? "bg-indigo-50 text-indigo-700" 
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <span className={cn("mr-3", active ? "text-indigo-600" : "text-gray-400")}>{icon}</span>
      {label}
    </button>
  );
}

// --- Sections ---

function PasswordSection({ data, searchQuery, userId }: { data: any[]; searchQuery: string; userId: string }) {
  const filtered = data.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Passwords</h2>
        <div className="flex items-center text-sm text-gray-500">
          <span className="mr-2">{filtered.length} items</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <PasswordCard key={item.id} item={item} userId={userId} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Key className="text-gray-400" size={32} />
            </div>
            <p className="text-gray-500">No passwords found. Add your first one!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordCard({ item, userId }: { item: any; userId: string; [key: string]: any }) {
  const [showPassword, setShowPassword] = useState(false);
  const strength = checkPasswordStrength(item.password);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this password?')) {
      try {
        await deleteDoc(doc(db, `users/${userId}/passwords/${item.id}`));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}/passwords/${item.id}`);
      }
    }
  };

  return (
    <Card className="group relative overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3">
            {item.category === 'social' ? <Globe size={20} /> : item.category === 'work' ? <Briefcase size={20} /> : <Layers size={20} />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{item.title}</h3>
            <p className="text-sm text-gray-500">{item.username}</p>
          </div>
        </div>
        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={item.password}
            readOnly
            className="pr-10 bg-gray-50 border-transparent cursor-default"
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {strength.isWeak && (
          <div className="flex items-center text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
            <AlertTriangle size={14} className="mr-1.5 flex-shrink-0" />
            <span>Weak: {strength.message}</span>
          </div>
        )}
        {!strength.isWeak && (
          <div className="flex items-center text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg">
            <CheckCircle2 size={14} className="mr-1.5 flex-shrink-0" />
            <span>Strong Password</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function GovSection({ data, searchQuery, userId }: { data: any[]; searchQuery: string; userId: string }) {
  const filtered = data.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Government Credentials</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <Card key={item.id} className="group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 mr-3">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.username}</p>
                </div>
              </div>
              <button onClick={() => deleteDoc(doc(db, `users/${userId}/governmentDocs/${item.id}`))} className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="relative">
              <Input type="password" value={item.password} readOnly className="bg-gray-50 border-transparent" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Encrypted</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PersonalSection({ data, searchQuery, userId }: { data: any[]; searchQuery: string; userId: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Personal Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.map((item) => (
          <Card key={item.id} className="relative">
            <button onClick={() => deleteDoc(doc(db, `users/${userId}/personalDocs/${item.id}`))} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500">
              <Trash2 size={16} />
            </button>
            <div className="space-y-4">
              <DetailRow icon={<IdCard size={18} />} label="Aadhar Number" value={item.aadharNumber} />
              <DetailRow icon={<Smartphone size={18} />} label="Driving License" value={item.drivingLicense} />
              <DetailRow icon={<FileText size={18} />} label="PAN Number" value={item.panNumber} />
              <DetailRow icon={<BookOpen size={18} />} label="Roll Number" value={item.marksheetRollNumber} />
              {item.otherDocs && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">Other Details</p>
                  <p className="text-sm text-gray-900">{item.otherDocs}</p>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BankSection({ data, searchQuery, userId }: { data: any[]; searchQuery: string; userId: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Bank & ATM Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((item) => (
          <Card key={item.id} className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none group">
            <div className="flex justify-between items-start mb-6">
              <CreditCard size={32} className="text-indigo-200" />
              <button onClick={() => deleteDoc(doc(db, `users/${userId}/bankDetails/${item.id}`))} className="p-2 text-indigo-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wider">Bank Name</p>
                <p className="text-lg font-semibold">{item.bankName}</p>
              </div>
              <div>
                <p className="text-xs text-indigo-200 uppercase tracking-wider">Account Number</p>
                <p className="text-xl font-mono tracking-widest">{item.accountNumber}</p>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-indigo-200 uppercase tracking-wider">IFSC</p>
                  <p className="font-medium">{item.ifscCode || 'N/A'}</p>
                </div>
                {item.atmCardDetails && (
                  <div>
                    <p className="text-xs text-indigo-200 uppercase tracking-wider">ATM Details</p>
                    <p className="font-medium">•••• ••••</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 mr-3">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{value || 'Not set'}</p>
      </div>
    </div>
  );
}

// --- Add Modal ---

function AddButton({ activeTab, userId }: { activeTab: string; userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const collectionName = {
      passwords: 'passwords',
      gov: 'governmentDocs',
      personal: 'personalDocs',
      bank: 'bankDetails'
    }[activeTab];

    if (!collectionName) return;

    try {
      await addDoc(collection(db, `users/${userId}/${collectionName}`), {
        ...formData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setIsOpen(false);
      setFormData({});
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="rounded-full h-10 w-10 p-0 lg:h-auto lg:w-auto lg:px-4 lg:py-2">
        <Plus size={20} className="lg:mr-2" />
        <span className="hidden lg:inline">Add New</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Add New {activeTab === 'passwords' ? 'Password' : activeTab === 'gov' ? 'Gov Doc' : activeTab === 'personal' ? 'Personal Detail' : 'Bank Detail'}</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {activeTab === 'passwords' && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Website or App Name</label>
                      <Input required value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Facebook, Netflix" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Gmail ID / Username</label>
                      <Input required value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="user@gmail.com" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Password</label>
                      <Input required type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Category</label>
                      <select 
                        className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        value={formData.category || 'social'}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="social">Social Media</option>
                        <option value="work">Work</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </>
                )}

                {activeTab === 'gov' && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Government Portal Name</label>
                      <Input required value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Income Tax, GST" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Username / ID</label>
                      <Input required value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Password</label>
                      <Input required type="password" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                  </>
                )}

                {activeTab === 'personal' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Aadhar Number</label>
                        <Input value={formData.aadharNumber || ''} onChange={e => setFormData({ ...formData, aadharNumber: e.target.value })} placeholder="XXXX XXXX XXXX" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">PAN Number</label>
                        <Input value={formData.panNumber || ''} onChange={e => setFormData({ ...formData, panNumber: e.target.value })} placeholder="ABCDE1234F" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Driving License</label>
                      <Input value={formData.drivingLicense || ''} onChange={e => setFormData({ ...formData, drivingLicense: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Roll Number / Marksheet</label>
                      <Input value={formData.marksheetRollNumber || ''} onChange={e => setFormData({ ...formData, marksheetRollNumber: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Other Details</label>
                      <textarea 
                        className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                        value={formData.otherDocs || ''}
                        onChange={e => setFormData({ ...formData, otherDocs: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {activeTab === 'bank' && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Bank Name</label>
                      <Input required value={formData.bankName || ''} onChange={e => setFormData({ ...formData, bankName: e.target.value })} placeholder="e.g. HDFC, SBI" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Account Number</label>
                      <Input required value={formData.accountNumber || ''} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">IFSC Code</label>
                      <Input value={formData.ifscCode || ''} onChange={e => setFormData({ ...formData, ifscCode: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">ATM Card Details (Optional)</label>
                      <Input value={formData.atmCardDetails || ''} onChange={e => setFormData({ ...formData, atmCardDetails: e.target.value })} placeholder="Card No, Expiry" />
                    </div>
                  </>
                )}

                <div className="pt-4 flex space-x-3">
                  <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" className="flex-1">Save Details</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
