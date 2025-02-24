const express = require('express');
const db = require('../database');
const bcrypt = require('bcryptjs');
const router = express.Router();
// create a new user form
router.get('/new',(req, res) => {
  res.render('partials/layout', { title: 'New user', body: '../users/new'});
});


// Create a new user (Submit)
router.post('/', (req, res) => {
    const { user_code, user_name, user_password } = req.body;
    console.log('Inserting user with user_code:', user_code);
    // Check if user_code already exists
    db.get('SELECT * FROM users WHERE user_code = ?', [user_code], (err, row) => {
      if (err) throw err;
  
      if (row) {
        // User with this user_code already exists
        return res.render('users/new', { error: 'User with this user_code already exists.' });
      }
  
      // If user_code is unique, proceed with insertion
      const hashedPassword = bcrypt.hashSync(user_password, 10);
      db.run(
        'INSERT INTO users (user_code, user_name, user_password) VALUES (?, ?, ?)',
        [user_code, user_name, hashedPassword],
        (err) => {
          if (err) throw err;
          res.redirect('/users');
        }
      );
    });
  });
//Get all users

router.get('/', (req, res) => {
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


  // Read a single user

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM users WHERE user_id = ?', [req.params.id], (err, user) => {
    if (err) throw err;
    res.render('partials/layout', { title: 'User Details', body: '../users/show', user: user });
});
});

  // Update a user (Form)
router.get('/:id/edit', (req, res) => {
  db.get('SELECT * FROM users WHERE user_id = ?', [req.params.id], (err, user) => {
    if (err) throw err;
    res.render('partials/layout', { title: 'Edit User', body: '../users/edit', user: user });
});
});
//update a user

router.put('/:id', async (req, res) => {
    const { id } = req.params;

    const { user_name, user_code, user_password } = req.body;
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(user_password, 10);
    
    try {
        const result = await db.run(
            'UPDATE users SET user_name = ?, user_code = ?, password = ? WHERE user_id = ?',
            [user_name, user_code, hashedPassword, id]
        );
    
        res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating user' });
    }
}); 


//delete a user
router.delete('/:id/delete', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await db.run(
            'DELETE FROM users WHERE user_id = ?',
            [id]
        );
    
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting user' });
    }
}); 

module.exports = router;