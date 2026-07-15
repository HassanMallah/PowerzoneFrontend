import { useEffect, useMemo, useState } from 'react';
import { api, setToken, clearToken } from './lib/api';
import {
  getVendors,
  createVendor,
  deleteVendor,
  getVendorPurchases,
  createVendorPurchase,
  deleteVendorPurchase,
  getVendorPayments,
  createVendorPayment,
  deleteVendorPayment
} from './lib/vendorApi';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  ClipboardList,
  Eye,
  History,
  Home,
  Lock,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  User,
  Users,
  Wallet
} from 'lucide-react';

const money = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(value);

const today = () => new Date().toISOString().slice(0, 10);

const expenseCategories = [
  'Panel',
  'Battery',
  'Lithium Battery',
  'Inverter',
  'Breaker',
  'Labor',
  'Fabricator / Welder',
  'Wire',
  'Transport',
  'Other'
];

const initialSiteCostFields = [
  { key: 'panel', label: 'Panel', category: 'Panel' },
  { key: 'inverter', label: 'Inverter', category: 'Inverter' },
  { key: 'battery', label: 'Battery', category: 'Battery' },
  { key: 'breaker', label: 'Breaker', category: 'Breaker' },
  { key: 'fabricator', label: 'Fabricator / Welder', category: 'Fabricator / Welder' }
];

const ownerTabs = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'workers', label: 'Workers', icon: Users },
  { id: 'sites', label: 'Sites', icon: Building2 },
  { id: 'vendors', label: 'Vendors', icon: Store },
  { id: 'daily', label: 'Daily', icon: Wallet },
  { id: 'audit', label: 'Audit', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Lock }
];

const workerTabs = [
  { id: 'log', label: 'Log Expense', icon: Plus },
  { id: 'expenses', label: 'My Expenses', icon: ReceiptText },
  { id: 'balance', label: 'My Balance', icon: Wallet }
];

function App() {
  const [session, setSession] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [sites, setSites] = useState([]);
  const [topUps, setTopUps] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [dailyExpenses, setDailyExpenses] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorPurchases, setVendorPurchases] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };

  const fetchData = async (role, workerId, workerName) => {
    try {
      if (role === 'owner') {
        const [workersData, sitesData, dashData, dailyData, vendorsData, purchasesData, paymentsData] = await Promise.all([
          api('/workers'),
          api('/sites'),
          api('/dashboard/owner'),
          api('/daily-expenses'),
          getVendors().catch(() => ({ vendors: [] })),
          getVendorPurchases().catch(() => ({ purchases: [] })),
          getVendorPayments().catch(() => ({ payments: [] }))
        ]);
        setWorkers(workersData.workers);
        setSites(sitesData.sites);
        setDashboard(dashData);
        setDailyExpenses(dailyData.expenses);
        setVendors(vendorsData.vendors || []);
        setVendorPurchases(purchasesData.purchases || []);
        setVendorPayments(paymentsData.payments || []);
      } else {
        const [sitesData, balanceData] = await Promise.all([
          api('/sites'),
          api('/expenses/my/balance')
        ]);
        setSites(sitesData.sites);
        setTopUps(balanceData.topups.map(t => ({ ...t, workerId })));
        setExpenses(balanceData.expenses.map(e => ({ ...e, workerId })));
        // We'll mock a worker object for the buildData logic
        setWorkers([{ id: workerId, name: workerName, balance: balanceData.balance }]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const { user } = await api('/auth/me');
          const newSession = {
            role: user.role,
            name: user.name,
            workerId: user.id
          };
          await fetchData(newSession.role, newSession.workerId, newSession.name);
          setSession(newSession);
        } catch (err) {
          console.error('Failed to restore session:', err);
          clearToken();
        }
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  const data = useMemo(
    () => buildData(workers, sites, topUps, expenses, dashboard, session, dailyExpenses, vendors, vendorPurchases, vendorPayments),
    [workers, sites, topUps, expenses, dashboard, session, dailyExpenses, vendors, vendorPurchases, vendorPayments]
  );

  const login = async (username, password) => {
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      setToken(data.token);
      const newSession = {
        role: data.user.role,
        name: data.user.name,
        workerId: data.user.id,
      };
      
      await fetchData(newSession.role, newSession.workerId, newSession.name);
      setSession(newSession);
      showToast(`Welcome ${data.user.name}`);
      return true;
    } catch (err) {
      return false;
    }
  };

  const addBalance = async (workerId, amount) => {
    try {
      await api(`/workers/${workerId}/balance`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      showToast('Balance updated');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const addWorker = async (name, password) => {
    try {
      const username = name.trim().toLowerCase().replace(/\s+/g, '');
      await api('/workers', {
        method: 'POST',
        body: JSON.stringify({ name, username, password }),
      });
      showToast('Worker added');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const deleteWorker = async (id) => {
    const password = window.prompt('Please enter admin password to confirm worker deletion:');
    if (password === null) return;
    if (!password) {
      showToast('Password is required');
      return;
    }

    try {
      await api(`/workers/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      showToast('Worker deleted');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const deleteExpense = async (id) => {
    const password = window.prompt('Please enter admin password to confirm record deletion:');
    if (password === null) return false;
    if (!password) {
      showToast('Password is required');
      return false;
    }

    try {
      await api(`/expenses/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      showToast('Record deleted');
      await fetchData('owner');
      return true;
    } catch (err) {
      showToast(err.message);
      return false;
    }
  };

  const deleteWorkerHistory = async (name) => {
    const password = window.prompt(`Please enter admin password to confirm DELETING ALL RECORDS for ${name}:`);
    if (password === null) return false;
    if (!password) {
      showToast('Password is required');
      return false;
    }

    try {
      await api(`/audit/history/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      showToast(`All records for ${name} deleted`);
      await fetchData('owner');
      return true;
    } catch (err) {
      showToast(err.message);
      return false;
    }
  };

  const addSite = async (name, projectAmount, initialReceived, initialCosts = {}) => {
    try {
      const costs = initialSiteCostFields
        .map((field) => ({
          category: field.category,
          description: field.label,
          amount: Number(initialCosts[field.key] || 0)
        }))
        .filter((item) => item.amount > 0);

      await api('/sites', {
        method: 'POST',
        body: JSON.stringify({ name, projectAmount, initialCosts: costs, initialReceived }),
      });

      showToast('Site added');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const markSiteDone = async (siteId) => {
    try {
      await api(`/sites/${siteId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      });
      showToast('Site marked done');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const addOwnerSiteExpense = async (siteId, category, description, amount) => {
    try {
      await api(`/sites/${siteId}/costs`, {
        method: 'POST',
        body: JSON.stringify({ category, description, amount }),
      });
      showToast('Site cost added');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const addSitePayment = async (siteId, amount) => {
    try {
      await api(`/sites/${siteId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      showToast('Payment received');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const addDailyExpense = async (category, description, amount) => {
    try {
      await api('/daily-expenses', {
        method: 'POST',
        body: JSON.stringify({ category, description, amount }),
      });
      showToast('Daily expense added');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const deleteDailyExpense = async (id) => {
    const password = window.prompt('Please enter admin password to confirm deletion:');
    if (password === null) return false;
    if (!password) {
      showToast('Password is required');
      return false;
    }

    try {
      await api(`/daily-expenses/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password })
      });
      showToast('Daily expense deleted');
      await fetchData('owner');
      return true;
    } catch (err) {
      showToast(err.message);
      return false;
    }
  };

  const updateWorkerPassword = async (id, newPassword) => {
    try {
      await api(`/workers/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword })
      });
      showToast('Worker password updated');
    } catch (err) {
      showToast(err.message);
    }
  };

  const updateOwnPassword = async (newPassword) => {
    try {
      await api('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ newPassword })
      });
      showToast('Your password updated');
      return true;
    } catch (err) {
      showToast(err.message);
      return false;
    }
  };

  const addExpense = async (workerId, siteId, description, amount) => {
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({ siteId, description, amount }),
      });
      showToast('Expense added');
      await fetchData('worker', session.workerId, session.name);
    } catch (err) {
      showToast(err.message);
    }
  };

  const addVendor = async (name, phone, address) => {
    try {
      await createVendor(name, phone, address);
      showToast('Vendor added');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const removeVendor = async (id) => {
    const confirm = window.confirm('Are you sure you want to delete this vendor? This will also delete their purchases and payments.');
    if (!confirm) return;
    try {
      await deleteVendor(id);
      showToast('Vendor deleted');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const addVendorPurchase = async (vendorId, siteId, category, description, totalAmount, paidAmount, date) => {
    try {
      await createVendorPurchase(vendorId, siteId, category, description, totalAmount, paidAmount, date);
      if (siteId) {
        const vendor = vendors.find(v => v.id === vendorId);
        const vendorName = vendor ? vendor.name : 'Vendor';
        await api(`/sites/${siteId}/costs`, {
          method: 'POST',
          body: JSON.stringify({
            category,
            description: `${vendorName}: ${description} (Total: ${money(totalAmount)}, Paid: ${money(paidAmount)})`,
            amount: Number(totalAmount)
          })
        });
      }
      showToast('Vendor purchase added');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  const addVendorPayment = async (vendorId, amount, date, note) => {
    try {
      await createVendorPayment(vendorId, amount, date, note);
      showToast('Vendor payment recorded');
      await fetchData('owner');
    } catch (err) {
      showToast(err.message);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-night text-gold">Loading...</div>;
  }

  if (!session) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <Shell session={session} onLogout={() => { clearToken(); setSession(null); }} toast={toast}>
      {session.role === 'owner' ? (
        <OwnerApp
          data={data}
          onAddBalance={addBalance}
          onAddWorker={addWorker}
          onDeleteWorker={deleteWorker}
          onAddSite={addSite}
          onAddOwnerSiteExpense={addOwnerSiteExpense}
          onMarkSiteDone={markSiteDone}
          onDeleteExpense={deleteExpense}
          onDeleteWorkerHistory={deleteWorkerHistory}
          onAddSitePayment={addSitePayment}
          onAddDailyExpense={addDailyExpense}
          onDeleteDailyExpense={deleteDailyExpense}
          onUpdateWorkerPassword={updateWorkerPassword}
          onUpdateOwnPassword={updateOwnPassword}
          onAddVendor={addVendor}
          onRemoveVendor={removeVendor}
          onAddVendorPurchase={addVendorPurchase}
          onAddVendorPayment={addVendorPayment}
        />
      ) : (
        <WorkerApp
          data={data}
          workerId={session.workerId}
          onAddExpense={addExpense}
          onAddDailyExpense={addDailyExpense}
        />
      )}
    </Shell>
  );
}

function buildData(workers, sites, topUps, expenses, dashboard, session, dailyExpenses = []) {
  const siteById = Object.fromEntries(sites.map((site) => [site.id, site]));
  const workerById = Object.fromEntries(workers.map((worker) => [worker.id, worker]));

  const workerStats = workers.map((worker) => {
    // Backend might already provide received/spent/balance
    const received = worker.received ?? topUps
      .filter((item) => item.workerId === worker.id)
      .reduce((total, item) => total + item.amount, 0);
    const spent = worker.spent ?? expenses
      .filter((item) => item.workerId === worker.id)
      .reduce((total, item) => total + item.amount, 0);
    const balance = worker.balance ?? (received - spent);

    return { ...worker, received, spent, balance };
  });

  const siteStats = sites.map((site) => {
    const siteExpenses = expenses.filter((item) => item.siteId === site.id);
    const spent = site.totalSpent ?? siteExpenses.reduce((total, item) => total + item.amount, 0);
    const status = site.status ? site.status.charAt(0).toUpperCase() + site.status.slice(1) : 'Active';

    return {
      ...site,
      status,
      expenses: siteExpenses,
      spent,
      profit: site.profit ?? (site.projectAmount - spent)
    };
  });

  const richExpenses = expenses.map((expense) => {
    const date = expense.created_at ? new Date(expense.created_at).toISOString().split('T')[0] : expense.date;
    return {
      ...expense,
      date,
      siteName: expense.site_name || siteById[expense.siteId]?.name || 'Unknown site',
      workerName: expense.worker_name || (expense.source === 'owner' ? 'Owner' : workerById[expense.workerId]?.name || 'Unknown worker')
    };
  });

  const richDailyExpenses = dailyExpenses.map(e => ({
    ...e,
    date: new Date(e.created_at).toISOString().split('T')[0]
  }));

  const richTopUps = topUps.map(t => ({
    ...t,
    date: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : t.date
  }));

  // Use dashboard data if available, otherwise calculate
  const totalGiven = dashboard?.totalMoneyGiven ?? richTopUps.reduce((total, item) => total + item.amount, 0);
  const totalSpent = dashboard?.totalProjectSpent ?? expenses.reduce((total, item) => total + item.amount, 0);
  const totalWorkerSpent = dashboard?.workerSpent ?? expenses
    .filter((item) => item.worker_id || item.workerId)
    .reduce((total, item) => total + item.amount, 0);
  const totalProjectAmount = dashboard?.totalProjectAmount ?? sites.reduce((total, site) => total + site.projectAmount, 0);

  const totalDailySpent = richDailyExpenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    workers,
    sites: siteStats,
    topUps: richTopUps,
    expenses: richExpenses,
    dailyExpenses: richDailyExpenses,
    workerStats,
    siteStats,
    totalGiven,
    totalSpent,
    totalWorkerSpent,
    totalWorkerRemaining: dashboard?.workerBalance ?? (totalGiven - totalWorkerSpent),
    totalProjectAmount,
    totalProfit: dashboard?.totalProfit ?? (totalProjectAmount - totalSpent),
    totalReceived: dashboard?.totalReceived ?? 0,
    totalRemaining: dashboard?.totalRemaining ?? 0,
    totalDailySpent
  };
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

const submit = async (event) => {
  event.preventDefault();
  setLoading(true);
  setError('');
  const ok = await onLogin(username.trim(), password);
  if (!ok) {
    setError('Wrong username or password');
    setLoading(false);
  }
};

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3146_0,#07111f_42%,#050913_100%)] px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md flex-col justify-center">
        <div className="mb-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-night shadow-luxury">
            <ShieldCheck size={30} />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amberSoft">PowerZone</p>
          <h1 className="mt-2 text-4xl font-bold leading-tight">Money Tracker</h1>
          <p className="mt-3 text-base text-white/60">Simple expense app for solar site work.</p>
        </div>

        <form onSubmit={submit} className="rounded-[28px] border border-white/10 bg-white/[0.07] p-5 shadow-luxury backdrop-blur">
          <InputBlock icon={User} label="Username" value={username} onChange={setUsername} placeholder="admin" />
          <InputBlock
            icon={Lock}
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="admin123"
            type="password"
          />
          {error && <p className="mb-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-100">{error}</p>}
          <button 
            disabled={loading}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-5 text-lg font-bold text-night shadow-lg shadow-gold/20 transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-night border-t-transparent"></div>
            ) : (
              <>Login <Check size={22} /></>
            )}
          </button>
        </form>

        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65">
          <p>Please Enter Your Email & Password</p>
        </div>
      </div>
    </main>
  );
}

function Shell({ children, session, onLogout, toast }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#07111f_0%,#0e1824_48%,#050913_100%)] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night/85 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Solar Expense</p>
            <h1 className="text-xl font-bold">{session.name}</h1>
          </div>
          <button
            onClick={onLogout}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/80"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>
      {children}
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border border-gold/40 bg-[#172331] px-5 py-3 text-sm font-semibold text-amberSoft shadow-luxury">
          {toast}
        </div>
      )}
    </main>
  );
}

function OwnerApp({
  data,
  onAddBalance,
  onAddWorker,
  onDeleteWorker,
  onAddSite,
  onAddOwnerSiteExpense,
  onMarkSiteDone,
  onDeleteExpense,
  onDeleteWorkerHistory,
  onAddSitePayment,
  onAddDailyExpense,
  onDeleteDailyExpense,
  onUpdateWorkerPassword,
  onUpdateOwnPassword,
  onAddVendor,
  onRemoveVendor,
  onAddVendorPurchase,
  onAddVendorPayment
}) {
  const [tab, setTab] = useState('overview');

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pb-28 pt-5">
        {tab === 'overview' && <OwnerOverview data={data} />}
        {tab === 'workers' && (
          <OwnerWorkers
            data={data}
            onAddBalance={onAddBalance}
            onAddWorker={onAddWorker}
            onDeleteWorker={onDeleteWorker}
            onUpdateWorkerPassword={onUpdateWorkerPassword}
          />
        )}
        {tab === 'sites' && (
          <OwnerSites
            data={data}
            onAddSite={onAddSite}
            onAddOwnerSiteExpense={onAddOwnerSiteExpense}
            onMarkSiteDone={onMarkSiteDone}
            onAddSitePayment={onAddSitePayment}
          />
        )}
        {tab === 'vendors' && (
          <OwnerVendors
            data={data}
            onAddVendor={onAddVendor}
            onRemoveVendor={onRemoveVendor}
            onAddVendorPurchase={onAddVendorPurchase}
            onAddVendorPayment={onAddVendorPayment}
          />
        )}
        {tab === 'daily' && (
          <DailyApp data={data} onAddDailyExpense={onAddDailyExpense} onDeleteDailyExpense={onDeleteDailyExpense} />
        )}
        {tab === 'audit' && (
          <OwnerAudit onDeleteExpense={onDeleteExpense} onDeleteWorkerHistory={onDeleteWorkerHistory} onDeleteDailyExpense={onDeleteDailyExpense} />
        )}
        {tab === 'settings' && <Settings onUpdatePassword={onUpdateOwnPassword} />}
      </section>
      <BottomNav items={ownerTabs} active={tab} onChange={setTab} />
    </>
  );
}

function Settings({ onUpdatePassword }) {
  const [newPass, setNewPass] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!newPass) return;
    const ok = await onUpdatePassword(newPass);
    if (ok) {
      setNewPass('');
    }
  };

  return (
    <div className="space-y-5">
      <SectionTitle icon={Lock} title="Settings" />
      <Panel>
        <SectionTitle icon={ShieldCheck} title="Change Your Password" compact />
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="simple-label">New Password</label>
            <input className="field mt-1" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          </div>
          <PrimaryButton>Update Password</PrimaryButton>
        </form>
      </Panel>
    </div>
  );
}

function DailyApp({ data, onAddDailyExpense, onDeleteDailyExpense }) {
  const [category, setCategory] = useState('Fuel');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [showManage, setShowManage] = useState(false);

  const categories = ['Fuel', 'Grocery', 'Office', 'Electricity', 'Internet', 'Rent', 'Maintenance', 'Other'];

  const submit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    onAddDailyExpense(category, description.trim(), Number(amount));
    setDescription('');
    setAmount('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle icon={Wallet} title="Daily Expenses" />
        <button
          onClick={() => setShowManage(!showManage)}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${showManage ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/50'}`}
        >
          {showManage ? 'Exit Manage' : 'Manage'}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <SectionTitle icon={Plus} title="Add New Expense" compact />
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label className="simple-label">Category</label>
              <select className="field mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="simple-label">Description</label>
              <input
                className="field mt-1"
                placeholder="Ex: Bike fuel"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="simple-label">Amount</label>
              <input
                className="field mt-1"
                type="number"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <PrimaryButton>Save Expense</PrimaryButton>
          </form>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <SectionTitle icon={History} title="Recent History" compact />
            <p className="font-bold text-amberSoft">{money(data.totalDailySpent)}</p>
          </div>
          <div className="mt-4 space-y-3">
            {data.dailyExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] p-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gold/60">{expense.category}</span>
                    <span className="text-[10px] text-white/30">{expense.date}</span>
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/50">{expense.worker_name || 'Owner'}</span>
                  </div>
                  <p className="mt-0.5 font-medium">{expense.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-amberSoft">{money(expense.amount)}</span>
                  {showManage && (
                    <button
                      onClick={() => onDeleteDailyExpense(expense.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {data.dailyExpenses.length === 0 && <EmptyState icon={Search} text="No daily expenses yet" />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OwnerOverview({ data }) {
  const activeSites = data.siteStats.filter((site) => site.status === 'Active');

  return (
    <div className="space-y-5">
      <StatGrid
        stats={[
          { label: 'Client Payments', value: money(data.totalReceived), icon: Banknote },
          { label: 'Pending Dues', value: money(data.totalRemaining), icon: History },
          { label: 'Worker Balance', value: money(data.totalWorkerRemaining), icon: Wallet },
          { label: 'Current Profit', value: money(data.totalProfit), icon: Building2 }
        ]}
      />

      <SectionTitle icon={Building2} title="Active Sites" />
      <div className="space-y-3">
        {activeSites.map((site) => (
          <InfoCard key={site.id}>
            <div>
              <p className="text-lg font-bold">{site.name}</p>
              <p className="text-sm text-white/50">Project {money(site.projectAmount)}</p>
              <p className="text-xs text-emerald-200">Received {money(site.totalReceived || 0)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/50">Profit</p>
              <p className={`text-lg font-bold ${site.profit < 0 ? 'text-red-200' : 'text-amberSoft'}`}>
                {money(site.profit)}
              </p>
              <p className="text-xs text-white/40">Rem. {money(site.remainingBalance || 0)}</p>
            </div>
          </InfoCard>
        ))}
        {activeSites.length === 0 && <EmptyState icon={Building2} text="No active sites" />}
      </div>
    </div>
  );
}

function OwnerWorkers({ data, onAddBalance, onAddWorker, onDeleteWorker }) {
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [history, setHistory] = useState([]);
  const [balanceWorkerId, setBalanceWorkerId] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (selectedWorkerId) {
      api(`/workers/${selectedWorkerId}`).then((res) => {
        setHistory(res.expenses.map(e => ({
          ...e,
          date: new Date(e.created_at).toISOString().split('T')[0],
          siteName: e.site_name
        })));
      });
    } else {
      setHistory([]);
    }
  }, [selectedWorkerId]);

  const selected = data.workerStats.find((worker) => worker.id === selectedWorkerId);

  const addBalance = (event) => {
    event.preventDefault();
    if (!balanceWorkerId || Number(balanceAmount) <= 0) return;
    onAddBalance(balanceWorkerId, balanceAmount);
    setBalanceAmount('');
  };

  const addWorker = (event) => {
    event.preventDefault();
    if (!name.trim() || !password.trim()) return;
    onAddWorker(name, password);
    setName('');
    setPassword('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle icon={Users} title="Workers" />
        <button
          onClick={() => setShowDelete(!showDelete)}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${showDelete ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/50'}`}
        >
          {showDelete ? 'Exit Manage' : 'Manage'}
        </button>
      </div>
      <div className="space-y-3">
        {data.workerStats.map((worker) => (
          <div key={worker.id} className="relative">
            <button onClick={() => setSelectedWorkerId(worker.id)} className="w-full text-left">
              <InfoCard>
                <div>
                  <p className="text-lg font-bold">{worker.name}</p>
                  <p className="text-sm text-white/50">Spent {money(worker.spent)}</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-sm text-white/50">Balance</p>
                    <p className="font-bold text-amberSoft">{money(worker.balance)}</p>
                  </div>
                  {showDelete && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const pass = window.prompt(`Enter new password for ${worker.name}:`);
                          if (pass) onUpdateWorkerPassword(worker.id, pass);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold transition hover:bg-gold/20 active:scale-95"
                        aria-label="Change password"
                      >
                        <Lock size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWorker(worker.id);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/20 active:scale-95"
                        aria-label="Delete worker"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </InfoCard>
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <Panel>
          <SectionTitle icon={History} title={`${selected.name} History`} compact />
          <ExpenseList expenses={history} />
        </Panel>
      )}

      <Panel>
        <SectionTitle icon={Plus} title="Add Balance" compact />
        <form onSubmit={addBalance} className="space-y-3">
          <select value={balanceWorkerId} onChange={(e) => setBalanceWorkerId(e.target.value)} className="field">
            <option value="">Select worker</option>
            {data.workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
          <input className="field" type="number" placeholder="Amount" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} />
          <PrimaryButton>Add Balance</PrimaryButton>
        </form>
      </Panel>

      <Panel>
        <SectionTitle icon={User} title="Add New Worker" compact />
        <form onSubmit={addWorker} className="space-y-3">
          <input className="field" placeholder="Worker name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PrimaryButton>Add Worker</PrimaryButton>
        </form>
      </Panel>
    </div>
  );
}

function OwnerSites({ data, onAddSite, onAddOwnerSiteExpense, onMarkSiteDone, onAddSitePayment }) {
  const [siteName, setSiteName] = useState('');
  const [projectAmount, setProjectAmount] = useState('');
  const [initialReceived, setInitialReceived] = useState('');
  const [initialCosts, setInitialCosts] = useState(
    Object.fromEntries(initialSiteCostFields.map((field) => [field.key, '']))
  );
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [history, setHistory] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    if (selectedSiteId) {
      Promise.all([
        api(`/sites/${selectedSiteId}/expenses`),
        api(`/sites/${selectedSiteId}/payments`)
      ]).then(([expenseRes, paymentRes]) => {
        setHistory(expenseRes.expenses.map(e => ({
          ...e,
          date: new Date(e.created_at).toISOString().split('T')[0],
          workerName: e.worker_name || 'Owner',
          siteName: data.siteStats.find(s => s.id === selectedSiteId)?.name
        })));
        setPayments(paymentRes.payments.map(p => ({
          ...p,
          date: new Date(p.created_at).toISOString().split('T')[0]
        })));
      });
    } else {
      setHistory([]);
      setPayments([]);
    }
  }, [selectedSiteId, data.siteStats]);

  const selected = data.siteStats.find((site) => site.id === selectedSiteId);

  const addSite = (event) => {
    event.preventDefault();
    if (!siteName.trim() || Number(projectAmount) <= 0) return;
    onAddSite(siteName, projectAmount, Number(initialReceived || 0), initialCosts);
    setSiteName('');
    setProjectAmount('');
    setInitialReceived('');
    setInitialCosts(Object.fromEntries(initialSiteCostFields.map((field) => [field.key, ''])));
  };

  const addPayment = (event) => {
    event.preventDefault();
    if (!selectedSiteId || Number(paymentAmount) <= 0) return;
    onAddSitePayment(selectedSiteId, paymentAmount);
    setPaymentAmount('');
  };

  return (
    <div className="space-y-5">
      <SectionTitle icon={Building2} title="Sites" />
      <div className="space-y-3">
        {data.siteStats.map((site) => (
          <div key={site.id} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-luxury">
            <button onClick={() => setSelectedSiteId(site.id)} className="flex w-full items-center justify-between text-left">
              <div>
                <p className="text-lg font-bold">{site.name}</p>
                <p className="text-sm text-white/50">Project {money(site.projectAmount)}</p>
                <p className="text-xs text-emerald-200">Received {money(site.totalReceived || 0)}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${site.profit < 0 ? 'text-red-200' : 'text-amberSoft'}`}>
                  {money(site.profit)}
                </p>
                <p className="text-xs text-white/40">Remaining {money(site.remainingBalance || 0)}</p>
                <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${site.status === 'Active' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/60'}`}>
                  {site.status}
                </span>
              </div>
            </button>
            {site.status === 'Active' && (
              <button onClick={() => onMarkSiteDone(site.id)} className="mt-4 min-h-12 w-full rounded-2xl border border-gold/30 text-sm font-bold text-amberSoft">
                Mark as Done
              </button>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div className="space-y-5">
          <Panel>
            <SectionTitle icon={Eye} title={`${selected.name} Financials`} compact />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniAmount label="Project Amount" value={money(selected.projectAmount)} />
              <MiniAmount label="Total Received" value={money(selected.totalReceived || 0)} />
              <MiniAmount label="Remaining Due" value={money(selected.remainingBalance || 0)} tone="loss" />
              <MiniAmount
                label="Current Profit"
                value={money(selected.profit)}
                tone={selected.profit < 0 ? 'loss' : 'profit'}
              />
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Panel>
                <SectionTitle icon={Banknote} title="Add Client Payment" compact />
                <form onSubmit={addPayment} className="space-y-3">
                  <input
                    className="field"
                    type="number"
                    placeholder="Payment Amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <PrimaryButton>Add Payment</PrimaryButton>
                </form>
              </Panel>

              <Panel>
                <SectionTitle icon={History} title="Payment History" compact />
                <SimpleHistory
                  items={payments}
                  empty="No payments received yet"
                  render={(item) => (
                    <>
                      <span>{item.date}</span>
                      <strong className="text-emerald-200">+ {money(item.amount)}</strong>
                    </>
                  )}
                />
              </Panel>
            </div>

            <div className="space-y-5">
              <AddSiteCostForm site={selected} onAddOwnerSiteExpense={onAddOwnerSiteExpense} />
              <Panel>
                <SectionTitle icon={ReceiptText} title={`${selected.name} Costs`} compact />
                <ExpenseList expenses={history} showWorker showCategory />
              </Panel>
            </div>
          </div>
        </div>
      )}

      <Panel>
        <SectionTitle icon={Plus} title="Add New Site" compact />
        <form onSubmit={addSite} className="space-y-3">
          <input className="field" placeholder="Site name" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="field"
              type="number"
              placeholder="Project amount"
              value={projectAmount}
              onChange={(e) => setProjectAmount(e.target.value)}
            />
            <input
              className="field"
              type="number"
              placeholder="Initial Received"
              value={initialReceived}
              onChange={(e) => setInitialReceived(e.target.value)}
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-night/35 p-3">
            <p className="mb-3 text-sm font-bold text-white/70">Initial Site Costs</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {initialSiteCostFields.map((field) => (
                <input
                  key={field.key}
                  className="field"
                  type="number"
                  placeholder={`${field.label} cost`}
                  value={initialCosts[field.key]}
                  onChange={(event) =>
                    setInitialCosts((current) => ({
                      ...current,
                      [field.key]: event.target.value
                    }))
                  }
                />
              ))}
            </div>
          </div>
          <PrimaryButton>Add Site</PrimaryButton>
        </form>
      </Panel>
    </div>
  );
}

function AddSiteCostForm({ site, onAddOwnerSiteExpense }) {
  const [category, setCategory] = useState(expenseCategories[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!category || !description.trim() || Number(amount) <= 0) return;
    onAddOwnerSiteExpense(site.id, category, description, amount);
    setDescription('');
    setAmount('');
  };

  return (
    <Panel>
      <SectionTitle icon={Plus} title="Add Site Cost" compact />
      <form onSubmit={submit} className="space-y-3">
        <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
          {expenseCategories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          className="field"
          placeholder="Item name"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <input
          className="field"
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <PrimaryButton>Add Cost</PrimaryButton>
      </form>
    </Panel>
  );
}

function MiniAmount({ label, value, tone = 'normal' }) {
  const color = tone === 'loss' ? 'text-red-200' : tone === 'profit' ? 'text-emerald-200' : 'text-amberSoft';

  return (
    <div className="rounded-2xl bg-white/[0.05] p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function OwnerAudit({ onDeleteExpense, onDeleteWorkerHistory }) {
  const [mode, setMode] = useState('monthly');
  const [period, setPeriod] = useState('2026-05');
  const [auditData, setAuditData] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const query = mode === 'monthly' ? `type=monthly&month=${period}` : `type=annual&year=${period.slice(0, 4)}`;
        const res = await api(`/audit?${query}`);
        setAuditData(res);
      } catch (err) {
        console.error('Audit fetch error:', err);
      }
    };
    fetchAudit();
  }, [mode, period, refresh]);

  const handleDelete = async (id) => {
    const ok = await onDeleteExpense(id);
    if (ok) setRefresh((r) => r + 1);
  };

  const handleDeleteWorkerHistory = async (name) => {
    const ok = await onDeleteWorkerHistory(name);
    if (ok) setRefresh((r) => r + 1);
  };

  if (!auditData) return <div className="p-10 text-center">Loading audit...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle icon={ClipboardList} title="Audit" />
        <button
          onClick={() => setShowManage(!showManage)}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${showManage ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/50'}`}
        >
          {showManage ? 'Exit Manage' : 'Manage'}
        </button>
      </div>
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          {['monthly', 'annual'].map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={`min-h-12 rounded-2xl font-bold capitalize ${mode === item ? 'bg-gold text-night' : 'bg-white/10 text-white/70'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          className="field mt-3"
          type={mode === 'monthly' ? 'month' : 'number'}
          value={mode === 'monthly' ? period : period.slice(0, 4)}
          onChange={(e) => setPeriod(mode === 'monthly' ? e.target.value : `${e.target.value}-01`)}
        />
      </Panel>

      <Panel>
        <SectionTitle icon={Users} title="Worker Summary" compact />
        <div className="space-y-3">
          {auditData.workers.map((worker) => (
            <div key={worker.name} className="rounded-2xl bg-white/[0.05] p-3">
              <div className="flex justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="font-bold">{worker.name}</p>
                  {showManage && (
                    <button
                      onClick={() => handleDeleteWorkerHistory(worker.name)}
                      className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-400"
                    >
                      Delete All
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-amberSoft">Spent: {money(worker.total_spent)}</p>
                  <p className="text-xs text-emerald-200">Balance: {money(worker.remaining_balance)}</p>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {worker.items?.length ? (
                  worker.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-night/30 p-2 text-[11px] text-white/60">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-white/80">
                          {item.site_name} - {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          {item.category}: {item.description} ({money(item.amount)})
                        </span>
                      </div>
                      {showManage && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/40">No records for this period</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between">
          <SectionTitle icon={Wallet} title="Daily Overhead" compact />
          <p className="font-bold text-amberSoft">
            {money(auditData.dailyExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0)}
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {auditData.dailyExpenses?.length ? (
            auditData.dailyExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] p-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-gold/60">{expense.category}</span>
                    <span className="text-white/30">{new Date(expense.created_at).toLocaleDateString()}</span>
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/50">{expense.worker_name || 'Owner'}</span>
                  </div>
                  <p className="mt-0.5 text-white/70">{expense.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-amberSoft">{money(expense.amount)}</span>
                  {showManage && (
                    <button
                      onClick={async () => {
                        const ok = await onDeleteDailyExpense(expense.id);
                        if (ok) setRefresh(r => r + 1);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/40">No daily expenses for this period</p>
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={Building2} title="Site Summary" compact />
        <div className="space-y-3">
          {auditData.sites.map((site) => (
            <div key={site.site_id} className="rounded-2xl bg-white/[0.05] p-3">
              <div className="flex justify-between gap-3">
                <p className="font-bold">{site.name}</p>
                <p className="text-amberSoft">{money(site.total_spent)}</p>
              </div>
              <p className={`mt-1 text-sm font-bold ${site.project_amount - site.total_spent < 0 ? 'text-red-200' : 'text-emerald-200'}`}>
                Profit {money(site.project_amount - site.total_spent)}
              </p>
              <div className="mt-2 space-y-2">
                {site.items?.length ? (
                  site.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-night/30 p-2 text-[11px] text-white/60">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-white/80">
                          {item.worker_name} - {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          {item.category}: {item.description} ({money(item.amount)})
                        </span>
                      </div>
                      {showManage && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/40">No items</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function WorkerApp({ data, workerId, onAddExpense, onAddDailyExpense }) {
  const [tab, setTab] = useState('log');
  const worker = data.workerStats.find((item) => item.id === workerId);

  if (!worker) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent"></div>
          <p className="text-white/50">Loading worker data...</p>
        </div>
      </div>
    );
  }

  const workerExpenses = data.expenses
    .filter((item) => item.workerId === workerId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const workerTopUps = data.topUps
    .filter((item) => item.workerId === workerId)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <section className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        {tab === 'log' && <LogExpense data={data} worker={worker} onAddExpense={onAddExpense} onAddDailyExpense={onAddDailyExpense} />}
        {tab === 'expenses' && <ExpenseListScreen expenses={workerExpenses} />}
        {tab === 'balance' && <BalanceScreen worker={worker} topUps={workerTopUps} expenses={workerExpenses} />}
      </section>
      <BottomNav items={workerTabs} active={tab} onChange={setTab} />
    </>
  );
}

function LogExpense({ data, worker, onAddExpense, onAddDailyExpense }) {
  const activeSites = data.sites.filter((site) => site.status === 'Active');
  const [type, setType] = useState('site'); // 'site' or 'daily'
  const [siteId, setSiteId] = useState('');
  const [category, setCategory] = useState('Fuel');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const dailyCategories = ['Fuel', 'Grocery', 'Food', 'Transport', 'Maintenance', 'Other'];

  useEffect(() => {
    if (activeSites.length && !siteId) {
      setSiteId(activeSites[0].id);
    }
  }, [activeSites, siteId]);

  const submit = (event) => {
    event.preventDefault();
    if (!description.trim() || Number(amount) <= 0) return;

    if (type === 'site') {
      if (!siteId) return;
      onAddExpense(worker.id, siteId, description.trim(), amount);
    } else {
      onAddDailyExpense(category, description.trim(), amount);
    }

    setDescription('');
    setAmount('');
  };

  return (
    <div className="space-y-5">
      <BalanceHero balance={worker.balance} />
      <Panel>
        <div className="mb-6 flex gap-2 rounded-2xl bg-night/50 p-1">
          {['site', 'daily'].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 rounded-xl py-3 text-sm font-bold capitalize transition ${type === t ? 'bg-gold text-night shadow-lg shadow-gold/10' : 'text-white/40'}`}
            >
              {t === 'site' ? 'Site Expense' : 'Daily Overhead'}
            </button>
          ))}
        </div>

        <SectionTitle icon={Plus} title={type === 'site' ? 'Add Site Expense' : 'Add Daily Overhead'} compact />
        <form onSubmit={submit} className="mt-4 space-y-4">
          {type === 'site' ? (
            <>
              <label className="simple-label">Site</label>
              <select className="field text-lg" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                {activeSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="simple-label">Category</label>
              <select className="field text-lg" value={category} onChange={(e) => setCategory(e.target.value)}>
                {dailyCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="simple-label">Description</label>
          <textarea
            className="field min-h-32 text-lg"
            placeholder={type === 'site' ? 'wire = 4000' : 'Petrol for bike'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="simple-label">Amount</label>
          <input className="field text-lg" type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <PrimaryButton>Save Expense</PrimaryButton>
        </form>
      </Panel>
    </div>
  );
}

function ExpenseListScreen({ expenses }) {
  return (
    <div className="space-y-5">
      <SectionTitle icon={ReceiptText} title="My Expenses" />
      <ExpenseList expenses={expenses} />
    </div>
  );
}

function BalanceScreen({ worker, topUps, expenses }) {
  return (
    <div className="space-y-5">
      <BalanceHero balance={worker.balance} />
      <Panel>
        <SectionTitle icon={Banknote} title="Money Received" compact />
        <SimpleHistory
          items={topUps}
          empty="No money received yet"
          render={(item) => (
            <>
              <span>{item.date}</span>
              <strong className="text-emerald-200">+ {money(item.amount)}</strong>
            </>
          )}
        />
      </Panel>
      <Panel>
        <SectionTitle icon={ReceiptText} title="Money Spent" compact />
        <SimpleHistory
          items={expenses}
          empty="No money spent yet"
          render={(item) => (
            <>
              <span>{item.date} - {item.siteName}</span>
              <strong className="text-amberSoft">- {money(item.amount)}</strong>
            </>
          )}
        />
      </Panel>
    </div>
  );
}

function InputBlock({ icon: Icon, label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-sm font-bold text-white/75">{label}</span>
      <span className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-night/70 px-4">
        <Icon size={20} className="text-gold" />
        <input
          className="w-full bg-transparent text-white outline-none placeholder:text-white/30"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
        />
      </span>
    </label>
  );
}

function BottomNav({ items, active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-night/95 px-3 py-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-3xl gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition ${active === id ? 'bg-gold text-night' : 'text-white/55'}`}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function StatGrid({ stats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-luxury">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/15 text-amberSoft">
            <Icon size={22} />
          </div>
          <p className="text-sm text-white/50">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function InfoCard({ children }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-luxury">
      {children}
    </div>
  );
}

function Panel({ children }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-luxury">{children}</div>;
}

function SectionTitle({ icon: Icon, title, compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'mb-4' : ''}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-amberSoft">
        <Icon size={20} />
      </div>
      <h2 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold`}>{title}</h2>
    </div>
  );
}

function PrimaryButton({ children }) {
  return (
    <button className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gold px-5 text-lg font-bold text-night shadow-lg shadow-gold/20 transition active:scale-[0.98]">
      {children}
    </button>
  );
}

function ExpenseList({ expenses, showWorker = false, showCategory = false }) {
  if (!expenses.length) return <EmptyState icon={Search} text="No expenses yet" />;

  return (
    <div className="space-y-3">
      {expenses.map((expense) => (
        <div key={expense.id} className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">{expense.siteName}</p>
              {showCategory && (
                <p className="mt-1 inline-flex rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-amberSoft">
                  {expense.category}
                </p>
              )}
              <p className="mt-1 text-white/65">{expense.description}</p>
              <p className="mt-2 text-sm text-white/45">
                {showWorker ? `${expense.workerName} - ` : ''}
                {expense.date}
              </p>
            </div>
            <p className="whitespace-nowrap font-bold text-amberSoft">{money(expense.amount)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-white/55">
      <Icon className="mx-auto mb-3 text-gold" size={34} />
      <p className="font-semibold">{text}</p>
    </div>
  );
}

function BalanceHero({ balance }) {
  return (
    <div className="rounded-[32px] border border-gold/20 bg-[linear-gradient(135deg,rgba(217,164,65,0.24),rgba(255,255,255,0.06))] p-6 shadow-luxury">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-amberSoft">Current Balance</p>
      <p className="mt-3 text-4xl font-black">{money(balance)}</p>
    </div>
  );
}

function SummaryRows({ headers, rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="grid grid-cols-3 bg-white/10 px-3 py-3 text-xs font-bold uppercase tracking-wide text-white/50">
        {headers.map((header) => (
          <span key={header}>{header}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.join('-')} className="grid grid-cols-3 border-t border-white/10 px-3 py-3 text-sm">
          {row.map((cell) => (
            <span key={cell} className="break-words">
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function SimpleHistory({ items, empty, render }) {
  if (!items.length) return <EmptyState icon={Menu} text={empty} />;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] px-3 py-3 text-sm">
          {render(item)}
        </div>
      ))}
    </div>
  );
}

function OwnerVendors({ data, onAddVendor, onRemoveVendor, onAddVendorPurchase, onAddVendorPayment }) {
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  const [purchaseSiteId, setPurchaseSiteId] = useState('');
  const [purchaseCategory, setPurchaseCategory] = useState(expenseCategories[0]);
  const [purchaseDescription, setPurchaseDescription] = useState('');
  const [purchaseTotalAmount, setPurchaseTotalAmount] = useState('');
  const [purchasePaidAmount, setPurchasePaidAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today());

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());

  const activeSites = data.sites.filter((site) => site.status === 'Active');

  useEffect(() => {
    if (activeSites.length && !purchaseSiteId) {
      setPurchaseSiteId(activeSites[0].id);
    }
  }, [activeSites, purchaseSiteId]);

  const addVendorSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddVendor(name.trim(), phone.trim(), address.trim());
    setName('');
    setPhone('');
    setAddress('');
  };

  const selectedVendor = data.vendors.find((v) => v.id === selectedVendorId);

  const purchaseSubmit = (e) => {
    e.preventDefault();
    if (!selectedVendorId || !purchaseDescription.trim() || Number(purchaseTotalAmount) <= 0) return;
    
    const paid = Number(purchasePaidAmount || 0);
    const total = Number(purchaseTotalAmount);
    if (paid > total) {
      alert("Paid amount cannot exceed total amount");
      return;
    }

    onAddVendorPurchase(
      selectedVendorId,
      purchaseSiteId || null,
      purchaseCategory,
      purchaseDescription.trim(),
      total,
      paid,
      purchaseDate
    );

    setPurchaseDescription('');
    setPurchaseTotalAmount('');
    setPurchasePaidAmount('');
    setPurchaseDate(today());
  };

  const paymentSubmit = (e) => {
    e.preventDefault();
    if (!selectedVendorId || Number(paymentAmount) <= 0) return;

    onAddVendorPayment(selectedVendorId, Number(paymentAmount), paymentDate, paymentNote.trim());
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentDate(today());
  };

  const ledger = useMemo(() => {
    if (!selectedVendor) return [];
    
    const items = [];
    
    selectedVendor.purchases.forEach((p) => {
      const site = data.sites.find((s) => s.id === p.siteId);
      items.push({
        ...p,
        type: 'purchase',
        dateObj: new Date(p.date || p.created_at),
        siteName: site ? site.name : null
      });
    });

    selectedVendor.payments.forEach((pay) => {
      items.push({
        ...pay,
        type: 'payment',
        dateObj: new Date(pay.date || pay.created_at)
      });
    });

    return items.sort((a, b) => b.dateObj - a.dateObj);
  }, [selectedVendor, data.sites]);

  if (selectedVendor) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelectedVendorId(null)}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/15"
        >
          <ArrowLeft size={16} /> Back to Vendors
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-luxury">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Vendor Profile</p>
              <h2 className="mt-1 text-3xl font-black text-white">{selectedVendor.name}</h2>
              {selectedVendor.phone && <p className="mt-1 text-sm text-white/60">📞 {selectedVendor.phone}</p>}
              {selectedVendor.address && <p className="text-sm text-white/60">📍 {selectedVendor.address}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onRemoveVendor(selectedVendor.id);
                  setSelectedVendorId(null);
                }}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
              >
                <Trash2 size={16} /> Delete Vendor
              </button>
            </div>
          </div>
          
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniAmount label="Total Purchases" value={money(selectedVendor.totalPurchased)} />
            <MiniAmount label="Total Paid" value={money(selectedVendor.totalPaid)} tone="profit" />
            <MiniAmount
              label="Remaining Payable"
              value={money(selectedVendor.balanceOwed)}
              tone={selectedVendor.balanceOwed > 0 ? 'loss' : 'profit'}
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <Panel>
              <SectionTitle icon={Plus} title="Record Purchase (Buy)" compact />
              <form onSubmit={purchaseSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="simple-label">Site (Optional)</label>
                  <select className="field mt-1" value={purchaseSiteId} onChange={(e) => setPurchaseSiteId(e.target.value)}>
                    <option value="">No site (Daily Overhead / General)</option>
                    {activeSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="simple-label">Category</label>
                    <select className="field mt-1" value={purchaseCategory} onChange={(e) => setPurchaseCategory(e.target.value)}>
                      {expenseCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="simple-label">Date</label>
                    <input className="field mt-1" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="simple-label">Description</label>
                  <input
                    className="field mt-1"
                    placeholder="e.g. 10x 550W Jinko solar panels"
                    value={purchaseDescription}
                    onChange={(e) => setPurchaseDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="simple-label">Total Bill Amount</label>
                    <input
                      className="field mt-1"
                      type="number"
                      placeholder="Total Bill"
                      value={purchaseTotalAmount}
                      onChange={(e) => setPurchaseTotalAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="simple-label">Paid Amount Now</label>
                    <input
                      className="field mt-1"
                      type="number"
                      placeholder="Paid Amount (0 if unpaid)"
                      value={purchasePaidAmount}
                      onChange={(e) => setPurchasePaidAmount(e.target.value)}
                    />
                  </div>
                </div>

                <PrimaryButton>Record Purchase</PrimaryButton>
              </form>
            </Panel>

            <Panel>
              <SectionTitle icon={Banknote} title="Record Payment to Vendor" compact />
              <form onSubmit={paymentSubmit} className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="simple-label">Amount Paid</label>
                    <input
                      className="field mt-1"
                      type="number"
                      placeholder="Amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="simple-label">Date</label>
                    <input className="field mt-1" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="simple-label">Note / Ref</label>
                  <input
                    className="field mt-1"
                    placeholder="e.g. Paid in Cash / Bank transfer ref 1234"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                  />
                </div>
                <PrimaryButton>Record Payment</PrimaryButton>
              </form>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel>
              <SectionTitle icon={History} title="Vendor Ledger / History" compact />
              <div className="mt-4 space-y-3">
                {ledger.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                    {item.type === 'purchase' ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-amberSoft uppercase">
                            Purchase ({item.category})
                          </span>
                          <span className="text-white/40 text-xs">{item.date}</span>
                        </div>
                        <p className="mt-1 font-semibold text-white">{item.description}</p>
                        {item.siteName && (
                          <p className="text-xs text-white/50 mt-0.5">Site: {item.siteName}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs border-t border-white/5 pt-2">
                          <div>
                            <span className="text-white/40">Total: </span>
                            <span className="font-bold text-white">{money(item.totalAmount)}</span>
                          </div>
                          <div>
                            <span className="text-white/40">Paid: </span>
                            <span className="font-bold text-emerald-300">{money(item.paidAmount)}</span>
                          </div>
                          <div>
                            <span className="text-white/40">Payable: </span>
                            <span className={`font-bold ${item.remainingAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              {money(item.remainingAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200 uppercase">
                            Payment Made
                          </span>
                          <span className="text-white/40 text-xs">{item.date}</span>
                        </div>
                        <p className="mt-1 font-semibold text-white">Amount Paid: {money(item.amount)}</p>
                        {item.note && <p className="text-xs text-white/50 mt-1">Note: {item.note}</p>}
                      </div>
                    )}
                  </div>
                ))}

                {ledger.length === 0 && (
                  <EmptyState icon={Search} text="No transactions recorded for this vendor." />
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionTitle icon={Store} title="Vendor Accounts" />
        <div className="text-right">
          <p className="text-xs text-white/50 uppercase tracking-wider">Total Owed to Vendors</p>
          <p className="text-xl font-bold text-red-300">{money(data.totalVendorOwed || 0)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <SectionTitle icon={Plus} title="Add New Vendor" compact />
          <form onSubmit={addVendorSubmit} className="mt-4 space-y-4">
            <div>
              <label className="simple-label">Vendor Shop Name</label>
              <input
                className="field mt-1"
                placeholder="e.g. Lahore Solar Center"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="simple-label">Phone Number (Optional)</label>
              <input
                className="field mt-1"
                placeholder="e.g. 0300-1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="simple-label">Address (Optional)</label>
              <input
                className="field mt-1"
                placeholder="e.g. Hall Road, Lahore"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <PrimaryButton>Save Vendor</PrimaryButton>
          </form>
        </Panel>

        <Panel>
          <SectionTitle icon={Store} title="Vendors List" compact />
          <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {data.vendors.map((vendor) => (
              <button
                key={vendor.id}
                onClick={() => setSelectedVendorId(vendor.id)}
                className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white/[0.08]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg text-white">{vendor.name}</h3>
                    {vendor.phone && <p className="text-xs text-white/50">📞 {vendor.phone}</p>}
                    <div className="mt-2 flex gap-3 text-xs text-white/60">
                      <span>Purchased: <strong>{money(vendor.totalPurchased)}</strong></span>
                      <span>Paid: <strong>{money(vendor.totalPaid)}</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block">Payable Balance</span>
                    <span className={`font-black text-lg ${vendor.balanceOwed > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                      {money(vendor.balanceOwed)}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {data.vendors.length === 0 && (
              <EmptyState icon={Search} text="No vendors registered yet." />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default App;
