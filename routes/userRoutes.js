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

router.post('/create', async (req, res) => {
    const { 
        user_code, 
        user_name, 
        user_password, 
        user_role, 
        status 
    } = req.body;

    // Validate required fields
    if (!user_code || !user_name || !user_password) {
        return res.json({ 
            success: false, 
            message: 'Missing required fields' 
        });
    }

    try {
        // Check if user code already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT user_code FROM users WHERE user_code = ?', [user_code], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingUser) {
            return res.json({ 
                success: false, 
                message: 'User code already exists' 
            });
        }

        // Insert new user
        db.run(`
            INSERT INTO users (
                user_code,
                user_name,
                user_password,
                user_role,
                status,
                create_date
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [user_code, user_name, user_password, user_role || 'user', status || 'Valid'],
            function(err) {
                if (err) {
                    console.error('Error creating user:', err);
                    return res.json({ 
                        success: false, 
                        message: 'Error creating user' 
                    });
                }
                res.json({ 
                    success: true, 
                    userId: this.lastID 
                });
            }
        );
    } catch (err) {
        console.error('Error:', err);
        res.json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

//Get all users

router.get('/', (req, res) => {
    const { search, role, status } = req.query;
    let query = `
        SELECT * FROM users 
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ` AND (user_code LIKE ? OR user_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
        query += ` AND user_role = ?`;
        params.push(role);
    }
    if (status) {
        query += ` AND status = ?`;
        params.push(status);
    }

    query += ` ORDER BY create_date DESC`;

    db.all(query, params, (err, users) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).send('Internal Server Error');
        }
        
        res.render('partials/layout', {
            title: 'Users',
            body: '../users/index',
            users,
            query: req.query // Pass the query parameters to the template
        });
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

router.post('/:id/edit', async (req, res) => {
    const userId = req.params.id;
    const { 
        user_name, 
        user_password, 
        user_role, 
        status 
    } = req.body;

    try {
        // Start building the query and params
        let query = `
            UPDATE users 
            SET user_name = ?,
                user_role = ?,
                status = ?,
                update_date = CURRENT_TIMESTAMP
        `;
        let params = [user_name, user_role, status];

        // Add password to update if provided
        if (user_password) {
            query += `, user_password = ?`;
            params.push(user_password);
        }

        // Add WHERE clause
        query += ` WHERE user_id = ?`;
        params.push(userId);

        // Execute the update
        db.run(query, params, function(err) {
            if (err) {
                console.error('Error updating user:', err);
                return res.json({ 
                    success: false, 
                    message: 'Error updating user' 
                });
            }

            if (this.changes === 0) {
                return res.json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }

            res.json({ 
                success: true, 
                userId: userId 
            });
        });
    } catch (err) {
        console.error('Error:', err);
        res.json({ 
            success: false, 
            message: 'Server error' 
        });
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