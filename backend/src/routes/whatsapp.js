// WhatsApp Routes - ONE BUTTON ACTIONS
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('./auth');

// ONE-BUTTON: Receive WhatsApp Message
router.post('/receive-message', authenticateToken, async (req, res) => {
  try {
    const { customer_phone, sender_name, message_text, message_type, media_url } = req.body;

    if (!customer_phone || !message_text) {
      return res.status(400).json({ error: 'Phone and message required' });
    }

    // Find or create customer
    let customer = await db.query(
      'SELECT id FROM customer_contacts WHERE phone = $1',
      [customer_phone]
    );

    let customerId;
    if (customer.rows.length === 0) {
      const newCustomer = await db.query(
        'INSERT INTO customer_contacts (phone, name, preferred_contact_method) VALUES ($1, $2, $3) RETURNING id',
        [customer_phone, sender_name || 'Unknown', 'whatsapp']
      );
      customerId = newCustomer.rows[0].id;
    } else {
      customerId = customer.rows[0].id;
    }

    // Extract info using AI (mock)
    const aiExtracted = extractServiceInfo(message_text);

    // Create WhatsApp message record
    const messageId = `WA-${Date.now()}`;
    const result = await db.query(
      `INSERT INTO whatsapp_messages 
        (message_id, customer_contact_id, direction, sender_phone, sender_name, message_text, message_type, media_url, ai_extracted_info, status)
       VALUES ($1, $2, 'inbound', $3, $4, $5, $6, $7, $8, 'received')
       RETURNING *`,
      [messageId, customerId, customer_phone, sender_name || 'Unknown', message_text, message_type || 'text', media_url, JSON.stringify(aiExtracted)]
    );

    res.status(201).json({
      message: 'WhatsApp message received',
      whatsappMessage: result.rows[0]
    });
  } catch (error) {
    console.error('Receive WhatsApp error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ONE-BUTTON: Reply to WhatsApp Message
router.post('/:messageId/reply', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reply_text } = req.body;

    if (!reply_text) {
      return res.status(400).json({ error: 'Reply text required' });
    }

    // Get original message
    const originalMsg = await db.query(
      'SELECT * FROM whatsapp_messages WHERE id = $1',
      [messageId]
    );

    if (originalMsg.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const original = originalMsg.rows[0];

    // Create reply message
    const replyId = `WA-${Date.now()}`;
    const replyResult = await db.query(
      `INSERT INTO whatsapp_messages 
        (message_id, customer_contact_id, handled_by, direction, sender_phone, sender_name, message_text, status)
       VALUES ($1, $2, $3, 'outbound', $4, 'HEMS Support', $5, 'replied')
       RETURNING *`,
      [replyId, original.customer_contact_id, req.user.id, 'HEMS Support', reply_text]
    );

    // Update original message status
    await db.query(
      'UPDATE whatsapp_messages SET status = $1, replied_at = NOW(), handled_by = $2 WHERE id = $3',
      ['replied', req.user.id, messageId]
    );

    res.json({
      message: 'Reply sent',
      originalMessage: original,
      reply: replyResult.rows[0]
    });
  } catch (error) {
    console.error('Reply error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ONE-BUTTON: Create Order from WhatsApp
router.post('/:messageId/create-order', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await db.query(
      'SELECT wm.*, cc.phone FROM whatsapp_messages wm JOIN customer_contacts cc ON wm.customer_contact_id = cc.id WHERE wm.id = $1',
      [messageId]
    );

    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = message.rows[0];
    const aiInfo = msg.ai_extracted_info || {};
    const orderNumber = `ORD-${Date.now()}`;

    const orderResult = await db.query(
      `INSERT INTO service_orders 
        (order_number, customer_name, customer_phone, service_type, description, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orderNumber, msg.sender_name, msg.phone, aiInfo.service_type || 'General Service', msg.message_text, aiInfo.priority || 'normal', req.user.id]
    );

    // Link order to WhatsApp message
    await db.query(
      'UPDATE whatsapp_messages SET order_created = $1, status = $2 WHERE id = $3',
      [orderResult.rows[0].id, 'resolved', messageId]
    );

    res.json({
      message: 'Order created from WhatsApp',
      order: orderResult.rows[0]
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all WhatsApp messages
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, customer_id } = req.query;

    let query = 'SELECT * FROM whatsapp_messages WHERE 1=1';
    let params = [];

    if (status) {
      query += ' AND status = $' + (params.length + 1);
      params.push(status);
    }

    if (customer_id) {
      query += ' AND customer_contact_id = $' + (params.length + 1);
      params.push(customer_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to extract service info from message
function extractServiceInfo(messageText) {
  const text = messageText.toLowerCase();
  
  const serviceKeywords = {
    'repair': 'Repair',
    'replace': 'Replace',
    'service': 'Service',
    'maintenance': 'Maintenance',
    'emergency': 'Emergency',
    'urgent': 'Urgent'
  };

  let detectedService = 'General Service';
  let priority = 'normal';

  for (const [keyword, service] of Object.entries(serviceKeywords)) {
    if (text.includes(keyword)) {
      detectedService = service;
      if (['emergency', 'urgent'].includes(keyword)) {
        priority = 'urgent';
      }
      break;
    }
  }

  return {
    service_type: detectedService,
    priority: priority,
    detected_keywords: messageText.match(/\b(hose|fitting|valve|seal|pump|cylinder)\b/gi) || []
  };
}

module.exports = router;
