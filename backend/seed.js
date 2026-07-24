const pool = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function requireDemoPassword() {
  const password = process.env.DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD || process.env.DEMO_SEED_PASSWORD || '';
  if (password.length < 12 || password.length > 1024) throw new Error('DEMO_PASSWORD must contain 12-1024 characters');
  return password;
}

async function seed() {
  console.log('🌱 Seeding database...\n');

  try {
    // Drop all tables
    await pool.query(`
      DROP TABLE IF EXISTS tasks CASCADE;
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS mileage CASCADE;
      DROP TABLE IF EXISTS testimonials CASCADE;
      DROP TABLE IF EXISTS email_templates CASCADE;
      DROP TABLE IF EXISTS workflows CASCADE;
      DROP TABLE IF EXISTS portfolio CASCADE;
      DROP TABLE IF EXISTS expenses CASCADE;
      DROP TABLE IF EXISTS equipment CASCADE;
      DROP TABLE IF EXISTS packages CASCADE;
      DROP TABLE IF EXISTS social_posts CASCADE;
      DROP TABLE IF EXISTS ai_edits CASCADE;
      DROP TABLE IF EXISTS invoices CASCADE;
      DROP TABLE IF EXISTS contracts CASCADE;
      DROP TABLE IF EXISTS galleries CASCADE;
      DROP TABLE IF EXISTS shoots CASCADE;
      DROP TABLE IF EXISTS clients CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create ALL tables
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        notes TEXT,
        category VARCHAR(100) DEFAULT 'General',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE galleries (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        description TEXT,
        photo_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Draft',
        delivery_date DATE,
        cover_image_url TEXT,
        access_password VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE contracts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        contract_type VARCHAR(100) DEFAULT 'Standard',
        content TEXT,
        amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Draft',
        valid_until DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        items JSONB DEFAULT '[]',
        subtotal DECIMAL(10,2) DEFAULT 0,
        tax_rate DECIMAL(5,2) DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Draft',
        due_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE shoots (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        shoot_date DATE,
        start_time TIME,
        end_time TIME,
        location TEXT,
        shoot_type VARCHAR(100) DEFAULT 'Portrait',
        status VARCHAR(50) DEFAULT 'Scheduled',
        notes TEXT,
        package_name VARCHAR(255),
        price DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE ai_edits (
        id SERIAL PRIMARY KEY,
        photo_name VARCHAR(255) NOT NULL,
        edit_type VARCHAR(100) DEFAULT 'Auto-Enhance',
        original_settings JSONB DEFAULT '{}',
        ai_suggestions JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE social_posts (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) DEFAULT 'Instagram',
        caption TEXT,
        hashtags TEXT,
        image_url TEXT,
        scheduled_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Draft',
        engagement_likes INTEGER DEFAULT 0,
        engagement_comments INTEGER DEFAULT 0,
        engagement_shares INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE packages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Portrait',
        description TEXT,
        price DECIMAL(10,2) DEFAULT 0,
        duration_hours DECIMAL(4,1) DEFAULT 1,
        deliverables TEXT,
        includes_album BOOLEAN DEFAULT false,
        includes_prints BOOLEAN DEFAULT false,
        max_photos INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE equipment (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Camera',
        brand VARCHAR(100),
        model VARCHAR(100),
        serial_number VARCHAR(100),
        purchase_date DATE,
        purchase_price DECIMAL(10,2) DEFAULT 0,
        condition VARCHAR(50) DEFAULT 'Excellent',
        notes TEXT,
        status VARCHAR(50) DEFAULT 'Available',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE expenses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Equipment',
        amount DECIMAL(10,2) DEFAULT 0,
        expense_date DATE DEFAULT CURRENT_DATE,
        vendor VARCHAR(255),
        description TEXT,
        is_tax_deductible BOOLEAN DEFAULT false,
        receipt_url TEXT,
        status VARCHAR(50) DEFAULT 'Recorded',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE portfolio (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'Portrait',
        description TEXT,
        image_url TEXT,
        camera_settings VARCHAR(255),
        location VARCHAR(255),
        shoot_date DATE,
        is_featured BOOLEAN DEFAULT false,
        display_order INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Published',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE workflows (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        workflow_type VARCHAR(100) DEFAULT 'Standard',
        steps JSONB DEFAULT '[]',
        current_step INTEGER DEFAULT 1,
        due_date DATE,
        priority VARCHAR(50) DEFAULT 'Medium',
        status VARCHAR(50) DEFAULT 'In Progress',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE email_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        subject VARCHAR(500),
        body TEXT,
        variables TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE testimonials (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        rating INTEGER DEFAULT 5,
        review_text TEXT,
        shoot_type VARCHAR(100),
        is_featured BOOLEAN DEFAULT false,
        source VARCHAR(100) DEFAULT 'Website',
        status VARCHAR(50) DEFAULT 'Published',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );


      CREATE TABLE mileage (
        id SERIAL PRIMARY KEY,
        trip_date DATE DEFAULT CURRENT_DATE,
        from_location VARCHAR(255),
        to_location VARCHAR(255),
        miles DECIMAL(8,1) DEFAULT 0,
        purpose VARCHAR(100) DEFAULT 'Client Shoot',
        client_name VARCHAR(255),
        is_round_trip BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE bookings (
        id SERIAL PRIMARY KEY,
        client_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        shoot_type VARCHAR(100) DEFAULT 'Portrait',
        preferred_date DATE,
        preferred_time TIME,
        location TEXT,
        message TEXT,
        budget DECIMAL(10,2) DEFAULT 0,
        referral_source VARCHAR(100),
        status VARCHAR(50) DEFAULT 'New',
        requested_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        description TEXT,
        due_date DATE,
        priority VARCHAR(50) DEFAULT 'Medium',
        related_shoot VARCHAR(255),
        status VARCHAR(50) DEFAULT 'To Do',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ All 18 tables created');

    // ==================== SEED USERS ====================
    const passwordHash = await bcrypt.hash(requireDemoPassword(), 10);
    await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)', ['Alex Rivera', 'admin@photostudio.com', passwordHash, 'admin']);
    console.log('✅ Admin user created');

    // ==================== SEED CLIENTS (16) ====================
    const clients = [
      ['Sarah Johnson', 'sarah@email.com', '(555) 101-0001', '123 Oak Street, Austin, TX', 'VIP wedding client', 'Wedding'],
      ['Michael Chen', 'michael.chen@email.com', '(555) 101-0002', '456 Maple Ave, Dallas, TX', 'Corporate headshots quarterly', 'Corporate'],
      ['Emily Rodriguez', 'emily.r@email.com', '(555) 101-0003', '789 Pine Rd, Houston, TX', 'Family portrait regular', 'Family'],
      ['David Kim', 'david.kim@email.com', '(555) 101-0004', '321 Elm Blvd, San Antonio, TX', 'Real estate photography', 'Commercial'],
      ['Jessica Taylor', 'jessica.t@email.com', '(555) 101-0005', '654 Cedar Lane, Austin, TX', 'Maternity and newborn sessions', 'Portrait'],
      ['Robert Martinez', 'robert.m@email.com', '(555) 101-0006', '987 Birch Dr, Plano, TX', 'Restaurant food photography', 'Commercial'],
      ['Amanda White', 'amanda.w@email.com', '(555) 101-0007', '147 Willow St, Frisco, TX', 'Fashion model portfolio', 'Fashion'],
      ['Christopher Lee', 'chris.lee@email.com', '(555) 101-0008', '258 Aspen Way, Round Rock, TX', 'Product photography for e-commerce', 'Commercial'],
      ['Sophia Brown', 'sophia.b@email.com', '(555) 101-0009', '369 Redwood Ct, Georgetown, TX', 'Engagement and wedding', 'Wedding'],
      ['James Wilson', 'james.w@email.com', '(555) 101-0010', '741 Sequoia Ln, Cedar Park, TX', 'Sports team photos', 'Sports'],
      ['Olivia Davis', 'olivia.d@email.com', '(555) 101-0011', '852 Magnolia Dr, Lakeway, TX', 'Senior portraits', 'Portrait'],
      ['Daniel Garcia', 'daniel.g@email.com', '(555) 101-0012', '963 Cypress Rd, Bee Cave, TX', 'Architecture photography', 'Commercial'],
      ['Lauren Anderson', 'lauren.a@email.com', '(555) 101-0013', '159 Juniper Ave, Dripping Springs, TX', 'Pet photography sessions', 'Portrait'],
      ['Ryan Thompson', 'ryan.t@email.com', '(555) 101-0014', '267 Sycamore Blvd, Pflugerville, TX', 'Concert and event coverage', 'Event'],
      ['Megan Clark', 'megan.c@email.com', '(555) 101-0015', '378 Chestnut St, Leander, TX', 'Brand lifestyle photos', 'Commercial'],
      ['Andrew Harris', 'andrew.h@email.com', '(555) 101-0016', '489 Walnut Way, Buda, TX', 'Fine art prints', 'Fine Art']
    ];
    for (const c of clients) { await pool.query('INSERT INTO clients (name, email, phone, address, notes, category) VALUES ($1,$2,$3,$4,$5,$6)', c); }
    console.log('✅ 16 clients seeded');

    // ==================== SEED GALLERIES (16) ====================
    const galleries = [
      ['Johnson-Williams Wedding', 1, 'Elegant garden wedding at Barton Springs', 245, 'Delivered', '2025-12-15'],
      ['Chen Corporate Headshots Q4', 2, 'Professional headshots for tech company', 48, 'Delivered', '2025-11-20'],
      ['Rodriguez Family Holiday', 3, 'Annual family Christmas portraits', 65, 'In Review', '2025-12-28'],
      ['Luxury Home - 1234 Oak Lane', 4, 'Real estate listing photos', 42, 'Delivered', '2025-10-15'],
      ['Taylor Maternity Session', 5, 'Outdoor maternity at sunset', 38, 'Editing', '2026-01-10'],
      ['Martinez Restaurant Menu', 6, 'Food photography for new menu launch', 85, 'Delivered', '2025-11-05'],
      ['White Fashion Portfolio', 7, 'Studio fashion editorial', 120, 'In Review', '2026-01-20'],
      ['Lee Product Catalog Spring', 8, 'E-commerce product shots on white', 156, 'Delivered', '2025-12-01'],
      ['Brown-Smith Engagement', 9, 'Engagement session at Lady Bird Lake', 92, 'Delivered', '2025-10-25'],
      ['Wilson Soccer Team 2025', 10, 'Team and individual player photos', 78, 'Editing', '2026-02-01'],
      ['Davis Senior Portraits', 11, 'Senior portrait multi-location shoot', 55, 'Draft', '2026-03-15'],
      ['Garcia Modern Architecture', 12, 'Commercial building exterior and interior', 63, 'Delivered', '2025-11-30'],
      ['Anderson Pet Portraits', 13, 'Holiday pet photo mini sessions', 44, 'In Review', '2025-12-20'],
      ['Thompson Live Music Fest', 14, 'Three-day music festival coverage', 340, 'Editing', '2026-01-15'],
      ['Clark Brand Lifestyle', 15, 'Lifestyle brand photography for social media', 95, 'Delivered', '2025-11-10'],
      ['Harris Fine Art Collection', 16, 'Gallery exhibition prints', 28, 'Draft', '2026-04-01']
    ];
    for (const g of galleries) { await pool.query('INSERT INTO galleries (title, client_id, description, photo_count, status, delivery_date) VALUES ($1,$2,$3,$4,$5,$6)', g); }
    console.log('✅ 16 galleries seeded');

    // ==================== SEED CONTRACTS (16) ====================
    const contracts = [
      ['Wedding Photography Contract', 1, 'Wedding', 'Full day wedding coverage', 4500, 'Signed', '2026-06-15'],
      ['Corporate Headshot Agreement', 2, 'Corporate', 'Quarterly headshot sessions', 2000, 'Signed', '2026-12-31'],
      ['Family Portrait Package', 3, 'Portrait', 'Annual family portrait session', 450, 'Signed', '2026-03-01'],
      ['Real Estate Photography', 4, 'Commercial', 'Per-property listing photos', 350, 'Active', '2026-06-30'],
      ['Maternity & Newborn Bundle', 5, 'Portrait', 'Combined maternity and newborn', 800, 'Signed', '2026-04-30'],
      ['Food Photography Agreement', 6, 'Commercial', 'Menu photography with styling', 3200, 'Signed', '2026-01-31'],
      ['Model Portfolio Contract', 7, 'Fashion', 'Fashion portfolio creation', 1200, 'Draft', '2026-03-15'],
      ['Product Photography SLA', 8, 'Commercial', 'Monthly product retainer', 4000, 'Active', '2026-12-31'],
      ['Engagement Session Contract', 9, 'Wedding', 'Engagement session package', 600, 'Signed', '2026-02-28'],
      ['Sports Team Photography', 10, 'Sports', 'Team and individual photos', 1500, 'Signed', '2026-05-31'],
      ['Senior Portrait Agreement', 11, 'Portrait', 'Multi-outfit senior session', 550, 'Draft', '2026-04-15'],
      ['Architecture Photography', 12, 'Commercial', 'Architectural photography', 2800, 'Signed', '2026-07-31'],
      ['Pet Photography Session', 13, 'Portrait', 'Pet portrait mini session', 250, 'Signed', '2026-01-15'],
      ['Event Coverage Agreement', 14, 'Event', 'Multi-day event photography', 5000, 'Active', '2026-08-31'],
      ['Brand Photography Retainer', 15, 'Commercial', 'Monthly brand content', 3500, 'Active', '2026-12-31'],
      ['Fine Art Print License', 16, 'Fine Art', 'Limited edition print sales', 1800, 'Draft', '2026-09-30']
    ];
    for (const c of contracts) { await pool.query('INSERT INTO contracts (title, client_id, contract_type, content, amount, status, valid_until) VALUES ($1,$2,$3,$4,$5,$6,$7)', c); }
    console.log('✅ 16 contracts seeded');

    // ==================== SEED INVOICES (16) ====================
    const invoices = [
      ['INV-2025-001', 1, '[{"description":"Wedding Photography - Full Day","qty":1,"price":4500}]', 4500, 8.25, 371.25, 4871.25, 'Paid', '2025-12-01'],
      ['INV-2025-002', 2, '[{"description":"Corporate Headshots - 25 people","qty":25,"price":80}]', 2000, 8.25, 165.00, 2165.00, 'Paid', '2025-11-15'],
      ['INV-2025-003', 3, '[{"description":"Family Portrait Session","qty":1,"price":450}]', 450, 8.25, 37.13, 487.13, 'Paid', '2025-12-20'],
      ['INV-2025-004', 4, '[{"description":"Real Estate Photos","qty":1,"price":350}]', 350, 8.25, 28.88, 378.88, 'Paid', '2025-10-30'],
      ['INV-2025-005', 5, '[{"description":"Maternity+Newborn Bundle","qty":1,"price":800}]', 800, 8.25, 66.00, 866.00, 'Pending', '2026-02-15'],
      ['INV-2025-006', 6, '[{"description":"Food Photography - 50 dishes","qty":50,"price":64}]', 3200, 8.25, 264.00, 3464.00, 'Paid', '2025-11-30'],
      ['INV-2025-007', 7, '[{"description":"Fashion Portfolio","qty":1,"price":1200}]', 1200, 8.25, 99.00, 1299.00, 'Draft', '2026-03-01'],
      ['INV-2025-008', 8, '[{"description":"Product Photos - 100 SKUs","qty":100,"price":40}]', 4000, 8.25, 330.00, 4330.00, 'Paid', '2026-01-31'],
      ['INV-2025-009', 9, '[{"description":"Engagement Session","qty":1,"price":600}]', 600, 8.25, 49.50, 649.50, 'Paid', '2025-11-15'],
      ['INV-2025-010', 10, '[{"description":"Team Photos + Prints","qty":1,"price":1500}]', 1500, 8.25, 123.75, 1623.75, 'Pending', '2026-03-01'],
      ['INV-2025-011', 11, '[{"description":"Senior Portrait Session","qty":1,"price":550}]', 550, 8.25, 45.38, 595.38, 'Draft', '2026-04-01'],
      ['INV-2025-012', 12, '[{"description":"Architecture Photography","qty":1,"price":2800}]', 2800, 8.25, 231.00, 3031.00, 'Paid', '2025-12-15'],
      ['INV-2025-013', 13, '[{"description":"Pet Portrait Mini","qty":1,"price":250}]', 250, 8.25, 20.63, 270.63, 'Paid', '2025-12-28'],
      ['INV-2025-014', 14, '[{"description":"Music Festival - 3 Days","qty":3,"price":1667}]', 5000, 8.25, 412.50, 5412.50, 'Pending', '2026-02-28'],
      ['INV-2025-015', 15, '[{"description":"Brand Content Monthly","qty":1,"price":3500}]', 3500, 8.25, 288.75, 3788.75, 'Paid', '2026-01-15'],
      ['INV-2026-001', 16, '[{"description":"Fine Art Prints x10","qty":10,"price":180}]', 1800, 8.25, 148.50, 1948.50, 'Draft', '2026-04-15']
    ];
    for (const inv of invoices) { await pool.query('INSERT INTO invoices (invoice_number, client_id, items, subtotal, tax_rate, tax_amount, total, status, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', inv); }
    console.log('✅ 16 invoices seeded');

    // ==================== SEED SHOOTS (16) ====================
    const shoots = [
      ['Johnson-Williams Wedding', 1, '2025-11-15', '10:00', '22:00', 'Barton Springs Garden Venue, Austin', 'Wedding', 'Completed', 'Full day coverage', 'Premium Wedding', 4500],
      ['Chen Team Headshots', 2, '2025-11-10', '09:00', '16:00', 'TechCorp Office, Dallas', 'Corporate', 'Completed', '25 employees', 'Corporate Standard', 2000],
      ['Rodriguez Christmas Portraits', 3, '2025-12-18', '14:00', '15:30', 'Studio A', 'Family', 'Completed', 'Holiday themed', 'Family Classic', 450],
      ['Luxury Home Listing', 4, '2025-10-05', '11:00', '14:00', '1234 Oak Lane, Westlake', 'Real Estate', 'Completed', 'HDR interiors + drone', 'Real Estate Premium', 350],
      ['Taylor Maternity Golden Hour', 5, '2025-12-28', '16:30', '18:00', 'Zilker Park, Austin', 'Maternity', 'Completed', 'Sunset backdrop', 'Maternity Deluxe', 400],
      ['Martinez Menu Reshoot', 6, '2025-10-28', '08:00', '15:00', 'La Casa Restaurant, Austin', 'Food', 'Completed', '50 dishes', 'Food Commercial', 3200],
      ['White Fashion Editorial', 7, '2026-01-15', '10:00', '17:00', 'Downtown Loft Studio', 'Fashion', 'Scheduled', '3 outfit changes', 'Fashion Portfolio', 1200],
      ['Lee Product Shoot', 8, '2025-11-20', '09:00', '18:00', 'Product Studio B', 'Product', 'Completed', '100 SKU flat lay', 'Product Catalog', 4000],
      ['Brown-Smith Engagement', 9, '2025-10-15', '16:00', '18:00', 'Lady Bird Lake Trail', 'Engagement', 'Completed', 'Golden hour', 'Engagement Classic', 600],
      ['Wilson Soccer Spring', 10, '2026-02-20', '08:00', '12:00', 'Round Rock Sports Complex', 'Sports', 'Scheduled', 'Team + individuals', 'Sports Team', 1500],
      ['Davis Multi-Location Senior', 11, '2026-03-22', '15:00', '18:00', 'Graffiti Park + UT Campus', 'Portrait', 'Scheduled', '3 outfits, 2 locations', 'Senior Premium', 550],
      ['Garcia Modern Office', 12, '2025-11-25', '06:00', '10:00', 'Innovation Tower, Downtown', 'Architecture', 'Completed', 'Sunrise exterior', 'Architecture Commercial', 2800],
      ['Anderson Holiday Pets', 13, '2025-12-14', '10:00', '14:00', 'Studio A - Holiday Set', 'Pet', 'Completed', '8 mini sessions', 'Pet Mini', 250],
      ['Thompson SXSW Coverage', 14, '2026-03-14', '18:00', '23:00', 'Various SXSW Venues', 'Event', 'Scheduled', 'Multi-day festival', 'Event Premium', 5000],
      ['Clark Q1 Brand Content', 15, '2025-11-05', '09:00', '15:00', 'Client Office + Coffee Shop', 'Commercial', 'Completed', 'Lifestyle brand content', 'Brand Monthly', 3500],
      ['Harris Gallery Prints', 16, '2026-04-10', '10:00', '13:00', 'Riverside Gallery, Austin', 'Fine Art', 'Scheduled', 'High-res captures', 'Fine Art Premium', 1800]
    ];
    for (const s of shoots) { await pool.query('INSERT INTO shoots (title, client_id, shoot_date, start_time, end_time, location, shoot_type, status, notes, package_name, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', s); }
    console.log('✅ 16 shoots seeded');

    // ==================== SEED AI EDITS (16) ====================
    const aiEdits = [
      ['IMG_8842_wedding_ceremony.CR2', 'Auto-Enhance', '{"exposure":0,"contrast":0}', '{"exposure":0.5,"contrast":15,"clarity":10}', 'Completed'],
      ['IMG_8901_first_dance.CR2', 'Low Light Fix', '{"exposure":-1.5,"iso":6400}', '{"exposure":0.8,"noise_reduction":45}', 'Completed'],
      ['IMG_3201_headshot_ceo.ARW', 'Portrait Retouch', '{"skin_smooth":0}', '{"skin_smooth":25,"eye_bright":15}', 'Completed'],
      ['IMG_4455_family_group.CR2', 'Color Correction', '{"white_balance":"auto"}', '{"white_balance":"5600K","tint":-3}', 'Completed'],
      ['DJI_0234_aerial_home.DNG', 'HDR Merge', '{"brackets":3}', '{"hdr_strength":65,"sky_enhance":20}', 'Completed'],
      ['IMG_5567_maternity.CR2', 'Golden Hour Enhance', '{"warmth":0}', '{"warmth":15,"glow":8,"vignette":12}', 'Pending'],
      ['IMG_6789_dish_closeup.ARW', 'Food Enhancement', '{"saturation":0}', '{"saturation":12,"clarity":20}', 'Completed'],
      ['IMG_7890_fashion.CR2', 'Fashion Grade', '{"contrast":0}', '{"contrast":25,"film_look":"portra_400"}', 'Processing'],
      ['IMG_2345_product_flat.ARW', 'Background Remove', '{"background":"gray"}', '{"background":"pure_white"}', 'Completed'],
      ['IMG_3456_engagement.CR2', 'Romantic Edit', '{"tone":"neutral"}', '{"tone":"warm_fade","lift_blacks":15}', 'Completed'],
      ['IMG_4567_soccer.CR2', 'Sports Action', '{"sharpness":0}', '{"sharpness":40,"motion_sharpen":true}', 'Pending'],
      ['IMG_5678_senior.CR2', 'Urban Edit', '{"contrast":0}', '{"contrast":30,"tone":"moody_teal_orange"}', 'Pending'],
      ['IMG_6001_building.DNG', 'Architecture Correct', '{"perspective":"auto"}', '{"perspective_vertical":true}', 'Completed'],
      ['IMG_7002_dog.CR2', 'Pet Portrait', '{"eye_enhance":0}', '{"eye_enhance":20,"fur_detail":25}', 'Completed'],
      ['IMG_8003_concert.CR2', 'Concert Grade', '{"exposure":0}', '{"exposure":0.7,"noise_reduce":50}', 'Processing'],
      ['IMG_9004_lifestyle.ARW', 'Lifestyle Preset', '{"look":"clean"}', '{"look":"airy_bright","soft_contrast":true}', 'Completed']
    ];
    for (const e of aiEdits) { await pool.query('INSERT INTO ai_edits (photo_name, edit_type, original_settings, ai_suggestions, status) VALUES ($1,$2,$3,$4,$5)', e); }
    console.log('✅ 16 AI edits seeded');

    // ==================== SEED SOCIAL POSTS (16) ====================
    const socialPosts = [
      ['Instagram', 'Magical moments from Sarah & Tom\'s garden wedding. Every love story deserves to be told beautifully.', '#weddingphotography #austinwedding #brideandgroom', null, '2025-12-20 10:00', 'Published', 342, 28, 45],
      ['Instagram', 'New corporate headshots for the amazing team at TechCorp!', '#corporateheadshots #businessportrait #linkedinphoto', null, '2025-11-25 14:00', 'Published', 128, 12, 8],
      ['Facebook', 'Family is everything. Love capturing these precious moments for generations.', '#familyphotography #holidayportraits #familylove', null, '2025-12-22 09:00', 'Published', 256, 34, 67],
      ['Instagram', 'This stunning Westlake property just hit the market!', '#realestatephotography #luxuryhomes #westlaketx', null, '2025-10-18 11:00', 'Published', 89, 6, 12],
      ['Instagram', 'Glowing mama-to-be in golden hour perfection. Maternity sessions booking now!', '#maternityphotography #goldenhour #babybump', null, '2026-01-05 16:00', 'Scheduled', 0, 0, 0],
      ['Instagram', 'Making your menu look as delicious as it tastes! Fresh food photography.', '#foodphotography #restaurantmarketing #foodie', null, '2025-11-08 12:00', 'Published', 215, 19, 31],
      ['Instagram', 'Behind the scenes at today\'s fashion editorial shoot.', '#fashionphotography #editorialshoot #behindthescenes', null, '2026-01-18 15:00', 'Scheduled', 0, 0, 0],
      ['Facebook', 'Spring product catalog is live! Beautiful e-commerce photography.', '#productphotography #ecommerce #commercialphotography', null, '2025-12-05 10:00', 'Published', 67, 8, 15],
      ['Instagram', 'She said YES! Engagement sessions at Lady Bird Lake are pure magic.', '#engagementphotos #shesaidyes #ladybirdlake', null, '2025-10-28 17:00', 'Published', 478, 52, 89],
      ['Twitter', 'Spring sports season is coming! Book your team photos now.', '#sportsphotography #teamphoto #youthsports', null, '2026-02-01 09:00', 'Scheduled', 0, 0, 0],
      ['Instagram', 'Senior portrait season is here! Class of 2026.', '#seniorportrait #classof2026 #highschoolsenior', null, '2026-03-01 14:00', 'Scheduled', 0, 0, 0],
      ['Instagram', 'Clean lines, natural light, stunning architecture.', '#architecturephotography #modernarchitecture #interiordesign', null, '2025-12-03 11:00', 'Published', 156, 14, 22],
      ['Instagram', 'Holiday pet portraits are going FAST! Only a few slots left.', '#petphotography #dogportrait #holidaypets', null, '2025-12-10 10:00', 'Published', 389, 45, 73],
      ['Twitter', 'Excited to announce we\'ll be covering SXSW 2026!', '#sxsw2026 #musicfestival #eventphotography', null, '2026-03-10 12:00', 'Scheduled', 0, 0, 0],
      ['Instagram', 'Authentic brand storytelling through lifestyle photography.', '#brandphotography #lifestylephotography #contentcreation', null, '2025-11-12 13:00', 'Published', 203, 17, 28],
      ['Facebook', 'Limited edition fine art prints now available!', '#fineart #photographyprints #limitededition', null, '2026-04-05 10:00', 'Draft', 0, 0, 0]
    ];
    for (const sp of socialPosts) { await pool.query('INSERT INTO social_posts (platform, caption, hashtags, image_url, scheduled_date, status, engagement_likes, engagement_comments, engagement_shares) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', sp); }
    console.log('✅ 16 social posts seeded');

    // ==================== SEED PACKAGES (16) ====================
    const packages = [
      ['Mini Session', 'Portrait', '20-minute session with 5 edited digital images', 150, 0.5, '5 edited digital images, online gallery', false, false, 5, 'Active'],
      ['Classic Portrait', 'Portrait', '1-hour portrait session with 15 edited images', 350, 1, '15 edited images, online gallery, print release', false, false, 15, 'Active'],
      ['Premium Portrait', 'Portrait', '2-hour session, 2 locations, 30 edited images', 600, 2, '30 edited images, online gallery, print release, 1 canvas', false, true, 30, 'Active'],
      ['Essential Wedding', 'Wedding', '6-hour wedding coverage, 300+ edited photos', 2500, 6, '300+ edited photos, online gallery, engagement session', false, false, 300, 'Active'],
      ['Premium Wedding', 'Wedding', 'Full day coverage, 2nd shooter, album, 500+ photos', 4500, 12, '500+ photos, second shooter, premium album, engagement session', true, true, 500, 'Active'],
      ['Luxury Wedding', 'Wedding', 'Full day + after party, 2nd shooter, luxury album, 800+ photos', 7500, 16, '800+ photos, 2 shooters, luxury album, canvas prints, video highlights', true, true, 800, 'Active'],
      ['Corporate Headshot', 'Corporate', 'Individual professional headshot session', 200, 0.5, '3 retouched headshots, white/gray backdrop', false, false, 3, 'Active'],
      ['Corporate Team', 'Corporate', 'Team headshots for up to 25 people', 2000, 4, '3 retouched shots per person, team group photo', false, false, 75, 'Active'],
      ['Real Estate Basic', 'Commercial', 'Up to 25 photos of property interior/exterior', 250, 2, '25 HDR photos, virtual tour link', false, false, 25, 'Active'],
      ['Real Estate Premium', 'Commercial', 'Full property shoot with drone and twilight', 500, 4, '40 HDR photos, drone aerials, twilight shots, virtual tour', false, false, 40, 'Active'],
      ['Food Menu Package', 'Commercial', 'Up to 30 dishes styled and photographed', 1800, 6, '30 styled food photos, editing, white balance correction', false, false, 30, 'Active'],
      ['Product E-Commerce', 'Commercial', 'Per product on white background + lifestyle', 45, 0.25, '4 angles per product, white background, web-optimized', false, false, 4, 'Active'],
      ['Fashion Portfolio', 'Fashion', '3-look fashion portfolio with styling guidance', 1200, 4, '30 edited images, 3 looks, 2 locations', false, false, 30, 'Active'],
      ['Event Coverage', 'Event', 'Up to 4 hours of event photography', 1500, 4, '200+ edited photos, same-day preview, online gallery', false, false, 200, 'Active'],
      ['Maternity Session', 'Portrait', '1-hour outdoor maternity session', 400, 1, '20 edited images, online gallery, print release', false, false, 20, 'Active'],
      ['Newborn Session', 'Portrait', '2-hour in-home newborn session', 500, 2, '25 edited images, online gallery, birth announcement design', false, true, 25, 'Active']
    ];
    for (const p of packages) { await pool.query('INSERT INTO packages (name, category, description, price, duration_hours, deliverables, includes_album, includes_prints, max_photos, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', p); }
    console.log('✅ 16 packages seeded');

    // ==================== SEED EQUIPMENT (16) ====================
    const equipment = [
      ['Canon EOS R5', 'Camera', 'Canon', 'EOS R5', 'CN-R5-20241001', '2024-03-15', 3899, 'Excellent', 'Primary body, 45MP full frame mirrorless', 'Available'],
      ['Canon EOS R6 Mark II', 'Camera', 'Canon', 'EOS R6 II', 'CN-R6II-20241002', '2024-06-20', 2499, 'Excellent', 'Second body, great for video', 'Available'],
      ['Sony A7R V', 'Camera', 'Sony', 'A7R V', 'SN-A7RV-20241003', '2024-01-10', 3898, 'Excellent', 'High-res body for commercial work', 'Available'],
      ['Canon RF 24-70mm f/2.8L', 'Lens', 'Canon', 'RF 24-70mm f/2.8L IS USM', 'CN-2470-20241004', '2024-03-15', 2299, 'Excellent', 'Workhorse zoom lens', 'Available'],
      ['Canon RF 70-200mm f/2.8L', 'Lens', 'Canon', 'RF 70-200mm f/2.8L IS USM', 'CN-70200-20241005', '2024-04-01', 2699, 'Excellent', 'Portrait and event telephoto', 'Available'],
      ['Canon RF 50mm f/1.2L', 'Lens', 'Canon', 'RF 50mm f/1.2L USM', 'CN-5012-20241006', '2023-11-15', 2299, 'Excellent', 'Premium portrait lens', 'Available'],
      ['Canon RF 85mm f/1.2L', 'Lens', 'Canon', 'RF 85mm f/1.2L USM', 'CN-8512-20241007', '2024-02-28', 2699, 'Good', 'Studio portrait lens', 'In Use'],
      ['Canon RF 15-35mm f/2.8L', 'Lens', 'Canon', 'RF 15-35mm f/2.8L IS USM', 'CN-1535-20241008', '2024-05-10', 2299, 'Excellent', 'Wide angle for real estate and events', 'Available'],
      ['Profoto B10X Plus', 'Lighting', 'Profoto', 'B10X Plus', 'PF-B10X-20241009', '2024-01-20', 2195, 'Excellent', 'Portable strobe, 500Ws', 'Available'],
      ['Profoto B10X Plus #2', 'Lighting', 'Profoto', 'B10X Plus', 'PF-B10X-20241010', '2024-01-20', 2195, 'Excellent', 'Second strobe for two-light setups', 'Available'],
      ['Profoto Softbox 3ft Octa', 'Modifier', 'Profoto', 'OCF Softbox 3 Octa', 'PF-OCF3-20241011', '2024-02-15', 215, 'Good', 'Key light modifier', 'Available'],
      ['DJI Mavic 3 Pro', 'Drone', 'DJI', 'Mavic 3 Pro', 'DJ-M3P-20241012', '2024-07-01', 2199, 'Excellent', 'Aerial photography, 4/3 CMOS Hasselblad', 'Available'],
      ['Manfrotto 055 Tripod', 'Support', 'Manfrotto', 'MT055CXPRO4', 'MF-055-20241013', '2023-09-01', 449, 'Good', 'Carbon fiber tripod', 'Available'],
      ['Peak Design Camera Bag', 'Bag', 'Peak Design', 'Everyday Backpack 30L', 'PD-EB30-20241014', '2024-03-15', 299, 'Excellent', 'Main camera bag', 'In Use'],
      ['SanDisk CFexpress 256GB', 'Storage', 'SanDisk', 'Extreme PRO CFexpress', 'SD-CFE-20241015', '2024-03-15', 229, 'Excellent', 'Primary card for R5', 'In Use'],
      ['Apple MacBook Pro 16"', 'Computer', 'Apple', 'MacBook Pro 16 M3 Max', 'AP-MBP-20241016', '2024-01-05', 3499, 'Excellent', 'Primary editing machine, 36GB RAM', 'In Use']
    ];
    for (const e of equipment) { await pool.query('INSERT INTO equipment (name, category, brand, model, serial_number, purchase_date, purchase_price, condition, notes, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', e); }
    console.log('✅ 16 equipment items seeded');

    // ==================== SEED EXPENSES (16) ====================
    const expenses = [
      ['Adobe Creative Cloud Annual', 'Software', 659.88, '2025-01-15', 'Adobe', 'Lightroom + Photoshop annual subscription', true, null, 'Recorded'],
      ['Studio Rent - January', 'Studio', 1800, '2025-01-01', 'Austin Creative Spaces', 'Monthly studio rental', true, null, 'Recorded'],
      ['Studio Rent - February', 'Studio', 1800, '2025-02-01', 'Austin Creative Spaces', 'Monthly studio rental', true, null, 'Recorded'],
      ['Studio Rent - March', 'Studio', 1800, '2025-03-01', 'Austin Creative Spaces', 'Monthly studio rental', true, null, 'Recorded'],
      ['Canon RF 85mm f/1.2L', 'Equipment', 2699, '2024-02-28', 'B&H Photo', 'Studio portrait lens purchase', true, null, 'Recorded'],
      ['Insurance Premium - Annual', 'Insurance', 2400, '2025-01-10', 'PhotoInsure Pro', 'Equipment and liability insurance', true, null, 'Recorded'],
      ['Website Hosting Annual', 'Software', 360, '2025-01-20', 'Squarespace', 'Portfolio website hosting', true, null, 'Recorded'],
      ['Cloud Storage - Annual', 'Software', 119.88, '2025-01-15', 'Google', 'Google Workspace for client delivery', true, null, 'Recorded'],
      ['Backdrop Paper Rolls x5', 'Supplies', 275, '2025-02-10', 'Savage Universal', 'Studio backdrop paper assortment', true, null, 'Recorded'],
      ['Mileage - January', 'Travel', 342.50, '2025-01-31', 'Self', 'Business mileage at $0.67/mile', true, null, 'Recorded'],
      ['Mileage - February', 'Travel', 287.25, '2025-02-28', 'Self', 'Business mileage at $0.67/mile', true, null, 'Recorded'],
      ['DJI Mavic 3 Pro Battery', 'Equipment', 189, '2025-03-05', 'DJI Store', 'Extra battery for drone', true, null, 'Recorded'],
      ['Business Cards 500ct', 'Marketing', 89, '2025-01-25', 'MOO', 'Premium business cards', true, null, 'Recorded'],
      ['Photo Prints for Portfolio', 'Marketing', 425, '2025-02-20', 'Bay Photo Lab', 'Large format prints for studio wall', true, null, 'Recorded'],
      ['CRM Software Annual', 'Software', 480, '2025-01-10', 'HoneyBook', 'Client management software', true, null, 'Recorded'],
      ['Workshop Registration', 'Education', 799, '2025-03-15', 'WPPI', 'Wedding photography conference', true, null, 'Recorded']
    ];
    for (const e of expenses) { await pool.query('INSERT INTO expenses (title, category, amount, expense_date, vendor, description, is_tax_deductible, receipt_url, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', e); }
    console.log('✅ 16 expenses seeded');

    // ==================== SEED PORTFOLIO (16) ====================
    const portfolio = [
      ['Golden Hour Bride', 'Wedding', 'Stunning bridal portrait during golden hour at Barton Springs', null, 'Canon R5, RF 85mm f/1.2, f/1.4, 1/800s, ISO 100', 'Barton Springs, Austin', '2025-11-15', true, 1, 'Published'],
      ['CEO Power Portrait', 'Corporate', 'Dramatic corporate headshot with rim lighting', null, 'Canon R5, RF 50mm f/1.2, f/2.8, 1/200s, ISO 200', 'Downtown Austin Office', '2025-11-10', true, 2, 'Published'],
      ['Family Joy', 'Family', 'Candid family moment during holiday session', null, 'Canon R6II, RF 24-70mm f/2.8, f/3.5, 1/250s, ISO 400', 'Studio A', '2025-12-18', false, 3, 'Published'],
      ['Luxury Living Room', 'Real Estate', 'HDR interior of luxury home living space', null, 'Canon R5, RF 15-35mm f/2.8, f/8, HDR bracket, ISO 100', 'Westlake, Austin', '2025-10-05', true, 4, 'Published'],
      ['Expecting Glow', 'Maternity', 'Backlit maternity silhouette at sunset', null, 'Canon R5, RF 85mm f/1.2, f/1.6, 1/1000s, ISO 100', 'Zilker Park, Austin', '2025-12-28', true, 5, 'Published'],
      ['Seared Perfection', 'Food', 'Artfully plated seared salmon with steam', null, 'Sony A7RV, 90mm Macro, f/4, 1/125s, ISO 200', 'La Casa Restaurant', '2025-10-28', false, 6, 'Published'],
      ['Urban Fashion', 'Fashion', 'Editorial fashion shot on downtown rooftop', null, 'Canon R5, RF 50mm f/1.2, f/1.8, 1/500s, ISO 100', 'Downtown Austin', '2025-09-20', true, 7, 'Published'],
      ['Product Elegance', 'Product', 'Minimal product shot on pure white background', null, 'Sony A7RV, 90mm Macro, f/11, 1/160s, ISO 100', 'Product Studio B', '2025-11-20', false, 8, 'Published'],
      ['Lake Engagement', 'Wedding', 'Romantic engagement portrait at golden hour', null, 'Canon R5, RF 70-200mm f/2.8, f/2.8, 1/640s, ISO 100', 'Lady Bird Lake', '2025-10-15', true, 9, 'Published'],
      ['Game Day Action', 'Sports', 'Intense soccer action shot with motion blur', null, 'Canon R6II, RF 70-200mm f/2.8, f/2.8, 1/2000s, ISO 800', 'Round Rock Sports Complex', '2025-10-01', false, 10, 'Published'],
      ['Senior Vibes', 'Portrait', 'Senior portrait at graffiti wall', null, 'Canon R5, RF 50mm f/1.2, f/1.4, 1/1000s, ISO 100', 'Graffiti Park, Austin', '2025-09-15', false, 11, 'Published'],
      ['Modern Lines', 'Architecture', 'Dramatic angle of modern office building at sunrise', null, 'Canon R5, RF 15-35mm f/2.8, f/11, 1/60s, ISO 100', 'Innovation Tower', '2025-11-25', true, 12, 'Published'],
      ['Best Friend', 'Pet', 'Adorable golden retriever portrait with catchlight', null, 'Canon R5, RF 85mm f/1.2, f/2, 1/320s, ISO 400', 'Studio A', '2025-12-14', true, 13, 'Published'],
      ['Stage Lights', 'Event', 'Concert photography with dramatic stage lighting', null, 'Canon R6II, RF 70-200mm f/2.8, f/2.8, 1/500s, ISO 3200', 'ACL Live', '2025-10-10', false, 14, 'Published'],
      ['Brand Story', 'Commercial', 'Lifestyle brand photo in artisan coffee shop', null, 'Canon R5, RF 24-70mm f/2.8, f/2.8, 1/200s, ISO 400', 'Jo\'s Coffee, Austin', '2025-11-05', false, 15, 'Published'],
      ['Ethereal Fine Art', 'Fine Art', 'Long exposure fine art landscape at dawn', null, 'Sony A7RV, 24-70mm GM, f/16, 30s, ISO 50, ND filter', 'Colorado River', '2025-08-20', true, 16, 'Published']
    ];
    for (const p of portfolio) { await pool.query('INSERT INTO portfolio (title, category, description, image_url, camera_settings, location, shoot_date, is_featured, display_order, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', p); }
    console.log('✅ 16 portfolio items seeded');

    // ==================== SEED WORKFLOWS (16) ====================
    const workflows = [
      ['Johnson Wedding Post-Production', 1, 'Wedding', '["Import & backup","Cull photos","Color correction","Detailed edits","Gallery creation","Client review","Final delivery"]', 5, '2026-01-15', 'High', 'In Progress', 'On track for delivery'],
      ['Chen Q1 Headshots Prep', 2, 'Corporate', '["Schedule sessions","Setup studio","Shoot day","Basic retouching","Client review","Delivery"]', 2, '2026-03-15', 'Medium', 'In Progress', 'Scheduling in progress'],
      ['Rodriguez Spring Portraits', 3, 'Portrait', '["Consultation","Location scout","Shoot","Edit","Gallery delivery"]', 1, '2026-04-01', 'Low', 'Not Started', 'Spring session planned'],
      ['Kim Luxury Home #456', 4, 'Commercial', '["Pre-shoot walkthrough","Staging review","HDR shoot","Drone aerials","Editing","Listing delivery"]', 3, '2026-02-20', 'High', 'In Progress', 'Property staging confirmed'],
      ['Taylor Newborn Session', 5, 'Portrait', '["Pre-consultation","Schedule (2-3 weeks post birth)","Setup props","Shoot","Edit","Gallery delivery"]', 2, '2026-03-30', 'High', 'In Progress', 'Due date approaching'],
      ['Martinez Spring Menu Update', 6, 'Commercial', '["Menu review","Prop sourcing","Styling plan","Shoot day","Editing","Final delivery"]', 1, '2026-04-15', 'Medium', 'Not Started', 'New seasonal items'],
      ['White Lookbook Production', 7, 'Fashion', '["Mood board","Wardrobe selection","Hair & makeup booking","Shoot","Retouching","Layout design","Print delivery"]', 4, '2026-02-28', 'High', 'In Progress', 'Wardrobe confirmed'],
      ['Lee Summer Product Batch', 8, 'Commercial', '["Inventory check","Shot list","Setup flat lay station","Shoot","Background removal","Color match","Upload to store"]', 1, '2026-05-15', 'Medium', 'Not Started', '150 new SKUs'],
      ['Brown Wedding Full Production', 9, 'Wedding', '["Engagement gallery delivery","Timeline planning","Vendor coordination","Shoot day","Culling","Editing","Album design","Final delivery"]', 3, '2026-06-30', 'High', 'In Progress', 'Wedding date June 15'],
      ['Wilson All-Star Game', 10, 'Sports', '["Equipment prep","Credential request","Shoot","Select best shots","Editing","Print orders","Delivery"]', 1, '2026-04-10', 'Low', 'Not Started', 'Tournament in April'],
      ['Davis Grad Announcement', 11, 'Portrait', '["Session completion","Design announcement cards","Client approval","Print order","Delivery"]', 3, '2026-04-20', 'Medium', 'In Progress', 'Announcement design started'],
      ['Garcia Interior Design Collab', 12, 'Commercial', '["Pre-shoot meeting","Staging coordination","Morning shoot (natural light)","Evening shoot (artificial)","HDR processing","Delivery"]', 2, '2026-03-10', 'Medium', 'In Progress', 'Interior designer coordinating'],
      ['Anderson Calendar Project', 13, 'Portrait', '["Select 12 best pet portraits","Design calendar layout","Client approval","Print order","Delivery"]', 2, '2026-02-01', 'Low', 'In Progress', 'Custom pet calendar gift'],
      ['Thompson SXSW Credentials', 14, 'Event', '["Apply for press credentials","Equipment prep","Shot list planning","Day 1 coverage","Day 2 coverage","Day 3 coverage","Edit and deliver"]', 1, '2026-03-14', 'High', 'In Progress', 'Credentials pending'],
      ['Clark Q2 Content Calendar', 15, 'Commercial', '["Strategy meeting","Content calendar creation","Location scouting","Monthly shoot","Edit","Social media scheduling"]', 2, '2026-06-30', 'Medium', 'In Progress', 'Q2 planning underway'],
      ['Harris Gallery Exhibition', 16, 'Fine Art', '["Select portfolio pieces","Large format printing","Framing","Gallery coordination","Installation","Opening night","Sales tracking"]', 3, '2026-05-01', 'High', 'In Progress', 'Gallery space confirmed']
    ];
    for (const w of workflows) { await pool.query('INSERT INTO workflows (title, client_id, workflow_type, steps, current_step, due_date, priority, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', w); }
    console.log('✅ 16 workflows seeded');

    // ==================== SEED EMAIL TEMPLATES (16) ====================
    const emails = [
      ['Booking Confirmation', 'Booking', 'Your Photography Session is Confirmed!', 'Hi {client_name},\n\nGreat news! Your {shoot_type} session is confirmed for {shoot_date} at {location}.\n\nSession Details:\n- Date: {shoot_date}\n- Time: {start_time}\n- Location: {location}\n- Package: {package_name}\n\nPlease arrive 10 minutes early. Feel free to bring outfit changes.\n\nLooking forward to creating something beautiful together!\n\nBest,\nAlex Rivera\nPhotoStudio AI', '{client_name}, {shoot_type}, {shoot_date}, {location}, {start_time}, {package_name}', 'Active'],
      ['Gallery Ready', 'Delivery', 'Your Photos Are Ready!', 'Hi {client_name},\n\nExciting news! Your gallery from our {shoot_type} session is ready for viewing!\n\nGallery Link: {gallery_link}\nPassword: {gallery_password}\n\nYou have {download_days} days to download your images. If you\'d like to order prints, use the ordering link in your gallery.\n\nI\'d love to hear your feedback!\n\nBest,\nAlex Rivera', '{client_name}, {shoot_type}, {gallery_link}, {gallery_password}, {download_days}', 'Active'],
      ['Invoice Reminder', 'Billing', 'Invoice #{invoice_number} - Payment Reminder', 'Hi {client_name},\n\nThis is a friendly reminder that invoice #{invoice_number} for ${amount} is due on {due_date}.\n\nPayment can be made via:\n- Venmo: @PhotoStudioAI\n- PayPal: payments@photostudio.com\n- Check: Payable to PhotoStudio AI\n\nIf you\'ve already sent payment, please disregard this email.\n\nThank you!\nAlex Rivera', '{client_name}, {invoice_number}, {amount}, {due_date}', 'Active'],
      ['Contract Sent', 'Contract', 'Your Photography Contract', 'Hi {client_name},\n\nThank you for choosing PhotoStudio AI for your {shoot_type}!\n\nPlease review and sign the attached contract at your earliest convenience. Key details:\n- Package: {package_name}\n- Date: {shoot_date}\n- Investment: ${amount}\n\nPlease sign by {valid_until} to secure your date.\n\nBest,\nAlex Rivera', '{client_name}, {shoot_type}, {package_name}, {shoot_date}, {amount}, {valid_until}', 'Active'],
      ['Thank You', 'Follow-up', 'Thank You for a Wonderful Session!', 'Hi {client_name},\n\nThank you so much for an amazing {shoot_type} session! I had a blast working with you.\n\nYour gallery will be ready in approximately {turnaround_days} business days. I\'ll send you a link as soon as it\'s ready.\n\nIn the meantime, I\'d love if you could leave a review on Google. It helps so much!\n\nBest,\nAlex Rivera', '{client_name}, {shoot_type}, {turnaround_days}', 'Active'],
      ['Referral Thank You', 'Follow-up', 'Thank You for the Referral!', 'Hi {client_name},\n\nI wanted to personally thank you for referring {referred_name} to PhotoStudio AI! Your trust means the world.\n\nAs a token of appreciation, you\'ll receive a $50 credit toward your next session.\n\nThank you for being an amazing client!\n\nBest,\nAlex Rivera', '{client_name}, {referred_name}', 'Active'],
      ['Session Prep Guide', 'Booking', 'Preparing for Your {shoot_type} Session', 'Hi {client_name},\n\nYour session is coming up on {shoot_date}! Here are some tips to help you prepare:\n\n1. Outfit Tips: Solid colors photograph best. Avoid busy patterns.\n2. Timing: Arrive 10 minutes early for setup.\n3. What to Bring: Outfit changes, props, accessories.\n4. Skin Care: Stay hydrated and moisturized.\n5. Rest: Get good sleep the night before!\n\nSee you soon!\nAlex Rivera', '{client_name}, {shoot_type}, {shoot_date}', 'Active'],
      ['Reschedule Request', 'Booking', 'Need to Reschedule? No Problem!', 'Hi {client_name},\n\nI understand plans change! If you need to reschedule your {shoot_type} session on {shoot_date}, no worries.\n\nPer our contract, rescheduling is free with 48+ hours notice. Please reply with your preferred new date and I\'ll check availability.\n\nBest,\nAlex Rivera', '{client_name}, {shoot_type}, {shoot_date}', 'Active'],
      ['Album Proof Ready', 'Delivery', 'Your Album Proof is Ready for Review', 'Hi {client_name},\n\nYour album proof is ready! Please review the layout and let me know:\n\n- Any image swaps you\'d like\n- Layout preferences\n- Text/caption changes\n\nYou have 2 rounds of revisions included. After approval, the album will be printed and shipped in 3-4 weeks.\n\nAlbum Proof Link: {proof_link}\n\nBest,\nAlex Rivera', '{client_name}, {proof_link}', 'Active'],
      ['Print Order Confirmation', 'Delivery', 'Your Print Order is Confirmed!', 'Hi {client_name},\n\nYour print order has been submitted! Here are the details:\n\nOrder: {order_details}\nEstimated Delivery: {delivery_date}\n\nPrints are produced by a professional lab on archival paper.\n\nThank you!\nAlex Rivera', '{client_name}, {order_details}, {delivery_date}', 'Active'],
      ['Mini Session Promotion', 'Marketing', 'Limited Time: {season} Mini Sessions!', 'Hi {client_name},\n\nExciting news! I\'m offering limited {season} mini sessions!\n\n20-minute sessions - only ${mini_price}\nIncludes 5 edited digital images\n\nDates available: {available_dates}\nLocation: {location}\n\nBook now - only {spots_left} spots remain!\n\nBest,\nAlex Rivera', '{client_name}, {season}, {mini_price}, {available_dates}, {location}, {spots_left}', 'Active'],
      ['Year-End Review', 'Marketing', 'Your Year in Photos - {year} Recap', 'Hi {client_name},\n\nWhat a year! Thank you for being part of the PhotoStudio AI family.\n\nYour {year} highlights:\n- Sessions: {session_count}\n- Photos delivered: {photo_count}\n- Favorite moment: {highlight}\n\nBook early for {next_year} and save 10% on any package!\n\nBest,\nAlex Rivera', '{client_name}, {year}, {session_count}, {photo_count}, {highlight}, {next_year}', 'Active'],
      ['Weather Backup Plan', 'Booking', 'Weather Update for Your Session', 'Hi {client_name},\n\nI\'m keeping an eye on the weather for your session on {shoot_date}. Current forecast shows {forecast}.\n\nBackup plan options:\n1. Move to indoor location\n2. Reschedule to {backup_date}\n3. Embrace the weather (overcast = great portraits!)\n\nLet me know your preference!\n\nBest,\nAlex Rivera', '{client_name}, {shoot_date}, {forecast}, {backup_date}', 'Active'],
      ['Welcome New Client', 'Onboarding', 'Welcome to PhotoStudio AI!', 'Hi {client_name},\n\nWelcome to the PhotoStudio AI family! I\'m thrilled to work with you.\n\nHere\'s what happens next:\n1. We\'ll finalize your contract and package\n2. Schedule your session date\n3. I\'ll send a prep guide before your session\n4. We create magic together!\n\nFeel free to reach out anytime with questions.\n\nBest,\nAlex Rivera', '{client_name}', 'Active'],
      ['Milestone Anniversary', 'Follow-up', 'Happy Anniversary from PhotoStudio AI!', 'Hi {client_name},\n\nHappy {anniversary} anniversary! Can you believe it\'s been {years} year(s) since we captured your {original_shoot}?\n\nTo celebrate, I\'m offering you 15% off any session booked this month.\n\nWould you like to create some new memories?\n\nBest,\nAlex Rivera', '{client_name}, {anniversary}, {years}, {original_shoot}', 'Active'],
      ['Payment Received', 'Billing', 'Payment Received - Thank You!', 'Hi {client_name},\n\nThis confirms we\'ve received your payment of ${amount} for invoice #{invoice_number}.\n\nPayment Details:\n- Amount: ${amount}\n- Date: {payment_date}\n- Method: {payment_method}\n\nThank you for your prompt payment!\n\nBest,\nAlex Rivera', '{client_name}, {amount}, {invoice_number}, {payment_date}, {payment_method}', 'Active']
    ];
    for (const e of emails) { await pool.query('INSERT INTO email_templates (name, category, subject, body, variables, status) VALUES ($1,$2,$3,$4,$5,$6)', e); }
    console.log('✅ 16 email templates seeded');

    // ==================== SEED TESTIMONIALS (16) ====================
    const testimonials = [
      [1, 5, 'Alex captured our wedding day perfectly! Every emotion, every detail - it was like reliving the day all over again. The gallery delivery was so fast and the photos exceeded our expectations. Highly recommend!', 'Wedding', true, 'Google', 'Published'],
      [2, 5, 'The corporate headshots for our team were outstanding. Professional, efficient, and everyone looked great. Alex made even the most camera-shy team members feel comfortable.', 'Corporate', true, 'Google', 'Published'],
      [3, 5, 'Our family photos are absolutely stunning! Alex has such a talent for capturing genuine moments. The kids were so comfortable and it shows in every photo.', 'Family', false, 'Website', 'Published'],
      [4, 5, 'The real estate photos helped sell our listing in just 3 days! The HDR interiors and drone shots made all the difference. Every agent should use PhotoStudio AI.', 'Real Estate', true, 'Google', 'Published'],
      [5, 5, 'My maternity photos are breathtaking. Alex knew exactly how to pose me to look my best and the golden hour lighting was magical. I will treasure these forever.', 'Maternity', true, 'Instagram', 'Published'],
      [6, 5, 'The food photography completely transformed our menu presentation. Our new menu photos have increased appetizer orders by 30%! Worth every penny.', 'Food', false, 'Google', 'Published'],
      [7, 5, 'Working with Alex on my modeling portfolio was incredible. The variety of looks and the quality of editing is top-notch. Already booked two jobs with these photos!', 'Fashion', true, 'Website', 'Published'],
      [8, 4, 'Product photos are clean, consistent, and conversion-optimized. Our e-commerce sales improved significantly after switching to PhotoStudio AI for our product imagery.', 'Product', false, 'Email', 'Published'],
      [9, 5, 'Our engagement photos are magazine-worthy! Alex found the most beautiful spots at Lady Bird Lake and the golden hour shots are absolutely dreamy.', 'Engagement', true, 'Google', 'Published'],
      [10, 5, 'Coach here - the team photos and individual portraits were fantastic. Quick turnaround, great quality, and the kids loved seeing themselves look so professional.', 'Sports', false, 'Website', 'Published'],
      [11, 5, 'My senior portraits are SO cool! Alex took me to the best spots around Austin and really understood the vibe I was going for. All my friends are jealous!', 'Portrait', false, 'Instagram', 'Published'],
      [12, 5, 'The architectural photography perfectly showcased our new office building. The sunrise shots are now featured in our marketing materials and investor presentations.', 'Architecture', false, 'LinkedIn', 'Published'],
      [13, 5, 'Getting my dog to sit still is impossible, but Alex somehow got the most adorable photos! The holiday set was so cute. Already booked again for next year.', 'Pet', true, 'Google', 'Published'],
      [14, 4, 'Three days of festival coverage and every shot was incredible. Alex captured the energy of every performance perfectly. Can\'t wait to work together at SXSW!', 'Event', false, 'Website', 'Published'],
      [15, 5, 'Our brand content has never looked better. Alex understands our aesthetic and consistently delivers photos that perform well on social media. A true partner.', 'Commercial', true, 'Email', 'Published'],
      [16, 5, 'The fine art prints are museum quality. Alex\'s eye for composition and attention to printing detail resulted in pieces I\'m proud to display in my gallery.', 'Fine Art', false, 'Website', 'Published']
    ];
    for (const t of testimonials) { await pool.query('INSERT INTO testimonials (client_id, rating, review_text, shoot_type, is_featured, source, status) VALUES ($1,$2,$3,$4,$5,$6,$7)', t); }
    console.log('✅ 16 testimonials seeded');

    // ==================== SEED MILEAGE (16) ====================
    const mileage = [
      ['2025-11-15', 'Home Studio, Austin', 'Barton Springs Garden Venue', 12.5, 'Client Shoot', 'Sarah Johnson', true, 'Wedding day - full day coverage'],
      ['2025-11-10', 'Home Studio, Austin', 'TechCorp Office, Dallas', 195.0, 'Client Shoot', 'Michael Chen', true, 'Corporate headshot session'],
      ['2025-12-18', 'Home Studio, Austin', 'Studio A', 3.2, 'Client Shoot', 'Emily Rodriguez', true, 'Holiday portraits'],
      ['2025-10-05', 'Home Studio, Austin', '1234 Oak Lane, Westlake', 8.7, 'Client Shoot', 'David Kim', true, 'Real estate listing'],
      ['2025-12-28', 'Home Studio, Austin', 'Zilker Park', 5.4, 'Client Shoot', 'Jessica Taylor', true, 'Maternity session'],
      ['2025-10-28', 'Home Studio, Austin', 'La Casa Restaurant', 6.1, 'Client Shoot', 'Robert Martinez', true, 'Food photography'],
      ['2025-11-20', 'Home Studio, Austin', 'Product Studio B', 2.8, 'Client Shoot', 'Christopher Lee', false, 'Product shoot'],
      ['2025-10-15', 'Home Studio, Austin', 'Lady Bird Lake Trail', 4.3, 'Client Shoot', 'Sophia Brown', true, 'Engagement session'],
      ['2025-12-14', 'Home Studio, Austin', 'Studio A - Holiday Set', 3.2, 'Client Shoot', 'Lauren Anderson', true, 'Pet mini sessions'],
      ['2025-11-05', 'Home Studio, Austin', 'Client Office, South Lamar', 7.8, 'Client Shoot', 'Megan Clark', true, 'Brand lifestyle shoot'],
      ['2025-11-25', 'Home Studio, Austin', 'Innovation Tower, Downtown', 4.5, 'Client Shoot', 'Daniel Garcia', true, 'Architecture shoot'],
      ['2025-12-01', 'Home Studio, Austin', 'B&H Photo, Dallas', 195.0, 'Equipment Pickup', '', false, 'New lens purchase'],
      ['2025-12-05', 'Home Studio, Austin', 'Print Lab, South Congress', 3.5, 'Delivery', 'Andrew Harris', true, 'Fine art print pickup'],
      ['2025-11-08', 'Home Studio, Austin', 'Sunset Cliff Overlook', 22.3, 'Scouting', '', false, 'Scouting new location for engagement shoots'],
      ['2025-12-10', 'Home Studio, Austin', 'Austin Convention Center', 5.1, 'Meeting', '', true, 'Photography expo and networking'],
      ['2025-11-30', 'Home Studio, Austin', 'Accountant Office, Round Rock', 18.6, 'Meeting', '', true, 'Year-end tax planning meeting']
    ];
    for (const m of mileage) { await pool.query('INSERT INTO mileage (trip_date, from_location, to_location, miles, purpose, client_name, is_round_trip, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', m); }
    console.log('✅ 16 mileage trips seeded');

    // ==================== SEED BOOKINGS (16) ====================
    const bookings = [
      ['Natalie Porter', 'natalie.p@email.com', '(555) 201-0001', 'Wedding', '2026-06-20', '14:00', 'Hill Country Vineyard', 'Looking for a photographer for our June wedding. We love your outdoor shots!', 5000, 'Instagram', 'New'],
      ['Marcus Reed', 'marcus.r@email.com', '(555) 201-0002', 'Corporate', '2026-04-15', '09:00', 'Reed & Associates Office', 'Need headshots for 15 team members, plus some office environment shots.', 1500, 'Google', 'Contacted'],
      ['Ashley Torres', 'ashley.t@email.com', '(555) 201-0003', 'Engagement', '2026-05-10', '17:00', 'Mount Bonnell', 'We got engaged last week! Want golden hour photos.', 700, 'Word of Mouth', 'Confirmed'],
      ['Kevin Patel', 'kevin.p@email.com', '(555) 201-0004', 'Product', '2026-04-01', '10:00', 'Our warehouse', 'E-commerce product shots for 50 new items launching.', 3000, 'Website', 'Confirmed'],
      ['Diana Flores', 'diana.f@email.com', '(555) 201-0005', 'Family', '2026-04-20', '15:00', 'Botanical Gardens', 'Annual family photos - 8 people including 3 kids under 5.', 500, 'Repeat Client', 'Confirmed'],
      ['Tyler Brooks', 'tyler.b@email.com', '(555) 201-0006', 'Event', '2026-05-25', '18:00', 'Moody Theater', 'Charity gala event coverage, approximately 4 hours.', 2500, 'Referral', 'New'],
      ['Rachel Kim', 'rachel.k@email.com', '(555) 201-0007', 'Portrait', '2026-04-08', '11:00', 'Studio or outdoor', 'Professional headshots for my LinkedIn and personal branding.', 350, 'Google', 'Contacted'],
      ['Brandon Wells', 'brandon.w@email.com', '(555) 201-0008', 'Real Estate', '2026-03-28', '10:00', '5678 Lakeside Dr', 'Luxury listing - need interior, exterior, and drone shots.', 450, 'Yelp', 'Confirmed'],
      ['Samantha Cruz', 'sam.cruz@email.com', '(555) 201-0009', 'Fashion', '2026-05-15', '09:00', 'Urban downtown area', 'Building my modeling portfolio, need 3 different looks.', 1200, 'Instagram', 'New'],
      ['Derek Nguyen', 'derek.n@email.com', '(555) 201-0010', 'Food', '2026-04-05', '08:00', 'Nguyen\'s Bistro', 'New restaurant opening - need menu photos and interior shots.', 2800, 'Word of Mouth', 'Contacted'],
      ['Courtney Adams', 'courtney.a@email.com', '(555) 201-0011', 'Portrait', '2026-06-01', '16:00', 'Graffiti Park', 'Senior portraits for my daughter - class of 2026!', 550, 'Facebook', 'New'],
      ['Jason Murphy', 'jason.m@email.com', '(555) 201-0012', 'Sports', '2026-04-12', '08:00', 'City Sports Complex', 'Youth baseball team photos - 18 kids + team shot.', 800, 'Referral', 'Confirmed'],
      ['Melissa Grant', 'melissa.g@email.com', '(555) 201-0013', 'Wedding', '2026-09-14', '12:00', 'Driskill Hotel', 'Fall wedding, about 150 guests. Need full day coverage + engagement session.', 6500, 'Website', 'New'],
      ['Carlos Herrera', 'carlos.h@email.com', '(555) 201-0014', 'Corporate', '2026-04-22', '13:00', 'Herrera Law Firm', 'Attorney headshots and office photos for website redesign.', 1200, 'Google', 'Contacted'],
      ['Amy Chen', 'amy.chen@email.com', '(555) 201-0015', 'Family', '2026-05-18', '10:00', 'Mayfield Park', 'Newborn session at home + family photos at the park.', 650, 'Repeat Client', 'Confirmed'],
      ['Patrick O\'Brien', 'patrick.ob@email.com', '(555) 201-0016', 'Event', '2026-07-04', '16:00', 'Barton Creek Country Club', 'Fourth of July corporate celebration - 3 hour coverage.', 1800, 'Referral', 'New']
    ];
    for (const b of bookings) { await pool.query('INSERT INTO bookings (client_name, email, phone, shoot_type, preferred_date, preferred_time, location, message, budget, referral_source, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', b); }
    console.log('✅ 16 bookings seeded');

    // ==================== SEED TASKS (16) ====================
    const tasks = [
      ['Edit Johnson wedding gallery', 'Editing', 'Cull and edit 245 photos from the wedding', '2026-03-25', 'High', 'Johnson-Williams Wedding', 'In Progress'],
      ['Send Rodriguez gallery for review', 'Delivery', 'Upload final edits and share gallery link', '2026-03-22', 'High', 'Rodriguez Christmas Portraits', 'To Do'],
      ['Order canvas prints for Harris', 'Delivery', 'Order 10 fine art canvas prints from lab', '2026-03-28', 'Medium', 'Harris Fine Art Collection', 'To Do'],
      ['Backup November shoot files', 'Admin', 'Archive all November shoots to external drive', '2026-03-24', 'Medium', '', 'To Do'],
      ['Update portfolio website', 'Marketing', 'Add 5 best shots from recent shoots to website', '2026-03-30', 'Medium', '', 'To Do'],
      ['Invoice Chen for Q1 headshots', 'Accounting', 'Create and send Q1 invoice to Michael Chen', '2026-03-23', 'High', 'Chen Team Headshots', 'To Do'],
      ['Clean camera sensors', 'Equipment', 'Both camera bodies need sensor cleaning', '2026-03-26', 'Low', '', 'To Do'],
      ['Reply to new wedding inquiry', 'Communication', 'Natalie Porter wedding - send package options', '2026-03-22', 'High', '', 'In Progress'],
      ['Scout location for White editorial', 'General', 'Visit downtown loft studio for fashion shoot', '2026-03-24', 'Medium', 'White Fashion Editorial', 'To Do'],
      ['Submit quarterly tax estimate', 'Accounting', 'Calculate and pay Q1 estimated taxes', '2026-04-15', 'High', '', 'To Do'],
      ['Post behind-the-scenes reel', 'Marketing', 'Edit and post BTS reel from Martinez shoot', '2026-03-27', 'Low', 'Martinez Menu Reshoot', 'To Do'],
      ['Renew insurance policy', 'Admin', 'Equipment insurance renewal due', '2026-04-01', 'Medium', '', 'To Do'],
      ['Color calibrate monitor', 'Equipment', 'Monthly monitor calibration with SpyderX', '2026-03-29', 'Low', '', 'Completed'],
      ['Send thank you cards', 'Communication', 'Mail handwritten thank you cards to recent clients', '2026-03-25', 'Low', '', 'In Progress'],
      ['Update contract template', 'Admin', 'Add new cancellation policy clause', '2026-03-31', 'Medium', '', 'To Do'],
      ['Review Wilson soccer proofs', 'Editing', 'Select best team and individual shots', '2026-03-23', 'High', 'Wilson Soccer Spring', 'To Do']
    ];
    for (const t of tasks) { await pool.query('INSERT INTO tasks (title, category, description, due_date, priority, related_shoot, status) VALUES ($1,$2,$3,$4,$5,$6,$7)', t); }
    console.log('✅ 16 tasks seeded');

    console.log('\n🎉 Database fully seeded with 18 features (16 items each)!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
