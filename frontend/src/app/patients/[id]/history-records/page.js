'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/common/Navbar';
import {
  FileText,
  User,
  Calendar,
  Activity,
  AlertCircle,
  ArrowLeft,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

export default function PatientHistoryRecordsPage() {
  const params = useParams();
  const patientId = params?.id;
if (!patientId) return;
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    let isMounted = true;
    const fetchPatientHistory = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch patient history records');
        }

        const data = await res.json();
        if (!isMounted) return;

        setPatient(data);
        setAppointments(data.appointments || []);
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (patientId) {
      fetchPatientHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [patientId, API_BASE_URL]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
              Loading patient history records...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl text-center">
            <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Failed to Load Records
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {error}
            </p>
            <Link
              href="/patients"
              className="inline-flex items-center justify-center gap-2 mt-6 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm shadow-teal-600/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                Diagnostic History Records
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Legacy patient clinical history viewer
              </p>
            </div>
          </div>

          <Link
            href={`/patients/${patient.id}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/40 dark:border-slate-700/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Patient
          </Link>
        </div>

        {/* Patient Cards Overview */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Patient Name</p>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">{patient.name}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Medical History</p>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                {patient.medicalHistory?.trim() ? patient.medicalHistory : 'No medical history available'}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Appointments</p>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">{appointments.length}</h3>
            </div>
          </div>
        </div>

        {/* Timeline Table Container */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Clinical Timeline</h2>
          </div>

          {appointments.length === 0 ? (
            <div className="p-12 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Stethoscope className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Clinical Records Found</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                This patient does not have any appointment history yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="p-5 sm:p-6 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          Dr. {appointment.doctor?.name || 'Unknown'}
                        </h3>
                        <span className="text-xs px-2 py-0.5 bg-teal-500/10 text-teal-700 dark:text-teal-400 font-medium rounded">
                          {appointment.doctor?.specialization || 'General Practice'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-900 mt-2">
                        <strong className="text-slate-400 font-medium text-xs block mb-0.5 uppercase tracking-wider">Reason for Visit</strong>
                        {appointment.reason?.trim() ? appointment.reason : 'No diagnosis notes available'}
                      </p>
                    </div>

                    <div className="flex md:flex-col justify-between md:items-end items-center gap-2 shrink-0 border-t md:border-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        appointment.status === 'COMPLETED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                          : appointment.status === 'CANCELLED'
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'
                          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {appointment.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {appointment.status === 'CANCELLED' && <XCircle className="w-3.5 h-3.5" />}
                        {appointment.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                        {appointment.status}
                      </span>

                      <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                        {new Date(appointment.appointmentDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}