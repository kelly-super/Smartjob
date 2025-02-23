const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const app = express();
const port =5000;



// Middleware to parse JSON and URL-encoded request bodies
app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.json()); // For JSON data
// Session setup (required for flash messages)
app.use(session({
    secret: 'your-secret-key', // Replace with a real secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
  }));
  
  // Flash middleware
  app.use(flash());
  
  // Make flash messages available in all views
  app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
  });




const userRoutes = require('./routes/userRoutes');
const clientRoutes = require('./routes/clientRoutes');  
const productRoutes = require('./routes/productRoutes');
const jobRoutes = require('./routes/jobRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const orderRoutes = require('./routes/orderRoutes');


app.use('/users', userRoutes);
app.use('/clients', clientRoutes);
app.use('/products', productRoutes);
app.use('/jobs', jobRoutes);
app.use('/quotes', quoteRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/orders', orderRoutes);

//middleware
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(__dirname + '/public'));

//routes
app.get('/', (req, res) => {
    res.render('partials/layout', { title: 'Dashboard', body: '../index' });
});

app.get('/jobs', (req, res) => {
    // Fetch jobs from the database (example)
    db.all("SELECT * FROM jobs", [], (err, jobs) => {
        if (err) {
            res.status(500).send("Error fetching jobs");
        } else {
            // Render the `index.ejs` file and pass the `body` variable
            res.render('partials/layout', { 
                title: 'Jobs', 
                body: '../jobs/index', // Pass the path to the content file
                jobs: jobs 
            });
        }
    });
});

app.get('/clients', (req, res) => {
    // Fetch jobs from the database (example)
    db.all("SELECT * FROM clients", [], (err, clients) => {
        if (err) {
            res.status(500).send("Error fetching clients");
        } else {
            // Render the `index.ejs` file and pass the `body` variable
            res.render('partials/layout', { 
                title: 'Clients', 
                body: '../clients/index', // Pass the path to the content file
                clients: clients 
            });
        }
    });
});

app.get('/users', (req, res) => {
    // Fetch jobs from the database (example)
    db.all("SELECT * FROM users", [], (err, users) => {
        if (err) {
            res.status(500).send("Error fetching users");
        } else {
            // Render the `index.ejs` file and pass the `body` variable
            res.render('partials/layout', { 
                title: 'Users', 
                body: '../users/index', // Pass the path to the content file
                users: users 
            });
        }
    });
});



app.get('/products', (req, res) => {
    // Fetch jobs from the database (example)
    db.all("SELECT * FROM products", [], (err, products) => {
        if (err) {
            res.status(500).send("Error fetching products");
        } else {
            // Render the `index.ejs` file and pass the `body` variable
            res.render('partials/layout', { 
                title: 'Products', 
                body: '../products/index', // Pass the path to the content file
                products: products 
            });
        }
    });
});

app.get('/quotes', (req, res) => {
    // Fetch jobs from the database (example)
    db.all("SELECT * FROM quotes", [], (err, quotes) => {
        if (err) {
            res.status(500).send("Error fetching quotes");
        } else {
            // Render the `index.ejs` file and pass the `body` variable
            res.render('partials/layout', { 
                title: 'Quotes', 
                body: '../quotes/index', // Pass the path to the content file
                quotes: quotes 
            });
        }
    });
});
app.get('/suppliers', (req, res) => {
    // Fetch jobs from the database (example)
    db.all("SELECT * FROM suppliers", [], (err, suppliers) => {
        if (err) {
            res.status(500).send("Error fetching quotes");
        } else {
            // Render the `index.ejs` file and pass the `body` variable
            res.render('partials/layout', { 
                title: 'suppliers', 
                body: '../suppliers/index', // Pass the path to the content file
                suppliers: suppliers 
            });
        }
    });
});


app._router.stack.forEach(function(r) {
    if (r.route && r.route.path) {
      console.log(r.route.path);
    }
  });
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

