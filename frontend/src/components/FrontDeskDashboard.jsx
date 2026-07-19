import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FrontDeskDashboard = () => {
  const [activeTab, setActiveTab] = useState('calls');
  const [calls, setCalls] = useState([]);
  const [whatsappMessages, setWhatsappMessages] = useState([]);
  const [callQueue, setCallQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [callsRes, whatsappRes, queueRes] = await Promise.all([
        axios.get(`${API_URL}/api/frontdesk`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/whatsapp`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/frontdesk/queue/status`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setCalls(callsRes.data);
      setWhatsappMessages(whatsappRes.data);
      setCallQueue(queueRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveCall = async () => {
    const phone = prompt('Enter customer phone number:');
    if (!phone) return;
    const name = prompt('Enter customer name:');
    const service = prompt('Enter service type:');

    try {
      await axios.post(
        `${API_URL}/api/frontdesk/receive-call`,
        { customer_phone: phone, customer_name: name, service_type: service, priority: 'normal' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Call logged');
      fetchData();
    } catch (err) {
      alert('❌ Error');
    }
  };

  const handleEndCall = async (callId) => {
    const notes = prompt('Enter resolution notes:');
    if (!notes) return;

    try {
      await axios.post(
        `${API_URL}/api/frontdesk/${callId}/end-call`,
        { resolution_notes: notes, call_duration_seconds: 300 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Call ended');
      fetchData();
    } catch (err) {
      alert('❌ Error');
    }
  };

  const handleCreateOrder = async (callId) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/frontdesk/${callId}/create-order`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`✅ Order created: ${response.data.order.order_number}`);
      fetchData();
    } catch (err) {
      alert('❌ Error');
    }
  };

  const handleReplyWhatsApp = async (messageId) => {
    const reply = prompt('Enter reply message:');
    if (!reply) return;

    try {
      await axios.post(
        `${API_URL}/api/whatsapp/${messageId}/reply`,
        { reply_text: reply },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Reply sent');
      fetchData();
    } catch (err) {
      alert('❌ Error');
    }
  };

  const handleCreateOrderFromWhatsApp = async (messageId) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/whatsapp/${messageId}/create-order`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(`✅ Order created: ${response.data.order.order_number}`);
      fetchData();
    } catch (err) {
      alert('❌ Error');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading Front Desk...</div>;

  const pendingCalls = calls.filter(c => c.call_status === 'pending' || c.call_status === 'answered');
  const unrepliedWhatsApp = whatsappMessages.filter(m => m.status === 'received');

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>📞 Front Desk Manager</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <StatBox title="Active Calls" count={pendingCalls.length} color="#ff6b6b" />
        <StatBox title="WhatsApp Unreplied" count={unrepliedWhatsApp.length} color="#25d366" />
        <StatBox title="Total Today" count={calls.filter(c => c.order_created).length} color="#4CAF50" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
        {['calls', 'whatsapp'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeTab === tab ? '#4CAF50' : '#f0f0f0',
              color: activeTab === tab ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              borderRadius: '4px 4px 0 0'
            }}
          >
            {tab === 'calls' && '☎️ Calls'}
            {tab === 'whatsapp' && '💬 WhatsApp'}
          </button>
        ))}
      </div>

      {/* Calls Tab */}
      {activeTab === 'calls' && (
        <div>
          <button
            onClick={handleReceiveCall}
            style={{
              padding: '12px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            ☎️ Receive Inbound Call
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {pendingCalls.map(call => (
              <div key={call.id} style={{
                backgroundColor: 'white',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #ff6b6b'
              }}>
                <h3>📞 {call.customer_name}</h3>
                <p><strong>Phone:</strong> {call.customer_phone}</p>
                <p><strong>Service:</strong> {call.service_type}</p>
                <p><strong>Issue:</strong> {call.description}</p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button
                    onClick={() => handleEndCall(call.id)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    ⏹️ End Call
                  </button>
                  <button
                    onClick={() => handleCreateOrder(call.id)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    📋 Create Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp Tab */}
      {activeTab === 'whatsapp' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {unrepliedWhatsApp.map(msg => (
            <div key={msg.id} style={{
              backgroundColor: 'white',
              padding: '15px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #25d366'
            }}>
              <h3>💬 {msg.sender_name}</h3>
              <p><strong>Phone:</strong> {msg.sender_phone}</p>
              <p style={{ backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
                {msg.message_text}
              </p>
              {msg.ai_extracted_info && (
                <p><strong>Service:</strong> {msg.ai_extracted_info.service_type}</p>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button
                  onClick={() => handleReplyWhatsApp(msg.id)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  💬 Reply
                </button>
                <button
                  onClick={() => handleCreateOrderFromWhatsApp(msg.id)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  📋 Create Order
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatBox = ({ title, count, color }) => (
  <div style={{
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    borderLeft: `4px solid ${color}`
  }}>
    <h3 style={{ margin: '0', color, fontSize: '32px' }}>{count}</h3>
    <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>{title}</p>
  </div>
);

export default FrontDeskDashboard;
