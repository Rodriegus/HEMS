// Front Desk Routes - ONE BUTTON ACTIONS
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('./auth');

// ONE-BUTTON: Receive Inbound Call
router.post('/receive-call', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'frontdesk') {
      return res.status(403).json({ error: 'Only staff can receive calls' });
    }

    const { customer_phone, customer_name, subject, description, priority, service_type, location_address, location_lat, location_lng } = req.body;

    if (!customer_phone) {
      return res.status(400).json({ error: 'Customer phone required' });
    }

    // Find or create customer contact
    let customer = await db.query(
      'SELECT id FROM customer_contacts WHERE phone = $1',
      [customer_phone]
    );

    let customerId;
    if (customer.rows.length === 0) {
      const newCustomer = await db.query(
        'INSERT INTO customer_contacts (phone, name) VALUES ($1, $2) RETURNING id',
        [customer_phone, customer_name || 'Unknown']
      );
      customerId = newCustomer.rows[0].id;
    } else {
      customerId = customer.rows[0].id;
    }

    // Create call record
    const callId = `CALL-${Date.now()}`;
    const result = await db.query(
      `INSERT INTO customer_calls 
        (call_id, customer_contact_id, received_by, call_type, call_status, customer_name, customer_phone, subject, description, priority, service_type, location_address, location_lat, location_lng)
       VALUES ($1, $2, $3, 'inbound', 'answered', $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [callId, customerId, req.user.id, customer_name || 'Unknown', customer_phone, subject, description, priority || 'normal', service_type, location_address, location_lat, location_lng]
    );

    // Update staff availability
    await db.query(
      'UPDATE staff_availability SET status = $1, current_call_id = $2, calls_handled_today = calls_handled_today + 1 WHERE staff_id = $3',
      ['busy', result.rows[0].id, req.user.id]
    );

    res.status(201).json({
      message: 'Call received and logged',
      call: result.rows[0]
    });
  } catch (error) {
    console.error('Receive call error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ONE-BUTTON: End Call & Log Details
router.post('/:callId/end-call', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { resolution_notes, call_duration_seconds } = req.body;

    const result = await db.query(
      `UPDATE customer_calls 
       SET call_status = 'completed', completed_at = NOW(), resolution_notes = $1, call_duration_seconds = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [resolution_notes, call_duration_seconds || 0, callId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = result.rows[0];

    // Update staff availability
    await db.query(
      'UPDATE staff_availability SET status = $1, current_call_id = NULL, total_call_duration_today = total_call_duration_today + $2 WHERE staff_id = $3',
      ['available', call_duration_seconds || 0, call.received_by]
    );

    // Update customer contact
    await db.query(
      'UPDATE customer_contacts SET last_contact_date = NOW(), call_count = call_count + 1 WHERE id = $1',
      [call.customer_contact_id]
    );

    res.json({
      message: 'Call ended and logged',
      call: result.rows[0]
    });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ONE-BUTTON: Create Order from Call
router.post('/:callId/create-order', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;

    // Get call details
    const call = await db.query('SELECT * FROM customer_calls WHERE id = $1', [callId]);
    if (call.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const callData = call.rows[0];
    const orderNumber = `ORD-${Date.now()}`;

    // Create service order
    const orderResult = await db.query(
      `INSERT INTO service_orders 
        (order_number, customer_name, customer_phone, customer_location_lat, customer_location_lng, service_type, description, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orderNumber, callData.customer_name, callData.customer_phone, callData.location_lat, callData.location_lng, callData.service_type, callData.description, callData.priority, req.user.id]
    );

    // Link order to call
    await db.query(
      'UPDATE customer_calls SET order_created = $1, resolved = true WHERE id = $2',
      [orderResult.rows[0].id, callId]
    );

    res.json({
      message: 'Order created from call',
      order: orderResult.rows[0],
      call: callData
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ONE-BUTTON: Transfer Call
router.post('/:callId/transfer', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { transfer_to_user_id } = req.body;

    if (!transfer_to_user_id) {
      return res.status(400).json({ error: 'Transfer user ID required' });
    }

    const result = await db.query(
      `UPDATE customer_calls 
       SET transferred_to = $1, call_status = 'transferred', transfer_count = transfer_count + 1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [transfer_to_user_id, callId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json({
      message: 'Call transferred',
      call: result.rows[0]
    });
  } catch (error) {
    console.error('Transfer call error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all calls
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, type } = req.query;

    let query = 'SELECT * FROM customer_calls WHERE 1=1';
    let params = [];

    if (status) {
      query += ' AND call_status = $' + (params.length + 1);
      params.push(status);
    }

    if (type) {
      query += ' AND call_type = $' + (params.length + 1);
      params.push(type);
    }

    query += ' ORDER BY call_time DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get calls error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get call queue
router.get('/queue/status', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cq.*, cc.customer_name, cc.call_type, u.username as assigned_to_name
       FROM call_queue cq
       JOIN customer_calls cc ON cq.call_id = cc.id
       LEFT JOIN users u ON cq.assigned_to = u.id
       WHERE cq.status IN ('waiting', 'on_hold')
       ORDER BY cq.queue_position ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
