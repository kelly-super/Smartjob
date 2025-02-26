const { text } = require('body-parser');
const { READONLY } = require('sqlite3');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

//create table
db.serialize(() => {

  db.run(`CREATE TABLE IF NOT EXISTS companies (
    company_id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    company_address TEXT,
    company_postcode TEXT,
    company_phone TEXT,
    company_email TEXT,
    company_website TEXT,
    company_registration TEXT,
    company_gst TEXT,
    bank_name TEXT,
    bank_account TEXT,
    quote_notes TEXT,
    invoice_notes TEXT,
    create_date TEXT DEFAULT CURRENT_TIMESTAMP,
    update_date TEXT
)`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_code TEXT UNIQUE NOT Null,
        user_name TEXT NOT NULL,
        user_role TEXT,
        create_date default CURRENT_TIMESTAMP,
        update_date TEXT,
        status default 'Valid',
        user_password TEXT,
        company_id INTEGER,
        FOREIGN KEY(company_id) REFERENCES companies(company_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clients (
        client_id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_lastname TEXT NOT NULL,
        client_surname TEXT,
        user_id INTEGER,
        client_address TEXT,
        client_postcode TEXT,
        client_mobile TEXT,
        client_email TEXT,
        create_date default CURRENT_TIMESTAMP,
        update_date TEXT,
        status default 'Valid',
        remark TEXT,
        FOREIGN KEY(user_id) REFERENCES users(user_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_code TEXT,
        product_name TEXT NOT NULL,
        product_description TEXT,
        product_price REAL,
        create_date default CURRENT_TIMESTAMP,
        update_date TEXT,
        status default 'Valid',
        note TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS jobs (
        job_id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        quote_id INTEGER,
        job_category  TEXT NOT NULL,
        job_description TEXT,
        job_address TEXT,
        job_price TEXT,
        job_status TEXT,
        job_createdate default CURRENT_TIMESTAMP,
        job_inspectiondate TEXT,
        job_startdate TEXT,
        job_completedate TEXT,
        job_notes TEXT,
        FOREIGN KEY(client_id) REFERENCES clients(client_id),
        FOREIGN KEY(quote_id) REFERENCES users(quote_id)
    )`);


    db.run(`CREATE TABLE IF NOT EXISTS quotes (
      quote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      quote_property_address TEXT,
      contact_number TEXT,
      contact_email TEXT,
      quote_price REAL,
      quote_remark TEXT,
      quote_pdf TEXT,
      quote_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(client_id)
    )`);

db.run(`CREATE TABLE IF NOT EXISTS quote_items (
  quote_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  item_price REAL,
  item_discount_price REAL,
  item_remark TEXT,
  create_date TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(quote_id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_name TEXT NOT NULL,
  supplier_address TEXT,
  supplier_postcode TEXT,
  supplier_contact_name TEXT,
  supplier_contact_phone TEXT,
  supplier_email TEXT,
  supplier_website TEXT,
  supplier_postaddress TEXT,
  update_date TEXT,
  status default 'Valid',
  remark TEXT,
  create_date default CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS orders (
  order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  reference_no TEXT,
  order_status TEXT,
  order_subtotal REAL,
  order_gst REAL,
  order_amount REAL,
  payment_status TEXT,
  payment_method TEXT,
  payment_date TEXT,
  payment_currency TEXT,
  remark TEXT,
  order_date TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS order_details (
  order_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_code TEXT ,
  description TEXT,
  unit_price REAL,
  quantity INTEGER,
  remark TEXT,
  create_date TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(order_id)
)`);

// Insert test data
// Insert test data only if the tables are empty
db.get("SELECT COUNT(*) AS count FROM companies", (err, row) => {
  if (err) throw err;
  if (row.count === 0) {
    db.run(`
      INSERT INTO companies (
        company_name ,
        company_address ,
        company_postcode ,
        company_phone ,
        company_email ,
        company_website ,
        company_registration ,
        company_gst ,
        bank_name ,
        bank_account ,
        quote_notes ,
        invoice_notes ,
        create_date
      ) VALUES (
        'Nova Gate Limited',
        'Ormiston, Flat Bush, Auckland 2019',
        '2019',
        '021-123-4567',
        'contact@smartjob.com',
        'www.smartjob.com',
        '123456',
        '123456',
        'ASB',
        '123456789',
        'Please pay within 7 days',
        'Please pay within 14 days',
        CURRENT_TIMESTAMP
      )
    `);
  }
}); 
// Insert test data only if the tables are empty
 db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
    if (err) throw err;
    if (row.count === 0) {
      db.run(`
        INSERT INTO users (user_code, user_name, user_role,user_password,company_id) VALUES
        ('U001', 'NovaGate','admin', '123',1),
        ('U002', 'Kelly', 'admin','123',1)
      `);
    }
  });

  db.get("SELECT COUNT(*) AS count FROM clients", (err, row) => {
    if (err) throw err;
    if (row.count === 0) {
      db.run(`
        INSERT INTO clients (client_lastname, client_surname, client_address, client_postcode, client_mobile, remark) VALUES
        ('Ashtar', 'ddasfdsafdsdfasdf', '162 brigham creek road, hobsonville', '12345', '0272783882', 'replace motor'),
        ('Doe', 'Jane', '456 Elm St', '67890', '555-5678', 'New customer')
      `);
    }
  });



  

});

module.exports = db;

