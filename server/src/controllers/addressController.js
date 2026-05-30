import * as AddressModel from '../models/Address.js';

/**
 * Obtener todas las direcciones del usuario
 */
export async function getUserAddresses(req, res) {
  try {
    const addresses = await AddressModel.getUserAddresses(req.user.id);

    res.json({
      addresses,
      total: addresses.length
    });
  } catch (error) {
    console.error('Error obteniendo direcciones:', error);
    res.status(500).json({ 
      error: 'Error obteniendo direcciones',
      detalles: error.message 
    });
  }
}

/**
 * Obtener dirección por defecto
 */
export async function getDefaultAddress(req, res) {
  try {
    const address = await AddressModel.getDefaultAddress(req.user.id);

    res.json({
      address: address || null
    });
  } catch (error) {
    console.error('Error obteniendo dirección por defecto:', error);
    res.status(500).json({ 
      error: 'Error obteniendo dirección por defecto',
      detalles: error.message 
    });
  }
}

/**
 * Crear nueva dirección
 */
export async function createAddress(req, res) {
  try {
    const { tipo, direccion, ciudad, telefono, notas, es_default } = req.body;

    if (!direccion || !direccion.trim()) {
      return res.status(400).json({ 
        error: 'La dirección es requerida' 
      });
    }

    const addressId = await AddressModel.createAddress({
      usuario_id: req.user.id,
      tipo: tipo || 'residencia',
      direccion,
      ciudad: ciudad || 'Giganta, Huila',
      telefono,
      notas,
      es_default: es_default ? 1 : 0
    });

    const newAddress = await AddressModel.getAddressById(addressId, req.user.id);

    res.status(201).json({
      mensaje: 'Dirección creada exitosamente',
      address: newAddress
    });
  } catch (error) {
    console.error('Error creando dirección:', error);
    res.status(500).json({ 
      error: 'Error creando dirección',
      detalles: error.message 
    });
  }
}

/**
 * Actualizar dirección
 */
export async function updateAddress(req, res) {
  try {
    const { id } = req.params;
    const { tipo, direccion, ciudad, telefono, notas, es_default } = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'ID de dirección es requerido' 
      });
    }

    const updateData = {};
    if (tipo !== undefined) updateData.tipo = tipo;
    if (direccion !== undefined) updateData.direccion = direccion;
    if (ciudad !== undefined) updateData.ciudad = ciudad;
    if (telefono !== undefined) updateData.telefono = telefono;
    if (notas !== undefined) updateData.notas = notas;
    if (es_default !== undefined) updateData.es_default = es_default ? 1 : 0;

    await AddressModel.updateAddress(id, req.user.id, updateData);

    const updatedAddress = await AddressModel.getAddressById(id, req.user.id);

    res.json({
      mensaje: 'Dirección actualizada exitosamente',
      address: updatedAddress
    });
  } catch (error) {
    console.error('Error actualizando dirección:', error);
    res.status(500).json({ 
      error: 'Error actualizando dirección',
      detalles: error.message 
    });
  }
}

/**
 * Eliminar dirección
 */
export async function deleteAddress(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'ID de dirección es requerido' 
      });
    }

    await AddressModel.deleteAddress(id, req.user.id);

    res.json({
      mensaje: 'Dirección eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando dirección:', error);
    res.status(500).json({ 
      error: 'Error eliminando dirección',
      detalles: error.message 
    });
  }
}

/**
 * Establecer dirección por defecto
 */
export async function setDefaultAddress(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        error: 'ID de dirección es requerido' 
      });
    }

    await AddressModel.setDefaultAddress(id, req.user.id);

    const updatedAddress = await AddressModel.getAddressById(id, req.user.id);

    res.json({
      mensaje: 'Dirección establecida por defecto',
      address: updatedAddress
    });
  } catch (error) {
    console.error('Error estableciendo dirección por defecto:', error);
    res.status(500).json({ 
      error: 'Error estableciendo dirección por defecto',
      detalles: error.message 
    });
  }
}

export default {
  getUserAddresses,
  getDefaultAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};

