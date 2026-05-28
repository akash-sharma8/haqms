'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/common/Navbar';
import { useRouter } from 'next/navigation';
import {
  Users, CalendarDays, Activity, Search, Sparkles, UserPlus, Trash2, ClipboardList, TrendingUp, DollarSign, Award, Clock, ArrowRight, ShieldAlert, CheckCircle, Volume2
} from 'lucide-react';

// FIX 1: Moved tab default logic into a helper so initial useState gets the right value
// without depending on a potentially-undefined user at module load time.
// Previously, `activeTab` was initialized before `user` was resolved, so it always
// fell through to the `else` branch ('appointments') regardless of role.
function getDefaultTab(role) {
  if (role === 'ADMIN') return 'reports';
  if (role === 'RECEPTIONIST') return 'patients';
  return 'appointments';
}

export default function Dashboard() {

  const { user, token, API_BASE_URL, logout } = useAuth();
  const router = useRouter();

  // ==========================================
  // STATE FOR RECEPTIONIST WORKFLOWS
  // ==========================================

  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientGender, setPatientGender] = useState('All');
  const [patientsPagination, setPatientsPagination] = useState({ page: 1, totalPages: 1 });

  // Registration Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState('Male');
  const [regHistory, setRegHistory] = useState('');
  const [regMessage, setRegMessage] = useState('');

  // Queue and Appointment Booking
  const [doctorsList, setDoctorsList] = useState([]);
  const [bookingPatientId, setBookingPatientId] = useState('');
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [checkinMessage, setCheckinMessage] = useState('');

  // FIX 2: Walk-in selects converted from uncontrolled (document.getElementById) to
  // controlled React state. Previously the values were read via DOM querying, which
  // is an anti-pattern in React and silently returns stale/empty values after re-renders.
  const [walkinPatientId, setWalkinPatientId] = useState('');
  const [walkinDoctorId, setWalkinDoctorId] = useState('');

  // ==========================================
  // STATE FOR DOCTOR WORKFLOWS
  // ==========================================

  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [doctorQueue, setDoctorQueue] = useState([]);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null);

  // ==========================================
  // STATE FOR ADMIN WORKFLOWS
  // ==========================================

  const [adminReportData, setAdminReportData] = useState(null);
  const [adminReportLoading, setAdminReportLoading] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [doctorsLoadError, setDoctorsLoadError] = useState(false);

  // FIX 1 (continued): activeTab now correctly derives from user.role on first render.
  // The old code initialized to 'appointments' unconditionally because `user` is null
  // at module evaluation time. Now we derive from user?.role which may still be null
  // initially, but the useEffect below will correct it once user loads.
  const [activeTab, setActiveTab] = useState(getDefaultTab(user?.role));

  // ==========================================
  // NAVIGATION GUARD
  // ==========================================

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // FIX 1 (continued): Keep activeTab in sync when user object loads asynchronously.
  // This correctly handles the case where user is null on first render (e.g. after
  // a page refresh where auth state is restored asynchronously).
  useEffect(() => {
    if (user?.role) {
      setActiveTab(getDefaultTab(user.role));
    }
  }, [user?.role]);

  // ==========================================
  // RECEPTIONIST FUNCTIONS
  // ==========================================

  const fetchPatients = useCallback(async (page = 1) => {
    // FIX 3: Guard against running without a valid token. Previously this could fire
    // with token=null during initial render, sending unauthenticated requests.
    if (!token) return;

    setPatientsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/patients?page=${page}&limit=5&search=${encodeURIComponent(patientSearch)}&gender=${patientGender}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients);
        setPatientsPagination({
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          totalPatients: data.pagination.totalPatients
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPatientsLoading(false);
    }
    // FIX 3 (continued): Added token, API_BASE_URL to deps so the callback always closes
    // over the current token and not a stale null value from first render.
  }, [token, API_BASE_URL, patientSearch, patientGender]);

  // FIX 4: Debounce patient search to avoid firing an API call on every single keystroke.
  // Previously, typing "John" would fire 4 separate requests. Now it waits 350ms after
  // the user stops typing before fetching — a standard search-as-you-type pattern.
  useEffect(() => {
    if (user?.role === 'RECEPTIONIST' || user?.role === 'ADMIN') {
      const debounceTimer = setTimeout(() => {
        fetchPatients(1);
      }, 350);
      return () => clearTimeout(debounceTimer);
    }
  }, [patientSearch, patientGender, fetchPatients, user?.role]);
  // Fetch Doctors for booking drop-down
  const fetchDoctorsDropdown = useCallback(async () => {
    if (!token) return;
    setDoctorsLoadError(false);
    try {
      const res = await fetch(`${API_BASE_URL}/doctors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // ✅ FIX: API wraps the array inside data.data
      const list = data.data ?? data; // handles both { data: [] } and plain []
      if (Array.isArray(list) && list.length > 0) {
        setDoctorsList(list);
      } else {
        setDoctorsLoadError(true);
      }
    } catch (e) {
      console.error('fetchDoctorsDropdown failed:', e);
      setDoctorsLoadError(true);
    }
  }, [token, API_BASE_URL]);

  useEffect(() => {
    fetchDoctorsDropdown();
  }, [fetchDoctorsDropdown]);

  useEffect(() => {
    if (token) {                    // ← only fetch once token exists
      fetchDoctorsDropdown();
    }
  }, [token, fetchDoctorsDropdown]);
  // Handle Patient Registration
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    setRegMessage('');

    // FIX 5: Added phone number format validation. Previously any string was accepted,
    // polluting the database with values like "abc" or "N/A".
    // This regex allows common formats: 10-15 digits, optional +, spaces, dashes, parens.
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{8,14}$/;
    if (!phoneRegex.test(regPhone)) {
      setRegMessage('Error: Enter a valid phone number (e.g. 555-0199 or +91-9876543210).');
      return;
    }

    if (!regName || !regPhone || !regAge) {
      setRegMessage('Error: Name, Age and Phone number are required.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phoneNumber: regPhone,
          age: parseInt(regAge, 10),
          gender: regGender,
          medicalHistory: regHistory
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRegMessage('Success: Patient registered successfully!');
        setRegName('');
        setRegEmail('');
        setRegPhone('');
        setRegAge('');
        setRegHistory('');
        fetchPatients(1);
      } else {
        setRegMessage(`Error: ${data.error || 'Failed to register'}`);
      }
    } catch (err) {
      setRegMessage(`Error: ${err.message}`);
    }
  };

  // Handle Appointment Booking
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookingMessage('');
    if (doctorsList.length === 0) {
      setBookingMessage('Error: No physicians available. Please refresh or contact support.');
      return;
    }
    if (!bookingPatientId || !bookingDoctorId || !bookingDate) {
      setBookingMessage('Error: All booking fields are required.');
      return;
    }
    // Prevent booking in the past
    if (new Date(bookingDate) < new Date()) {
      setBookingMessage('Error: Appointment date cannot be in the past.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: bookingPatientId,
          doctorId: bookingDoctorId,
          appointmentDate: bookingDate,
          reason: bookingReason
        })
      });

      const data = await res.json();
      if (res.ok) {
        setBookingMessage('Success: Appointment booked successfully!');
        setBookingPatientId('');
        setBookingDoctorId('');
        setBookingDate('');
        setBookingReason('');
        if (user.role === 'DOCTOR') fetchDoctorWorklist();
      } else {
        setBookingMessage(`Error: ${data.error || 'Failed to book'}`);
      }
    } catch (err) {
      setBookingMessage(`Error: ${err.message}`);
    }
  };

  // FIX 6: Delete Patient — restricted to ADMIN role only in the UI.
  // Previously the delete button was rendered for ALL roles including RECEPTIONIST
  // and DOCTOR, relying solely on a server-side check that the comments noted was
  // bypassed. Defense-in-depth: never show destructive actions to unauthorized roles.
  const handleDeletePatient = async (id) => {
    if (user?.role !== 'ADMIN') {
      alert('Only administrators can delete patient records.');
      return;
    }
    if (!confirm('Are you sure you want to delete this patient record? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Patient deleted.');
        fetchPatients(patientsPagination.page);
      } else {
        alert(`Error: ${data.error || 'Deletion failed.'}`);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Queue Token Checkin
  const handleQueueCheckin = async (patientId, doctorId, appointmentId = null) => {
    setCheckinMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/queue/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ patientId, doctorId, appointmentId })
      });

      const data = await res.json();
      console.log('Queue checkin response:', data); // 👈 check shape once, then remove

      if (res.ok) {
        // ✅ FIX: handle all common API response shapes safely
        // ✅ Replace the fallback chain with just this:
        const tokenNumber = data?.data?.tokenNumber ?? '—';
        setCheckinMessage(`Checked in! Generated Token #${tokenNumber}`);

        if (user.role === 'DOCTOR') fetchDoctorWorklist();
      } else {
        setCheckinMessage(`Error check-in: ${data?.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      setCheckinMessage(`Error: ${err.message}`);
    }
  };

  // ==========================================
  // DOCTOR WORKFLOW FUNCTIONS
  // ==========================================

  const fetchDoctorWorklist = useCallback(async () => {
  if (user?.role !== 'DOCTOR' || !token) return;
  try {
    const matchedDoc = doctorsList.find(d => d.userId === user.id);
    if (!matchedDoc) return;

    const [appRes, queueRes] = await Promise.all([
      fetch(`${API_BASE_URL}/appointments?doctorId=${matchedDoc.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(`${API_BASE_URL}/queue?doctorId=${matchedDoc.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    const [appData, queueData] = await Promise.all([appRes.json(), queueRes.json()]);

    console.log('appData:', appData);   // 👈 add once to confirm shape, then remove
    console.log('queueData:', queueData);

    // ✅ FIX: handle both { appointments: [] } and { data: [] } shapes
    const appointments = appData?.appointments ?? appData?.data ?? [];
    const queue = queueData?.data ?? queueData?.tokens ?? [];

    setDoctorAppointments(appointments);
    setDoctorQueue(Array.isArray(queue) ? queue : []);

  } catch (e) {
    console.error(e);
    setDoctorAppointments([]); // ✅ never leave state as undefined on error
    setDoctorQueue([]);
  }
}, [user, token, doctorsList, API_BASE_URL]);

  useEffect(() => {
    if (user?.role === 'DOCTOR' && doctorsList.length > 0) {
      fetchDoctorWorklist();
    }
  }, [doctorsList, fetchDoctorWorklist, user?.role]);

  const handleUpdateQueueStatus = async (tokenId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/queue/${tokenId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchDoctorWorklist();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompleteAppointment = async (appId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/appointments/${appId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'COMPLETED' })
      });
      if (res.ok) fetchDoctorWorklist();
    } catch (e) {
      console.error(e);
    }
  };

  // ==========================================
  // ADMIN SYSTEM WORKFLOWS
  // ==========================================

  const generateSystemReport = async () => {
    setAdminReportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/doctor-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAdminReportData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setAdminReportLoading(false);
    }
  };

  // FIX 7: Sanitize admin search query before sending to prevent SQL injection from
  // the client side. The server-side vulnerability still needs fixing (use parameterized
  // queries), but stripping dangerous SQL metacharacters adds a layer of protection
  // and prevents accidental injection from legitimate use.
  const sanitizeSearchQuery = (query) => {
    return query.replace(/['";\-\-\/\*\\]/g, '').trim();
  };

  const searchPhysiciansAdmin = async () => {
    const safeQuery = sanitizeSearchQuery(adminSearchQuery);
    if (safeQuery !== adminSearchQuery) {
      alert('Search query contains disallowed characters and has been sanitized.');
      setAdminSearchQuery(safeQuery);
    }
    try {
      const res = await fetch(`${API_BASE_URL}/doctors?search=${encodeURIComponent(safeQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setDoctorsList(data);
      } else {
        alert(`API Error: ${data.error || 'Search failed.'}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8">

        {/* Navigation Tabs based on Role */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto gap-4">
          {user?.role === 'ADMIN' && (
            <>
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-3.5 px-1 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'reports' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400'}`}
              >
                System Audit Reports
              </button>
              <button
                onClick={() => setActiveTab('physicians')}
                className={`py-3.5 px-1 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'physicians' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400'}`}
              >
                Physician Registry
              </button>
            </>
          )}

          {(user?.role === 'RECEPTIONIST' || user?.role === 'ADMIN') && (
            <>
              <button
                onClick={() => setActiveTab('patients')}
                className={`py-3.5 px-1 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'patients' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400'}`}
              >
                Patient Registry Directory
              </button>
              <button
                onClick={() => setActiveTab('book')}
                className={`py-3.5 px-1 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'book' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400'}`}
              >
                Scheduling / Check-in Portal
              </button>
            </>
          )}

          {user?.role === 'DOCTOR' && (
            <>
              <button
                onClick={() => setActiveTab('appointments')}
                className={`py-3.5 px-1 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'appointments' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400'}`}
              >
                My Scheduled Bookings
              </button>
              <button
                onClick={() => setActiveTab('queue')}
                className={`py-3.5 px-1 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'queue' ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-400'}`}
              >
                Active Calling Queue
              </button>
            </>
          )}
        </div>

        {/* Global Notifications Panel */}
        {checkinMessage && (
          <div className="p-4 mb-6 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-between text-sm">
            <span>{checkinMessage}</span>
            <button onClick={() => setCheckinMessage('')} className="font-bold underline text-xs">Dismiss</button>
          </div>
        )}

        {/* ==============================================================
            TAB: PATIENT REGISTRY (RECEPTIONIST & ADMIN)
            ============================================================== */}
        {activeTab === 'patients' && (
          <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-3">

              {/* Directory Section */}
              <div className="lg:col-span-2 space-y-6">
                <div className="glass p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                    <ClipboardList className="h-5 w-5 text-teal-600" />
                    Patient Lookup Directory
                  </h3>

                  {/* Filters — debounced on keystroke (FIX 4) */}
                  <div className="flex gap-4 mb-6">
                    <div className="relative flex-1 rounded-lg shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search by name, phone or email..."
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value)}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                    >
                      <option value="All">All Genders</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Table listing */}
                  {patientsLoading ? (
                    <p className="text-center py-6 text-slate-400 animate-pulse text-sm">Synchronizing table data...</p>
                  ) : patients.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 text-sm">No registered patients match this filter.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
                        <thead>
                          <tr className="text-slate-400 uppercase tracking-widest text-xxs font-bold border-b border-slate-200 dark:border-slate-800">
                            <th className="pb-3">Name</th>
                            <th className="pb-3">Contact</th>
                            <th className="pb-3">Age/Sex</th>
                            <th className="pb-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {patients.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-500/5 transition-colors">
                              <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">
                                {p.name}
                                {p.email && <span className="block text-xxs text-slate-400 font-normal mt-0.5">{p.email}</span>}
                              </td>
                              <td className="py-3.5 text-slate-500 dark:text-slate-400 font-medium">{p.phoneNumber}</td>
                              <td className="py-3.5 text-slate-500 dark:text-slate-400">
                                {p.age} yrs / <span className="capitalize">{p.gender}</span>
                              </td>
                              <td className="py-3.5 text-right space-x-2">
                                <button
                                  onClick={() => handleQueueCheckin(p.id, doctorsList[0]?.id)}
                                  className="text-xxs px-2.5 py-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold hover:bg-teal-500 hover:text-white transition-colors"
                                >
                                  Check In
                                </button>

                                {/* FIX 6: Delete button is only rendered for ADMIN role.
                                    Previously shown to all roles including RECEPTIONIST. */}
                                {user?.role === 'ADMIN' && (
                                  <button
                                    onClick={() => handleDeletePatient(p.id)}
                                    className="text-xxs p-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                                    title="Delete patient record"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination control */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">
                      Page {patientsPagination.page} of {patientsPagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={patientsPagination.page <= 1}
                        onClick={() => fetchPatients(patientsPagination.page - 1)}
                        className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-teal-500/10 disabled:opacity-50 text-xs font-semibold"
                      >
                        Prev
                      </button>
                      <button
                        disabled={patientsPagination.page >= patientsPagination.totalPages}
                        onClick={() => fetchPatients(patientsPagination.page + 1)}
                        className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-teal-500/10 disabled:opacity-50 text-xs font-semibold"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Form */}
              <div className="glass p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 h-fit">
                <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                  <UserPlus className="h-5 w-5 text-teal-600" />
                  New Registration
                </h3>

                {regMessage && (
                  <div className={`p-3 text-sm rounded-lg mb-4 ${regMessage.startsWith('Success') ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/20' : 'bg-rose-500/15 text-rose-500 border border-rose-500/20'}`}>
                    {regMessage}
                  </div>
                )}

                <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <div>
                    <label className="block mb-1">Patient Full Name*</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Bruce Wayne"
                      className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1">Age (Years)*</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="150"
                        value={regAge}
                        onChange={(e) => setRegAge(e.target.value)}
                        placeholder="35"
                        className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block mb-1">Gender*</label>
                      <select
                        value={regGender}
                        onChange={(e) => setRegGender(e.target.value)}
                        className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    {/* FIX 5: Phone field now uses type="tel" and shows expected format hint */}
                    <label className="block mb-1">Contact Phone*</label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="555-0199"
                      pattern="^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{8,14}$"
                      title="Enter a valid phone number (e.g. 555-0199 or +91-9876543210)"
                      className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="bruce@wayne.com"
                      className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block mb-1">Medical Anamnesis / History (Can be left blank)</label>
                    <textarea
                      value={regHistory}
                      onChange={(e) => setRegHistory(e.target.value)}
                      placeholder="E.g. cardiovascular risks, asthma..."
                      rows="3"
                      className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="glow-btn w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm rounded-lg shadow-md transition-colors duration-300 mt-2"
                  >
                    Register Patient Record
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB: SCHEDULING / BOOKING & CHECKIN (RECEPTIONIST & ADMIN)
            ============================================================== */}
        {activeTab === 'book' && (
          <div className="grid gap-8 lg:grid-cols-2">

            {/* Book Appointment Card */}
            <div className="glass p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <CalendarDays className="h-5 w-5 text-teal-600" />
                Schedule Appointment Slot
              </h3>

              {/* Error banner if doctors failed to load */}
              {doctorsLoadError && (
                <div className="p-3 text-sm rounded-lg mb-4 bg-rose-500/15 text-rose-500 border border-rose-500/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    Physicians list could not be loaded.
                  </div>
                  <button
                    onClick={fetchDoctorsDropdown}   /* ← retry button */
                    className="text-xs font-bold underline hover:text-rose-600 whitespace-nowrap"
                  >
                    Retry
                  </button>
                </div>
              )}

              {bookingMessage && (
                <div className={`p-3 text-sm rounded-lg mb-4 ${bookingMessage.startsWith('Success')
                  ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                  : 'bg-rose-500/15 text-rose-500 border border-rose-500/20'}`}>
                  {bookingMessage}
                </div>
              )}

              <form onSubmit={handleBookAppointment} className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <div>
                  <label className="block mb-1">Select Registered Patient*</label>
                  <select
                    required
                    value={bookingPatientId}
                    onChange={(e) => setBookingPatientId(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.phoneNumber})</option>
                    ))}
                  </select>
                  {patients.length === 0 && (
                    <span className="text-xxs text-rose-400 block mt-1">No patients found. Register one in the Directory tab first.</span>
                  )}
                  <span className="text-xxs text-slate-400 block mt-1">If client is missing, register them in the Directory tab first.</span>
                </div>

                <div>
                  <label className="block mb-1">Select Physician*</label>
                  <select
                    required
                    disabled={doctorsLoadError || doctorsList.length === 0}
                    value={bookingDoctorId}
                    onChange={(e) => setBookingDoctorId(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {doctorsLoadError ? '⚠ Physicians unavailable' : '-- Choose Physician --'}
                    </option>
                    {doctorsList.map(d => (
                      <option key={d.id} value={d.id}>{d.name} - {d.specialization} (${d.consultationFee})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1">Appointment Date & Time*</label>
                  <input
                    type="datetime-local"
                    required
                    min={new Date().toISOString().slice(0, 16)} /* Prevent past dates at HTML level */
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1">Consultation Objective / Reason</label>
                  <input
                    type="text"
                    value={bookingReason}
                    onChange={(e) => setBookingReason(e.target.value)}
                    placeholder="Regular diagnostic review, suture removal..."
                    className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={doctorsLoadError || doctorsList.length === 0 || patients.length === 0}
                  className="glow-btn w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm rounded-lg shadow-md transition-colors duration-300 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Book Appointment Slot
                </button>
              </form>
            </div>

            {/* Quick Walk-in Checkin Token Board */}
            <div className="glass p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-teal-600" />
                Active Direct Queue Check-In
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-semibold">
                Generate an immediate waiting token for a direct walk-in patient. Allocates active positions under selected practitioners.
              </p>

              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-teal-500/25 bg-teal-500/10 text-slate-700 dark:text-slate-300 text-xs leading-5">
                  <strong>Token Generation Engine Note:</strong> Direct arrivals bypass appointments.
                  The token engine automatically fetches the current day's maximum token size and increments.
                </div>

                {/* FIX 2: Walk-in selects are now controlled React state (walkinPatientId,
                    walkinDoctorId) instead of reading from the DOM via getElementById.
                    The old approach silently returned empty strings after re-renders. */}
                <div className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <div>
                    <label className="block mb-1">Select Walk-in Patient*</label>
                    <select
                      value={walkinPatientId}
                      onChange={(e) => setWalkinPatientId(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                    >
                      <option value="">-- Choose Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1">Assign Physician*</label>
                    <select
                      value={walkinDoctorId}
                      onChange={(e) => setWalkinDoctorId(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none"
                    >
                      <option value="">-- Choose Physician --</option>
                      {doctorsList.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      if (doctorsLoadError) {
                        alert('Physicians list failed to load. Please refresh the page.');
                        return;
                      }
                      if (!walkinPatientId || !walkinDoctorId) {
                        alert('Select both a patient and a physician first.');
                        return;
                      }
                      handleQueueCheckin(walkinPatientId, walkinDoctorId);
                    }}
                    disabled={doctorsLoadError || doctorsList.length === 0}
                    className="glow-btn w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 font-extrabold text-sm rounded-lg shadow-md transition-colors duration-300 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate Live Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB: DOCTOR WORKLIST - APPOINTMENTS (DOCTOR ROLE)
            ============================================================== */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <CalendarDays className="h-5 w-5 text-teal-600" />
                Scheduled Daily Bookings List
              </h3>

              {(doctorAppointments ?? []).length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-sm">No appointments scheduled for you today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-widest text-xxs font-bold border-b border-slate-200 dark:border-slate-800">
                        <th className="pb-3">Time</th>
                        <th className="pb-3">Patient</th>
                        <th className="pb-3">Consultation Reason</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {doctorAppointments.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-500/5 transition-colors">
                          <td className="py-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {new Date(app.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3.5">
                            <button
                              onClick={() => setSelectedPatientHistory(app.patient)}
                              className="font-bold text-teal-600 hover:underline hover:text-teal-700 transition-colors"
                            >
                              {app.patient ? app.patient.name : 'Unknown Patient'}
                            </button>
                            <span className="block text-xxs text-slate-400 mt-0.5">Age: {app.patient?.age}</span>
                          </td>
                          <td className="py-3.5 text-slate-500 dark:text-slate-400 font-semibold">{app.reason || 'None provided'}</td>
                          <td className="py-3.5">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xxs font-extrabold tracking-wide uppercase ${app.status === 'COMPLETED' ? 'bg-teal-500/10 text-teal-600' : app.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="py-3.5 text-right space-x-2">
                            {app.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => {
                                    const matchedDoc = doctorsList.find(d => d.userId === user.id);
                                    if (matchedDoc) handleQueueCheckin(app.patientId, matchedDoc.id, app.id);
                                  }}
                                  className="text-xxs px-2.5 py-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-extrabold hover:bg-teal-500 hover:text-white transition-colors"
                                >
                                  Check In Patient
                                </button>
                                <button
                                  onClick={() => handleCompleteAppointment(app.id)}
                                  className="text-xxs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold hover:bg-teal-500 hover:text-white transition-colors"
                                >
                                  Complete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Patient Clinical History Modal Display */}
            {selectedPatientHistory && (
              <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                      Medical Records: {selectedPatientHistory.name}
                    </h3>
                    <p className="text-xxs font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Gender: {selectedPatientHistory.gender} | Contact: {selectedPatientHistory.phoneNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPatientHistory(null)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider">Clinical Background Information</h4>

                  {/* FIX 8: Removed incorrect .toUpperCase() call on medical history.
                      Displaying patient medical history in ALL CAPS is poor UX and
                      potentially obscures formatting. The optional chain (?.) already
                      safely handles null — no crash was possible here in modern JS,
                      but the uppercase was a genuine display bug. */}
                  <p className="text-slate-700 dark:text-slate-300 leading-5 text-sm font-semibold">
                    {selectedPatientHistory.medicalHistory || 'No medical history on record.'}
                  </p>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs">
                  <Link
                    href={`/patients/${selectedPatientHistory.id}/history-records`}
                    className="text-teal-600 font-extrabold hover:underline flex items-center gap-1"
                  >
                    View Full Diagnostic Records
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==============================================================
            TAB: DOCTOR ACTIVE CALLING QUEUE (DOCTOR ROLE)
            ============================================================== */}
        {activeTab === 'queue' && (
          <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-teal-600" />
              Active Operations Queue Controller
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-semibold">
              Manage patient call sequences for live monitors. Update status from waiting to active calling.
            </p>

            {doctorQueue.length === 0 ? (
              <p className="text-center py-6 text-slate-400 text-sm">No checked-in patients in queue today.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {doctorQueue.map((t) => (
                  <div
                    key={t.id}
                    className={`p-5 rounded-2xl border shadow-md relative overflow-hidden flex flex-col justify-between ${t.status === 'CALLING' ? 'border-teal-500 bg-teal-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-500/5'}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-2xl font-black text-slate-800 dark:text-slate-100">Token #{t.tokenNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-xxs font-extrabold tracking-wide uppercase ${t.status === 'CALLING' ? 'bg-teal-500 text-white' : t.status === 'COMPLETED' ? 'bg-teal-500/10 text-teal-600' : 'bg-amber-500/10 text-amber-500'}`}>
                        {t.status}
                      </span>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.patient.name}</h4>
                      <p className="text-xxs text-slate-400 mt-0.5">Contact: {t.patient.phoneNumber}</p>
                    </div>

                    <div className="mt-6 flex gap-2">
                      {t.status === 'WAITING' && (
                        <button
                          onClick={() => handleUpdateQueueStatus(t.id, 'CALLING')}
                          className="flex-1 py-1.5 bg-teal-600 text-white font-bold text-xxs rounded hover:bg-teal-700 transition-colors"
                        >
                          Call Patient
                        </button>
                      )}
                      {t.status === 'CALLING' && (
                        <>
                          <button
                            onClick={() => handleUpdateQueueStatus(t.id, 'COMPLETED')}
                            className="flex-1 py-1.5 bg-teal-600 text-white font-bold text-xxs rounded hover:bg-teal-700 transition-colors"
                          >
                            Consulted
                          </button>
                          <button
                            onClick={() => handleUpdateQueueStatus(t.id, 'SKIPPED')}
                            className="flex-1 py-1.5 bg-rose-500/10 text-rose-500 font-bold text-xxs rounded hover:bg-rose-500 hover:text-white transition-colors"
                          >
                            Skip / No Show
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==============================================================
            TAB: SYSTEM REPORTS (ADMIN ROLE)
            ============================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-8">
            <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    Doctor Revenue & Operations Report
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                    System-wide practitioner performance audits. Computes completed bookings and potential sales.
                  </p>
                </div>
                <button
                  onClick={generateSystemReport}
                  disabled={adminReportLoading}
                  className="glow-btn px-4 py-2 bg-teal-600 text-white font-extrabold text-xs rounded-lg shadow hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {adminReportLoading ? 'Aggregating...' : 'Load Doctor System Audit Report'}
                </button>
              </div>

              {adminReportLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="pulse-loader">
                    <div></div>
                    <div></div>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-slate-400 animate-pulse">
                    Executing nested aggregates...
                  </p>
                </div>
              ) : !adminReportData ? (
                <div className="p-8 text-center bg-slate-100 dark:bg-slate-800/40 rounded-xl text-slate-400 text-xs font-semibold border border-dashed border-slate-200 dark:border-slate-700">
                  Click the button above to load reports. Note: may be slow on large datasets.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 bg-amber-500/10 text-slate-700 dark:text-slate-300 text-xs rounded-lg border border-amber-500/20 leading-5">
                    <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                      <strong>Performance Diagnostic:</strong> API execution resolved in{' '}
                      <span className="font-bold text-amber-500">{adminReportData.timeTakenMs} ms</span>.
                      Consider optimizing with Promise.all or a single JOIN aggregate query.
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="p-4 bg-slate-500/5 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <span className="text-xxs uppercase tracking-wider text-slate-400 font-bold">Total Physicians</span>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{adminReportData.data.length}</h4>
                    </div>
                    <div className="p-4 bg-slate-500/5 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <span className="text-xxs uppercase tracking-wider text-slate-400 font-bold">Sum Appointments</span>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
                        {adminReportData.data.reduce((sum, item) => sum + item.totalAppointments, 0)}
                      </h4>
                    </div>
                    <div className="p-4 bg-slate-500/5 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <span className="text-xxs uppercase tracking-wider text-slate-400 font-bold">Total Sales ($)</span>
                      <h4 className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
                        ${adminReportData.data.reduce((sum, item) => sum + item.revenue, 0)}
                      </h4>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
                      <thead>
                        <tr className="text-slate-400 uppercase tracking-widest text-xxs font-bold border-b border-slate-200 dark:border-slate-800">
                          <th className="pb-3">Doctor</th>
                          <th className="pb-3">Department</th>
                          <th className="pb-3 text-center">Consultations</th>
                          <th className="pb-3 text-center">Today Queue</th>
                          <th className="pb-3 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {adminReportData.data.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">
                              {item.name}
                              <span className="block text-xxs text-teal-600 dark:text-teal-400 font-semibold uppercase mt-0.5">{item.specialization}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 dark:text-slate-400">{item.department}</td>
                            <td className="py-3.5 text-center text-slate-500 dark:text-slate-400">
                              {item.completedAppointments} Completed / {item.totalAppointments} Total
                            </td>
                            <td className="py-3.5 text-center font-bold text-slate-800 dark:text-slate-200">{item.todayQueueSize} in queue</td>
                            <td className="py-3.5 text-right font-bold text-teal-600 dark:text-teal-400">${item.revenue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==============================================================
            TAB: PHYSICIAN REGISTRY (ADMIN ROLE)
            ============================================================== */}
        {activeTab === 'physicians' && (
          <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Award className="h-5 w-5 text-teal-600" />
                Staff Physicians Registry Lookup
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                Search physician records by name.
              </p>
            </div>

            <div className="flex gap-4">
              <div className="relative flex-1 rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  placeholder="Search physician by name..."
                  className="block w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>

              {/* FIX 7: Renamed button from "Execute SQL Query" to "Search Physicians".
                  Exposing raw SQL semantics in the UI is misleading and invites misuse.
                  Input is also sanitized in searchPhysiciansAdmin() via sanitizeSearchQuery(). */}
              <button
                onClick={searchPhysiciansAdmin}
                className="glow-btn px-5 py-2 bg-slate-900 text-white dark:bg-teal-500 dark:text-slate-950 font-bold text-xs rounded-lg hover:bg-slate-800 dark:hover:bg-teal-400 transition-colors"
              >
                Search Physicians
              </button>
            </div>

            {/* FIX 7 (continued): Removed the public SQL injection notice from the UI.
                Security vulnerability disclosures should never be visible to end users —
                they belong in internal docs or a private security backlog. */}
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs rounded-lg border border-amber-500/20 font-semibold leading-5 flex gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <div>
                <strong>Backend notice:</strong> Ensure the search endpoint uses parameterized queries. Input is sanitized client-side, but server-side validation is required.
              </div>
            </div>

            {/* Doctors Result List */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctorsList.map((doc) => (
                <div
                  key={doc.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-500/5 flex flex-col justify-between"
                >
                  <div>
                    <span className="inline-flex px-2 py-0.5 rounded text-xxs font-extrabold tracking-wide uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-2">
                      {doc.department}
                    </span>
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-100">{doc.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{doc.specialization}</p>
                  </div>
                  <div className="mt-6 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex justify-between items-center text-xs font-semibold text-slate-500">
                    <span>Exp: {doc.experience} yrs</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">Fee: ${doc.consultationFee}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}