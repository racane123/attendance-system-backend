import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log('Auth middleware - Authorization header:', authHeader ? 'Present' : 'Missing');
  console.log('Auth middleware - Token:', token ? 'Present' : 'Missing');

  if (!token) {
    console.log('Auth middleware - No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Auth middleware - Token decoded successfully for user:', decoded.username);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth middleware - Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to check if user has required role
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Utility function to hash passwords
export const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Utility function to compare passwords
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Utility function to generate JWT token
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}; 