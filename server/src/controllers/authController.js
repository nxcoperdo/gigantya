import { generateToken, generateRefreshToken } from '../middleware/authMiddleware.js';
import * as UserModel from '../models/User.js';
import { query, queryOne } from '../config/database.js';
import { sendEmail } from '../services/notificationService.js';
import crypto from 'crypto';

/**
 * Registro de nuevo usuario
 */
export async function register(req, res) {
  try {
    const nombre = req.body.nombre;
    const email = req.body.email;
    const telefono = req.body.telefono;
    const contrasena = req.body.contrasena;
    const contrasena_confirmacion = req.body.contrasena_confirmacion;
    const tipo_usuario = 'cliente';
    const documento_identidad = req.body.documento_identidad;

    // Validaciones básicas
    if (!nombre || !email || !telefono || !contrasena || !tipo_usuario) {
      return res.status(400).json({ 
        error: 'Campos requeridos faltando: nombre, email, telefono, contrasena, tipo_usuario' 
      });
    }

    if (contrasena !== contrasena_confirmacion) {
      return res.status(400).json({ 
        error: 'Las contraseñas no coinciden' 
      });
    }

    if (contrasena.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    if (req.body.tipo_usuario && req.body.tipo_usuario !== 'cliente') {
      return res.status(400).json({ 
        error: 'En esta plataforma solo se permiten registros de clientes. Los restaurantes se gestionan de forma manual con mensualidad.' 
      });
    }

    // Verificar si el email ya existe
    const usuarioExistente = await UserModel.getUserByEmail(email);
    if (usuarioExistente) {
      return res.status(409).json({ 
        error: 'El email ya está registrado' 
      });
    }

    // Crear usuario
    const userId = await UserModel.createUser({
      nombre,
      email,
      telefono,
      contrasena,
      tipo_usuario,
      documento_identidad
    });

    const usuario = await UserModel.getUserById(userId);

    // Generar token
    const token = generateToken(usuario);
    const refreshToken = generateRefreshToken(userId);

    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      error: 'Error registrando usuario',
      detalles: error.message 
    });
  }
}

/**
 * Login de usuario
 */
export async function login(req, res) {
  try {
    const email = req.body.email;
    const contrasena = req.body.contrasena;

    if (!email || !contrasena) {
      return res.status(400).json({ 
        error: 'Email y contrasena son requeridos' 
      });
    }

    // Buscar usuario
    const usuario = await UserModel.getUserByEmail(email);
    if (!usuario) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Verificar contraseña
    const contrasenaValida = await UserModel.verifyPassword(contrasena, usuario.contrasena_hash);
    if (!contrasenaValida) {
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Generar tokens
    const token = generateToken(usuario);
    const refreshToken = generateRefreshToken(usuario.id);

    // Log del login exitoso
    console.log(`✅ Login exitoso: ${usuario.email} (${usuario.tipo_usuario})`);

    res.json({
      mensaje: 'Login exitoso',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      error: 'Error en login',
      detalles: error.message 
    });
  }
}

/**
 * Obtener perfil del usuario actual
 */
export async function getProfile(req, res) {
  try {
    const usuario = await UserModel.getUserProfile(req.user.id);

    if (!usuario) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado' 
      });
    }

    res.json({
      usuario
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ 
      error: 'Error obteniendo perfil',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar perfil
 */
export async function updateProfile(req, res) {
  try {
    const { nombre, telefono } = req.body;

    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (telefono) updateData.telefono = telefono;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        error: 'No hay datos para actualizar' 
      });
    }

    await UserModel.updateUser(req.user.id, updateData);

    const usuario = await UserModel.getUserById(req.user.id);

    res.json({
      mensaje: 'Perfil actualizado exitosamente',
      usuario
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ 
      error: 'Error actualizando perfil',
      detalles: error.message 
    });
  }
}

/**
 * Cambiar contraseña
 */
export async function changePassword(req, res) {
  try {
    const contrasena_actual = req.body.contrasena_actual;
    const contrasena_nueva = req.body.contrasena_nueva;
    const contrasena_confirmacion = req.body.contrasena_confirmacion;

    if (!contrasena_actual || !contrasena_nueva || !contrasena_confirmacion) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos' 
      });
    }

    if (contrasena_nueva !== contrasena_confirmacion) {
      return res.status(400).json({ 
        error: 'Las nuevas contraseñas no coinciden' 
      });
    }

    if (contrasena_nueva.length < 6) {
      return res.status(400).json({ 
        error: 'La nueva contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Verificar contraseña actual
    const usuario = await UserModel.getUserByEmail(req.user.email);
    const contrasenaValida = await UserModel.verifyPassword(contrasena_actual, usuario.contrasena_hash);

    if (!contrasenaValida) {
      return res.status(401).json({ 
        error: 'La contraseña actual es incorrecta' 
      });
    }

    // Cambiar contraseña
    await UserModel.changePassword(req.user.id, contrasena_nueva);

    res.json({
      mensaje: 'Contraseña cambiada exitosamente'
    });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ 
      error: 'Error cambiando contraseña',
      detalles: error.message 
    });
  }
}

/**
 * Solicitar reseteo de contraseña
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    const usuario = await UserModel.getUserByEmail(email);

    // Siempre respondemos éxito para no revelar si el email existe
    if (!usuario) {
      return res.json({
        mensaje: 'Si el email está registrado, recibirás un enlace para resetear tu contraseña'
      });
    }

    // Generar token de reset (válido por 1 hora)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpira = new Date(Date.now() + 3600000); // 1 hora

    await query(
      `INSERT INTO password_reset_tokens (usuario_id, token, expira_en)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token = ?, expira_en = ?`,
      [usuario.id, resetToken, resetTokenExpira, resetToken, resetTokenExpira]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Plantilla de email para reseteo de contraseña
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">🔐 Recuperar Contraseña</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Hola <strong>${usuario.nombre}</strong>,</p>
          <p style="font-size: 16px; color: #555;">Has solicitado resetear tu contraseña. Haz clic en el botón de abajo para establecer una nueva:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Resetear Contraseña
            </a>
          </div>

          <p style="font-size: 14px; color: #777;">O copia y pega este enlace en tu navegador:</p>
          <p style="font-size: 12px; color: #999; word-break: break-all;">${resetUrl}</p>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; font-size: 14px;"><strong>⚠️ Importante:</strong> Este enlace expira en 1 hora por seguridad.</p>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #666;">Si no solicitaste este cambio, puedes ignorar este email.</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="font-size: 14px; color: #999;">GigantYA - Tu plataforma de pedidos</p>
          </div>
        </div>
      </div>
    `;

    // Enviar email
    const emailResult = await sendEmail({
      to: email,
      subject: '🔐 Recuperar Contraseña - GigantYA',
      html: emailHtml
    });

    if (emailResult.sent) {
      console.log(`📧 Email de recuperación enviado a ${email}: ${emailResult.messageId}`);
    } else {
      console.log(`⚠️ Email no enviado a ${email}: ${emailResult.reason || emailResult.error}`);
    }

    res.json({
      mensaje: 'Si el email está registrado, recibirás un enlace para resetear tu contraseña'
    });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({
      error: 'Error procesando solicitud',
      detalles: error.message
    });
  }
}

/**
 * Resetear contraseña con token
 */
export async function resetPassword(req, res) {
  try {
    const { token, nueva_contrasena } = req.body;

    if (!token || !nueva_contrasena) {
      return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });
    }

    if (nueva_contrasena.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar token
    const resetRecord = await queryOne(
      `SELECT usuario_id, expira_en FROM password_reset_tokens
       WHERE token = ?`,
      [token]
    );

    if (!resetRecord) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    if (new Date(resetRecord.expira_en) < new Date()) {
      await query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
      return res.status(400).json({ error: 'Token expirado' });
    }

    // Actualizar contraseña
    await UserModel.changePassword(resetRecord.usuario_id, nueva_contrasena);

    // Eliminar token usado
    await query('DELETE FROM password_reset_tokens WHERE token = ?', [token]);

    res.json({
      mensaje: 'Contraseña reseteada exitosamente'
    });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({
      error: 'Error reseteando contraseña',
      detalles: error.message
    });
  }
}

export default {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
};
