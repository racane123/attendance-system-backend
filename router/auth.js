import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, requireRole, hashPassword, comparePassword, generateToken } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for login attempts (disabled in development)
const loginLimiter = process.env.NODE_ENV === 'production' ? rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
  }
}) : (req, res, next) => next(); // Skip rate limiting in development

// Register new user (admin only)
router.post('/register', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { username, email, password, role = 'teacher' } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Username, email, and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Validate role
    if (!['admin', 'teacher', 'viewer'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role. Must be admin, teacher, or viewer' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Username or email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
      [username, email, hashedPassword, role]
    );

    const user = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          created_at: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Development endpoint to reset rate limiter (remove in production)
router.post('/reset-rate-limit', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Reset the rate limiter store
  if (loginLimiter.resetKey) {
    // This is a simplified reset - in production you'd want a proper store
    res.json({ message: 'Rate limiter reset (development only)' });
  } else {
    res.json({ message: 'Rate limiter reset not available' });
  }
});

// Login user
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('Login attempt for username:', username);

    // Validate input
    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    console.log('User query result:', result.rows.length > 0 ? 'User found' : 'User not found');

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('User found:', { id: user.id, username: user.username, role: user.role });

    // Check password
    const isValidPassword = await comparePassword(password, user.password_hash);
    console.log('Password validation:', isValidPassword ? 'Valid' : 'Invalid');
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);
    console.log('Token generated successfully');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    console.log('Profile request for user ID:', req.user.id);
    
    const result = await pool.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    console.log('Profile query result:', result.rows.length > 0 ? 'User found' : 'User not found');

    if (result.rows.length === 0) {
      console.log('User not found in database');
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    console.log('Profile data:', result.rows[0]);
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: 'New password must be at least 6 characters long' 
      });
    }

    // Get current user with password
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        error: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedNewPassword, req.user.id]
    );

    res.json({ 
      success: true,
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'teacher', 'viewer'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role' 
      });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot delete your own account' 
      });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({ 
      success: true,
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get user by ID (admin only)
router.get('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role } = req.body;

    // Validate role if provided
    if (role && !['admin', 'teacher', 'viewer'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role' 
      });
    }

    // Check if username or email already exists (excluding current user)
    if (username || email) {
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE (username = $1 OR email = $2) AND id != $3',
        [username, email, id]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Username or email already exists' 
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (username) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No fields to update' 
      });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, role, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

export default router; 