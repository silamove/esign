const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

class AuthController {
  // Register a new user
  async register(req, res, next) {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Create user
      const user = await User.create({
        email,
        password,
        firstName,
        lastName
      });

      // Generate token
      const token = generateToken(user.id);

      res.status(201).json({
        success: true,
        data: {
          user: user.toJSON(),
          token
        },
        message: 'User registered successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Login user
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Authenticate user
      const user = await User.authenticate(email, password);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate token
      const token = generateToken(user.id);

      res.json({
        success: true,
        data: {
          user: user.toJSON(),
          token
        },
        message: 'Login successful'
      });
    } catch (error) {
      next(error);
    }
  }

  // Forgot password
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal whether email exists or not
        return res.json({
          success: true,
          message: 'If the email exists, a reset link has been sent'
        });
      }

      // TODO: Implement email sending logic
      // For now, just return success
      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });
    } catch (error) {
      next(error);
    }
  }

  // Refresh token
  async refreshToken(req, res, next) {
    try {
      // User is already authenticated through middleware
      const token = generateToken(req.user.id);

      res.json({
        success: true,
        data: {
          user: req.user.toJSON(),
          token
        },
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
