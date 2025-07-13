import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../database/db.js';

const router = express.Router();

// Get email history (admin only)
router.get('/history', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20, email_type, status, recipient_email } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (email_type) {
      paramCount++;
      whereClause += ` AND email_type = $${paramCount}`;
      params.push(email_type);
    }
    
    if (status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (recipient_email) {
      paramCount++;
      whereClause += ` AND recipient_email ILIKE $${paramCount}`;
      params.push(`%${recipient_email}%`);
    }
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM email_history ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get paginated results
    paramCount++;
    const historyResult = await pool.query(
      `SELECT eh.*, u.username as sent_by_username
       FROM email_history eh
       LEFT JOIN users u ON eh.sent_by = u.id
       ${whereClause}
       ORDER BY eh.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limit, offset]
    );
    
    res.json({
      success: true,
      data: historyResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Get email history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get email history' });
  }
});

// Get email statistics (admin only)
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get email statistics for the last N days
    const statsResult = await pool.query(
      `SELECT 
        email_type,
        status,
        COUNT(*) as count,
        DATE(created_at) as date
       FROM email_history
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY email_type, status, DATE(created_at)
       ORDER BY date DESC, email_type`
    );
    
    // Get total counts by type
    const totalByTypeResult = await pool.query(
      `SELECT 
        email_type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
       FROM email_history
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY email_type`
    );
    
    res.json({
      success: true,
      data: {
        dailyStats: statsResult.rows,
        totalByType: totalByTypeResult.rows
      }
    });
  } catch (error) {
    console.error('Get email stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get email statistics' });
  }
});

// Get user email preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      'SELECT * FROM email_preferences WHERE user_id = $1 ORDER BY email_type',
      [userId]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get email preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to get email preferences' });
  }
});

// Update user email preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_type, enabled, frequency } = req.body;
    
    if (!email_type) {
      return res.status(400).json({
        success: false,
        error: 'Email type is required'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO email_preferences (user_id, email_type, enabled, frequency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, email_type)
       DO UPDATE SET 
         enabled = EXCLUDED.enabled,
         frequency = EXCLUDED.frequency,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, email_type, enabled !== undefined ? enabled : true, frequency || 'daily']
    );
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update email preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update email preferences' });
  }
});

// Bulk update email preferences
router.put('/preferences/bulk', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;
    
    if (!Array.isArray(preferences)) {
      return res.status(400).json({
        success: false,
        error: 'Preferences must be an array'
      });
    }
    
    const results = [];
    
    for (const pref of preferences) {
      const { email_type, enabled, frequency } = pref;
      
      if (!email_type) continue;
      
      const result = await pool.query(
        `INSERT INTO email_preferences (user_id, email_type, enabled, frequency)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, email_type)
         DO UPDATE SET 
           enabled = EXCLUDED.enabled,
           frequency = EXCLUDED.frequency,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, email_type, enabled !== undefined ? enabled : true, frequency || 'daily']
      );
      
      results.push(result.rows[0]);
    }
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Bulk update email preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update email preferences' });
  }
});

// Get users who should receive emails based on preferences
export const getUsersForEmailType = async (emailType, frequency = 'daily') => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.username, ep.frequency
       FROM users u
       JOIN email_preferences ep ON u.id = ep.user_id
       WHERE ep.email_type = $1 
         AND ep.enabled = true
         AND ep.frequency = $2`,
      [emailType, frequency]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Get users for email type error:', error);
    return [];
  }
};

export default router; 