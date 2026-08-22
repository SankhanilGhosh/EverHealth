import React, { useState, useEffect } from 'react';

export default function HospitalDashboard({ hospitalId = 'hosp-001' }) {
  const [inventory, setInventory] = useState({
    icuBedsAvailable: 4,
    generalBedsAvailable: 12,
    cardiacBedsAvailable: 2,
    traumaBedsAvailable: 3,
    ambulancesAvailable: 2,
    totalAmbulanceFleet: 5,
  });

  const [activeBooking, setActiveBooking] = useState(null);
  const [slaTimeLeft, setSlaTimeLeft] = useState(25);
  const [recentBookings, setRecentBookings] = useState([
    {
      id: 'bk-901',
      eventId: 'evt-301',
      patientName: 'Robert Chen',
      severity: 'LIFE_THREATENING',
      condition: 'SpO2 drop (86%) & Tachycardia',
      status: 'EN_ROUTE',
      etaMinutes: 8,
      ambulanceId: 'AMB-104',
      timestamp: '10 mins ago',
    },
    {
      id: 'bk-899',
      eventId: 'evt-298',
      patientName: 'Maria Garcia',
      severity: 'SEVERE',
      condition: 'Fall detected with elevated HR',
      status: 'ARRIVED',
      etaMinutes: 0,
      ambulanceId: 'AMB-102',
      timestamp: '45 mins ago',
    },
  ]);

  // Simulate receiving a live emergency dispatch request
  const simulateIncomingEmergency = () => {
    const newBooking = {
      id: `bk-${Math.floor(1000 + Math.random() * 9000)}`,
      eventId: `evt-${Math.floor(500 + Math.random() * 500)}`,
      patientName: 'Jane Doe',
      severity: 'LIFE_THREATENING',
      condition: 'Critically low SpO2 (87%) & Bradycardia (36 bpm)',
      bloodType: 'O+',
      allergies: 'Penicillin',
      status: 'REQUESTED',
      etaMinutes: 6,
      ambulanceId: 'AMB-108',
      timestamp: 'Just now',
    };
    setActiveBooking(newBooking);
    setSlaTimeLeft(25);
  };

  // SLA Countdown clock for pending incoming dispatch request
  useEffect(() => {
    if (!activeBooking || activeBooking.status !== 'REQUESTED') return;

    if (slaTimeLeft <= 0) {
      // SLA timeout: auto-reject and clear
      handleReject(activeBooking.id, 'SLA Timeout');
      return;
    }

    const timer = setInterval(() => {
      setSlaTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeBooking, slaTimeLeft]);

  const handleAccept = (bookingId) => {
    if (!activeBooking) return;
    const accepted = { ...activeBooking, status: 'ACCEPTED' };
    setRecentBookings([accepted, ...recentBookings]);
    setActiveBooking(null);

    // Decrement available beds and ambulance count
    setInventory((prev) => ({
      ...prev,
      icuBedsAvailable: Math.max(0, prev.icuBedsAvailable - 1),
      ambulancesAvailable: Math.max(0, prev.ambulancesAvailable - 1),
    }));
  };

  const handleReject = (bookingId, reason = 'Hospital Occupancy Full') => {
    if (!activeBooking) return;
    alert(`Dispatch Rejected (${reason}). Cascading to next candidate hospital.`);
    setActiveBooking(null);
  };

  const handleInventoryChange = (field, delta) => {
    setInventory((prev) => ({
      ...prev,
      [field]: Math.max(0, prev[field] + delta),
    }));
  };

  const hospitalDetailsMap = {
    'hosp-001': { name: 'St. Jude Trauma & Cardiac Emergency Center', license: 'LIC-CA-94812' },
    'hosp-002': { name: 'Mercy Regional Emergency Care', license: 'LIC-CA-94815' },
    'hosp-aiims-delhi': { name: 'AIIMS New Delhi', license: 'LIC-DL-00101' },
    'hosp-apollo-delhi': { name: 'Apollo Hospitals – Delhi', license: 'LIC-DL-00102' },
    'hosp-fortis-gurugram': { name: 'Fortis Memorial Research Institute – Gurugram', license: 'LIC-HR-00201' },
    'hosp-narayana-bengaluru': { name: 'Narayana Health – Bengaluru', license: 'LIC-KA-00301' },
    'hosp-tata-mumbai': { name: 'Tata Memorial Hospital – Mumbai', license: 'LIC-MH-00401' },
  };

  const currentHospital = hospitalDetailsMap[hospitalId] || {
    name: 'St. Jude Trauma & Cardiac Emergency Center',
    license: 'HOSP-CA-94812'
  };

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/everhealth-logo.png" alt="EverHealth Logo" style={{ height: '52px', borderRadius: '10px', background: '#fff', padding: '4px 8px', border: '1px solid #C0C3B9' }} />
          <div>
            <h1 style={styles.title}>{currentHospital.name}</h1>
            <p style={styles.subtitle}>EverHealth Network | Hospital ID: {hospitalId} | License: {currentHospital.license}</p>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.simBtn} onClick={simulateIncomingEmergency}>
            ⚡ Simulate Emergency Dispatch Trigger
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div style={styles.grid}>
        {/* Inventory Control Panel */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>🏥 Live Bed & Fleet Inventory</h2>
          <div style={styles.inventoryGrid}>
            <InventoryRow
              label="ICU Beds"
              value={inventory.icuBedsAvailable}
              onChange={(d) => handleInventoryChange('icuBedsAvailable', d)}
              tag="CRITICAL"
            />
            <InventoryRow
              label="Cardiac Ward Beds"
              value={inventory.cardiacBedsAvailable}
              onChange={(d) => handleInventoryChange('cardiacBedsAvailable', d)}
            />
            <InventoryRow
              label="Trauma Beds"
              value={inventory.traumaBedsAvailable}
              onChange={(d) => handleInventoryChange('traumaBedsAvailable', d)}
            />
            <InventoryRow
              label="General Beds"
              value={inventory.generalBedsAvailable}
              onChange={(d) => handleInventoryChange('generalBedsAvailable', d)}
            />
            <InventoryRow
              label="Available Ambulances"
              value={inventory.ambulancesAvailable}
              total={inventory.totalAmbulanceFleet}
              onChange={(d) => handleInventoryChange('ambulancesAvailable', d)}
              tag="FLEET"
            />
          </div>
        </section>

        {/* Incoming Live Emergency Alert Modal / Banner */}
        {activeBooking && (
          <section style={styles.alertBanner}>
            <div style={styles.alertHeader}>
              <span style={styles.alertBadge}>
                🚨 INCOMING EMERGENCY DISPATCH ({activeBooking.severity})
              </span>
              <span style={styles.slaTimer}>SLA Countdown: {slaTimeLeft}s</span>
            </div>

            <div style={styles.alertBody}>
              <div>
                <h3 style={styles.patientName}>{activeBooking.patientName}</h3>
                <p style={styles.patientDetail}>
                  <strong>Detected Condition:</strong> {activeBooking.condition}
                </p>
                <p style={styles.patientDetail}>
                  <strong>Blood Type:</strong> {activeBooking.bloodType} |{' '}
                  <strong>Allergies:</strong> {activeBooking.allergies}
                </p>
              </div>

              <div style={styles.etaBox}>
                <span style={styles.etaVal}>{activeBooking.etaMinutes} MINS</span>
                <span style={styles.etaLabel}>ESTIMATED ETA</span>
              </div>
            </div>

            <div style={styles.alertActions}>
              <button
                style={{ ...styles.actionBtn, backgroundColor: '#10b981' }}
                onClick={() => handleAccept(activeBooking.id)}
              >
                ✓ ACCEPT BOOKING & DISPATCH AMBULANCE ({activeBooking.ambulanceId})
              </button>
              <button
                style={{ ...styles.actionBtn, backgroundColor: '#ef4444' }}
                onClick={() => handleReject(activeBooking.id, 'Manually Rejected')}
              >
                ✕ REJECT / RE-ROUTE TO NEXT HOSPITAL
              </button>
            </div>
          </section>
        )}

        {/* Active & Recent Bookings List */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>📋 Active Emergency Dispatches</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Booking ID</th>
                <th style={styles.th}>Patient</th>
                <th style={styles.th}>Condition</th>
                <th style={styles.th}>Severity</th>
                <th style={styles.th}>ETA</th>
                <th style={styles.th}>Ambulance</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={b.id}>
                  <td style={styles.td}>{b.id}</td>
                  <td style={styles.td}>
                    <strong>{b.patientName}</strong>
                  </td>
                  <td style={styles.td}>{b.condition}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.severityTag,
                        backgroundColor:
                          b.severity === 'LIFE_THREATENING' ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {b.severity}
                    </span>
                  </td>
                  <td style={styles.td}>{b.etaMinutes} mins</td>
                  <td style={styles.td}>{b.ambulanceId}</td>
                  <td style={styles.td}>
                    <span style={styles.statusTag}>{b.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function InventoryRow({ label, value, onChange, tag }) {
  return (
    <div style={styles.invRow}>
      <div>
        <span style={styles.invLabel}>{label}</span>
        {tag && <span style={styles.invTag}>{tag}</span>}
      </div>
      <div style={styles.invCounter}>
        <button style={styles.counterBtn} onClick={() => onChange(-1)}>
          -
        </button>
        <span style={styles.invVal}>{value}</span>
        <button style={styles.counterBtn} onClick={() => onChange(1)}>
          +
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    minHeight: '100vh',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #334155',
  },
  title: { fontSize: '24px', margin: 0, fontWeight: '700', color: '#38bdf8' },
  subtitle: { margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' },
  simBtn: {
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  grid: { display: 'flex', flexDirection: 'column', gap: '20px' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #334155',
  },
  cardTitle: { fontSize: '18px', margin: '0 0 16px 0', color: '#f1f5f9' },
  inventoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' },
  invRow: {
    backgroundColor: '#0f172a',
    padding: '12px 16px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #334155',
  },
  invLabel: { fontWeight: '600', fontSize: '14px' },
  invTag: {
    marginLeft: '8px',
    fontSize: '10px',
    backgroundColor: '#0284c7',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#fff',
  },
  invCounter: { display: 'flex', alignItems: 'center', gap: '10px' },
  counterBtn: {
    backgroundColor: '#334155',
    color: '#fff',
    border: 'none',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  invVal: { fontSize: '18px', fontWeight: 'bold', width: '24px', textAlign: 'center' },
  alertBanner: {
    backgroundColor: '#450a0a',
    border: '2px solid #ef4444',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
  },
  alertHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' },
  alertBadge: {
    backgroundColor: '#dc2626',
    color: '#fff',
    fontWeight: 'bold',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '14px',
  },
  slaTimer: { color: '#fca5a5', fontWeight: 'bold', fontSize: '16px' },
  alertBody: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  patientName: { fontSize: '20px', margin: '0 0 8px 0', color: '#fff' },
  patientDetail: { margin: '4px 0', color: '#fecaca', fontSize: '14px' },
  etaBox: {
    backgroundColor: '#7f1d1d',
    padding: '12px 20px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  etaVal: { fontSize: '22px', fontWeight: 'bold', color: '#fff', display: 'block' },
  etaLabel: { fontSize: '10px', color: '#fca5a5', fontWeight: 'bold' },
  alertActions: { display: 'flex', gap: '12px' },
  actionBtn: {
    flex: 1,
    color: '#fff',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' },
  th: { textAlign: 'left', padding: '10px', color: '#94a3b8', borderBottom: '1px solid #334155', fontSize: '13px' },
  td: { padding: '12px 10px', borderBottom: '1px solid #1e293b', fontSize: '14px' },
  severityTag: { padding: '2px 8px', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 'bold' },
  statusTag: { backgroundColor: '#0284c7', padding: '2px 8px', borderRadius: '4px', color: '#fff', fontSize: '11px' },
};
