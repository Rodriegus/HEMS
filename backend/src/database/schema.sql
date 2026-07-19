-- HEMS Database Schema
-- Hydraulic Express Mobile Service - Field Service Management

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('technician', 'admin', 'manager', 'frontdesk')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    last_location_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Inventory
CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    type VARCHAR(100),
    specs JSONB,
    stock_quantity INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    unit_price DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'damaged', 'maintenance', 'discontinued')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Service Orders
CREATE TABLE IF NOT EXISTS service_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_location_lat DECIMAL(10, 8),
    customer_location_lng DECIMAL(11, 8),
    service_type VARCHAR(100) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
    assigned_technician_id INT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_date TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_duration INT,
    actual_duration INT,
    FOREIGN KEY (assigned_technician_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Job Cards (Field work details)
CREATE TABLE IF NOT EXISTS job_cards (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    job_number VARCHAR(50) UNIQUE NOT NULL,
    technician_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'rejected')),
    description TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    photos JSONB,
    ai_analysis JSONB,
    parts_used JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES service_orders(id),
    FOREIGN KEY (technician_id) REFERENCES users(id)
);

-- Stock Issues (Inventory management)
CREATE TABLE IF NOT EXISTS stock_issues (
    id SERIAL PRIMARY KEY,
    issue_number VARCHAR(50) UNIQUE NOT NULL,
    equipment_id INT NOT NULL,
    issued_by INT NOT NULL,
    issued_to INT,
    quantity INT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'issued', 'returned', 'rejected')),
    approval_by INT,
    approval_date TIMESTAMP,
    issued_date TIMESTAMP,
    return_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (issued_by) REFERENCES users(id),
    FOREIGN KEY (issued_to) REFERENCES users(id),
    FOREIGN KEY (approval_by) REFERENCES users(id)
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INT NOT NULL,
    job_card_id INT,
    total_amount DECIMAL(12, 2),
    parts_cost DECIMAL(12, 2),
    labor_cost DECIMAL(12, 2),
    tax DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'sent', 'accepted', 'paid')),
    created_by INT NOT NULL,
    approved_by INT,
    approved_date TIMESTAMP,
    sent_date TIMESTAMP,
    customer_response VARCHAR(50),
    response_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES service_orders(id),
    FOREIGN KEY (job_card_id) REFERENCES job_cards(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INT NOT NULL,
    quote_id INT,
    total_amount DECIMAL(12, 2),
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('draft', 'sent', 'viewed', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
    due_date TIMESTAMP,
    paid_date TIMESTAMP,
    payment_method VARCHAR(50),
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES service_orders(id),
    FOREIGN KEY (quote_id) REFERENCES quotes(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    changes JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Customer Contacts
CREATE TABLE IF NOT EXISTS customer_contacts (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200),
    email VARCHAR(100),
    company VARCHAR(200),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    preferred_contact_method VARCHAR(50) CHECK (preferred_contact_method IN ('phone', 'whatsapp', 'email')),
    call_count INT DEFAULT 0,
    last_contact_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vip', 'blocked')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Calls (Direct calls & WhatsApp)
CREATE TABLE IF NOT EXISTS customer_calls (
    id SERIAL PRIMARY KEY,
    call_id VARCHAR(100) UNIQUE,
    customer_contact_id INT NOT NULL,
    received_by INT,
    call_type VARCHAR(50) CHECK (call_type IN ('inbound', 'outbound', 'whatsapp', 'missed')),
    call_status VARCHAR(50) DEFAULT 'pending' CHECK (call_status IN ('pending', 'answered', 'transferred', 'completed', 'missed', 'rejected')),
    call_duration_seconds INT DEFAULT 0,
    customer_name VARCHAR(200),
    customer_phone VARCHAR(20),
    subject VARCHAR(200),
    description TEXT,
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    service_type VARCHAR(100),
    issue_description TEXT,
    location_address TEXT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    transferred_to INT,
    transfer_count INT DEFAULT 0,
    transfer_history JSONB,
    order_created INT,
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    recording_url VARCHAR(500),
    recording_duration_seconds INT,
    transcript TEXT,
    ai_summary TEXT,
    call_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    completed_at TIMESTAMP,
    call_direction VARCHAR(50),
    ip_address VARCHAR(50),
    device_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_contact_id) REFERENCES customer_contacts(id),
    FOREIGN KEY (received_by) REFERENCES users(id),
    FOREIGN KEY (transferred_to) REFERENCES users(id),
    FOREIGN KEY (order_created) REFERENCES service_orders(id)
);

-- WhatsApp Messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100) UNIQUE,
    customer_contact_id INT NOT NULL,
    handled_by INT,
    direction VARCHAR(50) CHECK (direction IN ('inbound', 'outbound')),
    sender_phone VARCHAR(20),
    sender_name VARCHAR(200),
    message_text TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video')),
    media_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'received' CHECK (status IN ('received', 'read', 'replied', 'resolved')),
    read_at TIMESTAMP,
    replied_at TIMESTAMP,
    issue_description TEXT,
    service_type VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'normal',
    order_created INT,
    ai_extracted_info JSONB,
    ai_sentiment VARCHAR(50),
    ai_suggested_action VARCHAR(200),
    needs_human_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_contact_id) REFERENCES customer_contacts(id),
    FOREIGN KEY (handled_by) REFERENCES users(id),
    FOREIGN KEY (order_created) REFERENCES service_orders(id)
);

-- Call Queue
CREATE TABLE IF NOT EXISTS call_queue (
    id SERIAL PRIMARY KEY,
    call_id INT NOT NULL,
    queue_position INT,
    status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'answered', 'on_hold', 'transferred', 'completed')),
    wait_duration_seconds INT DEFAULT 0,
    assigned_to INT,
    assigned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (call_id) REFERENCES customer_calls(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- Staff Availability
CREATE TABLE IF NOT EXISTS staff_availability (
    id SERIAL PRIMARY KEY,
    staff_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'on_break', 'offline', 'training')),
    current_call_id INT,
    calls_handled_today INT DEFAULT 0,
    total_call_duration_today INT DEFAULT 0,
    break_until TIMESTAMP,
    available_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shift_start TIMESTAMP,
    shift_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id),
    FOREIGN KEY (current_call_id) REFERENCES customer_calls(id)
);

-- Create Indexes for performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_equipment_category ON equipment(category);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_technician ON service_orders(assigned_technician_id);
CREATE INDEX idx_job_cards_technician ON job_cards(technician_id);
CREATE INDEX idx_job_cards_status ON job_cards(status);
CREATE INDEX idx_stock_issues_status ON stock_issues(status);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_customer_calls_status ON customer_calls(call_status);
CREATE INDEX idx_customer_calls_customer ON customer_calls(customer_contact_id);
CREATE INDEX idx_customer_calls_received_by ON customer_calls(received_by);
CREATE INDEX idx_customer_calls_time ON customer_calls(call_time);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_customer ON whatsapp_messages(customer_contact_id);
CREATE INDEX idx_whatsapp_messages_time ON whatsapp_messages(created_at);
CREATE INDEX idx_call_queue_status ON call_queue(status);
CREATE INDEX idx_staff_availability_status ON staff_availability(status);
CREATE INDEX idx_staff_availability_staff ON staff_availability(staff_id);
