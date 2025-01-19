import React from 'react';
import { Card, Button, Input } from "@nextui-org/react";
import { useState, useEffect } from "react";
import { Line, Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';
import io from 'socket.io-client';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const StatsCard = ({ title, value, icon }) => (
  <div className="bg-white overflow-hidden shadow-lg rounded-xl">
    <div className="p-6">
      <div className="flex items-center">
        <div className="flex-shrink-0 p-3 bg-indigo-500 rounded-lg">
          {icon}
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-2xl font-semibold text-gray-900">{value}</dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [envVars, setEnvVars] = useState({});
  const [editedEnvVars, setEditedEnvVars] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [showPasswords, setShowPasswords] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [isNewChallengeModalOpen, setIsNewChallengeModalOpen] = useState(false);
  const [isEnvVarsCollapsed, setIsEnvVarsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('challenges'); // 'challenges', 'predefinedWarnings', 'issuedWarnings'
  const [predefinedWarnings, setPredefinedWarnings] = useState([]);
  const [issuedWarnings, setIssuedWarnings] = useState([]);
  const [isNewWarningModalOpen, setIsNewWarningModalOpen] = useState(false);
  const [editingWarning, setEditingWarning] = useState(null);
  const [isEditWarningModalOpen, setIsEditWarningModalOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    warningTrends: [],
    challengeDistribution: [],
    topModerators: []
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [isLogDetailsModalOpen, setIsLogDetailsModalOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [userSettings, setUserSettings] = useState({
    theme: 'light',
    defaultTab: 'challenges',
    itemsPerPage: 10,
    tableCompact: false
  });

  // Load env vars and challenges on component mount
  useEffect(() => {
    fetchEnvVars();
    fetchChallenges();
    fetchPredefinedWarnings();
    fetchIssuedWarnings();
    fetchAnalytics();
    fetchAuditLogs();
    // Set initial time
    setCurrentTime(new Date().toLocaleTimeString());
  }, []);

  // Add this effect to initialize editedEnvVars when envVars changes
  useEffect(() => {
    setEditedEnvVars(envVars);
  }, [envVars]);

  // Add this useEffect for socket connection
  useEffect(() => {
    // Initialize socket connection
    const socketInit = async () => {
      const newSocket = io(`http://localhost:${process.env.WEB_PORT}`);

      newSocket.on('connect', () => {
        console.log('WebSocket connected');
      });

      newSocket.on('envUpdate', (data) => {
        console.log('Environment variable updated:', data);
        fetchEnvVars();
      });

      newSocket.on('challengeUpdate', (data) => {
        console.log('Challenge updated:', data);
        fetchChallenges();
      });

      newSocket.on('warningUpdate', (data) => {
        console.log('Warning updated:', data);
        fetchPredefinedWarnings();
        fetchIssuedWarnings();
      });

      newSocket.on('auditLog', (data) => {
        console.log('New audit log:', data);
        fetchAuditLogs();
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        newSocket.close();
      };
    };

    socketInit();
  }, []);

  const fetchEnvVars = async () => {
    try {
      const response = await fetch('/api/env');
      const data = await response.json();
      setEnvVars(data || {});
    } catch (err) {
      console.error('Error fetching env vars:', err);
      setError('Failed to load environment variables');
    }
  };

  const fetchChallenges = async () => {
    try {
      const response = await fetch('/api/challenges');
      const data = await response.json();
      setChallenges(data || []);
    } catch (err) {
      console.error('Error fetching challenges:', err);
      setError('Failed to load challenges');
    }
  };

  const fetchPredefinedWarnings = async () => {
    try {
      const response = await fetch('/api/warnings/predefined');
      const data = await response.json();
      setPredefinedWarnings(data || []);
    } catch (err) {
      console.error('Error fetching predefined warnings:', err);
      setError('Failed to load predefined warnings');
    }
  };

  const fetchIssuedWarnings = async () => {
    try {
      const response = await fetch('/api/warnings/issued');
      const data = await response.json();
      setIssuedWarnings(data || []);
    } catch (err) {
      console.error('Error fetching issued warnings:', err);
      setError('Failed to load issued warnings');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics');
      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/audit');
      const data = await response.json();
      setAuditLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Failed to load audit logs');
    }
  };

  const handleEnvUpdate = async () => {
    try {
      setIsEditing(false);
      const updates = Object.entries(editedEnvVars).map(async ([key, value]) => {
        if (value !== envVars[key]) {
          await fetch('/api/env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          });

          // Create audit log
          await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action_type: 'UPDATE_ENV',
              description: `Updated environment variable: ${key}`,
              user_id: 'admin', // You might want to add actual user tracking
              metadata: { key, oldValue: envVars[key], newValue: value }
            })
          });
        }
      });

      await Promise.all(updates);
      await fetchEnvVars();
      await fetchAuditLogs();
    } catch (err) {
      console.error('Error updating env vars:', err);
      setError('Failed to update environment variables');
    }
  };

  const handleEnvChange = (key, value) => {
    setEditedEnvVars(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleChallengeDelete = async (id) => {
    try {
      await fetch(`/api/challenges/${id}`, {
        method: 'DELETE',
      });
      
      // Create audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: 'DELETE_CHALLENGE',
          description: `Deleted challenge #${id}`,
          user_id: 'admin',
          metadata: { challenge_id: id }
        })
      });

      fetchChallenges();
      fetchAuditLogs();
    } catch (error) {
      console.error('Error deleting challenge:', error);
      setError('Failed to delete challenge');
    }
  };

  const isSensitiveField = (key) => {
    return key.includes('TOKEN') || key.includes('PASSWORD');
  };

  // Add this helper function to determine status color
  const getStatusColor = (status, isActive = true) => {
    if (!isActive) {
      return 'bg-gray-100 text-gray-800';  // Color for Concluded challenges
    }
    
    switch (status.toLowerCase()) {
      case 'submissions':
        return 'bg-blue-100 text-blue-800';
      case 'voting':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return (
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    page === currentPage
                      ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    );
  };

  const paginatedChallenges = challenges.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleEditChallenge = (challenge) => {
    setEditingChallenge(challenge);
    setIsEditModalOpen(true);
  };

  const EditChallengeModal = ({ challenge, isOpen, onClose, onSave }) => {
    const [editedChallenge, setEditedChallenge] = useState(challenge);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-medium text-gray-900">Edit Challenge</h3>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Challenge Title</label>
              <input
                type="text"
                value={editedChallenge.title}
                onChange={(e) => setEditedChallenge({...editedChallenge, title: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={editedChallenge.status}
                onChange={(e) => setEditedChallenge({...editedChallenge, status: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="Submissions">Submissions</option>
                <option value="Voting">Voting</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(editedChallenge)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleRefresh = async () => {
    await Promise.all([
      fetchEnvVars(),
      fetchChallenges()
    ]);
    setCurrentTime(new Date().toLocaleTimeString());
  };

  const NewChallengeModal = ({ isOpen, onClose, onSave }) => {
    const [newChallenge, setNewChallenge] = useState({
      title: '',
      description: '',
      submissionsClose: '',
      votingBegins: '',
      votingEnds: ''
    });

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-medium text-gray-900">Create New Challenge</h3>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Challenge Title</label>
              <input
                type="text"
                value={newChallenge.title}
                onChange={(e) => setNewChallenge({...newChallenge, title: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter challenge title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={newChallenge.description}
                onChange={(e) => setNewChallenge({...newChallenge, description: e.target.value})}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows={3}
                placeholder="Enter challenge description"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Submissions Close</label>
                <input
                  type="datetime-local"
                  value={newChallenge.submissionsClose}
                  onChange={(e) => setNewChallenge({...newChallenge, submissionsClose: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voting Begins</label>
                <input
                  type="datetime-local"
                  value={newChallenge.votingBegins}
                  onChange={(e) => setNewChallenge({...newChallenge, votingBegins: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voting Ends</label>
                <input
                  type="datetime-local"
                  value={newChallenge.votingEnds}
                  onChange={(e) => setNewChallenge({...newChallenge, votingEnds: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(newChallenge)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Challenge
            </button>
          </div>
        </div>
      </div>
    );
  };

  const TabButton = ({ id, label, active, onClick }) => (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 font-medium text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  const handleNewWarning = async (warning) => {
    try {
      const response = await fetch('/api/warnings/predefined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warning),
      });
      
      if (response.ok) {
        // Create audit log
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_type: 'CREATE_WARNING',
            description: 'Created new predefined warning',
            user_id: 'admin',
            metadata: { warning }
          })
        });

        fetchPredefinedWarnings();
        setIsNewWarningModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating warning:', error);
      setError('Failed to create warning');
    }
  };

  const handleEditWarning = async (warning) => {
    try {
      const response = await fetch(`/api/warnings/predefined/${warning.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warning),
      });
      
      if (response.ok) {
        // Create audit log
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_type: 'UPDATE_WARNING',
            description: `Updated predefined warning #${warning.id}`,
            user_id: 'admin',
            metadata: { 
              old: editingWarning,
              new: warning 
            }
          })
        });

        fetchPredefinedWarnings();
        fetchAuditLogs();
        setIsEditWarningModalOpen(false);
        setEditingWarning(null);
      }
    } catch (error) {
      console.error('Error updating warning:', error);
      setError('Failed to update warning');
    }
  };

  const handleDeleteWarning = async (id) => {
    if (!confirm('Are you sure you want to delete this warning?')) return;
    
    try {
      const response = await fetch(`/api/warnings/predefined/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Create audit log
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_type: 'DELETE_WARNING',
            description: `Deleted predefined warning #${id}`,
            user_id: 'admin',
            metadata: { warning_id: id }
          })
        });

        fetchPredefinedWarnings();
        fetchAuditLogs();
      }
    } catch (error) {
      console.error('Error deleting warning:', error);
      setError('Failed to delete warning');
    }
  };

  const EditWarningModal = ({ warning, isOpen, onClose, onSave }) => {
    const [editedWarning, setEditedWarning] = useState(warning || { description: '' });

    useEffect(() => {
      if (warning) {
        setEditedWarning(warning);
      }
    }, [warning]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-medium text-gray-900">
              {warning ? 'Edit Warning' : 'New Warning'}
            </h3>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warning Description</label>
              <textarea
                value={editedWarning.description}
                onChange={(e) => setEditedWarning({ ...editedWarning, description: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows={4}
                placeholder="Enter warning description"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(editedWarning)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {warning ? 'Save Changes' : 'Create Warning'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const NewWarningModal = ({ isOpen, onClose, onSave }) => {
    const [newWarning, setNewWarning] = useState({ description: '' });

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-medium text-gray-900">Create New Warning</h3>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warning Description</label>
              <textarea
                value={newWarning.description}
                onChange={(e) => setNewWarning({ ...newWarning, description: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows={4}
                placeholder="Enter warning description"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(newWarning);
                setNewWarning({ description: '' }); // Reset form after submission
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Warning
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getFilteredAuditLogs = () => {
    return auditLogs.filter(log => {
      // Filter by action type
      const matchesAction = auditFilter === 'all' || 
        (auditFilter === 'env' && log.action_type.includes('ENV')) ||
        (auditFilter === 'challenge' && log.action_type.includes('CHALLENGE')) ||
        (auditFilter === 'warning' && log.action_type.includes('WARNING'));

      // Filter by date range
      const logDate = new Date(log.timestamp);
      const afterStart = !dateRange.start || logDate >= new Date(dateRange.start);
      const beforeEnd = !dateRange.end || logDate <= new Date(dateRange.end);

      return matchesAction && afterStart && beforeEnd;
    });
  };

  const LogDetailsModal = ({ log, isOpen, onClose }) => {
    if (!isOpen || !log) return null;

    const formatMetadata = (metadata) => {
      try {
        return JSON.stringify(metadata, null, 2);
      } catch (e) {
        return 'Unable to parse metadata';
      }
    };

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-medium text-gray-900">Audit Log Details</h3>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Timestamp</h4>
              <p className="mt-1 text-sm text-gray-900">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Action Type</h4>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                log.action_type.includes('CREATE') ? 'bg-green-100 text-green-800' :
                log.action_type.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                log.action_type.includes('DELETE') ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {log.action_type}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Description</h4>
              <p className="mt-1 text-sm text-gray-900">{log.description}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">User ID</h4>
              <p className="mt-1 text-sm text-gray-900">{log.user_id}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Metadata</h4>
              <pre className="mt-1 bg-gray-50 p-4 rounded-md overflow-auto text-sm text-gray-900">
                {formatMetadata(log.metadata)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SettingsModal = ({ isOpen, onClose, settings, onSave }) => {
    const [editedSettings, setEditedSettings] = useState(settings);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-medium text-gray-900">Dashboard Settings</h3>
            <button
              onClick={onClose}
              className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
              <select
                value={editedSettings.theme}
                onChange={(e) => setEditedSettings({ ...editedSettings, theme: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            {/* Default Tab */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Tab</label>
              <select
                value={editedSettings.defaultTab}
                onChange={(e) => setEditedSettings({ ...editedSettings, defaultTab: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="challenges">Challenges</option>
                <option value="predefinedWarnings">Predefined Warnings</option>
                <option value="issuedWarnings">Issued Warnings</option>
                <option value="analytics">Analytics</option>
                <option value="auditLogs">Audit Logs</option>
              </select>
            </div>

            {/* Items Per Page */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Items Per Page</label>
              <select
                value={editedSettings.itemsPerPage}
                onChange={(e) => setEditedSettings({ ...editedSettings, itemsPerPage: Number(e.target.value) })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Table Display */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="tableCompact"
                checked={editedSettings.tableCompact}
                onChange={(e) => setEditedSettings({ ...editedSettings, tableCompact: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="tableCompact" className="ml-2 block text-sm text-gray-900">
                Compact Tables
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(editedSettings);
                onClose();
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleSettingsSave = async (newSettings) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'admin', // Replace with actual user ID when you have authentication
          settings: newSettings
        }),
      });
      
      setUserSettings(newSettings);
      
      // Apply settings
      setItemsPerPage(newSettings.itemsPerPage);
      setActiveTab(newSettings.defaultTab);
      // Theme will be handled by the theme provider
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Improved Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Last updated: {currentTime}</span>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Improved Error Alert */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Improved Stats Section */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          <StatsCard
            title="Environment Variables"
            value={Object.keys(envVars).length}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            }
          />
          <StatsCard
            title="Active Challenges"
            value={challenges.filter(c => c.isActive).length}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatsCard
            title="Total Challenges"
            value={challenges.length}
            icon={
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>

        {/* Environment Variables Section */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex space-x-4">
              <TabButton
                id="challenges"
                label="Challenges"
                active={activeTab === 'challenges'}
                onClick={setActiveTab}
              />
              <TabButton
                id="predefinedWarnings"
                label="Predefined Warnings"
                active={activeTab === 'predefinedWarnings'}
                onClick={setActiveTab}
              />
              <TabButton
                id="issuedWarnings"
                label="Issued Warnings"
                active={activeTab === 'issuedWarnings'}
                onClick={setActiveTab}
              />
              <TabButton
                id="analytics"
                label="Analytics"
                active={activeTab === 'analytics'}
                onClick={setActiveTab}
              />
              <TabButton
                id="auditLogs"
                label="Audit Logs"
                active={activeTab === 'auditLogs'}
                onClick={setActiveTab}
              />
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-5">
            {activeTab === 'challenges' && (
              <div>
                <div className="bg-white shadow-lg rounded-xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Community Challenges</h3>
                      <p className="mt-1 text-sm text-gray-500">Manage and monitor all challenges</p>
                    </div>
                    <button
                      onClick={() => setIsNewChallengeModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Challenge
                    </button>
                  </div>
                  <div className="px-6 py-5">
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedChallenges.map((challenge) => (
                            <tr key={challenge.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{challenge.id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{challenge.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(challenge.status, challenge.isActive)}`}>
                                  {challenge.isActive ? challenge.status : 'Concluded'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleEditChallenge(challenge)}
                                  className="inline-flex items-center text-indigo-600 hover:text-indigo-900 mr-4"
                                >
                                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleChallengeDelete(challenge.id)}
                                  className="inline-flex items-center text-red-600 hover:text-red-900"
                                >
                                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      totalItems={challenges.length}
                      itemsPerPage={itemsPerPage}
                      currentPage={currentPage}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'predefinedWarnings' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Predefined Warnings</h3>
                  <button
                    onClick={() => {
                      setEditingWarning(null);
                      setIsEditWarningModalOpen(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Warning
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {predefinedWarnings.map((warning) => (
                        <tr key={warning.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{warning.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{warning.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setEditingWarning(warning);
                                setIsEditWarningModalOpen(true);
                              }}
                              className="inline-flex items-center text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteWarning(warning.id)}
                              className="inline-flex items-center text-red-600 hover:text-red-900"
                            >
                              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'issuedWarnings' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Issued Warnings</h3>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warning</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Context</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moderator</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {issuedWarnings.map((warning) => (
                        <tr key={warning.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{warning.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{warning.user_id}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{warning.warning_text}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{warning.context || 'No context provided'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{warning.issued_by}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(warning.issued_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Warning Trends Chart */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Warning Trends</h3>
                    <div className="h-64">
                      <Line
                        data={{
                          labels: analyticsData.warningTrends.map(item => new Date(item.date).toLocaleDateString()),
                          datasets: [{
                            label: 'Warnings Issued',
                            data: analyticsData.warningTrends.map(item => item.count),
                            borderColor: 'rgb(79, 70, 229)',
                            tension: 0.1
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 1
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Challenge Distribution Chart */}
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Challenge Status Distribution</h3>
                    <div className="h-64">
                      <Pie
                        data={{
                          labels: analyticsData.challengeDistribution.map(item => item.state),
                          datasets: [{
                            data: analyticsData.challengeDistribution.map(item => item.count),
                            backgroundColor: [
                              'rgb(59, 130, 246)',
                              'rgb(139, 92, 246)',
                              'rgb(34, 197, 94)',
                              'rgb(107, 114, 128)'
                            ]
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false
                        }}
                      />
                    </div>
                  </div>

                  {/* Top Moderators */}
                  <div className="bg-white p-6 rounded-lg shadow col-span-full">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Top Moderators</h3>
                    <div className="overflow-hidden">
                      <Bar
                        data={{
                          labels: analyticsData.topModerators.map(item => item.moderator_id),
                          datasets: [{
                            label: 'Warnings Issued',
                            data: analyticsData.topModerators.map(item => item.warning_count),
                            backgroundColor: 'rgb(79, 70, 229)'
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 1
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'auditLogs' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Audit Logs</h3>
                  <div className="flex items-center space-x-4">
                    {/* Date Range Filters */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>

                    {/* Action Type Filter */}
                    <select
                      value={auditFilter}
                      onChange={(e) => setAuditFilter(e.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="all">All Actions</option>
                      <option value="env">Environment Changes</option>
                      <option value="challenge">Challenge Changes</option>
                      <option value="warning">Warning Changes</option>
                    </select>

                    {/* Clear Filters Button */}
                    <button
                      onClick={() => {
                        setAuditFilter('all');
                        setDateRange({ start: '', end: '' });
                      }}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear Filters
                    </button>

                    {/* Refresh Button */}
                    <button
                      onClick={fetchAuditLogs}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getFilteredAuditLogs().map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              log.action_type.includes('CREATE') ? 'bg-green-100 text-green-800' :
                              log.action_type.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                              log.action_type.includes('DELETE') ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {log.action_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{log.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.user_id}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <button
                              onClick={() => {
                                setSelectedLog(log);
                                setIsLogDetailsModalOpen(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* No Results Message */}
                {getFilteredAuditLogs().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No audit logs found matching the current filters.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <EditChallengeModal
          challenge={editingChallenge}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingChallenge(null);
          }}
          onSave={async (updatedChallenge) => {
            try {
              const response = await fetch(`/api/challenges/${updatedChallenge.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedChallenge),
              });
              
              if (response.ok) {
                // Create audit log
                await fetch('/api/audit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action_type: 'UPDATE_CHALLENGE',
                    description: `Updated challenge: ${updatedChallenge.title}`,
                    user_id: 'admin',
                    metadata: { 
                      old: editingChallenge,
                      new: updatedChallenge 
                    }
                  })
                });

                fetchChallenges();
                fetchAuditLogs();
                setIsEditModalOpen(false);
                setEditingChallenge(null);
              }
            } catch (error) {
              console.error('Error updating challenge:', error);
              setError('Failed to update challenge');
            }
          }}
        />

        <NewChallengeModal
          isOpen={isNewChallengeModalOpen}
          onClose={() => setIsNewChallengeModalOpen(false)}
          onSave={async (newChallenge) => {
            try {
              const response = await fetch('/api/challenges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newChallenge),
              });
              
              if (response.ok) {
                // Create audit log
                await fetch('/api/audit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action_type: 'CREATE_CHALLENGE',
                    description: `Created new challenge: ${newChallenge.title}`,
                    user_id: 'admin',
                    metadata: { challenge: newChallenge }
                  })
                });

                fetchChallenges();
                fetchAuditLogs();
                setIsNewChallengeModalOpen(false);
              }
            } catch (error) {
              console.error('Error creating challenge:', error);
              setError('Failed to create challenge');
            }
          }}
        />

        <EditWarningModal
          warning={editingWarning}
          isOpen={isEditWarningModalOpen}
          onClose={() => {
            setIsEditWarningModalOpen(false);
            setEditingWarning(null);
          }}
          onSave={handleEditWarning}
        />

        <NewWarningModal
          isOpen={isNewWarningModalOpen}
          onClose={() => setIsNewWarningModalOpen(false)}
          onSave={handleNewWarning}
        />

        <LogDetailsModal
          log={selectedLog}
          isOpen={isLogDetailsModalOpen}
          onClose={() => {
            setIsLogDetailsModalOpen(false);
            setSelectedLog(null);
          }}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={userSettings}
          onSave={handleSettingsSave}
        />
      </main>
    </div>
  );
};

export default Dashboard; 